/**
 * Task 24G — CV file storage providers.
 *
 * The project has no Manus file/bucket storage integration available, so CV
 * bytes are stored through a small provider abstraction:
 *
 * - Vercel Blob (`@vercel/blob`) when `BLOB_READ_WRITE_TOKEN` is configured —
 *   the durable object storage for the Vercel deployment. Blobs are written
 *   with `access: "private"` and are never exposed through a public URL;
 *   they are only ever streamed through the authenticated Admin proxy route.
 * - Local filesystem fallback (`CV_STORAGE_DIR`, default `data/cv-uploads`)
 *   for local development and tests.
 *
 * Storage keys are generated server-side (`cv/<applicationId>/<random>`) —
 * user-supplied filenames never form part of the key, so paths cannot be
 * manipulated to access arbitrary files. Credentials never reach the client.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface CvStorageProvider {
  save(key: string, bytes: Buffer): Promise<void>;
  read(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

/** Local filesystem storage — development/test fallback. */
export function createLocalCvStorage(directory?: string): CvStorageProvider {
  const baseDir = path.resolve(directory ?? process.env.CV_STORAGE_DIR ?? "data/cv-uploads");
  const resolveKey = (key: string): string => {
    const resolved = path.resolve(baseDir, key);
    if (!resolved.startsWith(baseDir + path.sep)) throw new Error("Invalid storage key.");
    return resolved;
  };
  return {
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
  };
}

/** Vercel Blob storage — used in the Vercel deployment (private blobs). */
export function createVercelBlobCvStorage(token: string): CvStorageProvider {
  return {
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
  };
}

let cached: CvStorageProvider | null = null;

/**
 * Resolve the active storage provider once. Vercel Blob when its token is
 * configured (production), otherwise the local filesystem fallback.
 */
export function getCvStorage(): CvStorageProvider {
  if (cached) return cached;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  cached = token ? createVercelBlobCvStorage(token) : createLocalCvStorage();
  return cached;
}

/** Test seam: reset the cached provider (used when env overrides change). */
export function resetCvStorageForTests(): void {
  cached = null;
}
