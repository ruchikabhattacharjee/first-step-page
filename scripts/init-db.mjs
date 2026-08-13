// Creates/updates the SQLite schema without the Prisma schema engine
// (that binary needs libssl, which isn't present in every build image).
// Idempotent: safe to run on every build and boot.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const sql = readFileSync(join(process.cwd(), "prisma", "schema.sql"), "utf8");
const statements = sql
  .split(";")
  .map((s) =>
    s
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim()
  )
  .filter(Boolean);

const prisma = new PrismaClient();
try {
  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
  }
  // Older databases predate OtpToken.purpose — add it when missing.
  const cols = await prisma.$queryRawUnsafe(`PRAGMA table_info("OtpToken")`);
  if (!cols.some((c) => c.name === "purpose")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "OtpToken" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'SIGNUP'`
    );
  }
  console.log("database schema ready");
} finally {
  await prisma.$disconnect();
}
