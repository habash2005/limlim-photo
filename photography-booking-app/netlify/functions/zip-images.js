import archiver from "archiver";
import { Readable } from "node:stream";
import { Buffer } from "node:buffer";

const MAX_FILES = 300;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200MB

async function fetchToBuffer(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Fetch ${resp.status} for ${url} - ${t.slice(0,200)}`);
  }
  const ab = await resp.arrayBuffer();
  return Buffer.from(ab);
}
function originalUrl(cloudName, publicId, format) {
  return `https://res.cloudinary.com/${cloudName}/image/upload/fl_attachment/${publicId}.${format}`;
}

async function zipFromCloudinary({ cloudName, items, zipName }) {
  if (!cloudName) throw new Error("cloudName required");
  if (!Array.isArray(items) || items.length === 0) throw new Error("items[] required");
  if (items.length > MAX_FILES) throw new Error(`Too many files (>${MAX_FILES})`);

  const archive = archiver("zip", { zlib: { level: 0 } }); // store only
  const chunks = [];
  let total = 0;

  archive.on("data", (c) => {
    chunks.push(c);
    total += c.length;
    if (total > MAX_TOTAL_BYTES) archive.abort();
  });

  const done = new Promise((res, rej) => {
    archive.on("error", rej);
    archive.on("end", res);
    archive.on("close", res);
  });

  for (const it of items) {
    const { public_id, format } = it || {};
    if (!public_id || !format) continue;
    const name = `${public_id.split("/").pop()}.${format}`;
    const url = originalUrl(cloudName, public_id, format);
    const buf = await fetchToBuffer(url);
    archive.append(Readable.from(buf), { name });
  }

  await archive.finalize();
  await done;

  const zipBuffer = Buffer.concat(chunks);
  if (!zipBuffer.length) throw new Error("ZIP empty");
  return { zipBuffer, zipName };
}

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  try {
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers };
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    let body;
    try { body = JSON.parse(event.body || "{}"); }
    catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

    const cloud =
      body.cloud_name ||
      process.env.CLOUDINARY_CLOUD_NAME ||
      process.env.VITE_CLOUDINARY_CLOUD_NAME;

    const items = body.items || [];
    const filename = body.filename || "images.zip";

    const { zipBuffer, zipName } = await zipFromCloudinary({
      cloudName: cloud,
      items,
      zipName: filename,
    });

    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
        "Content-Length": String(zipBuffer.length),
      },
      isBase64Encoded: true,
      body: zipBuffer.toString("base64"),
    };
  } catch (e) {
    console.error("[zip-images] error:", e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Zip failed", detail: String(e.message || e) }) };
  }
};
