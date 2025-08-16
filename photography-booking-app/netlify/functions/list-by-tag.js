// netlify/functions/list-by-tag.js
import { v2 as cloudinary } from "cloudinary";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

function normalize(resources = []) {
  return resources.map((r) => ({
    public_id: r.public_id,
    format: r.format,
    bytes: r.bytes,
    width: r.width,
    height: r.height,
    secure_url: r.secure_url,
    original_filename: r.original_filename || r.public_id.split("/").pop(),
    tags: r.tags || [],
  }));
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "Missing Cloudinary env vars" }) };
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  // accept GET or POST
  const qsTag = event.queryStringParameters?.tag;
  let bodyTag = "";
  if (event.httpMethod === "POST" && event.body) {
    try { bodyTag = JSON.parse(event.body)?.tag || ""; } catch {}
  }
  const tag = (bodyTag || qsTag || "").trim();
  if (!tag) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Missing tag" }) };

  // 1) Try Admin API: resources_by_tag (most reliable)
  try {
    const res1 = await cloudinary.api.resources_by_tag(tag, {
      resource_type: "image",
      max_results: 500,
    });
    if (res1?.resources?.length) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, source: "by_tag", count: res1.resources.length, resources: normalize(res1.resources) }),
      };
    }
  } catch (e) {
    // proceed to fallback
    console.warn("list-by-tag: resources_by_tag failed, will fallback to search:", e?.message || e);
  }

  // 2) Fallback: Search API
  try {
    const res2 = await cloudinary.search
      .expression(`resource_type:image AND tags=${tag}`)
      .max_results(500)
      .execute();

    if (Array.isArray(res2?.resources)) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, source: "search", count: res2.resources.length, resources: normalize(res2.resources) }),
      };
    }
    return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: "Cloudinary search returned no resources", detail: res2 }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "List failed", detail: e?.message || String(e) }) };
  }
};
