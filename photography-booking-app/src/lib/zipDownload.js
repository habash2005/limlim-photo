// src/lib/zipDownload.js
//
// Two download strategies live in this file:
//
// Desktop -- streamZipDownload(): truly streams to disk, RAM stays flat.
// Sink picked at runtime in three preference tiers:
//   1. showSaveFilePicker (Chromium / recent Firefox desktop)
//   2. StreamSaver service worker (Safari, older Firefox)
//   3. Buffered Blob fallback (last resort)
//
// Mobile -- bufferedZipDownload() + partitionFilesBySize(): on iOS Safari
// and low-RAM Android, both showSaveFilePicker is unavailable AND StreamSaver
// can fail or get evicted under memory pressure, silently falling through
// to the in-memory Blob sink. Letting that happen for a multi-GB gallery
// blows past iOS's per-tab memory cap (~1-1.5 GB) and the OS reloads the
// page mid-download. We avoid the trap entirely by splitting files into
// ~250 MB chunks up front and saving each as its own zip via FileSaver.
// Pages call partitionFilesBySize, then loop over groups with a
// user-gesture between parts (iOS blocks programmatic downloads outside
// a fresh user-activation window).
//
// Originals are preserved bit-for-bit on both paths: every entry is a
// ZipPassThrough (STORE, no recompression).

import { Zip, ZipPassThrough } from "fflate";
import streamSaver from "streamsaver";
import { saveAs } from "file-saver";

// Self-hosted mitm + sw (see public/streamsaver/) — avoids depending on the
// public jimmywarting.github.io page.
streamSaver.mitm = "/streamsaver/mitm.html";

function toUint8(chunk) {
  if (chunk instanceof Uint8Array) return chunk;
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
  return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
}

function dedupeName(used, name) {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const base = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : "";
  let i = 2;
  let candidate;
  do {
    candidate = `${base} (${i})${ext}`;
    i++;
  } while (used.has(candidate));
  used.add(candidate);
  return candidate;
}

async function pickSink(outName) {
  if (typeof window !== "undefined" && typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: outName,
        types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }],
      });
      const writable = await handle.createWritable();
      return {
        kind: "fsa",
        async write(chunk) { await writable.write(chunk); },
        async close() { await writable.close(); },
        async abort(reason) { try { await writable.abort(reason); } catch (_) {} },
      };
    } catch (e) {
      // User dismissed the picker — bubble up so the caller can treat it
      // as a cancel rather than silently switching to a different sink.
      if (e && (e.name === "AbortError" || e.name === "NotAllowedError")) throw e;
      // Anything else (e.g. SecurityError in iframes) → next tier.
    }
  }

  try {
    const writer = streamSaver.createWriteStream(outName).getWriter();
    return {
      kind: "streamsaver",
      async write(chunk) { await writer.write(chunk); },
      async close() { await writer.close(); },
      async abort(reason) { try { await writer.abort(reason); } catch (_) {} },
    };
  } catch (_) {
    // fall through
  }

  const parts = [];
  return {
    kind: "blob",
    async write(chunk) { parts.push(chunk); },
    async close() { saveAs(new Blob(parts, { type: "application/zip" }), outName); },
    async abort() {},
  };
}

/**
 * Stream remote files into a ZIP and save it.
 *
 * @param {object} options
 * @param {Array<object>} options.files
 *   Caller-shaped file descriptors. Each is passed back to `openFile` and
 *   `getName` so the helper stays storage-agnostic.
 * @param {(file: object) => string} options.getName
 *   Returns the desired filename inside the archive.
 * @param {(file: object) => Promise<ReadableStream<Uint8Array> | Response | Blob>} options.openFile
 *   Resolves to a Response, ReadableStream, or Blob containing the file's
 *   raw bytes. Called once per file, in order.
 * @param {string} options.outName
 *   Suggested ZIP filename.
 * @param {(p: {index: number, total: number, currentName: string, bytesWritten: number}) => void} [options.onProgress]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{cancelled: boolean, kind: string, bytesWritten: number}>}
 */
