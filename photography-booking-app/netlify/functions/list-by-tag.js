// netlify/functions/list-by-tag.js
export const handler = async (event) => {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };
  
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "Missing Cloudinary env vars" }) };
    }
  
    // accept GET or POST
    const qsTag = event.queryStringParameters?.tag;
    let bodyTag = "";
    if (event.httpMethod === "POST" && event.body) {
      try {
        const b = JSON.parse(event.body);
        bodyTag = b?.tag || "";
      } catch {}
    }
    const tag = (bodyTag || qsTag || "").trim();
    if (!tag) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Missing tag" }) };
  
    const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString("base64");
  
    // Helper to normalize resources
    const normalize = (arr = []) =>
      arr.map((r) => ({
        public_id: r.public_id,
        format: r.format,
        bytes: r.bytes,
        width: r.width,
        height: r.height,
        secure_url: r.secure_url,
        original_filename: r.original_filename || r.public_id.split("/").pop(),
        tags: r.tags || [],
      }));
  
    // --- Attempt 1: Admin API "resources by tag"
    try {
      const byTagUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/by_tag/${encodeURIComponent(tag)}?resource_type=image&max_results=500`;
      const r1 = await fetch(byTagUrl, { headers: { Authorization: `Basic ${auth}` } });
      const t1 = await r1.text();
      const d1 = t1 ? JSON.parse(t1) : {};
      if (r1.ok && Array.isArray(d1.resources) && d1.resources.length > 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, source: "by_tag", count: d1.resources.length, resources: normalize(d1.resources) }) };
      }
    } catch (e) {
      // fall through to search
      console.warn("by_tag failed, trying search:", e);
    }
  
    // --- Attempt 2: Search API (fallback)
    try {
      const searchUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/search`;
      const r2 = await fetch(searchUrl, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({ expression: `resource_type:image AND tags=${tag}`, max_results: 500 }),
      });
      const t2 = await r2.text();
      const d2 = t2 ? JSON.parse(t2) : {};
      if (r2.ok && Array.isArray(d2.resources)) {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, source: "search", count: d2.resources.length, resources: normalize(d2.resources) }) };
      }
      return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: "Cloudinary error", detail: d2 }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "List failed", detail: String(e) }) };
    }
  };
  