import { DuckDBInstance } from "@duckdb/node-api";

const db = await DuckDBInstance.create("database/movies.db");

export function pickValues(obj: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => keys.includes(k))
  );
}

export default db;
