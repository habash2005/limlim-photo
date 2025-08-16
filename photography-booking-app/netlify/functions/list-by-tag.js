// netlify/functions/list-by-tag.js
import { v2 as cloudinary } from "cloudinary";

export const handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // ---- Env vars ----
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: "Missing Cloudinary env vars (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET)" }),
    };
  }

  // ---- Parse body ----
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }
  const tag = (body.tag || "").trim();
  const maxResults = Math.min(Number(body.max_results || 100), 500); // cap
  const nextCursor = body.next_cursor || undefined;

  if (!tag) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Missing 'tag' in request body" }) };
  }

  // ---- Configure SDK ----
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  // Helper to normalize results
  const normalize = (items = []) =>
    items.map((r) => ({
      public_id: r.public_id,
      format: r.format,
      width: r.width,
      height: r.height,
      bytes: r.bytes,
      created_at: r.created_at,
      secure_url: r.secure_url, // original delivery URL (no transforms applied unless you add them client-side)
    }));

  try {
    // 1) Try the Search API (most flexible & robust)
    // Tag expressions with hyphens/spaces should be quoted.
    const expr = `tags="${tag}"`;

    const search = cloudinary.search
      .expression(expr)
      .with_field("tags")
      .sort_by("public_id", "asc")
      .max_results(maxResults);

    if (nextCursor) search.next_cursor(nextCursor);

    const res = await search.execute();

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        ok: true,
        source: "search",
        count: (res.resources || []).length,
        next_cursor: res.next_cursor || null,
        resources: normalize(res.resources),
      }),
    };
  } catch (err1) {
    console.error("[list-by-tag] Search API failed:", err1?.message || err1);

    // 2) Fallback to Admin API: resources_by_tag
    try {
      const res2 = await cloudinary.api.resources_by_tag(tag, {
        max_results: maxResults,
        next_cursor: nextCursor,
      });

      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({
          ok: true,
          source: "resources_by_tag",
          count: (res2.resources || []).length,
          next_cursor: res2.next_cursor || null,
          resources: normalize(res2.resources),
        }),
      };
    } catch (err2) {
      console.error("[list-by-tag] resources_by_tag failed:", err2?.message || err2);
      // Return full details to help you diagnose from the client console
      return {
        statusCode: 500,
        headers: cors,
        body: JSON.stringify({
          error: "List failed",
          detail: err2?.message || String(err2),
        }),
      };
    }
  }
};
