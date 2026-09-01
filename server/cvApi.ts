/**
 * Task 24G — CV upload & manual CV review API.
 *
 * Applicant endpoints (applicant token, never Admin auth):
 *   POST   /api/public/applications/me/cv/upload-url — scoped direct-upload auth
 *   POST   /api/public/applications/me/cv/complete   — persist uploaded CV metadata
 *   PUT    /api/public/applications/me/cv   — legacy raw upload (local dev only)
 *   GET    /api/public/applications/me/cv   — inspect current CV metadata
 *   DELETE /api/public/applications/me/cv   — remove the CV before submission
 *
 * Admin endpoints (Task 24B authorization per route):
 *   GET    /api/admin/applications/:id/cv         — CV metadata + review
 *   GET    /api/admin/applications/:id/cv/file    — signed private URL (blob)
 *                                                   or proxied bytes (local dev)
 *   PUT    /api/admin/applications/:id/cv-review  — save manual 0–100 score
 *   DELETE /api/admin/applications/:id/cv-review  — reset the CV score
 *
 * Transport & security model:
 * - Vercel Functions have small payload limits, so CV bytes NEVER pass
 *   through this API in deployments. The browser uploads directly to the
 *   PRIVATE Blob store using a scoped, short-lived client token issued by
 *   `/cv/upload-url`; the read-write token never leaves the server.
 * - Admins receive a short-lived presigned GET URL for the private blob
 *   after authentication; bytes stream from Blob storage, not this API.
 * - Storage keys are generated server-side; user input never forms a path.
 *   Completion requests must present a key belonging to the caller's own
 *   application, so one applicant can never attach another applicant's blob.
 * - Uploads are validated server-side: extension + declared size before
 *   authorization, actual stored size/content type after upload (the browser
 *   MIME type is never trusted). The legacy local raw path additionally
 *   verifies magic bytes.
 * - In production, CV storage refuses to serve unless Vercel Blob is
 *   configured — the serverless filesystem is never used.
 * - The CV review never touches the assessment engine: saving a score only
 *   writes `application_cv_reviews`.
 */
import express, { type Request, type Response, type Router } from "express";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { applications, applicationCvFiles, applicationCvReviews } from "../drizzle/schema";
import { validateCvUpload, validateCvUploadDeclaration } from "./cvFileValidation";
import { CvStorageConfigurationError, LOCAL_DIRECT_UPLOAD_CODE, directBlobUploadAvailable, getCvStorage, isProductionRuntime } from "./cvStorage";
import { validateCvScoreInput } from "../shared/candidateScore";
import { CV_MAX_FILE_SIZE, CV_MIME_TYPES, type CvExtension, type CvFileMetadata, type CvReviewRecord } from "../shared/cvApi";
import { findApplicationByToken } from "./applicationRepository";
import { findAdminProfileForUser, readSessionToken, resolveSession } from "./adminAuth";
import { isAdminAuthorized } from "../shared/adminAuth";

/** Direct-upload authorizations are scoped and short-lived. */
const UPLOAD_AUTH_TTL_MS = 15 * 60 * 1000;
/** Admin signed GET URLs for private CV blobs are short-lived. */
const ADMIN_CV_URL_TTL_MS = 10 * 60 * 1000;

function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function fail(response: Response, status: number, error: string) {
  response.status(status).json({ ok: false, error });
}

function handleRouteError(context: string) {
  return (error: unknown, response: Response) => {
    if (error instanceof CvStorageConfigurationError) {
      console.error(`[cv] ${context}: storage unavailable:`, error.message);
      fail(response, 503, "CV storage is not configured for this deployment.");
      return;
    }
    console.error(`[cv] ${context} failed:`, error instanceof Error ? error.message : String(error));
    fail(response, 503, "Unable to process your request.");
  };
}

function generateId(): string {
  return randomBytes(12).toString("hex");
}

async function getDb() {
  return (await import("./db")).getDatabase();
}

