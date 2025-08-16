// netlify/functions/cloudinary-zip.js
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
  
    // Admin API: must include `/upload/`
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/image/upload/generate_archive`;
    const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString("base64");
  
    const body = {
      public_ids,                 // full paths like "client-galleries/abc123"
      target_format: "zip",
      resource_type: "image",
      flatten_folders: true,
      mode: "download",           // return a one-time URL
      async: false,
      expires_at: Math.floor(Date.now() / 1000) + 600, // 10 min
    };
  
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
  
      const text = await resp.text();
      const data = text ? JSON.parse(text) : {};
  
      if (!resp.ok) {
        console.error("Cloudinary archive error", { status: resp.status, data });
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({ error: "Cloudinary error", status: resp.status, detail: data }),
        };
      }
  
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, url: data.url, filename }) };
    } catch (e) {
      console.error("Archive request failed:", e);
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Archive failed", detail: String(e) }) };
    }
  };
  