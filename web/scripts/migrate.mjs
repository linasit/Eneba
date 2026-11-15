import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const connectionString =
  process.env.ENEBA_DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.ENEBA_DATABASE_URL;
if (!connectionString) {
  console.error(
    "Database migration requires the connected Neon database variables.",
  );
  process.exit(1);
}
const client = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 15000,
});
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('keyvault-schema-migrations', 0))",
  );
  const state = await client.query(
    "SELECT to_regclass('public.keyvault_migrations') AS ledger, to_regclass('public.users') AS users",
  );
  if (!state.rows[0].ledger && state.rows[0].users)
    throw new Error(
      "Existing untracked marketplace schema; automatic migration refused",
    );
  await client.query(
    "CREATE TABLE IF NOT EXISTS keyvault_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (
    await readdir(new URL("../../migrations/", import.meta.url))
  )
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort()) {
    const sql = await readFile(
      new URL(`../../migrations/${name}`, import.meta.url),
      "utf8",
    );
    const checksum = createHash("sha256").update(sql).digest("hex");
    const previous = await client.query(
      "SELECT checksum FROM keyvault_migrations WHERE name=$1",
      [name],
    );
    if (previous.rows.length) {
      if (previous.rows[0].checksum !== checksum)
        throw new Error(`Applied migration changed: ${name}`);
      console.log(`Already applied: ${name}`);
      continue;
    }
    await client.query(sql);
    await client.query(
      "INSERT INTO keyvault_migrations(name,checksum) VALUES($1,$2)",
      [name, checksum],
    );
    console.log(`Applied: ${name}`);
  }
  await client.query("COMMIT");
  const counts = await client.query(
    "SELECT (SELECT count(*) FROM products)::int AS products, (SELECT count(*) FROM offers)::int AS offers, (SELECT count(*) FROM key_inventory)::int AS keys",
  );
  console.log("Database ready:", counts.rows[0]);
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(
    "Migration failed:",
    error.code ||
      error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[redacted]"),
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
