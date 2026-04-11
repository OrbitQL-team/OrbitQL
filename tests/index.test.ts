import * as schema from './schema';
import build_query from "../src";
import { NONE, StructuredQuery, TableStructure } from "../src/types";
import mysql from 'mysql2/promise';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import { describe, it, expect } from "vitest";

const client = mysql.createPool("mysql://polaris:polaris_is_very_cool@localhost:3306/polaris");

const DB = process.env.DB || 'mysql';
const local_user = process.env.USER_OBJ ? JSON.parse(process.env.USER_OBJ) : null
const query:StructuredQuery = process.env.STRUCTURE_QUERY ? JSON.parse(process.env.STRUCTURE_QUERY) : null;
let structure:Record<string, TableStructure> = process.env.STRUCTURE_OBJ ? JSON.parse(process.env.STRUCTURE_OBJ) : null;

const db = drizzle(client, { schema, mode: 'default' }) ?? null as unknown as MySql2Database

function injectSchemaIntoTable(config:Record<string, TableStructure>, schema:any) {
  const result:any = {};

  for (const key in config) {
    if (!schema[key]) {
      throw new Error(`Missing schema for key: ${key}`);
    }

    result[key] = {
      ...config[key],
      table: schema[key] // ← replace "users" with schema.users
    };
  }

  return result;
}

structure = injectSchemaIntoTable(structure, schema)

if(query == null) throw Error('Query not passed')

it("should measure build and execute performance", async () => {
  // Measure build time
  const buildStart = performance.now();

  const built_query = await build_query(
    db,
    query,
    local_user,
    "user",
    structure
  );

  const buildTime = performance.now() - buildStart;

  // Measure execution time
  const execStart = performance.now();

  await expect(built_query.execute()).resolves.not.toThrow();

  const execTime = performance.now() - execStart;

  console.log(`Build time: ${buildTime.toFixed(2)} ms`);
  console.log(`Execute time: ${execTime.toFixed(2)} ms`);
});