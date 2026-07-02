import type { DuckDBConnection } from "@duckdb/node-api";
import db from "./connection.js";

type QueryValue = string | number | boolean | bigint | null;
type Row = Record<string, unknown>;
type JoinType = "JOIN" | "LEFT JOIN" | "RIGHT JOIN" | "FULL JOIN";
type Direction = "ASC" | "DESC";
type Logical = "AND" | "OR";

const identifierPart = /^[A-Za-z_][A-Za-z0-9_]*$/;
const operators = new Set([
  "=",
  "!=",
  "<>",
  ">",
  ">=",
  "<",
  "<=",
  "LIKE",
  "NOT LIKE",
  "ILIKE",
  "IN",
  "NOT IN",
]);

function assertIdentifier(value: string, label = "identifier") {
  const parts = value.split(".");
  if (!parts.every((part) => identifierPart.test(part))) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

function identifier(value: string) {
  assertIdentifier(value);
  return value;
}

function tableRef(name: string, alias?: string) {
  assertIdentifier(name, "table name");
  if (!alias) return name;
  assertIdentifier(alias, "table alias");
  return `${name} AS ${alias}`;
}

function normalizeOperator(operator: string) {
  const normalized = operator.trim().toUpperCase();
  if (!operators.has(normalized)) {
    throw new Error(`Unsupported operator: ${operator}`);
  }
  return normalized;
}

function normalizeValue(value: unknown): QueryValue {
  if (value == null) return null;
  if (["string", "number", "boolean", "bigint"].includes(typeof value)) {
    return value as QueryValue;
  }
  throw new Error(`Unsupported query value: ${String(value)}`);
}

function normalizeRow(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      assertIdentifier(key, "column name");
      return [key, normalizeValue(value)];
    })
  ) as Record<string, QueryValue>;
}

function placeholders(count: number) {
  return Array.from({ length: count }, () => "?").join(", ");
}

type Condition =
  | {
      kind: "basic";
      logical: Logical;
      field: string;
      operator: string;
      value: QueryValue;
    }
  | { kind: "null"; logical: Logical; field: string; not: boolean }
  | { kind: "between"; logical: Logical; field: string; values: [QueryValue, QueryValue] }
  | { kind: "in"; logical: Logical; field: string; values: QueryValue[]; not: boolean }
  | { kind: "raw"; logical: Logical; sql: string; params: QueryValue[] };

type Join = {
  type: JoinType;
  table: string;
  alias?: string;
  left: string;
  operator: string;
  right: string;
};

export class RawSql {
  constructor(
    public readonly sql: string,
    public readonly params: QueryValue[] = []
  ) {}
}

export function raw(sql: string, params: unknown[] = []) {
  return new RawSql(sql, params.map(normalizeValue));
}

export type ColumnSchema = {
  type: string;
  primary?: boolean;
  nullable?: boolean;
  unique?: boolean;
  default?: string;
  references?: { table: string; column: string };
};

export type TableSchema<T extends Row = Row> = {
  name: string;
  alias?: string;
  columns?: Record<keyof T & string, ColumnSchema>;
  primaryKey?: keyof T & string;
};

export function table<T extends Row>(
  name: string,
  columns?: Record<keyof T & string, ColumnSchema>,
  options: { alias?: string; primaryKey?: keyof T & string } = {}
): TableSchema<T> {
  assertIdentifier(name, "table name");
  if (options.alias) assertIdentifier(options.alias, "table alias");
  for (const column of Object.keys(columns ?? {})) {
    assertIdentifier(column, "column name");
  }
  return { name, columns, alias: options.alias, primaryKey: options.primaryKey };
}

export function col<T extends Row>(tbl: TableSchema<T>, column: keyof T & string) {
  assertIdentifier(column, "column name");
  return `${tbl.alias ?? tbl.name}.${column}`;
}

