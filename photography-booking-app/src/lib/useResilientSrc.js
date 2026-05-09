// React hook for image src that gracefully falls back from a CDN-transformed
// URL to the raw source URL when the CDN rejects it.
//
// Why: Netlify Image CDN caps source images at 20 MB. Some of our DSLR JPEGs
// (8192×5464 at high quality) sit above that cap. When the CDN rejects, the
// IMG element fires `onerror` silently — without a fallback handler the slot
// stays at opacity:0 forever and looks empty. The raw Firebase Storage URL
// has no such cap and always works (bucket has open CORS), so falling back
// to it is safe.
//
// Usage:
//   const { src, onError, onLoad } = useResilientSrc(item.secure_url, { w: 2000, q: 85 });
//   <img src={src} onLoad={onLoad} onError={onError} ... />
//
// The hook resets its internal state whenever the source URL changes so a
// new photo gets a fresh chance through the fast (CDN) path.

import { useEffect, useState } from "react";
import { cdnUrl } from "./imageUrl";

export function useResilientSrc(rawUrl, cdnOpts = {}) {
  const [cdnFailed, setCdnFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCdnFailed(false);
    setLoaded(false);
    setFailed(false);
  }, [rawUrl]);

  const src = !rawUrl
    ? rawUrl
    : cdnFailed
      ? rawUrl
      : cdnUrl(rawUrl, cdnOpts);

  return {
    src,
    loaded,
    cdnFailed,
    failed, // becomes true after BOTH CDN and raw URL failed to load
    onLoad: () => setLoaded(true),
    onError: () => {
      if (!cdnFailed) {
        // First failure: drop CDN, retry with raw URL.
        if (typeof console !== "undefined") {
          // Surfacing the URL helps debug. Single-line console.warn is
          // intentional — these are noisy in dev but useful in support.
          console.warn("[useResilientSrc] CDN failed, falling back to raw:", rawUrl);
        }
        setCdnFailed(true);
      } else {
        // Second failure (raw URL also failed): we're out of options.
        if (typeof console !== "undefined") {
          console.warn("[useResilientSrc] raw URL also failed:", rawUrl);
        }
        setFailed(true);
      }
    },
  };
}
