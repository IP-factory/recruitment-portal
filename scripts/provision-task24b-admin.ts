/**
 * Task 24B — secure initial Admin provisioning (operator-run).
 *
 * Creates the authentication account and Active Admin profile for the initial
 * Admin without ever storing the password: only a salted scrypt hash is
 * persisted, and the password itself must be supplied by the operator through
 * the ADMIN_PASSWORD environment variable (never via source, seed files, or
 * logs). The old demo password is explicitly rejected.
 *
 * Usage:
 *   ADMIN_PASSWORD='<operator-chosen strong password>' npx tsx scripts/provision-task24b-admin.ts
 * Optional:
 *   ADMIN_EMAIL=<email>        (default: admin@gmail.com)
 *   ADMIN_FULL_NAME=<name>
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";
import { hashPassword } from "../server/adminAuth";

const DEMO_PASSWORD = "123456";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not available");

const email = (process.env.ADMIN_EMAIL || "admin@gmail.com").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_FULL_NAME?.trim() || null;

if (!password) {
  console.error([
    "ADMIN_PASSWORD is required to provision the initial Admin account.",
    "Supply a strong operator-chosen password via the environment, e.g.:",
    "  ADMIN_PASSWORD='<strong password>' npx tsx scripts/provision-task24b-admin.ts",
    "The password is never written to source, seed files, logs, or the database.",
  ].join("\n"));
  process.exit(1);
}
if (password === DEMO_PASSWORD) throw new Error("The old demo password is not permitted for a real Admin account.");
if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.");

const openId = `credential:${email}`;
const passwordHash = hashPassword(password);

const connection = await mysql.createConnection(databaseUrl);
try {
  const [existingUsers] = await connection.query<Array<{ id: number }>>(
    "SELECT id FROM users WHERE openId = ? LIMIT 1",
    [openId],
  );
  let userId: number;
  if (existingUsers.length > 0) {
    userId = existingUsers[0].id;
    await connection.query(
      "UPDATE users SET password_hash = ?, email = ?, loginMethod = COALESCE(loginMethod, 'credential'), lastSignedIn = lastSignedIn WHERE id = ?",
      [passwordHash, email, userId],
    );
  } else {
    const [result] = await connection.query(
      "INSERT INTO users (openId, name, email, loginMethod, role, password_hash) VALUES (?, ?, ?, 'credential', 'user', ?)",
      [openId, fullName, email, passwordHash],
    );
    userId = (result as { insertId: number }).insertId;
  }

  const [existingProfiles] = await connection.query<Array<{ id: string }>>(
    "SELECT id FROM admin_profiles WHERE auth_user_id = ? LIMIT 1",
    [userId],
  );
  let profileId: string;
  if (existingProfiles.length > 0) {
    profileId = existingProfiles[0].id;
    await connection.query(
      "UPDATE admin_profiles SET email = ?, full_name = ?, role = 'Admin', status = 'Active' WHERE id = ?",
      [email, fullName, profileId],
    );
  } else {
    profileId = `admin-profile-${randomBytes(12).toString("hex")}`;
    await connection.query(
      "INSERT INTO admin_profiles (id, auth_user_id, email, full_name, role, status) VALUES (?, ?, ?, ?, 'Admin', 'Active')",
      [profileId, userId, email, fullName],
    );
  }

  // Report authorization metadata only — never the password or its hash.
  console.log(JSON.stringify({ provisioned: true, email, userId, profileId, role: "Admin", status: "Active" }, null, 2));
} finally {
  await connection.end();
  process.exit(0);
}
