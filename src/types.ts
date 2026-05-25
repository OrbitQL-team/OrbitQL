/* -------------------------------------------------------------------------- */
/*                                   IMPORTS                                  */
/* -------------------------------------------------------------------------- */
import { GelDatabase } from "drizzle-orm/gel-core";
import { MySql2Database } from "drizzle-orm/mysql2";
import { PlanetScaleDatabase } from "drizzle-orm/planetscale-serverless";
import { PgDatabase } from "drizzle-orm/pg-core";
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
/*                                  STRUCTURE                                 */
/* -------------------------------------------------------------------------- */

export type Structure = Record<string, TableStructure>;

export type TableStructure = {
  endpoints: Endpoint[];
  table: any;
};

export const BuildWhereOptionsDefaults:BuildWhereOptions = {
  disable_triggers: false,
  after: false
}

export type BuildWhereOptions = {
  disable_triggers?: boolean,
  after?: number | boolean
}

export type Set_Value = {
  set: {
    field: string;
    when: WhereCondition | SubqueryCondition;
    value: any;
    else_value?: any;
  }
}

export type EndpointType = "GET" | "PUT" | "POST" | "DELETE";
export type TriggerStructure = {
  type: "BEFORE" | "AFTER";
  query: StructuredQuery & IfCondition & Set_Value;
}

// Endpoint structure
export type Endpoint = {
  // Explicit properties
  type: EndpointType;
  triggers?: TriggerStructure[];

  
  // Dynamic role properties
  [role: string]: 
    | RolePermissions 
    | typeof NONE 
    | any;
};

/* -------------------------------------------------------------------------- */
/*                                 PERMISSIONS                                */
/* -------------------------------------------------------------------------- */

type AllowedAliases =
  | { allowed: FieldPermission; allow?: never }
  | { allow: FieldPermission; allowed?: never };

type DisallowedAliases =
  | { disallowed?: FieldPermission; deny?: never }
  | { deny?: FieldPermission; disallowed?: never };

type Limit = { limit?: number };

type OrderBy = { order_by?: string[] | string };

type GroupBy = { group_by?: string[] | string };

export type Returning = {
  returning?: AllowedAliasesReturning & DisallowedAliasesReturning & boolean;
}

export type RolePermissions = AllowedAliases & DisallowedAliases & Limit & OrderBy & Returning & GroupBy;

export type AllowedAliasesReturning =
  | { allowed: string | string[]; allow?: never }
  | { allow: string | string[]; allowed?: never };

export type DisallowedAliasesReturning =
  | { disallowed?: string | string[]; deny?: never }
  | { deny?: string | string[]; disallowed?: never };

export type FieldPermission =
  | string | string[]
  | {
      field: string | string[];
      where?: WhereCondition;
    };

/* -------------------------------------------------------------------------- */
/*                                  OPERATORS                                 */
/* -------------------------------------------------------------------------- */

export const SAFE_OPERATORS = [
  "=",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "LIKE",
  "NOT LIKE",
  "ILIKE",
  "NOT ILIKE",
  "IS",
  "IS NOT",
  "IS NULL",
  "IS NOT NULL",
  "NOT BETWEEN",
  "IN",
  "NOT IN"
] as const;

export type SafeOperator = typeof SAFE_OPERATORS[number];

/* -------------------------------------------------------------------------- */
/*                              QUERY/CONDITIONS                              */
/* -------------------------------------------------------------------------- */

export type StructuredQuery = {
  table: keyof Structure;
  type: "GET" | "PUT" | "DELETE" | "POST";
  select?: string[] | string;
  join?: Join[];
  where?: WhereCondition;
  data?: Record<string, any> | Record<string, any>[];
  group_by?: string[] | string;
  order_by?: string[] | string;
  returning?: string[] | string;
  
  /* Queries executed after this one */
  after?: StructuredQuery[];

  [key: string]: any;
};

export type Join = {
  table: keyof Structure;
  type: "INNER" | "LEFT";
  on: Record<string, string> | WhereCondition;
};

type OperatorAlias =
  | { operator: SafeOperator; op?: never }
  | { op: SafeOperator; operator?: never };

export type SimpleCondition = OperatorAlias & {
  field?: string;
  left_value?: any;
  value?: any;
  start?:any;
  end?:any;
};

export type BetweenCondition =
  | {
      operator: "BETWEEN";
      op?: never;

      field: string;
      start: any;
      end: any;
    }
  | {
      op: "BETWEEN";
      operator?: never;

      field: string;
      start: any;
      end: any;
    };

export type NotBetweenCondition =
  | {
      operator: "BETWEEN";
      op?: never;

      field: string;
      start: any;
      end: any;
    }
  | {
      op: "BETWEEN";
      operator?: never;

      field: string;
      start: any;
      end: any;
    };

export type ExistsCondition =
  | {
      operator: "EXISTS";
      op?: never;
      query: {
        select: string[] | string;
        from: string;
        where?: WhereCondition;
      };
    }
  | {
      op: "EXISTS";
      operator?: never;
      query: {
        select: string[] | string;
        from: string;
        where?: WhereCondition;
      };
    };

export type NotExistsCondition =
  | {
      operator: "NOT EXISTS";
      op?: never;
      query: {
        select: string[] | string;
        from: string;
        where?: WhereCondition;
      };
    }
  | {
      op: "NOT EXISTS";
      operator?: never;
      query: {
        select: string[] | string;
        from: string;
        where?: WhereCondition;
      };
    };

export type NotCondition = {
  not: WhereCondition | SubqueryCondition;
  and?: never;
  or?: never;
  if?: never;
}

export type AndCondition = {
  and: (WhereCondition | SubqueryCondition)[];
  not?: never;
  or?: never;
  if?: never;
};

export type OrCondition = {
  or: (WhereCondition | SubqueryCondition)[];
  not?: never;
  and?: never;
  if?: never;
};

export type IfCondition = {
  if: {
    when: WhereCondition | SubqueryCondition;
    do?: WhereCondition | SubqueryCondition | boolean | StructuredQuery | Function;
    else?: WhereCondition | SubqueryCondition | boolean | StructuredQuery | Function;
  };
  not?: never;
  and?: never;
  or?: never;
};

export type NestedCondition = AndCondition | OrCondition | IfCondition | NotCondition;

// A WhereCondition can be simple or nested
export type WhereCondition = SimpleCondition | NestedCondition | ExistsCondition | NotExistsCondition | BetweenCondition | NotBetweenCondition;

// Subquery structure for IN conditions
export type SubqueryCondition = {
  field?: string;
  left_value?: any; //supports $data - $user - $col - any
  operator: "IN";
  value: {
    select: string[] | string;
    from: string;
    where?: WhereCondition;
  };
};

/* -------------------------------------------------------------------------- */
/*                                   PRESETS                                  */
/* -------------------------------------------------------------------------- */

export const ALL: RolePermissions = { allowed: ["*"], disallowed: [] };
export const ALL_EXCEPT_ID: RolePermissions = { allowed: ["*"], disallowed: ["id"] };
export const NONE: RolePermissions = { allowed: [], disallowed: [] };