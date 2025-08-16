// netlify/functions/list-by-tag.js
import { v2 as cloudinary } from "cloudinary";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

function parseBodyOrQS(event) {
  // Try JSON body first
  try {
    if (event.body) {
      const b = JSON.parse(event.body);
      if (b && (b.tag || b.max_results || b.next_cursor)) return b;
    }
  } catch {}
  // Fallback to querystring (?tag=..., ?max_results=..., ?next_cursor=...)
  const qs = new URLSearchParams(event.queryStringParameters || {});
  return {
    tag: (qs.get("tag") || "").trim(),
    max_results: qs.get("max_results") ? Number(qs.get("max_results")) : undefined,
    next_cursor: qs.get("next_cursor") || undefined,
  };
}

const normalize = (items = []) =>
  items.map((r) => ({
    public_id: r.public_id,
    format: r.format,
    width: r.width,
    height: r.height,
    bytes: r.bytes,
    created_at: r.created_at,
    secure_url: r.secure_url,
    // include tags for sanity checks in dev (safe—already public metadata)
    tags: r.tags || [],
    folder: r.folder || "",
  }));

function errShape(e) {
  return {
    name: e?.name || null,
    message: e?.message || String(e),
    http_code: e?.http_code || e?.status || null,
    response_body: e?.response?.body || null, // <- Cloudinary puts useful text here
    raw: (() => { try { return JSON.parse(JSON.stringify(e)); } catch { return String(e); } })(),
  };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS };
  if (!["POST", "GET"].includes(event.httpMethod)) {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env || {};
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({
        error: "Missing Cloudinary env vars",
        expect: ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
      }),
    };
  }

  const { tag: rawTag, max_results, next_cursor } = parseBodyOrQS(event);
  const tag = (rawTag || "").trim();
  const maxResults = Math.min(Number(max_results || 100), 500);
  if (!tag) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({
        error: "Missing 'tag'. Send JSON { tag:\"...\" } or use ?tag=... in the URL.",
      }),
    };
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  // Try Search API first (handles hyphens/spaces in tag with quotes)
  try {
    const expr = `tags="${tag}"`;
    const search = cloudinary.search
      .expression(expr)
      .with_field("tags")
      .sort_by("public_id", "asc")
      .max_results(maxResults);
    if (next_cursor) search.next_cursor(next_cursor);

    const r = await search.execute();

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        source: "search",
        tag,
        count: (r.resources || []).length,
        next_cursor: r.next_cursor || null,
        resources: normalize(r.resources),
      }),
    };
  } catch (err1) {
    console.error("[list-by-tag] Search API failed:", errShape(err1));

    // Fallback to Admin API
    try {
      const r2 = await cloudinary.api.resources_by_tag(tag, {
        max_results: maxResults,
        next_cursor,
      });

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          ok: true,
          source: "resources_by_tag",
          tag,
          count: (r2.resources || []).length,
          next_cursor: r2.next_cursor || null,
          resources: normalize(r2.resources),
        }),
      };
    } catch (err2) {
      console.error("[list-by-tag] resources_by_tag failed:", errShape(err2));
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({
          error: "List failed",
          tag,
          search_error: errShape(err1),
          admin_error: errShape(err2),
          hint:
            "Verify the exact tag (case-sensitive) exists on assets. Also confirm CLOUDINARY_CLOUD_NAME is the account that holds those assets. If Search API is restricted on your plan, the Admin fallback must succeed.",
        }),
      };
    }
  }
};