/** Persist CV metadata with replace semantics; cleans up the object on failure. */
async function persistCvFile(
  storage: { remove(key: string): Promise<void> },
  applicationId: string,
  storageKey: string,
  details: { sanitizedFilename: string; mimeType: string; fileSize: number },
): Promise<void> {
  const db = await getDb();
  const existing = await loadCvFileRow(applicationId);
  try {
    if (existing) {
      await db
        .update(applicationCvFiles)
        .set({ storageKey, originalFilename: details.sanitizedFilename, mimeType: details.mimeType, fileSize: details.fileSize, uploadedAt: new Date() })
        .where(eq(applicationCvFiles.id, existing.id));
      // Replace semantics: one active CV per application. The old object is
      // removed only after the metadata points at the new one.
      if (existing.storageKey !== storageKey) await storage.remove(existing.storageKey).catch(() => undefined);
    } else {
      await db.insert(applicationCvFiles).values({
        id: generateId(),
        applicationId,
        storageKey,
        originalFilename: details.sanitizedFilename,
        mimeType: details.mimeType,
        fileSize: details.fileSize,
      });
    }
  } catch (error) {
    // Metadata persistence failed — do not leave an orphaned object.
    await storage.remove(storageKey).catch(() => undefined);
    throw error;
  }
}

/** A storage key belongs to exactly one application: `cv/<applicationId>/…`. */
function storageKeyBelongsToApplication(key: string, applicationId: string): boolean {
  return key.startsWith(`cv/${applicationId}/`) && key.length > `cv/${applicationId}/`.length && !key.slice(`cv/${applicationId}/`.length).includes("/");
}

// ── Applicant token resolution (same header contract as applicationApi) ─────

async function resolveApplicantApplication(request: Request, response: Response) {
  const header = request.headers["x-application-token"];
  const token = typeof header === "string" && header.trim() ? header.trim() : null;
  if (!token) {
    fail(response, 401, "Application access is required.");
    return null;
  }
  try {
    const application = await findApplicationByToken(token);
    if (!application) {
      fail(response, 403, "Unable to access your application.");
      return null;
    }
    return application;
  } catch (error) {
    console.error("[cv] token resolution failed:", error instanceof Error ? error.message : String(error));
    fail(response, 503, "Unable to access your application.");
    return null;
  }
}

/** CVs can be uploaded/replaced/removed only before final submission. */
function cvChangeAllowed(applicationStatus: string): boolean {
  return applicationStatus === "In Progress" || applicationStatus === "Assessment In Progress" || applicationStatus === "Assessment Complete";
}

async function loadCvFileRow(applicationId: string) {
  const db = await getDb();
  return (await db.select().from(applicationCvFiles).where(eq(applicationCvFiles.applicationId, applicationId)).limit(1))[0] ?? null;
}

async function loadCvReviewRow(applicationId: string) {
  const db = await getDb();
  return (await db.select().from(applicationCvReviews).where(eq(applicationCvReviews.applicationId, applicationId)).limit(1))[0] ?? null;
}

