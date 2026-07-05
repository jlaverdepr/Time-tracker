import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

if (!process.env.DB_PATH) {
  throw new Error(
    "DB_PATH must be set to the path of the local SQLite database file.",
  );
}

mkdirSync(path.dirname(process.env.DB_PATH), { recursive: true });

export const sqlite: Database.Database = new Database(process.env.DB_PATH);
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export * from "./schema";
