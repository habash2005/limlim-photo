// netlify/functions/zip-images.js
export const handler = async (event) => {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: "Method not allowed" }) };
    }
  
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "Missing Cloudinary env vars" }) };
    }
  
    let payload = {};
    try { payload = JSON.parse(event.body || "{}"); } catch {}
    const { public_ids = [], filename = "images.zip" } = payload;
    if (!Array.isArray(public_ids) || public_ids.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "public_ids[] required" }) };
    }
  
    const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString("base64");
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/generate_archive`;
  
    const body = JSON.stringify({
      public_ids,
      resource_type: "image",
      target_format: "zip",
      flatten_folders: true,
      mode: "download",      // return a direct URL
      async: false,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 15,
    });
  
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body,
      });
  
      const text = await resp.text();
      const data = text ? JSON.parse(text) : {};
  
      if (!resp.ok || !data.url) {
        console.error("Cloudinary archive error", { status: resp.status, data });
        return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: "Cloudinary error", detail: data }) };
      }
  
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, url: data.url, filename }) };
    } catch (e) {
      console.error("zip-images failed", e);
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "Archive failed", detail: String(e) }) };
    }
  };
  