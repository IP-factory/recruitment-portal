import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not available");
const seedSql = await readFile("/tmp/task24a-seed.sql", "utf8");
const statements = seedSql.split(/;\n/).map((statement) => statement.trim()).filter(Boolean);
const connection = await mysql.createConnection(databaseUrl);
try {
  for (const statement of statements) await connection.query(statement);
  console.log(JSON.stringify({ executed: statements.length }, null, 2));
} finally {
  await connection.end();
  process.exit(0);
}
