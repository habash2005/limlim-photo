// netlify/functions/cloudinary-zip.js
export const handler = async (event) => {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
    };
  
    // Handle preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers };
    }
  
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }
  
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Missing Cloudinary env vars" }),
      };
    }
  
    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON" }),
      };
    }
  
    const { public_ids = [], tag = null, filename = "gallery.zip" } = payload;
  
    if ((!public_ids || public_ids.length === 0) && !tag) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Provide public_ids[] or tag" }),
      };
    }
  
    // ✅ Correct Admin API endpoint (must include `/upload/`)
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/image/upload/generate_archive`;
    const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString("base64");
  
    // Prepare body based on tag or public_ids
    const body = tag
      ? {
          tags: [tag], // Cloudinary requires `tags` array
          target_format: "zip",
          resource_type: "image",
          flatten_folders: true,
          mode: "download",
          async: false,
          expires_at: Math.floor(Date.now() / 1000) + 60 * 10, // 10 min expiry
        }
      : {
          public_ids,
          target_format: "zip",
          resource_type: "image",
          flatten_folders: true,
          mode: "download",
          async: false,
          expires_at: Math.floor(Date.now() / 1000) + 60 * 10,
        };
  
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
  
      const text = await resp.text();
      const data = text ? JSON.parse(text) : {};
  
      if (!resp.ok) {
        console.error("Cloudinary archive error", { status: resp.status, data });
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({
            error: "Cloudinary error",
            status: resp.status,
            detail: data,
          }),
        };
      }
  
      // ✅ Success: return signed ZIP URL
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, url: data.url, filename }),
      };
    } catch (e) {
      console.error("Archive request failed:", e);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Archive failed", detail: String(e) }),
      };
    }
  };
  