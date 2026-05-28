import * as schema from './schema';
import { getDB } from "./runner/db-connection.mjs"
import path from "path";

const db_host = process.env.DB_HOST || null;
const db_user = process.env.DB_USER || null;
const db_pwd = process.env.DB_PWD || null;
const db_name = process.env.DB_NAME || null;
const selected_family = process.env.DB_FAMILY || null;
const local_user = process.env.USER_OBJ ? JSON.parse(process.env.USER_OBJ) : null
const role = process.env.USER_ROLE ? process.env.USER_ROLE : null
const run_mode = process.env.RUN_MODE ? process.env.RUN_MODE : "sequential"

if(db_host == null) throw Error('DB host not passed')
if(db_user == null) throw Error('DB user not passed')
if(db_pwd == null) throw Error('DB password not passed')
if(db_name == null) throw Error('DB name not passed')
if(role == null) throw Error('Role not passed')
if(local_user == null) throw Error('User object not passed')
if(selected_family == null) throw Error('Database family not selected')

let db = await getDB(selected_family, db_host, db_user, db_pwd, db_name, schema)

async function runTests(count: number, mode: "sequential" | "parallel" = "sequential") {
  const runOne = async (i: number) => {
    const filePath = path.resolve(`./auto_tests/test_${i}.js`);

    let module;

    try {
      module = await import(filePath);
    } catch (err: any) {
      if (err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("Cannot find")) {
        console.warn(`test_${i}.js not found, skipping`);
        return { i, status: "missing" };
      }
      throw err;
    }

    const testFn = module.default;

    if (typeof testFn !== "function") {
      console.warn(`test_${i}.js has no default function, skipping`);
      return { i, status: "invalid" };
    }

    console.log(`Running test_${i}`);

    try {
      await testFn();
      return { i, status: "passed" };
    } catch (err) {
      console.error(`test_${i} failed`, err);
      return { i, status: "failed", error: err };
    }
  };

  if (mode === "sequential") {
    const results = [];

    for (let i = 0; i < count; i++) {
      results.push(await runOne(i));
    }

    return results;
  }

  if (mode === "parallel") {
    return await Promise.all(
      Array.from({ length: count }, (_, i) => runOne(i))
    );
  }
}

runTests(10, run_mode == "parallel" ? "parallel" : "sequential").then((results) => {
    if(!results) throw new Error("No tests were run. Check if test files are named correctly and exist in the auto_tests directory.")
    console.log("Test results:", results);
    const passed = results.filter(r => r.status === "passed").length;
    const failed = results.filter(r => r.status === "failed").length;
    const missing = results.filter(r => r.status === "missing").length;
    const invalid = results.filter(r => r.status === "invalid").length
    console.log(`Summary: ${passed} passed, ${failed} failed, ${missing} missing, ${invalid} invalid`)
}).catch((err) => {
    console.error("Error running tests", err)
});