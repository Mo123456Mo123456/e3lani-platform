import { createHash, createHmac } from "node:crypto";

import { ENV } from "./_core/env";

export type S3UploadedPart = {
  partNumber: number;
  etag: string;
  size: number;
};

type QueryValue = string | number;
type Query = Record<string, QueryValue | undefined>;

const SERVICE = "s3";
const ALGORITHM = "AWS4-HMAC-SHA256";
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function rfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function normalizePath(pathname: string) {
  return pathname
    .split("/")
    .map((segment) => rfc3986(decodeURIComponent(segment)))
    .join("/");
}

function canonicalQuery(query: Query) {
  return Object.entries(query)
    .filter((entry): entry is [string, QueryValue] => entry[1] !== undefined)
    .map(([key, value]) => [rfc3986(key), rfc3986(String(value))] as const)
    .sort(([aKey, aValue], [bKey, bValue]) =>
      aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey),
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function timestamp(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function dateStamp(date: Date) {
  return timestamp(date).slice(0, 8);
}

function signingKey(date: string) {
  const dateKey = hmac(`AWS4${ENV.s3SecretAccessKey}`, date);
  const regionKey = hmac(dateKey, ENV.s3Region);
  const serviceKey = hmac(regionKey, SERVICE);
  return hmac(serviceKey, "aws4_request");
}

function configurationError() {
  if (!ENV.s3Endpoint || !ENV.s3Bucket || !ENV.s3AccessKeyId || !ENV.s3SecretAccessKey) {
    throw new Error("S3_MULTIPART_NOT_CONFIGURED");
  }
}

export function isS3MultipartConfigured() {
  return Boolean(
    ENV.s3Endpoint &&
      ENV.s3Bucket &&
      ENV.s3AccessKeyId &&
      ENV.s3SecretAccessKey,
  );
}

function objectUrl(key: string) {
  configurationError();
  const endpoint = new URL(ENV.s3Endpoint);
  const basePath = endpoint.pathname.replace(/\/$/, "");
  if (ENV.s3ForcePathStyle) {
    endpoint.pathname = `${basePath}/${ENV.s3Bucket}/${key}`;
  } else {
    endpoint.hostname = `${ENV.s3Bucket}.${endpoint.hostname}`;
    endpoint.pathname = `${basePath}/${key}`;
  }
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint;
}

function normalizedHeaders(input: Record<string, string>, host: string) {
  const headers = new Map<string, string>();
  headers.set("host", host);
  for (const [key, value] of Object.entries(input)) {
    headers.set(key.toLowerCase(), value.trim().replace(/\s+/g, " "));
  }
  return [...headers.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function canonicalHeaders(entries: [string, string][]) {
  return entries.map(([key, value]) => `${key}:${value}\n`).join("");
}

function signedHeaderNames(entries: [string, string][]) {
  return entries.map(([key]) => key).join(";");
}

function credentialScope(date: string) {
  return `${date}/${ENV.s3Region}/${SERVICE}/aws4_request`;
}

function signature(input: {
  method: string;
  url: URL;
  query: Query;
  headers: Record<string, string>;
  payloadHash: string;
  now: Date;
}) {
  const headerEntries = normalizedHeaders(input.headers, input.url.host);
  const signedHeaders = signedHeaderNames(headerEntries);
  const canonicalRequest = [
    input.method.toUpperCase(),
    normalizePath(input.url.pathname),
    canonicalQuery(input.query),
    canonicalHeaders(headerEntries),
    signedHeaders,
    input.payloadHash,
  ].join("\n");
  const shortDate = dateStamp(input.now);
  const scope = credentialScope(shortDate);
  const stringToSign = [
    ALGORITHM,
    timestamp(input.now),
    scope,
    sha256(canonicalRequest),
  ].join("\n");
  return {
    value: createHmac("sha256", signingKey(shortDate)).update(stringToSign).digest("hex"),
    scope,
    signedHeaders,
  };
}

export function presignUploadPart(input: {
  key: string;
  uploadId: string;
  partNumber: number;
  expiresSeconds?: number;
  now?: Date;
}) {
  configurationError();
  const now = input.now ?? new Date();
  const url = objectUrl(input.key);
  const shortDate = dateStamp(now);
  const query: Query = {
    partNumber: input.partNumber,
    uploadId: input.uploadId,
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${ENV.s3AccessKeyId}/${credentialScope(shortDate)}`,
    "X-Amz-Date": timestamp(now),
    "X-Amz-Expires": Math.min(Math.max(input.expiresSeconds ?? 900, 60), 3600),
    "X-Amz-SignedHeaders": "host",
    ...(ENV.s3SessionToken ? { "X-Amz-Security-Token": ENV.s3SessionToken } : {}),
  };
  const signed = signature({
    method: "PUT",
    url,
    query,
    headers: {},
    payloadHash: UNSIGNED_PAYLOAD,
    now,
  });
  query["X-Amz-Signature"] = signed.value;
  url.search = canonicalQuery(query);
  return url.toString();
}

async function signedRequest(input: {
  method: string;
  key: string;
  query?: Query;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
}) {
  configurationError();
  const url = objectUrl(input.key);
  const query = input.query ?? {};
  const now = new Date();
  const body = input.body ?? "";
  const payloadHash = sha256(body);
  const headers: Record<string, string> = {
    ...(input.headers ?? {}),
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": timestamp(now),
    ...(ENV.s3SessionToken ? { "x-amz-security-token": ENV.s3SessionToken } : {}),
  };
  const signed = signature({
    method: input.method,
    url,
    query,
    headers,
    payloadHash,
    now,
  });
  headers.Authorization = `${ALGORITHM} Credential=${ENV.s3AccessKeyId}/${signed.scope}, SignedHeaders=${signed.signedHeaders}, Signature=${signed.value}`;
  url.search = canonicalQuery(query);
  return fetch(url, {
    method: input.method,
    headers,
    body: input.method === "GET" || input.method === "HEAD" ? undefined : body,
  });
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function xmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? decodeXml(match[1].trim()) : null;
}

async function requireS3Response(response: Response, operation: string) {
  const text = await response.text();
  if (!response.ok || /<Error>/.test(text)) {
    const code = xmlValue(text, "Code") ?? response.status.toString();
    throw new Error(`${operation}_${code}`);
  }
  return text;
}

export async function createMultipartUpload(input: {
  key: string;
  contentType: "video/mp4";
}) {
  const response = await signedRequest({
    method: "POST",
    key: input.key,
    query: { uploads: "" },
    headers: { "content-type": input.contentType },
  });
  const xml = await requireS3Response(response, "S3_MULTIPART_CREATE_FAILED");
  const uploadId = xmlValue(xml, "UploadId");
  if (!uploadId) throw new Error("S3_MULTIPART_UPLOAD_ID_MISSING");
  return uploadId;
}

export async function listMultipartParts(key: string, uploadId: string) {
  const response = await signedRequest({
    method: "GET",
    key,
    query: { uploadId },
  });
  const xml = await requireS3Response(response, "S3_MULTIPART_LIST_FAILED");
  const parts: S3UploadedPart[] = [];
  for (const match of xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)) {
    const partXml = match[1];
    const partNumber = Number(xmlValue(partXml, "PartNumber"));
    const size = Number(xmlValue(partXml, "Size"));
    const etag = xmlValue(partXml, "ETag");
    if (Number.isInteger(partNumber) && partNumber > 0 && Number.isFinite(size) && size >= 0 && etag) {
      parts.push({ partNumber, size, etag });
    }
  }
  return parts.sort((a, b) => a.partNumber - b.partNumber);
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: S3UploadedPart[],
) {
  const body = `<CompleteMultipartUpload>${parts
    .map(
      (part) =>
        `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${part.etag
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</ETag></Part>`,
    )
    .join("")}</CompleteMultipartUpload>`;
  const response = await signedRequest({
    method: "POST",
    key,
    query: { uploadId },
    headers: { "content-type": "application/xml" },
    body,
  });
  await requireS3Response(response, "S3_MULTIPART_COMPLETE_FAILED");
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  const response = await signedRequest({
    method: "DELETE",
    key,
    query: { uploadId },
  });
  if (!response.ok && response.status !== 404) {
    await requireS3Response(response, "S3_MULTIPART_ABORT_FAILED");
  }
}

export async function headS3Object(key: string) {
  const response = await signedRequest({ method: "HEAD", key });
  if (!response.ok) throw new Error(`S3_OBJECT_HEAD_FAILED_${response.status}`);
  const bytes = Number(response.headers.get("content-length"));
  if (!Number.isInteger(bytes) || bytes < 0) throw new Error("S3_OBJECT_SIZE_INVALID");
  return { bytes, contentType: response.headers.get("content-type") };
}

export async function readS3ObjectPrefix(key: string, length = 32) {
  const response = await signedRequest({
    method: "GET",
    key,
    headers: { range: `bytes=0-${Math.max(0, length - 1)}` },
  });
  if (!response.ok && response.status !== 206) {
    throw new Error(`S3_OBJECT_PREFIX_FAILED_${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function getS3ObjectResponse(key: string, range?: string) {
  return signedRequest({
    method: "GET",
    key,
    headers: range ? { range } : undefined,
  });
}
