// netlify/functions/list-by-tag.js
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
  
    const tag = (event.queryStringParameters?.tag || "").trim();
    if (!tag) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Missing tag" }) };
  
    const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString("base64");
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/search`;
    const body = JSON.stringify({
      expression: `resource_type:image AND tags=${tag}`,
      max_results: 500,
    });
  
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body,
      });
  
      const text = await resp.text();
      const data = text ? JSON.parse(text) : {};
  
      if (!resp.ok) {
        console.error("Cloudinary search error", { status: resp.status, data });
        return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: "Cloudinary error", detail: data }) };
      }
  
      const resources = (data.resources || []).map((r) => ({
        public_id: r.public_id,
        format: r.format,
        bytes: r.bytes,
        width: r.width,
        height: r.height,
        secure_url: r.secure_url,
        original_filename: r.original_filename || r.public_id.split("/").pop(),
        tags: r.tags || [],
      }));
  
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, count: resources.length, resources }) };
    } catch (e) {
      console.error("list-by-tag failed", e);
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "List failed", detail: String(e) }) };
    }
  };
  