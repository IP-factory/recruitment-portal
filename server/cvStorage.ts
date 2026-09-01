/**
 * Task 24G — CV file storage providers.
 *
 * CV bytes are stored through a small provider abstraction:
 *
 * - Vercel Blob (`@vercel/blob`) when `BLOB_READ_WRITE_TOKEN` is configured —
 *   the durable object storage for the Vercel deployment. Blobs are written
 *   with `access: "private"`.
 * - Local filesystem (`CV_STORAGE_DIR`, default `data/cv-uploads`) for local
 *   development and tests ONLY.
 *
 * Transport model (Vercel Functions have ~4.5 MB payload limits, so a 10 MB
 * CV must never pass through the serverless function):
 * - Uploads go DIRECTLY from the browser to the private Blob store. The API
 *   only issues a scoped, short-lived client upload token (one pathname, size
 *   and content-type constraints) and never hands out the read-write token.
 * - Admin reads receive a short-lived presigned GET URL for the private blob
 *   after authentication; bytes stream from Blob CDN storage, never through
 *   the API. (The signed GET URL carries no content-disposition — the SDK
 *   does not support it for reads — so download behaviour is handled by the
 *   authenticated Admin UI.) The local provider keeps streaming because
 *   there is no CDN in development.
 *
 * Production safety: in a production environment without Blob configuration,
 * CV storage refuses to serve rather than writing to the ephemeral
 * serverless filesystem.
 *
 * Storage keys are generated server-side (`cv/<applicationId>/<random>`) —
 * user-supplied filenames never form part of the key. Credentials never
 * reach the client.
 */
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface CvObjectInfo {
  size: number;
  contentType: string;
}

export interface CvUploadAuthorization {
  /** Scoped client token for the browser SDK; NOT the read-write token. */
  clientToken: string;
  /** Destination pathname the authorization is scoped to. */
  pathname: string;
  validUntil: number;
}

export interface CvStorageProvider {
  /** "blob" in deployments, "local" for development/tests. */
  readonly mode: "blob" | "local";
  save(key: string, bytes: Buffer): Promise<void>;
  read(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
  /** Metadata for an existing object, or null when it does not exist. */
  head(key: string): Promise<CvObjectInfo | null>;
  /** Scoped direct-upload authorization (blob storage only). */
  createUploadAuthorization(key: string, constraints: { maximumSizeInBytes: number; allowedContentTypes: string[]; validUntilMs: number }): Promise<CvUploadAuthorization>;
  /** Short-lived signed GET URL for the private object (blob storage only). */
  createSignedDownloadUrl(key: string, opts: { validUntilMs: number }): Promise<string>;
}

/** Thrown when CV storage is unusable in the current environment. */
export class CvStorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CvStorageConfigurationError";
  }
}

/** Sentinel a local-mode route uses to tell the client to send raw bytes. */
export const LOCAL_DIRECT_UPLOAD_CODE = "local-upload-required";

/** A production environment must use durable Blob storage — never the local filesystem. */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new CvStorageConfigurationError("CV storage is not configured.");
  return token;
}