export class SelectQuery<T extends Row = Row> {
  private readonly joins: Join[] = [];
  private readonly conditions: Condition[] = [];
  private readonly groups: string[] = [];
  private readonly havings: Condition[] = [];
  private readonly orders: { field: string; direction: Direction }[] = [];
  private readonly selected: (string | RawSql)[] = ["*"];
  private rowLimit?: number;
  private rowOffset?: number;
  private distinctRows = false;

  constructor(
    private readonly orm: DuckOrm,
    private readonly source: TableSchema<T>
  ) {}

  select(...fields: (keyof T & string | string | RawSql)[]) {
    this.selected.splice(0, this.selected.length, ...(fields.length ? fields : ["*"]));
    return this;
  }

  distinct() {
    this.distinctRows = true;
    return this;
  }

  join(tableName: string, left: string, right: string, alias?: string) {
    return this.addJoin("JOIN", tableName, left, "=", right, alias);
  }

  leftJoin(tableName: string, left: string, right: string, alias?: string) {
    return this.addJoin("LEFT JOIN", tableName, left, "=", right, alias);
  }

  rightJoin(tableName: string, left: string, right: string, alias?: string) {
    return this.addJoin("RIGHT JOIN", tableName, left, "=", right, alias);
  }

  fullJoin(tableName: string, left: string, right: string, alias?: string) {
    return this.addJoin("FULL JOIN", tableName, left, "=", right, alias);
  }

  where(field: string, operator: string, value: unknown) {
    return this.addCondition(this.conditions, "AND", field, operator, value);
  }

  andWhere(field: string, operator: string, value: unknown) {
    return this.where(field, operator, value);
  }

  orWhere(field: string, operator: string, value: unknown) {
    return this.addCondition(this.conditions, "OR", field, operator, value);
  }

  whereNull(field: string) {
    return this.addNullCondition(this.conditions, "AND", field, false);
  }

  whereNotNull(field: string) {
    return this.addNullCondition(this.conditions, "AND", field, true);
  }

  whereIn(field: string, values: unknown[]) {
    return this.addInCondition(this.conditions, "AND", field, values, false);
  }

  whereNotIn(field: string, values: unknown[]) {
    return this.addInCondition(this.conditions, "AND", field, values, true);
  }

  whereBetween(field: string, min: unknown, max: unknown) {
    return this.addBetweenCondition(this.conditions, "AND", field, min, max);
  }

  whereRaw(sql: string, params: unknown[] = []) {
    this.conditions.push({ kind: "raw", logical: "AND", sql, params: params.map(normalizeValue) });
    return this;
  }

  groupBy(...fields: string[]) {
    fields.forEach((field) => assertIdentifier(field, "group field"));
    this.groups.push(...fields);
    return this;
  }

  having(field: string, operator: string, value: unknown) {
    return this.addCondition(this.havings, "AND", field, operator, value);
  }

  orderBy(field: string, direction: Direction = "ASC") {
    assertIdentifier(field, "order field");
    this.orders.push({ field, direction });
    return this;
  }

  limit(count: number) {
    if (!Number.isInteger(count) || count < 0) throw new Error("Limit must be a positive integer");
    this.rowLimit = count;
    return this;
  }

  offset(count: number) {
    if (!Number.isInteger(count) || count < 0) throw new Error("Offset must be a positive integer");
    this.rowOffset = count;
    return this;
  }

  async execute<R extends Row = T>() {
    const compiled = this.toSQL();
    return this.orm.all<R>(compiled.sql, compiled.params);
  }

  async first<R extends Row = T>() {
    const rows = await this.limit(1).execute<R>();
    return rows[0] ?? null;
  }

  async count(field = "*") {
    const rows = await this.select(raw(`COUNT(${field === "*" ? "*" : identifier(field)}) AS count`)).first<{ count: number }>();
    return Number(rows?.count ?? 0);
  }

