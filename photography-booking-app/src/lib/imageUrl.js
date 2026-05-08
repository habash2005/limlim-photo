// Image URL helper — routes a remote image through Netlify Image CDN so
// 8MB Firebase Storage originals download as ~50–150KB resized variants.
// `remote_images` in netlify.toml allowlists the source patterns we accept.
//
// Usage:
//   <img src={cdnUrl(photo.secure_url, { w: 720 })} ... />
//   <img src={cdnUrl(url, { w: 360, q: 70 })} ... />
//
// Falls back to the original URL when:
//   - we're in dev (no Netlify functions running)
//   - the URL isn't HTTPS (data URLs etc.)
//   - explicitly disabled

const ENABLED =
  typeof window !== "undefined" &&
  window.location?.hostname !== "localhost" &&
  !window.location?.hostname?.startsWith("127.");

export function cdnUrl(url, opts = {}) {
  if (!url || !ENABLED) return url;
  if (typeof url !== "string" || !url.startsWith("https://")) return url;

  const params = new URLSearchParams();
  params.set("url", url);
  if (opts.w) params.set("w", String(Math.round(opts.w)));
  if (opts.h) params.set("h", String(Math.round(opts.h)));
  if (opts.fit) params.set("fit", opts.fit);
  if (opts.q != null) params.set("q", String(opts.q));
  if (opts.fm) params.set("fm", opts.fm); // e.g. "webp", "avif"

  return `/.netlify/images?${params.toString()}`;
}

// Build a `srcset` for responsive loading. Browser picks the right variant
// for the rendered slot size + DPR. Sizes are powers-of-2 scaled.
export function cdnSrcSet(url, baseWidth, opts = {}) {
  if (!url || !ENABLED) return undefined;
  // 1×, 1.5×, 2× of the base width — covers retina + window-zoom cases.
  const widths = [
    Math.round(baseWidth),
    Math.round(baseWidth * 1.5),
    Math.round(baseWidth * 2),
  ];
  return widths.map((w) => `${cdnUrl(url, { ...opts, w })} ${w}w`).join(", ");
}