/** Local filesystem storage — development/test only (never production). */
export function createLocalCvStorage(directory?: string): CvStorageProvider {
  const baseDir = path.resolve(directory ?? process.env.CV_STORAGE_DIR ?? "data/cv-uploads");
  const resolveKey = (key: string): string => {
    const resolved = path.resolve(baseDir, key);
    if (!resolved.startsWith(baseDir + path.sep)) throw new Error("Invalid storage key.");
    return resolved;
  };
  return {
    mode: "local",
    async save(key, bytes) {
      const target = resolveKey(key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
    },
    async read(key) {
      try {
        return await readFile(resolveKey(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async remove(key) {
      await rm(resolveKey(key), { force: true });
    },
    async head(key) {
      try {
        const info = await stat(resolveKey(key));
        return { size: info.size, contentType: "application/octet-stream" };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async createUploadAuthorization() {
      throw new CvStorageConfigurationError("Direct uploads are unavailable in this environment.");
    },
    async createSignedDownloadUrl() {
      throw new CvStorageConfigurationError("Signed downloads are unavailable in this environment.");
    },
  };
}

/** Vercel Blob storage — durable private object storage for deployments. */
export function createVercelBlobCvStorage(token: string): CvStorageProvider {
  return {
    mode: "blob",
    async save(key, bytes) {
      const { put } = await import("@vercel/blob");
      await put(key, bytes, { access: "private", token, addRandomSuffix: false });
    },
    async read(key) {
      const { get } = await import("@vercel/blob");
      try {
        const result = await get(key, { token, access: "private" });
        if (!result || !result.stream) return null;
        const chunks: Buffer[] = [];
        const reader = result.stream.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(Buffer.from(value));
        }
        return Buffer.concat(chunks);
      } catch (error) {
        if (error instanceof Error && error.name === "BlobNotFoundError") return null;
        throw error;
      }
    },
    async remove(key) {
      const { del } = await import("@vercel/blob");
      await del(key, { token });
    },
    async head(key) {
      return blobTestSeams.head(key, token);
    },
    async createUploadAuthorization(key, constraints) {
      const generate = blobTestSeams.generateClientToken;
      const clientToken = await generate({
        pathname: key,
        token,
        access: "private",
        maximumSizeInBytes: constraints.maximumSizeInBytes,
        allowedContentTypes: constraints.allowedContentTypes,
        validUntil: constraints.validUntilMs,
        addRandomSuffix: false,
      });
      return { clientToken, pathname: key, validUntil: constraints.validUntilMs };
    },
    async createSignedDownloadUrl(key, opts) {
      const issue = blobTestSeams.issueSignedToken;
      const presign = blobTestSeams.presignUrl;
      const signedToken = await issue({ pathname: key, operations: ["get"], validUntil: opts.validUntilMs, token });
      const { presignedUrl } = await presign(signedToken, { operation: "get", pathname: key, validUntil: opts.validUntilMs, access: "private" });
      return presignedUrl;
    },
  };
}

// ── Test seams ───────────────────────────────────────────────────────────────
// Real Blob control-plane calls are network operations; tests substitute
// fakes so authorization/scoping behaviour is verifiable without Blob access.

export interface BlobTestSeams {
  generateClientToken: (options: { pathname: string; token: string; access: "private"; maximumSizeInBytes: number; allowedContentTypes: string[]; validUntil: number; addRandomSuffix: boolean }) => Promise<string>;
  head: (key: string, token: string) => Promise<CvObjectInfo | null>;
  issueSignedToken: (options: { pathname: string; operations: Array<"get" | "head">; validUntil: number; token: string }) => Promise<{ delegationToken: string; clientSigningToken: string; validUntil: number }>;
  presignUrl: (signedToken: { delegationToken: string; clientSigningToken: string }, options: { operation: "get"; pathname: string; validUntil: number; access: "private" }) => Promise<{ presignedUrl: string }>;
}

const realBlobSeams: BlobTestSeams = {
  async generateClientToken(options) {
    const { generateClientTokenFromReadWriteToken } = await import("@vercel/blob/client");
    return generateClientTokenFromReadWriteToken(options);
  },
  async head(key, token) {
    const { head } = await import("@vercel/blob");
    try {
      const result = await head(key, { token });
      return { size: result.size, contentType: result.contentType };
    } catch (error) {
      if (error instanceof Error && (error.name === "BlobNotFoundError" || error.name === "BlobUnknownError")) return null;
      throw error;
    }
  },
  async issueSignedToken(options) {
    const { issueSignedToken } = await import("@vercel/blob");
    return issueSignedToken(options);
  },
  async presignUrl(signedToken, options) {
    const { presignUrl } = await import("@vercel/blob");
    return presignUrl(signedToken, options);
  },
};

let blobTestSeams: BlobTestSeams = realBlobSeams;

export function setBlobSeamsForTests(seams: Partial<BlobTestSeams> | null): void {
  blobTestSeams = seams ? { ...realBlobSeams, ...seams } : realBlobSeams;
}

// ── Provider resolution ──────────────────────────────────────────────────────

let cached: CvStorageProvider | null = null;

/**
 * Resolve the active storage provider once. Vercel Blob when its token is
 * configured; otherwise the local filesystem ONLY outside production. In a
 * production environment without Blob configuration the provider refuses to
 * serve — the serverless filesystem is not durable, so CVs must never be
 * written there.
 */
export function getCvStorage(): CvStorageProvider {
  if (cached) return cached;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    cached = createVercelBlobCvStorage(token);
    return cached;
  }
  if (isProductionRuntime()) {
    console.error("[cv] CV storage is disabled: BLOB_READ_WRITE_TOKEN is not configured. Local filesystem fallback is never used in production because the serverless filesystem is not durable.");
    throw new CvStorageConfigurationError("CV storage is not configured for this deployment.");
  }
  cached = createLocalCvStorage();
  return cached;
}

/** True when the direct browser-to-Blob upload path is available. */
export function directBlobUploadAvailable(): boolean {
  return isBlobConfigured();
}

/** Test seam: reset the cached provider (used when env overrides change). */
export function resetCvStorageForTests(): void {
  cached = null;
}