  toSQL() {
    const params: QueryValue[] = [];
    const selectSql = this.selected
      .map((field) => {
        if (field instanceof RawSql) {
          params.push(...field.params);
          return field.sql;
        }
        return field === "*" ? "*" : identifier(field);
      })
      .join(", ");

    const sql = [
      `SELECT ${this.distinctRows ? "DISTINCT " : ""}${selectSql}`,
      `FROM ${tableRef(this.source.name, this.source.alias)}`,
      this.compileJoins(),
      this.compileConditions("WHERE", this.conditions, params),
      this.groups.length ? `GROUP BY ${this.groups.join(", ")}` : "",
      this.compileConditions("HAVING", this.havings, params),
      this.orders.length
        ? `ORDER BY ${this.orders.map((order) => `${order.field} ${order.direction}`).join(", ")}`
        : "",
      this.rowLimit == null ? "" : `LIMIT ${this.rowLimit}`,
      this.rowOffset == null ? "" : `OFFSET ${this.rowOffset}`,
    ]
      .filter(Boolean)
      .join(" ");

    return { sql, params };
  }

  private addJoin(type: JoinType, tableName: string, left: string, operator: string, right: string, alias?: string) {
    assertIdentifier(tableName, "join table");
    if (alias) assertIdentifier(alias, "join alias");
    assertIdentifier(left, "join field");
    assertIdentifier(right, "join field");
    this.joins.push({ type, table: tableName, alias, left, operator, right });
    return this;
  }

  private addCondition(target: Condition[], logical: Logical, field: string, operator: string, value: unknown) {
    assertIdentifier(field, "where field");
    target.push({
      kind: "basic",
      logical,
      field,
      operator: normalizeOperator(operator),
      value: normalizeValue(value),
    });
    return this;
  }

  private addNullCondition(target: Condition[], logical: Logical, field: string, not: boolean) {
    assertIdentifier(field, "where field");
    target.push({ kind: "null", logical, field, not });
    return this;
  }

  private addInCondition(target: Condition[], logical: Logical, field: string, values: unknown[], not: boolean) {
    assertIdentifier(field, "where field");
    if (!values.length) throw new Error("whereIn requires at least one value");
    target.push({ kind: "in", logical, field, values: values.map(normalizeValue), not });
    return this;
  }

  private addBetweenCondition(target: Condition[], logical: Logical, field: string, min: unknown, max: unknown) {
    assertIdentifier(field, "where field");
    target.push({ kind: "between", logical, field, values: [normalizeValue(min), normalizeValue(max)] });
    return this;
  }

  private compileJoins() {
    return this.joins
      .map(
        (join) =>
          `${join.type} ${tableRef(join.table, join.alias)} ON ${join.left} ${join.operator} ${join.right}`
      )
      .join(" ");
  }

  private compileConditions(prefix: string, conditions: Condition[], params: QueryValue[]) {
    if (!conditions.length) return "";
    const parts = conditions.map((condition, index) => {
      const logical = index === 0 ? "" : `${condition.logical} `;
      if (condition.kind === "basic") {
        params.push(condition.value);
        return `${logical}${condition.field} ${condition.operator} ?`;
      }
      if (condition.kind === "null") {
        return `${logical}${condition.field} IS ${condition.not ? "NOT " : ""}NULL`;
      }
      if (condition.kind === "between") {
        params.push(...condition.values);
        return `${logical}${condition.field} BETWEEN ? AND ?`;
      }
      if (condition.kind === "in") {
        params.push(...condition.values);
        return `${logical}${condition.field} ${condition.not ? "NOT " : ""}IN (${placeholders(condition.values.length)})`;
      }
      params.push(...condition.params);
      return `${logical}${condition.sql}`;
    });
    return `${prefix} ${parts.join(" ")}`;
  }
}

export class DuckOrm {
  constructor(private readonly transactionConnection?: DuckDBConnection) {}

  from<T extends Row>(schema: TableSchema<T>) {
    return new SelectQuery<T>(this, schema);
  }

  table<T extends Row>(name: string, options: { alias?: string; primaryKey?: keyof T & string } = {}) {
    return this.from<T>(table<T>(name, undefined, options));
  }

  async all<T extends Row = Row>(sql: string, params: QueryValue[] = []) {
    const conn = await this.connection();
    try {
      const result = await conn.run(sql, params);
      return (await result.getRowObjectsJson()) as T[];
    } finally {
      this.closeIfOwned(conn);
    }
  }

