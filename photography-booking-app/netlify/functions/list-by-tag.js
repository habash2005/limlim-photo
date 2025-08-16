// netlify/functions/list-by-tag.js
import { v2 as cloudinary } from "cloudinary";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

function parseBodyOrQS(event) {
  // Try JSON body
  try {
    if (event.body) {
      const b = JSON.parse(event.body);
      if (b && (b.tag || b.max_results || b.next_cursor)) return b;
    }
  } catch {}
  // Try query string as a fallback
  const params = new URLSearchParams(event.queryStringParameters || {});
  const tag = (params.get("tag") || "").trim();
  const max_results = params.get("max_results");
  const next_cursor = params.get("next_cursor");
  return {
    tag,
    max_results: max_results ? Number(max_results) : undefined,
    next_cursor: next_cursor || undefined,
  };
}

function normalize(items = []) {
  return items.map((r) => ({
    public_id: r.public_id,
    format: r.format,
    width: r.width,
    height: r.height,
    bytes: r.bytes,
    created_at: r.created_at,
    secure_url: r.secure_url,
  }));
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS };
  }
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: CORS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Env
  const {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
  } = process.env || {};
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({
        error: "Missing Cloudinary env vars",
        expect: [
          "CLOUDINARY_CLOUD_NAME",
          "CLOUDINARY_API_KEY",
          "CLOUDINARY_API_SECRET",
        ],
      }),
    };
  }

  // Parse inputs (body or ?tag=)
  const { tag: rawTag, max_results, next_cursor } = parseBodyOrQS(event);
  const tag = (rawTag || "").trim();
  const maxResults = Math.min(Number(max_results || 100), 500);

  if (!tag) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({
        error: "Missing 'tag'. Send in JSON body {tag:\"...\"} or as ?tag=... ",
      }),
    };
  }

  // Configure Cloudinary
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  // Try Search API
  try {
    const expr = `tags="${tag}"`; // quotes handle dashes/spaces
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
    // Fall back to Admin API
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
      // Send full diagnostics back
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({
          error: "List failed",
          tag,
          detail: {
            search_error: String(err1?.message || err1),
            admin_error: String(err2?.message || err2),
          },
          hint:
            "Verify tag exists on your images (case-sensitive), cloud_name is correct, and API key/secret belong to that cloud.",
        }),
      };
    }
  }
};
