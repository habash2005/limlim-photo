# Firebase infra config

## Storage CORS

`storage-cors.json` is the source-of-truth CORS configuration for the Cloud
Storage bucket `gs://limlim-32e6a.firebasestorage.app`. Origins are pinned
to production + Netlify deploy previews + localhost dev so the bucket
isn't permanently exposed as `*`.

### Apply / refresh

You need `gcloud` + `gsutil` installed and authenticated as a project
owner. One-liner:

```sh
gsutil cors set firebase/storage-cors.json gs://limlim-32e6a.firebasestorage.app
```

Verify:

```sh
gsutil cors get gs://limlim-32e6a.firebasestorage.app
```

### When to re-run

- After adding a new origin (custom domain, new branch deploy URL, etc.)
- If downloads start failing with `TypeError: Failed to fetch` on a
  domain that previously worked — first check whether someone wiped
  the CORS config on the bucket (`gsutil cors get …`); if so, re-apply.

Code-side, `src/lib/downloadWithRetry.js` adds retry + SDK fallback so a
brief CORS regression doesn't immediately break user downloads.
