import { DuckDBInstance } from "@duckdb/node-api";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const databasePath = path.resolve(__dirname, "../../database/movies.db");

const db = await DuckDBInstance.create(databasePath);

export function pickValues(obj: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => keys.includes(k))
  );
}

export default db;
