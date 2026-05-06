// src/lib/firebase-storage.js
// Storage SDK is heavy (~100KB) — kept out of the main bundle by importing
// it only from chunks that actually need it (uploads, downloads).
import { getStorage } from "firebase/storage";
import { app } from "./firebase";

export const storage = getStorage(app, "gs://limlim-32e6a.firebasestorage.app");
