// netlify/functions/cloudinary-zip.js
import crypto from "node:crypto";

/** Build Cloudinary signature (SHA-1) for Upload API */
function signParams(params, apiSecret) {
  // Remove undefined/empty
  const clean = Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)
    )
  );

  // Arrays must be comma-joined for signing
  const toSign = Object.keys(clean)
    .sort()
    .map((k) => {
      const v = Array.isArray(clean[k]) ? clean[k].join(",") : clean[k];
      return `${k}=${v}`;
    })
    .join("&") + apiSecret;

  return crypto.createHash("sha1").update(toSign).digest("hex");
}

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Missing Cloudinary env vars" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { public_ids = [], filename = "gallery.zip" } = payload;
  if (!Array.isArray(public_ids) || public_ids.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "public_ids[] is required" }) };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);

    // Params to sign (Cloudinary expects arrays comma-joined when signing)
    const paramsToSign = {
      mode: "download",
      public_ids: public_ids,           // array here; signParams will comma-join
      resource_type: "image",
      target_format: "zip",
      timestamp,
      type: "upload",
      use_original_filename: true,
    };

    const signature = signParams(paramsToSign, CLOUDINARY_API_SECRET);

    // Build x-www-form-urlencoded body:
    // public_ids must be sent as multiple public_ids[] fields.
    const form = new URLSearchParams();
    public_ids.forEach((id) => form.append("public_ids[]", id));
    form.set("mode", "download");
    form.set("resource_type", "image");
    form.set("target_format", "zip");
    form.set("type", "upload");
    form.set("use_original_filename", "true");
    form.set("timestamp", String(timestamp));
    form.set("api_key", CLOUDINARY_API_KEY);
    form.set("signature", signature);

    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/download_zip_url`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const text = await resp.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; }
    catch { data = { raw: text }; } // if Cloudinary ever returns HTML again, we capture it

    if (!resp.ok || !data?.zip_url) {
      console.error("Cloudinary download_zip_url error", { status: resp.status, data });
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: "Cloudinary error", status: resp.status, detail: data }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, url: data.zip_url, filename }),
    };
  } catch (e) {
    console.error("Archive (download_zip_url) failed:", e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Archive failed", detail: String(e) }) };
  }
};
