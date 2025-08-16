// netlify/functions/cldiag.js
import { v2 as cloudinary } from "cloudinary";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

function shapeError(e) {
  return {
    name: e?.name || null,
    message: e?.message || String(e),
    http_code: e?.http_code || e?.status || null,
    // Cloudinary admin/search errors usually include a response body
    response_body: e?.response?.body || null,
    raw: (() => { try { return JSON.parse(JSON.stringify(e)); } catch { return String(e); } })(),
  };
}

function mask(val, keep = 4) {
  if (!val || typeof val !== "string") return null;
  if (val.length <= keep) return val;
  return `${val.slice(0, 2)}…${val.slice(-keep)}`;
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS };
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // Parse input tag if present (JSON body or ?tag=)
  let tag = "";
  try {
    if (event.body) {
      const b = JSON.parse(event.body);
      if (b?.tag) tag = String(b.tag).trim();
    }
  } catch {}
  if (!tag) {
    const qs = new URLSearchParams(event.queryStringParameters || {});
    tag = (qs.get("tag") || "").trim();
  }

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env || {};

  // Quick env summary
  const envSummary = {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: mask(CLOUDINARY_API_KEY),
    CLOUDINARY_API_SECRET: mask(CLOUDINARY_API_SECRET),
  };

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({
        ok: false,
        step: "env",
        error: "Missing Cloudinary env vars",
        expect: ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
        envSummary,
      }),
    };
  }

  try {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });

    // 1) Ping Cloudinary (simple auth sanity)
    let ping;
    try {
      // ping uses Admin API; will fail if creds/cloud are wrong
      ping = await cloudinary.api.ping();
    } catch (e) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({
          ok: false,
          step: "ping",
          error: "Cloudinary Admin API ping failed",
          detail: shapeError(e),
          envSummary,
        }),
      };
    }

    // 2) Optionally test a tag if provided
    let tagTest = null;
    if (tag) {
      // Search API
      let searchRes = null;
      let searchErr = null;
      try {
        const expr = `tags="${tag}"`;
        searchRes = await cloudinary.search
          .expression(expr)
          .with_field("tags")
          .max_results(5)
          .execute();
      } catch (e) {
        searchErr = shapeError(e);
      }

      // Admin API fallback
      let adminRes = null;
      let adminErr = null;
      try {
        adminRes = await cloudinary.api.resources_by_tag(tag, { max_results: 5 });
      } catch (e) {
        adminErr = shapeError(e);
      }

      tagTest = {
        tag,
        search: searchRes
          ? { ok: true, count: (searchRes.resources || []).length }
          : { ok: false, error: searchErr },
        admin: adminRes
          ? { ok: true, count: (adminRes.resources || []).length }
          : { ok: false, error: adminErr },
        hint:
          "If both fail, your credentials or cloud_name are wrong for where the assets live. If Search fails but Admin works, your plan/permissions may disallow Search API.",
      };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        envSummary,
        ping,
        ...(tag ? { tagTest } : {}),
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({
        ok: false,
        step: "unknown",
        error: "Diag failed",
        detail: shapeError(e),
        envSummary,
      }),
    };
  }
};
