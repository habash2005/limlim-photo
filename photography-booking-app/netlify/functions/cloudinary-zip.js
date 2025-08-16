// netlify/functions/cloudinary-zip.js
import crypto from "node:crypto";

function signParams(params, apiSecret) {
  // Cloudinary signing: sort keys asc, join as key=value (arrays joined by ',')
  const toSign = Object.keys(params)
    .sort()
    .map((k) => {
      const v = Array.isArray(params[k]) ? params[k].join(",") : params[k];
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
    // Build Upload API signed request for download_zip_url
    const timestamp = Math.floor(Date.now() / 1000);

    // Params to sign (see Cloudinary Upload API docs)
    const paramsToSign = {
      mode: "download",
      public_ids,            // array of full public_ids (with folders), no extensions
      resource_type: "image",
      target_format: "zip",
      timestamp,
      type: "upload",
      use_original_filename: true,
      // optional: target_public_id: filename.replace(/\.zip$/i, "") // if you want the zip to have a stable public_id
    };

    const signature = signParams(paramsToSign, CLOUDINARY_API_SECRET);

    // Final body (include api_key + signature)
    const body = {
      ...paramsToSign,
      api_key: CLOUDINARY_API_KEY,
      signature,
    };

    // Upload API endpoint
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/download_zip_url`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    const data = text ? JSON.parse(text) : {};

    if (!resp.ok) {
      // Bubble response so you can see exact reason in logs
      console.error("Cloudinary download_zip_url error", { status: resp.status, data });
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: "Cloudinary error", status: resp.status, detail: data }),
      };
    }

    // data.zip_url is the direct, one-time downloadable URL
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
