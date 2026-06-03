import { DuckDBConnection } from "@duckdb/node-api";
import db from "./connection.js";

const formattedValue = (value: unknown) => {
  if (value == null) return "NULL";
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return value;
};

// joins, where, limit, count, order
export function list(tbl: string) {
  let joinString = "";
  let whereString = "";
  let orderString = "";
  let limitString = "";
  let countString = "";

  const appendCondition = (
    type: string,
    field: string,
    operator: string,
    value: string | number | boolean
  ) => {
    const formatted = formattedValue(value);
    if (!whereString) {
      whereString = ` WHERE ${field} ${operator} ${formatted}`;
    } else {
      whereString += ` ${type} ${field} ${operator} ${formatted}`;
    }
  };

  return {
    join(joinTbl: string, leftValue: string, rightValue: string) {
      joinString += ` JOIN ${joinTbl} ON ${leftValue} = ${rightValue}`;
      return this;
    },

    leftJoin(joinTbl: string, leftValue: string, rightValue: string) {
      joinString += ` LEFT JOIN ${joinTbl} ON ${leftValue} = ${rightValue}`;
      return this;
    },

    rightJoin(joinTbl: string, leftValue: string, rightValue: string) {
      joinString += ` RIGHT JOIN ${joinTbl} ON ${leftValue} = ${rightValue}`;
      return this;
    },

    fullJoin(joinTbl: string, leftValue: string, rightValue: string) {
      joinString += ` FULL JOIN ${joinTbl} ON ${leftValue} = ${rightValue}`;
      return this;
    },

    where(field: string, operator: string, value: string | number | boolean) {
      appendCondition("AND", field, operator, value);
      return this;
    },

    andWhere(
      field: string,
      operator: string,
      value: string | number | boolean
    ) {
      appendCondition("AND", field, operator, value);
      return this;
    },

    orWhere(field: string, operator: string, value: string | number | boolean) {
      appendCondition("OR", field, operator, value);
      return this;
    },

    orderBy(field: string, style: string = "ASC") {
      orderString = ` ORDER BY ${field} ${style}`;
      return this;
    },

    limit(num: number) {
      limitString = ` LIMIT ${num}`;
      return this;
    },

    count(field: string = "*") {
      countString = `COUNT(${field}) AS count`;
      return this;
    },

    async select(fields: string = "*") {
      const conn = await db.connect();
      try {
        const selectClause = countString ? countString : fields;
        const sql = `SELECT ${selectClause} FROM ${tbl} ${joinString} ${whereString} ${orderString} ${limitString}`;
        const result = await conn.run(sql);
        return await result.getRowObjectsJson();
      } catch (e) {
        console.log(e);
        throw e;
      } finally {
        conn.closeSync();
      }
    },
  };
}

export async function save(tbl: string, data: Record<string, unknown>) {
  const conn: DuckDBConnection = await db.connect();

  try {
    let nextId: number;

    if (data.id != null) {
      if (typeof data.id === "number") {
        nextId = data.id;
      } else if (typeof data.id === "string") {
        const parsed = Number(data.id);
        if (Number.isNaN(parsed)) throw new Error("Invalid id value");
        nextId = parsed;
      } else {
        throw new Error("Invalid id type");
      }
    } else {
      const result = await conn.run(
        `SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM ${tbl}`
      );

      const rows = await result.getRowObjectsJson();
      nextId = Number(rows[0]?.nextId ?? 1);
    }

    const hasId = data.id != null;
    const dataKeys = Object.keys(data);

    const formatValue = (v: unknown) =>
      v == null
        ? "NULL"
        : typeof v === "string"
          ? `'${v.replace(/'/g, "''")}'`
          : typeof v === "boolean"
            ? v
              ? "TRUE"
              : "FALSE"
            : v;

    // if an id exists, update the existing row; otherwise insert a new one
    if (hasId) {
      const updateKeys = dataKeys.filter((key) => key !== "id");
      if (updateKeys.length === 0) {
        throw new Error("No fields to update");
      }

      const assignments = updateKeys
        .map((key) => `${key} = ${formatValue(data[key])}`)
        .join(", ");

      const sql = `UPDATE ${tbl} SET ${assignments} WHERE id = ${nextId}`;
      await conn.run(sql);
      return nextId;
    }

    const fieldsArray = ["id", ...dataKeys];
    const valuesArray = [nextId, ...Object.values(data)];

    const fields = fieldsArray.join(", ");
    const values = valuesArray.map((v) => formatValue(v)).join(", ");

    const sql = `INSERT INTO ${tbl} (${fields}) VALUES (${values})`;

    await conn.run(sql);
    return nextId;
  } catch (e) {
    console.log(e);
    throw e;
  } finally {
    conn.closeSync();
  }
}

export async function remove(tbl: string, id: number) {
  const conn = await db.connect();
  try {
    const sql = `DELETE FROM ${tbl} WHERE id = ${id}`;
    await conn.run(sql);
    return id;
  } catch (e) {
    console.log(e);
    throw e;
  } finally {
    conn.closeSync();
  }
}
