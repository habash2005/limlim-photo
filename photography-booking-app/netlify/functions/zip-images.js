// netlify/functions/zip-images.js
import { v2 as cloudinary } from "cloudinary";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Missing Cloudinary env vars" }) };
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}
  const public_ids = Array.isArray(body.public_ids) ? body.public_ids.filter(Boolean) : [];
  const filename = body.filename || "images.zip";

  if (!public_ids.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "public_ids[] required" }) };
  }

  try {
    // SDK builds a signed, time-limited download URL for the ZIP
    const url = cloudinary.utils.download_zip_url({
      resource_type: "image",
      public_ids,
      flatten_folders: true,
      target_public_id: filename.replace(/\.zip$/i, ""), // name without .zip
    });

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, url }) };
  } catch (e) {
    console.error("zip-images error:", e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Archive failed", detail: e?.message || String(e) }) };
  }
};
