// netlify/functions/zip-images.js
import { v2 as cloudinary } from "cloudinary";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env || {};
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Missing Cloudinary env vars" }) };
    }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const public_ids = Array.isArray(body.public_ids) ? body.public_ids : [];
  const filename = (body.filename || "photos.zip").replace(/[^\w.\-]/g, "_");
  if (!public_ids.length) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Provide public_ids[]" }) };
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  try {
    // Cloudinary "generate_archive" via SDK
    const res = await cloudinary.utils.download_folder
      ? // If SDK has helper (older v1 sometimes exposes helpers)
        cloudinary.utils.download_multiple(public_ids, { resource_type: "image", target_public_id: filename })
      : // Use Admin API directly
        cloudinary.api.create_zip({
          public_ids,
          resource_type: "image",
          flatten_folders: true,
          target_public_id: filename.replace(/\.zip$/i, ""),
        });

    // Different SDK methods return different shapes; normalize
    const url = typeof res === "string" ? res : res?.url || res?.secure_url;
    if (!url) throw new Error("No archive URL returned");

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, url }) };
  } catch (e) {
    console.error("[zip-images] error:", e?.message || e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Archive failed", detail: e?.message || String(e) }) };
  }
};