  async run(sql: string, params: QueryValue[] = []) {
    const conn = await this.connection();
    try {
      await conn.run(sql, params);
    } finally {
      this.closeIfOwned(conn);
    }
  }

  async insert<T extends Row>(schema: TableSchema<T>, data: Partial<T>) {
    const row = normalizeRow(data);
    const keys = Object.keys(row);
    if (!keys.length) throw new Error("Insert requires at least one column");
    const sql = `INSERT INTO ${identifier(schema.name)} (${keys.join(", ")}) VALUES (${placeholders(keys.length)})`;
    await this.run(sql, keys.map((key) => row[key]));
    return row;
  }

  async update<T extends Row>(schema: TableSchema<T>, data: Partial<T>, where: Partial<T>) {
    const row = normalizeRow(data);
    const whereRow = normalizeRow(where);
    const keys = Object.keys(row);
    const whereKeys = Object.keys(whereRow);
    if (!keys.length) throw new Error("Update requires at least one column");
    if (!whereKeys.length) throw new Error("Update requires a where clause");
    const sql = `UPDATE ${identifier(schema.name)} SET ${keys
      .map((key) => `${key} = ?`)
      .join(", ")} WHERE ${whereKeys.map((key) => `${key} = ?`).join(" AND ")}`;
    await this.run(sql, [...keys.map((key) => row[key]), ...whereKeys.map((key) => whereRow[key])]);
    return row;
  }

  async delete<T extends Row>(schema: TableSchema<T>, where: Partial<T>) {
    const whereRow = normalizeRow(where);
    const whereKeys = Object.keys(whereRow);
    if (!whereKeys.length) throw new Error("Delete requires a where clause");
    const sql = `DELETE FROM ${identifier(schema.name)} WHERE ${whereKeys.map((key) => `${key} = ?`).join(" AND ")}`;
    await this.run(sql, whereKeys.map((key) => whereRow[key]));
  }

  async upsertById<T extends Row & { id?: unknown }>(schema: TableSchema<T>, data: Partial<T>) {
    const primaryKey = schema.primaryKey ?? "id";
    assertIdentifier(primaryKey, "primary key");
    const id = data[primaryKey as keyof T];
    if (id != null) {
      const updates = { ...data };
      delete updates[primaryKey as keyof T];
      const normalizedId = normalizeValue(id);
      const existing = await this
        .from(schema)
        .where(primaryKey, "=", normalizedId)
        .first();
      if (existing) {
        if (Object.keys(updates).length) {
          await this.update(schema, updates, { [primaryKey]: normalizedId } as Partial<T>);
        }
      } else {
        await this.insert(schema, data);
      }
      return normalizedId;
    }

    const nextId = await this.nextIntegerId(schema.name, primaryKey);
    await this.insert(schema, { ...data, [primaryKey]: nextId } as Partial<T>);
    return nextId;
  }

  async transaction<T>(callback: (trx: DuckOrm) => Promise<T>) {
    const conn = await db.connect();
    const trx = new DuckOrm(conn);
    try {
      await conn.run("BEGIN TRANSACTION");
      const result = await callback(trx);
      await conn.run("COMMIT");
      return result;
    } catch (error) {
      await conn.run("ROLLBACK");
      throw error;
    } finally {
      conn.closeSync();
    }
  }

  async createTable(schema: TableSchema) {
    if (!schema.columns) throw new Error(`No columns defined for ${schema.name}`);
    const definitions = Object.entries(schema.columns).map(([name, column]) => {
      const pieces = [identifier(name), column.type];
      if (column.primary) pieces.push("PRIMARY KEY");
      if (column.unique) pieces.push("UNIQUE");
      if (!column.nullable && !column.primary) pieces.push("NOT NULL");
      if (column.default) pieces.push(`DEFAULT ${column.default}`);
      if (column.references) {
        pieces.push(`REFERENCES ${identifier(column.references.table)}(${identifier(column.references.column)})`);
      }
      return pieces.join(" ");
    });
    await this.run(`CREATE TABLE IF NOT EXISTS ${identifier(schema.name)} (${definitions.join(", ")})`);
  }