export async function streamZipDownload({
  files,
  getName,
  openFile,
  outName,
  onProgress,
  signal,
}) {
  if (!files || !files.length) throw new Error("No files to download");

  const sink = await pickSink(outName);
  let bytesWritten = 0;
  let cancelled = false;
  let pendingError = null;
  let writerChain = Promise.resolve();

  const zip = new Zip();
  zip.ondata = (err, chunk, final) => {
    if (err) {
      pendingError = err;
      return;
    }
    if (chunk && chunk.length) {
      const u8 = toUint8(chunk);
      bytesWritten += u8.length;
      writerChain = writerChain.then(() => sink.write(u8));
    }
    if (final) {
      writerChain = writerChain.then(() => sink.close());
    }
  };

  const onAbort = async () => {
    cancelled = true;
    try { zip.terminate(); } catch (_) {}
    try { await sink.abort("cancelled"); } catch (_) {}
  };
  if (signal) {
    if (signal.aborted) {
      await onAbort();
      return { cancelled: true, kind: sink.kind, bytesWritten };
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }

  const usedNames = new Set();

  try {
    for (let i = 0; i < files.length; i++) {
      if (cancelled) break;
      const file = files[i];
      const safeName = dedupeName(usedNames, getName(file));
      const entry = new ZipPassThrough(safeName);
      zip.add(entry);

      onProgress?.({ index: i, total: files.length, currentName: safeName, bytesWritten });

      const source = await openFile(file);
      let stream;
      if (source && typeof source.getReader === "function") {
        stream = source;
      } else if (source && source.body && typeof source.body.getReader === "function") {
        stream = source.body;
      } else if (source && typeof source.stream === "function") {
        stream = source.stream();
      } else {
        throw new Error(`No readable stream available for ${safeName}`);
      }

      const reader = stream.getReader();
      try {
        while (true) {
          if (cancelled) {
            try { await reader.cancel("cancelled"); } catch (_) {}
            break;
          }
          const { value, done } = await reader.read();
          if (done) break;
          entry.push(toUint8(value), false);
          // Backpressure: wait for whatever the zip emitted to drain into
          // the sink before we pull more bytes from the source.
          await writerChain;
          if (pendingError) throw pendingError;
        }
        entry.push(new Uint8Array(0), true);
      } finally {
        try { reader.releaseLock(); } catch (_) {}
      }

      onProgress?.({ index: i + 1, total: files.length, currentName: safeName, bytesWritten });
    }

    if (cancelled) {
      try { zip.terminate(); } catch (_) {}
      try { await sink.abort("cancelled"); } catch (_) {}
      return { cancelled: true, kind: sink.kind, bytesWritten };
    }

    zip.end();
    await writerChain;
    if (pendingError) throw pendingError;

    return { cancelled: false, kind: sink.kind, bytesWritten };
  } catch (e) {
    try { zip.terminate(); } catch (_) {}
    try { await sink.abort(String(e?.message || e)); } catch (_) {}
    throw e;
  } finally {
    if (signal) {
      try { signal.removeEventListener("abort", onAbort); } catch (_) {}
    }
  }
}

/**
 * Coarse UA-based check for phone/tablet browsers. Used to route bulk
 * downloads onto the chunked, in-memory path that doesn't depend on
 * service-worker streaming (unreliable on iOS Safari).
 */
export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Group files into batches whose estimated total bytes stay under
 * `maxBytesPerPart`. A single file larger than the cap becomes its own
 * group — we never split a photo across two zips, since that would produce
 * unrenderable archives.
 *
 * @param {Array<object>} files
 * @param {number} maxBytesPerPart
 * @param {(file: object) => number} [estimateBytes]
 *   Defaults to file.bytes -> file.size -> 5MB fallback. The image
 *   documents in this app store `bytes` from the upload step.
 * @returns {Array<Array<object>>}
 */
export function partitionFilesBySize(
  files,
  maxBytesPerPart,
  estimateBytes = (f) => f?.bytes || f?.size || 5 * 1024 * 1024
) {
  const groups = [];
  let current = [];
  let acc = 0;
  for (const f of files) {
    const est = Math.max(0, estimateBytes(f) || 0);
    if (current.length > 0 && acc + est > maxBytesPerPart) {
      groups.push(current);
      current = [];
      acc = 0;
    }
    current.push(f);
    acc += est;
  }
  if (current.length) groups.push(current);
  return groups;
}

/**
 * Build a zip in memory and save it via FileSaver. Suitable for the mobile
 * chunked path. Caller MUST ensure files for one call won't exceed the
 * device's per-tab memory budget — partitionFilesBySize is the intended
 * companion.
 *
 * @param {object} options
 * @param {Array<object>} options.files
 * @param {(file: object) => string} options.getName
 * @param {(file: object) => Promise<ReadableStream<Uint8Array> | Response | Blob>} options.openFile
 * @param {string} options.outName
 * @param {(p: {index: number, total: number, currentName: string}) => void} [options.onProgress]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{cancelled: boolean, kind: string}>}
 */
export async function bufferedZipDownload({
  files,
  getName,
  openFile,
  outName,
  onProgress,
  signal,
}) {
  if (!files || !files.length) throw new Error("No files to download");

  let parts = [];
  let pendingError = null;
  const zip = new Zip();
  zip.ondata = (err, chunk, _final) => {
    if (err) {
      pendingError = err;
      return;
    }
    if (chunk && chunk.length) parts.push(toUint8(chunk));
  };

  const usedNames = new Set();

  const ensureNotAborted = () => {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
  };

  try {
    for (let i = 0; i < files.length; i++) {
      ensureNotAborted();
      const file = files[i];
      const safeName = dedupeName(usedNames, getName(file));
      const entry = new ZipPassThrough(safeName);
      zip.add(entry);

      onProgress?.({ index: i, total: files.length, currentName: safeName });

      const source = await openFile(file);
      let stream;
      if (source && typeof source.getReader === "function") {
        stream = source;
      } else if (source && source.body && typeof source.body.getReader === "function") {
        stream = source.body;
      } else if (source && typeof source.stream === "function") {
        stream = source.stream();
      } else {
        throw new Error(`No readable stream available for ${safeName}`);
      }

      const reader = stream.getReader();
      try {
        while (true) {
          if (signal?.aborted) {
            try { await reader.cancel("cancelled"); } catch (_) {}
            throw new DOMException("cancelled", "AbortError");
          }
          const { value, done } = await reader.read();
          if (done) break;
          entry.push(toUint8(value), false);
          if (pendingError) throw pendingError;
        }
        entry.push(new Uint8Array(0), true);
      } finally {
        try { reader.releaseLock(); } catch (_) {}
      }

      onProgress?.({ index: i + 1, total: files.length, currentName: safeName });
    }

    zip.end();
    if (pendingError) throw pendingError;

    const blob = new Blob(parts, { type: "application/zip" });
    // Drop our reference before saveAs so the GC can collect the parts
    // array's chunks while the browser holds the assembled blob.
    parts = [];
    saveAs(blob, outName);

    return { cancelled: false, kind: "buffered" };
  } catch (e) {
    try { zip.terminate(); } catch (_) {}
    parts = [];
    if (e?.name === "AbortError") {
      return { cancelled: true, kind: "buffered" };
    }
    throw e;
  }
}

/** Default per-part cap for the chunked mobile path. ~250 MB stays well
 *  under iOS Safari's per-tab budget on devices going back several years. */
export const MOBILE_PART_BYTES = 250 * 1024 * 1024;
