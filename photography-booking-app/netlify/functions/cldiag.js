// netlify/functions/cldiag.js
import { v2 as cloudinary } from "cloudinary";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS };
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({
        error: "Missing Cloudinary env vars",
        CLOUDINARY_CLOUD_NAME: CLOUDINARY_CLOUD_NAME || null,
        CLOUDINARY_API_KEY_tail: CLOUDINARY_API_KEY ? CLOUDINARY_API_KEY.slice(-4) : null,
      }),
    };
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  // read tag from body or query
  let tag = "";
  try {
    if (event.body) tag = (JSON.parse(event.body).tag || "").trim();
  } catch {}
  if (!tag && event.queryStringParameters?.tag) tag = event.queryStringParameters.tag.trim();

  try {
    // basic auth check
    const ping = await cloudinary.api.ping(); // { status: "ok" }
    // try a tiny sample call so we see *something* even if tag is empty
    const sample = await cloudinary.api.resources({ max_results: 1 });

    let byTag = null;
    if (tag) {
      try {
        byTag = await cloudinary.api.resources_by_tag(tag, { max_results: 5 });
      } catch (e) {
        byTag = { error: String(e && e.message ? e.message : e) };
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        ping,
        cloud: CLOUDINARY_CLOUD_NAME,
        key_tail: CLOUDINARY_API_KEY.slice(-4),
        sample_count: (sample.resources || []).length,
        tag,
        byTag_count: byTag?.resources ? byTag.resources.length : 0,
        byTag_error: byTag && byTag.error ? byTag.error : null,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({
        error: "Diag failed",
        detail: String(err?.message || err),
      }),
    };
  }
};