  async migrate(migrations: { name: string; up: (orm: DuckOrm) => Promise<void> }[]) {
    await this.run("CREATE TABLE IF NOT EXISTS orm_migrations (name VARCHAR PRIMARY KEY, run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
    const completed = await this.all<{ name: string }>("SELECT name FROM orm_migrations");
    const completedNames = new Set(completed.map((row) => row.name));
    for (const migration of migrations) {
      if (completedNames.has(migration.name)) continue;
      await this.transaction(async (trx) => {
        await migration.up(trx);
        await trx.insert(table("orm_migrations"), { name: migration.name });
      });
    }
  }

  readCsv(path: string, options = "AUTO_DETECT=TRUE") {
    return raw(`read_csv(?, ${options})`, [path]);
  }

  readParquet(path: string) {
    return raw("read_parquet(?)", [path]);
  }

  private async nextIntegerId(tableName: string, primaryKey: string) {
    const rows = await this.all<{ nextId: number }>(
      `SELECT COALESCE(MAX(${identifier(primaryKey)}), 0) + 1 AS nextId FROM ${identifier(tableName)}`
    );
    return Number(rows[0]?.nextId ?? 1);
  }

  private async connection() {
    return this.transactionConnection ?? db.connect();
  }

  private closeIfOwned(conn: DuckDBConnection) {
    if (!this.transactionConnection) conn.closeSync();
  }
}

export const orm = new DuckOrm();

function inferTable(input: string) {
  const match = input.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s+(?:as\s+)?([A-Za-z_][A-Za-z0-9_]*))?$/i);
  if (!match) throw new Error(`Invalid table reference: ${input}`);
  return table(match[1], undefined, { alias: match[2], primaryKey: "id" });
}

export function list(tbl: string) {
  const query = orm.from(inferTable(tbl));
  const parsedJoin = (input: string) => {
    const parsed = inferTable(input);
    return { name: parsed.name, alias: parsed.alias };
  };
  return {
    join(joinTbl: string, leftValue: string, rightValue: string) {
      const parsed = parsedJoin(joinTbl);
      query.join(parsed.name, leftValue, rightValue, parsed.alias);
      return this;
    },
    leftJoin(joinTbl: string, leftValue: string, rightValue: string) {
      const parsed = parsedJoin(joinTbl);
      query.leftJoin(parsed.name, leftValue, rightValue, parsed.alias);
      return this;
    },
    rightJoin(joinTbl: string, leftValue: string, rightValue: string) {
      const parsed = parsedJoin(joinTbl);
      query.rightJoin(parsed.name, leftValue, rightValue, parsed.alias);
      return this;
    },
    fullJoin(joinTbl: string, leftValue: string, rightValue: string) {
      const parsed = parsedJoin(joinTbl);
      query.fullJoin(parsed.name, leftValue, rightValue, parsed.alias);
      return this;
    },
    where(field: string, operator: string, value: string | number | boolean) {
      query.where(field, operator, value);
      return this;
    },
    andWhere(field: string, operator: string, value: string | number | boolean) {
      query.andWhere(field, operator, value);
      return this;
    },
    orWhere(field: string, operator: string, value: string | number | boolean) {
      query.orWhere(field, operator, value);
      return this;
    },
    orderBy(field: string, style: Direction = "ASC") {
      query.orderBy(field, style);
      return this;
    },
    limit(num: number) {
      query.limit(num);
      return this;
    },
    count(field = "*") {
      query.select(raw(`COUNT(${field === "*" ? "*" : identifier(field)}) AS count`));
      return this;
    },
    async select(fields = "*") {
      return query.select(...fields.split(",").map((field) => field.trim())).execute();
    },
  };
}

export async function save(tbl: string, data: Record<string, unknown>) {
  return orm.upsertById(inferTable(tbl), data);
}

export async function remove(tbl: string, id: number) {
  await orm.delete(inferTable(tbl), { id });
  return id;
}
