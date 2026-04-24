import * as schema from './schema';
import build_query from "../src";
import { NONE, StructuredQuery, TableStructure } from "../src/types";
import mysql from 'mysql2/promise';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import { describe, it, expect } from "vitest";
import { getDB } from "./runner/db-connection.mjs"

const local_user = process.env.USER_OBJ ? JSON.parse(process.env.USER_OBJ) : null

const db = getDB(process.env.DB_FAMILY, process.env.DB_HOST, process.env.DB_USER, process.env.DB_PWD, process.env.DB_NAME, schema)

const structure: Record<string, TableStructure> = {
    users: {
        endpoints: [
            {
                type: "GET" as const,
                user: { 
                    allow: {
                        field: ["*"],
                        where: {
                            and: [
                                {
                                    field: "users.have_access",
                                    operator: "=",
                                    value: 1
                                },
                                {
                                    left_value: "$user.have_access",
                                    operator: "=",
                                    value: 1
                                },
                            ]
                        }
                    },
                    deny: {
                        field: "have_access",
                        where: {
                            field: 'users.id',
                            operator: '!=',
                            value: '$user.id'
                        }
                    }
                },
            },
            {
                type: "PUT" as const,
                user: { 
                    allowed:{
                        field: ["*"],
                        where: {
                            if: {
                                'when': {
                                    left_value: '$data.name',
                                    operator: 'IS NOT NULL'
                                },
                                do: true,
                                else: false
                            }
                        }
                    }, 
                    disallowed: {
                        field: ["id", "have_access"],
                        where: {
                            left_value: "$user.have_access",
                            operator: "=",
                            value: 0
                        }
                    }
                },
            },
            { 
                type: "POST" as const,
                user: NONE
            },
            { 
                type: "DELETE" as const,
                user: NONE
            }
        ],
        table: schema.users,
    }
}
const query:StructuredQuery = {
    type: 'PUT' as const,
    data: {
        name: 'Daniele'
    },
    where: {
        field: 'users.id',
        operator: '=',
        value: 1
    },
    table: 'users'
}

describe("build_query result", () => {
  it("should return at least one row and measure execution time", async () => {
    const start = Date.now();

    const built_query = await build_query(db, query, local_user, "user", structure);
    const result = await built_query.execute();

    const end = Date.now();
    const duration = end - start;

    console.log(result)

    console.log(`Query executed in ${duration} ms`);

    // Assert that there is at least one row
    expect(result);
  });
});