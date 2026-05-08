// src/lib/zipDownload.js
//
// Streams remote files into a ZIP and writes it directly to disk.
//
// Originals are preserved bit-for-bit: every entry is a ZipPassThrough
// (STORE, no recompression). The ZIP itself is produced incrementally by
// fflate and piped to a sink in three preference tiers:
//
//   1. window.showSaveFilePicker  -- Chromium / recent Firefox desktop.
//      The user picks the save location once and bytes go straight to disk;
//      RAM use stays flat regardless of total size.
//
//   2. StreamSaver (service worker) -- Safari, mobile, older Firefox.
//      A same-origin SW intercepts a synthetic URL and streams the response
//      to the browser's normal "Save As" download. Also flat RAM.
//
//   3. Buffered Blob -- last-ditch fallback if neither path works. Holds
//      the whole archive in memory; only reached on very old browsers.

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
