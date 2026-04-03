import { GelDatabase } from "drizzle-orm/gel-core";
import { MySql2Database } from "drizzle-orm/mysql2";
import { PlanetScaleDatabase } from "drizzle-orm/planetscale-serverless";
import { PgDatabase, TableConfig as PgTableConfig } from "drizzle-orm/pg-core";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { VercelPgDatabase } from "drizzle-orm/vercel-postgres";
import { LibSQLDatabase } from "drizzle-orm/libsql";
import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { NeonDatabase } from "drizzle-orm/neon-serverless";
import { GelJsDatabase } from "drizzle-orm/gel";
import { AnyD1Database, DrizzleD1Database } from "drizzle-orm/d1";
import { SQLJsDatabase } from "drizzle-orm/sql-js";
import { PgliteDatabase } from "drizzle-orm/pglite";
import { XataHttpDatabase } from "drizzle-orm/xata-http";
import { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { OPSQLiteDatabase } from "drizzle-orm/op-sqlite";
import { PgRemoteDatabase } from "drizzle-orm/pg-proxy";
import { PrismaPgDatabase } from "drizzle-orm/prisma/pg";
import { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { SingleStoreRemoteDatabase } from "drizzle-orm/singlestore-proxy";
import { SingleStoreDatabase } from "drizzle-orm/singlestore";
import { TiDBServerlessDatabase } from "drizzle-orm/tidb-serverless";
import { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { PrismaSQLiteDatabase } from "drizzle-orm/prisma/sqlite";
import { AwsDataApiPgDatabase } from "drizzle-orm/aws-data-api/pg";
import { PrismaMySqlDatabase } from "drizzle-orm/prisma/mysql";
import { MySqlRemoteDatabase } from "drizzle-orm/mysql-proxy";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { MySqlDatabase } from "drizzle-orm/mysql-core";

/* -------------------------------------------------------------------------- */
/*                               DATABASE TYPES                               */
/* -------------------------------------------------------------------------- */

export type Database =
  | GelDatabase<any, any, any>
  | MySql2Database
  | PlanetScaleDatabase
  | PgDatabase<any, any, any>
  | NodePgDatabase
  | NeonDatabase
  | VercelPgDatabase
  | LibSQLDatabase
  | BetterSQLite3Database
  | GelJsDatabase
  | MySqlDatabase<any, any, any, any>
  | AnyD1Database
  | SQLJsDatabase
  | PgliteDatabase
  | XataHttpDatabase
  | NeonHttpDatabase
  | OPSQLiteDatabase
  | PgRemoteDatabase
  | PrismaPgDatabase
  | DrizzleSqliteDODatabase
  | SingleStoreRemoteDatabase
  | TiDBServerlessDatabase
  | SqliteRemoteDatabase
  | PrismaSQLiteDatabase
  | AwsDataApiPgDatabase
  | SingleStoreDatabase<any, any, any, any>
  | DrizzleD1Database
  | PrismaMySqlDatabase
  | MySqlRemoteDatabase
  | PostgresJsDatabase
  | BaseSQLiteDatabase<any, any, any, any>
  | ExpoSQLiteDatabase
  | BunSQLiteDatabase;

/* -------------------------------------------------------------------------- */
/*                               STRUCTURE                                    */
/* -------------------------------------------------------------------------- */

export type Structure = Record<string, TableStructure>;

export type TableStructure = {
  endpoints: Endpoint[];
  table: any;
};

export type EndpointType = "GET" | "PUT" | "POST" | "DELETE";

// Endpoint structure
export type Endpoint = {
  type: EndpointType;
  order_by?: string[];
  direction?: "asc" | "desc";
  [role: string]:
    | RolePermissions
    | typeof NONE
    | string[]
    | "asc"
    | "desc"
    | EndpointType
    | undefined;
};

/* -------------------------------------------------------------------------- */
/*                                 ROLES                                      */
/* -------------------------------------------------------------------------- */

type AllowedAliases =
  | { allowed: FieldPermission }
  | { allow: FieldPermission };

type DisallowedAliases =
  | { disallowed?: FieldPermission }
  | { deny?: FieldPermission };

export type RolePermissions = AllowedAliases & DisallowedAliases;

export type FieldPermission =
  | string[] | string
  | {
      field: string | string[];
      where?: WhereCondition;
    };

/* -------------------------------------------------------------------------- */
/*                               OPERATORS                                    */
/* -------------------------------------------------------------------------- */

export const SAFE_OPERATORS = [
  "=",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "LIKE",
  "IN"
] as const;

export type SafeOperator = typeof SAFE_OPERATORS[number];

/* -------------------------------------------------------------------------- */
/*                               CONDITIONS                                   */
/* -------------------------------------------------------------------------- */

export type StructuredQuery = {
  table: keyof Structure;
  type: "GET" | "PUT" | "DELETE" | "POST";
  select?: string[];
  join?: Join[];
  where?: WhereCondition;
  data?: Record<string, any>;
  group_by?: string[];
  order_by?: string[];
  
  /* Queries executed after this one */
  after?: StructuredQuery[];

  [key: string]: any;
};

export type SimpleCondition = {
  field?: string;
  operator?: SafeOperator;
  left_value?: any;
  value?: any;
};

export type Join = {
  table: keyof Structure;
  type: "INNER" | "LEFT";       // RIGHT & FULL removed (not supported + unsafe)
  on: Record<string, string> | WhereCondition;  // either simple mapping or a complex condition
};

type NotCondition = {
  not: WhereCondition | SubqueryCondition;
  and?: never;
  or?: never;
  if?: never;
}

// Nested AND/OR conditions
type AndCondition = {
  and: (WhereCondition | SubqueryCondition)[];
  not?: never;
  or?: never;
  if?: never;
};

type OrCondition = {
  or: (WhereCondition | SubqueryCondition)[];
  not?: never;
  and?: never;
  if?: never;
};

type IfCondition = {
  if: {
    when: WhereCondition | SubqueryCondition;
    do?: WhereCondition | SubqueryCondition;
    else?: WhereCondition | SubqueryCondition;
  };
  not?: never;
  and?: never;
  or?: never;
};

export type NestedCondition = AndCondition | OrCondition | IfCondition | NotCondition;

// A WhereCondition can be simple or nested
export type WhereCondition = SimpleCondition | NestedCondition;

// Subquery structure for IN conditions
export type SubqueryCondition = {
  field?: string;
  left_value?: any;
  operator: "IN";
  value: {
    select: string;
    from: string;
    where?: WhereCondition[];
  };
};

/* -------------------------------------------------------------------------- */
/*                               PERMISSION PRESETS                           */
/* -------------------------------------------------------------------------- */

export const ALL: RolePermissions = { allowed: ["*"], disallowed: [] };
export const ALL_EXCEPT_ID: RolePermissions = { allowed: ["*"], disallowed: ["id"] };
export const NONE: RolePermissions = { allowed: [], disallowed: [] };