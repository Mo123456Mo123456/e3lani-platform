import { Readable } from "node:stream";
import type { Express, Response as ExpressResponse } from "express";

import { getS3ObjectResponse } from "../s3-multipart";
import { ENV } from "./env";

const FORWARDED_HEADERS = [
  "accept-ranges",
  "cache-control",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
] as const;

async function proxyS3Object(key: string, range: string | undefined, res: ExpressResponse) {
  const objectKey = key.slice("s3/".length);
  if (!objectKey) {
    res.status(400).send("Missing S3 object key");
    return;
  }

  const response = await getS3ObjectResponse(objectKey, range);
  if (!response.ok && response.status !== 206) {
    const body = await response.text().catch(() => "");
    console.error(`[StorageProxy] S3 error: ${response.status} ${body}`);
    res.status(response.status === 404 ? 404 : 502).send("Storage backend error");
    return;
  }

  res.status(response.status);
  for (const header of FORWARDED_HEADERS) {
    const value = response.headers.get(header);
    if (value) res.set(header, value);
  }
  if (!response.headers.get("cache-control")) {
    res.set("Cache-Control", "private, max-age=300");
  }
  if (!response.body) {
    res.end();
    return;
  }
  Readable.fromWeb(response.body as never).pipe(res);
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      if (key.startsWith("s3/")) {
        const range = typeof req.headers.range === "string" ? req.headers.range : undefined;
        await proxyS3Object(key, range, res);
        return;
      }

      if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
        res.status(500).send("Storage proxy not configured");
        return;
      }

      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
