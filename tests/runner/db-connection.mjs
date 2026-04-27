import prompts from "prompts";

import { drizzle as mysqlDrizzle } from "drizzle-orm/mysql2";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { drizzle as postgresJsDrizzle } from "drizzle-orm/postgres-js";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import { drizzle as vercelDrizzle } from "drizzle-orm/vercel-postgres";
import { drizzle as libsqlDrizzle } from "drizzle-orm/libsql";
import { drizzle as d1Drizzle } from "drizzle-orm/d1";
import { drizzle as betterSqliteDrizzle } from "drizzle-orm/better-sqlite3";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";

export async function createConnection(db_select, config = {}) {
  const onCancel = () => {
    console.log("\nCancelled by user");
    process.exit(1);
  };

  console.clear();
  console.log("--[ database configuration ]--");

  const { db_address, user_name, password, db_name } = await prompts([
    {
      type: "text",
      name: "db_address",
      message: `Enter ${db_select.family} db host/address`,
    },
    {
      type: "text",
      name: "user_name",
      message: `Enter ${db_select.family} db user name`,
    },
    {
      type: "password",
      name: "password",
      message: `Enter ${db_select.family} db password`,
    },
    {
      type: "text",
      name: "db_name",
      message: `Enter ${db_select.family} db name`,
    },
  ], { onCancel });

  return { db_address, user_name, password, db_name };
}

export async function getDB(family, db_address, user_name, password, db_name, schema) {
  let db;

  switch (family) {

    case "mysql": {
      const mysql = await import("mysql2/promise");

      const pool = mysql.createPool({
        host: db_address,
        user: user_name,
        password,
        database: db_name,
        port: 3306,
      });

      db = mysqlDrizzle(pool, { schema, mode: 'default' });
      break;
    }

    case "postgres": {
      const { Pool } = await import("pg");

      const pool = new Pool({
        host: db_address,
        user: user_name,
        password,
        database: db_name,
        port: 5432,
      });

      db = pgDrizzle(pool, { schema, mode: 'default' });
      break;
    }

    case "postgres-js": {
      const postgres = (await import("postgres")).default;

      const client = postgres(
        `postgres://${user_name}:${password}@${db_address}:5432/${db_name}`
      );

      db = postgresJsDrizzle(client, { schema, mode: 'default' });
      break;
    }

    case "neon":
    case "neon-http": {
      const { neon } = await import("@neondatabase/serverless");

      const sql = neon(
        `postgres://${user_name}:${password}@${db_address}/${db_name}`
      );

      db = neonDrizzle(sql, { schema, mode: 'default' });
      break;
    }

    case "vercel-pg": {
      const { sql } = await import("@vercel/postgres");

      db = vercelDrizzle(sql, { schema, mode: 'default' });
      break;
    }

    case "better-sqlite3": {
      const Database = (await import("better-sqlite3")).default;

      const sqlite = new Database(db_name);

      db = betterSqliteDrizzle(sqlite, { schema, mode: 'default' });
      break;
    }

    case "libsql": {
      const { createClient } = await import("@libsql/client");

      const client = createClient({
        url: db_address,
        authToken: password,
      });

      db = libsqlDrizzle(client, { schema, mode: 'default' });
      break;
    }

    case "d1":
    case "drizzle-d1": {
      if (!config.d1) {
        throw new Error("Missing D1 binding in config");
      }

      db = d1Drizzle(config.d1);
      break;
    }

    case "pglite": {
      const { PGlite } = await import("@electric-sql/pglite");

      const client = new PGlite();

      db = pgliteDrizzle(client, { schema, mode: 'default' });
      break;
    }

    case "aws-pg": {
      const { RDSDataClient } = await import("@aws-sdk/client-rds-data");
      const { drizzle: awsDrizzle } = await import("drizzle-orm/aws-data-api/pg");

      const client = new RDSDataClient({
        region: config.region,
      });

      db = awsDrizzle(client, {
        database: db_name,
        secretArn: config.secretArn,
        resourceArn: config.resourceArn,
        schema
      });

      break;
    }

    default:
      throw new Error(`Unsupported DB type: ${family}`);
  }

  return db;
}