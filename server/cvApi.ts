/**
 * Task 24G — CV upload & manual CV review API.
 *
 * Applicant endpoints (applicant token, never Admin auth):
 *   PUT    /api/public/applications/me/cv   — upload or replace the CV
 *   GET    /api/public/applications/me/cv   — inspect current CV metadata
 *   DELETE /api/public/applications/me/cv   — remove the CV before submission
 *
 * Admin endpoints (Task 24B authorization per route):
 *   GET    /api/admin/applications/:id/cv         — CV metadata + review
 *   GET    /api/admin/applications/:id/cv/file    — proxied file (view/download)
 *   PUT    /api/admin/applications/:id/cv-review  — save manual 0–100 score
 *   DELETE /api/admin/applications/:id/cv-review  — reset the CV score
 *
 * Security model:
 * - CV bytes live in object/file storage and are NEVER exposed through a
 *   public or permanent URL; the Admin file route streams them through the
 *   authenticated API. Applicants only ever see their own metadata.
 * - Storage keys are generated server-side; user input never forms a path.
 * - Uploads are validated server-side from file content (magic bytes), not
 *   the browser MIME type.
 * - The CV review never touches the assessment engine: saving a score only
 *   writes `application_cv_reviews`.
 */
import express, { type Request, type Response, type Router } from "express";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { applications, applicationCvFiles, applicationCvReviews } from "../drizzle/schema";
import { validateCvUpload } from "./cvFileValidation";
import { getCvStorage } from "./cvStorage";
import { validateCvScoreInput } from "../shared/candidateScore";
import type { CvFileMetadata, CvReviewRecord } from "../shared/cvApi";
import { findApplicationByToken } from "./applicationRepository";
import { findAdminProfileForUser, readSessionToken, resolveSession } from "./adminAuth";
import { isAdminAuthorized } from "../shared/adminAuth";

function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function fail(response: Response, status: number, error: string) {
  response.status(status).json({ ok: false, error });
}

function handleRouteError(context: string) {
  return (error: unknown, response: Response) => {
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
  // Raw binary body with an 11 MB route-level limit (10 MB payload headroom).
  // The filename travels in an `x-cv-filename` header because the body is the
  // raw file itself.

  router.put(
    "/api/public/applications/me/cv",
    express.raw({ type: () => true, limit: "11mb" }),
    async (request: Request, response: Response) => {
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

        // Replace semantics: one active CV per application. Remove the old
        // object first so a failed replacement never orphans the new file
        // while the metadata still points at the old one.
        const storage = getCvStorage();
        const existing = await loadCvFileRow(application.id);
        const storageKey = `cv/${application.id}/${generateId()}${validation.extension}`;
        await storage.save(storageKey, body);

        const db = await getDb();
        try {
          if (existing) {
            await db
              .update(applicationCvFiles)
              .set({ storageKey, originalFilename: validation.sanitizedFilename, mimeType: validation.mimeType, fileSize: body.length, uploadedAt: new Date() })
              .where(eq(applicationCvFiles.id, existing.id));
            if (existing.storageKey !== storageKey) await storage.remove(existing.storageKey).catch(() => undefined);
          } else {
            await db.insert(applicationCvFiles).values({
              id: generateId(),
              applicationId: application.id,
              storageKey,
              originalFilename: validation.sanitizedFilename,
              mimeType: validation.mimeType,
              fileSize: body.length,
            });
          }
        } catch (error) {
          // Metadata persistence failed — do not leave an orphaned object.
          await storage.remove(storageKey).catch(() => undefined);
          throw error;
        }

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
  // The file is streamed through this authenticated route — CVs are never
  // served from a public or guessable URL. `?download=1` forces attachment.

  router.get("/api/admin/applications/:id/cv/file", async (request: Request, response: Response) => {
    const adminProfileId = await requireAuthorizedAdmin(request, response);
    if (!adminProfileId) return;
    try {
      const row = await loadCvFileRow(request.params.id);
      if (!row) return fail(response, 404, "No CV has been uploaded for this application.");
      const bytes = await getCvStorage().read(row.storageKey);
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
