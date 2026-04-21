import * as schema from './schema';
import build_query from "../src";
import { NONE, StructuredQuery, TableStructure } from "../src/types";
import { it, expect } from "vitest";
import { createConnection } from './runner/db-connection.mjs';

const selected_db = process.env.DB || null;
const selected_family = process.env.DB_FAMILY || null;
const local_user = process.env.USER_OBJ ? JSON.parse(process.env.USER_OBJ) : null
const role = process.env.USER_ROLE ? process.env.USER_ROLE : null
const query:StructuredQuery = process.env.STRUCTURE_QUERY ? JSON.parse(process.env.STRUCTURE_QUERY) : null;
let structure:Record<string, TableStructure> = process.env.STRUCTURE_OBJ ? JSON.parse(process.env.STRUCTURE_OBJ) : null;

if(query == null) throw Error('Query not passed')
if(role == null) throw Error('Role not passed')
if(structure == null) throw Error('Structure not passed')
if(local_user == null) throw Error('User object not passed')
if(selected_db == null) throw Error('Database not selected')
if(selected_family == null) throw Error('Database family not selected')

let db = await createConnection({
  db: selected_db,
  family: selected_family,
});

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

it("should measure build and execute performance", async () => {
  // Measure build time
  const buildStart = performance.now();

  const built_query = await build_query(
    db,
    query,
    local_user,
    role,
    structure
  );

  const buildTime = performance.now() - buildStart;

  // Measure execution time
  const execStart = performance.now();

  const result = await built_query.execute();

  const execTime = performance.now() - execStart;

  console.log("Query result:", result);
  console.log(`Build time: ${buildTime.toFixed(2)} ms`);
  console.log(`Execute time: ${execTime.toFixed(2)} ms`);

  expect(result).toBeDefined();
});