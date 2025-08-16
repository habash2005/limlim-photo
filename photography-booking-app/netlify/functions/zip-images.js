// netlify/functions/zip-images.js
import { PassThrough } from "node:stream";
import archiver from "archiver";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // Cloud name is all we need (we fetch originals via public URLs)
  const { CLOUDINARY_CLOUD_NAME } = process.env;
  if (!CLOUDINARY_CLOUD_NAME) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Missing CLOUDINARY_CLOUD_NAME env var" }),
    };
  }

  // Parse body
  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  const filename = String(payload.filename || "photos.zip")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  if (items.length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "No items to zip" }) };
  }

  // Prepare archiver piping into an in-memory stream
  const zip = archiver("zip", { zlib: { level: 9 } });
  const passthrough = new PassThrough();
  zip.pipe(passthrough);

  // Collect chunks from the stream
  const chunks = [];
  const collect = new Promise((resolve, reject) => {
    passthrough.on("data", (chunk) => chunks.push(chunk));
    passthrough.on("end", resolve);
    passthrough.on("error", reject);
  });

  try {
    // Fetch each original file and append to archive
    for (const it of items) {
      const public_id = String(it.public_id || "").trim();
      const format = String(it.format || "").trim();

      if (!public_id || !format) continue;

      // Original file URL (no transforms). We don't need fl_attachment for fetching.
      const url = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${public_id}.${format}`;

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        // Skip missing/broken assets instead of failing the whole zip
        // You can `throw` here if you prefer strict mode.
        continue;
      }

      const arrBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrBuf);
      const base = public_id.split("/").pop() || "image";
      zip.append(buf, { name: `${base}.${format}` });
    }

    await zip.finalize();
    await collect;

    const zipBuf = Buffer.concat(chunks);

    return {
      statusCode: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
      body: zipBuf.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    console.error("[zip-images] Failed:", e);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "ZIP failed", detail: String(e) }),
    };
  }
};