function toCvMetadata(row: { originalFilename: string; mimeType: string; fileSize: number; uploadedAt: Date }): CvFileMetadata {
  return {
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

function toCvReview(row: { score: string; reviewNote: string | null; reviewedAt: Date }): CvReviewRecord {
  return { score: Number(row.score), reviewNote: row.reviewNote, reviewedAt: row.reviewedAt.toISOString() };
}

// ── Admin guard (per-route, mirrors adminApplicationApi) ─────────────────────

async function requireAuthorizedAdmin(request: Request, response: Response): Promise<string | null> {
  if (!databaseConfigured()) {
    fail(response, 503, "Unable to load CV data.");
    return null;
  }
  try {
    const token = readSessionToken(request);
    const session = token ? await resolveSession(token) : null;
    const profile = session ? await findAdminProfileForUser(session.user.id) : null;
    if (!session || !isAdminAuthorized(session.user, profile)) {
      fail(response, 401, "Admin authorization is required.");
      return null;
    }
    return profile!.id;
  } catch (error) {
    console.error("[cv] admin authorization failed:", error instanceof Error ? error.message : String(error));
    fail(response, 503, "Unable to load CV data.");
    return null;
  }
}

// ── Router ───────────────────────────────────────────────────────────────────

export function createCvApiRouter(): Router {
  const router = express.Router();

  // ── Applicant: upload / replace CV ───────────────────────────────────────
  // Applicant: authorize a direct browser→Blob upload.
  // CV bytes never pass through this API. The applicant token, application
  // status and declared filename/size are validated, then a scoped,
  // short-lived client upload token is issued (one pathname, size and
  // content-type constraints). The Blob read-write token never leaves the
  // server.

  router.post("/api/public/applications/me/cv/upload-url", async (request: Request, response: Response) => {
    if (!databaseConfigured()) return fail(response, 503, "Unable to upload your CV.");
    try {
      const application = await resolveApplicantApplication(request, response);
      if (!application) return;
      if (!cvChangeAllowed(application.applicationStatus)) {
        return fail(response, 403, "Your CV can no longer be changed because the application has been submitted.");
      }

      const body = (request.body ?? {}) as { filename?: unknown; size?: unknown };
      const filename = typeof body.filename === "string" ? body.filename : "";
      const declaredSize = typeof body.size === "number" && Number.isFinite(body.size) ? body.size : null;
      const validation = validateCvUploadDeclaration(filename, declaredSize);
      if (!validation.ok) return fail(response, 400, validation.error);

      if (!directBlobUploadAvailable()) {
        if (isProductionRuntime()) {
          // Never fall back to the ephemeral serverless filesystem in production.
          return fail(response, 503, "CV storage is not configured for this deployment.");
        }
        // Local development has no object-store CDN — the client sends raw
        // bytes to the legacy PUT route instead.
        response.json({ mode: "local", code: LOCAL_DIRECT_UPLOAD_CODE, maximumSizeInBytes: CV_MAX_FILE_SIZE });
        return;
      }

      const storageKey = `cv/${application.id}/${generateId()}${validation.extension}`;
      const authorization = await getCvStorage().createUploadAuthorization(storageKey, {
        maximumSizeInBytes: CV_MAX_FILE_SIZE,
        allowedContentTypes: [validation.mimeType],
        validUntilMs: Date.now() + UPLOAD_AUTH_TTL_MS,
      });
      response.json({ mode: "blob", clientToken: authorization.clientToken, pathname: authorization.pathname, validUntil: authorization.validUntil, maximumSizeInBytes: CV_MAX_FILE_SIZE });
    } catch (error) {
      handleRouteError("authorize CV upload")(error, response);
    }
  });

  // Applicant: complete a direct upload.
  // Called after the browser puts the file into the PRIVATE Blob store.
  // Verifies the stored object exists, belongs to the caller's application,
  // and matches the declared size/content type before persisting metadata.

  router.post("/api/public/applications/me/cv/complete", async (request: Request, response: Response) => {
    if (!databaseConfigured()) return fail(response, 503, "Unable to upload your CV.");
    try {
      const application = await resolveApplicantApplication(request, response);
      if (!application) return;
      if (!cvChangeAllowed(application.applicationStatus)) {
        return fail(response, 403, "Your CV can no longer be changed because the application has been submitted.");
      }

      const body = (request.body ?? {}) as { pathname?: unknown; filename?: unknown; size?: unknown };
      const pathname = typeof body.pathname === "string" ? body.pathname : "";
      const filename = typeof body.filename === "string" ? body.filename : "";
      if (!storageKeyBelongsToApplication(pathname, application.id)) {
        // A key scoped to another application can never be attached here.
        return fail(response, 403, "This file does not belong to your application.");
      }
      const declaredSize = typeof body.size === "number" && Number.isFinite(body.size) ? body.size : null;
      const validation = validateCvUploadDeclaration(filename, declaredSize);
      if (!validation.ok) return fail(response, 400, validation.error);

      const storage = getCvStorage();
      const info = await storage.head(pathname);
      if (!info) return fail(response, 404, "The uploaded file could not be found. Please upload it again.");
      if (info.size > CV_MAX_FILE_SIZE) {
        await storage.remove(pathname).catch(() => undefined);
        return fail(response, 400, "The file is too large. CVs must be 10 MB or smaller.");
      }
      if (declaredSize !== null && info.size !== declaredSize) {
        await storage.remove(pathname).catch(() => undefined);
        return fail(response, 400, "The uploaded file does not match its declared size.");
      }
      if (info.contentType && info.contentType !== "application/octet-stream" && info.contentType !== validation.mimeType) {
        await storage.remove(pathname).catch(() => undefined);
        return fail(response, 400, "The uploaded file does not match its declared type.");
      }

      await persistCvFile(storage, application.id, pathname, {
        sanitizedFilename: validation.sanitizedFilename,
        mimeType: validation.mimeType,
        fileSize: info.size,
      });

      const row = await loadCvFileRow(application.id);
      if (!row) return fail(response, 503, "Unable to upload your CV.");
      response.json({ ok: true, cv: toCvMetadata(row) });
    } catch (error) {
      handleRouteError("complete CV upload")(error, response);
    }
  });

  // Applicant: raw byte upload (local development only).
  // Raw binary body with an 11 MB route-level limit (10 MB payload headroom).
  // The filename travels in an `x-cv-filename` header because the body is the
  // raw file itself. Disabled in production: bytes must travel browser→Blob
  // directly because Vercel Functions cannot carry 10 MB bodies and the
  // serverless filesystem must never store CVs.

  router.put(
    "/api/public/applications/me/cv",
    express.raw({ type: () => true, limit: "11mb" }),
    async (request: Request, response: Response) => {
      if (isProductionRuntime()) {
        return fail(response, 403, "Direct server uploads are disabled in this environment.");
      }
      if (!databaseConfigured()) return fail(response, 503, "Unable to upload your CV.");
      try {
        const application = await resolveApplicantApplication(request, response);
        if (!application) return;

        if (!cvChangeAllowed(application.applicationStatus)) {
          return fail(response, 403, "Your CV can no longer be changed because the application has been submitted.");
        }

        const body = request.body;
        if (!Buffer.isBuffer(body) || body.length === 0) {
          return fail(response, 400, "No file was received.");
        }

        const filenameHeader = request.headers["x-cv-filename"];
        const filename = typeof filenameHeader === "string" ? decodeURIComponent(filenameHeader) : "";
        const validation = validateCvUpload(body, filename);
        if (!validation.ok) return fail(response, 400, validation.error);

        const storage = getCvStorage();
        const storageKey = `cv/${application.id}/${generateId()}${validation.extension}`;
        await storage.save(storageKey, body);
        await persistCvFile(storage, application.id, storageKey, {
          sanitizedFilename: validation.sanitizedFilename,
          mimeType: validation.mimeType,
          fileSize: body.length,
        });

        const row = await loadCvFileRow(application.id);
        if (!row) return fail(response, 503, "Unable to upload your CV.");
        response.json({ ok: true, cv: toCvMetadata(row) });
      } catch (error) {
        handleRouteError("upload CV")(error, response);
      }
    },
  );

  // ── Applicant: inspect current CV metadata ───────────────────────────────

  router.get("/api/public/applications/me/cv", async (request: Request, response: Response) => {
    if (!databaseConfigured()) return fail(response, 503, "Unable to load your CV.");
    try {
      const application = await resolveApplicantApplication(request, response);
      if (!application) return;
      const row = await loadCvFileRow(application.id);
      response.json({ ok: true, cv: row ? toCvMetadata(row) : null });
    } catch (error) {
      handleRouteError("load CV metadata")(error, response);
    }
  });

  // ── Applicant: remove CV before submission ───────────────────────────────

  router.delete("/api/public/applications/me/cv", async (request: Request, response: Response) => {
    if (!databaseConfigured()) return fail(response, 503, "Unable to remove your CV.");
    try {
      const application = await resolveApplicantApplication(request, response);
      if (!application) return;
      if (!cvChangeAllowed(application.applicationStatus)) {
        return fail(response, 403, "Your CV can no longer be changed because the application has been submitted.");
      }
      const db = await getDb();
      const existing = await loadCvFileRow(application.id);
      if (existing) {
        await db.delete(applicationCvFiles).where(eq(applicationCvFiles.id, existing.id));
        await getCvStorage().remove(existing.storageKey).catch(() => undefined);
      }
      response.json({ ok: true, cv: null });
    } catch (error) {
      handleRouteError("remove CV")(error, response);
    }
  });

  // ── Admin: CV metadata + review ──────────────────────────────────────────

  router.get("/api/admin/applications/:id/cv", async (request: Request, response: Response) => {
    const adminProfileId = await requireAuthorizedAdmin(request, response);
    if (!adminProfileId) return;
    try {
      const [cvRow, reviewRow] = await Promise.all([
        loadCvFileRow(request.params.id),
        loadCvReviewRow(request.params.id),
      ]);
      response.json({
        ok: true,
        cv: cvRow ? toCvMetadata(cvRow) : null,
        review: reviewRow ? toCvReview(reviewRow) : null,
      });
    } catch (error) {
      handleRouteError("admin CV detail")(error, response);
    }
  });

  // ── Admin: proxied CV file (view or download) ────────────────────────────
  // Admin: CV file access (view or download).
  // Deployments: after admin authorization, a short-lived signed GET URL for
  // the PRIVATE blob is returned — the bytes stream from Blob storage and
  // never pass through this function. Local development (no CDN): the
  // authenticated route streams the bytes itself. `?download=1` forces
  // attachment in local mode; in deployments the Admin UI drives download
  // behaviour. The permanent Blob token is never returned.

  router.get("/api/admin/applications/:id/cv/file", async (request: Request, response: Response) => {
    const adminProfileId = await requireAuthorizedAdmin(request, response);
    if (!adminProfileId) return;
    try {
      const row = await loadCvFileRow(request.params.id);
      if (!row) return fail(response, 404, "No CV has been uploaded for this application.");
      const storage = getCvStorage();

      if (storage.mode === "blob") {
        const expiresAt = Date.now() + ADMIN_CV_URL_TTL_MS;
        const url = await storage.createSignedDownloadUrl(row.storageKey, { validUntilMs: expiresAt });
        response.json({ ok: true, kind: "url", url, filename: row.originalFilename, mimeType: row.mimeType, expiresAt });
        return;
      }

      const bytes = await storage.read(row.storageKey);
      if (!bytes) return fail(response, 404, "The CV file could not be found in storage.");

      const disposition = request.query.download === "1" ? "attachment" : "inline";
      const asciiName = row.originalFilename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
      response.setHeader("Content-Type", row.mimeType);
      response.setHeader("Content-Length", bytes.length);
      response.setHeader("Content-Disposition", `${disposition}; filename="${asciiName}"`);
      response.setHeader("Cache-Control", "no-store");
      response.end(bytes);
    } catch (error) {
      handleRouteError("admin CV file")(error, response);
    }
  });

  // ── Admin: save manual CV score (0–100) ──────────────────────────────────
  // This ONLY writes the CV review record. It never triggers or touches the
  // assessment scoring engine.

  router.put("/api/admin/applications/:id/cv-review", async (request: Request, response: Response) => {
    const adminProfileId = await requireAuthorizedAdmin(request, response);
    if (!adminProfileId) return;
    try {
      const applicationId = request.params.id;
      const db = await getDb();
      const application = (await db.select({ id: applications.id }).from(applications).where(eq(applications.id, applicationId)).limit(1))[0];
      if (!application) return fail(response, 404, "Application not found.");

      const validated = validateCvScoreInput((request.body as { score?: unknown } | undefined)?.score);
      if ("error" in validated) return fail(response, 400, validated.error);
      const noteRaw = (request.body as { note?: unknown } | undefined)?.note;
      const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim().slice(0, 2000) : null;

      const existing = await loadCvReviewRow(applicationId);
      if (existing) {
        await db
          .update(applicationCvReviews)
          .set({ score: String(validated.score), reviewNote: note, reviewedBy: adminProfileId, reviewedAt: new Date() })
          .where(eq(applicationCvReviews.id, existing.id));
      } else {
        await db.insert(applicationCvReviews).values({
          id: generateId(),
          applicationId,
          score: String(validated.score),
          reviewNote: note,
          reviewedBy: adminProfileId,
        });
      }
      const row = await loadCvReviewRow(applicationId);
      if (!row) return fail(response, 503, "Unable to save the CV review.");
      response.json({ ok: true, review: toCvReview(row) });
    } catch (error) {
      handleRouteError("save CV review")(error, response);
    }
  });

  // ── Admin: reset the CV score ────────────────────────────────────────────

  router.delete("/api/admin/applications/:id/cv-review", async (request: Request, response: Response) => {
    const adminProfileId = await requireAuthorizedAdmin(request, response);
    if (!adminProfileId) return;
    try {
      const db = await getDb();
      await db.delete(applicationCvReviews).where(eq(applicationCvReviews.applicationId, request.params.id));
      response.json({ ok: true, review: null });
    } catch (error) {
      handleRouteError("reset CV review")(error, response);
    }
  });

  return router;
}
