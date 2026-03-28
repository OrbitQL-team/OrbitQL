import * as schema from './schema';
import build_query from "../src";
import { NONE, TableStructure } from "../src/types";
import mysql from 'mysql2/promise';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import { describe, it, expect } from "vitest";

const client = mysql.createPool("mysql://polaris:polaris_is_very_cool@localhost:3306/polaris");

const db = drizzle(client, { schema, mode: 'default' }) ?? null as unknown as MySql2Database

const structure: Record<string, TableStructure> = {
    users: {
        endpoints: [
            {
                type: "GET" as const,
                user: { 
                    allowed: {
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
                    disallowed: ["have_access"] 
                },
            },
            {
                type: "PUT" as const,
                user: { 
                    allowed:{
                            field: ["*"],
                            where: {
                                field: 'users.id',
                                operator: '=',
                                value: '$user.id'
                            }
                        }, 
                    disallowed: ["id", "have_access"]
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
const query = {
    type: 'GET' as const,
    select: ['*'],
    table: 'users'
}

const local_user = {
    id: 1,
    name: 'test',
    surname: 'test',
    email: 'test@test.test',
    have_access: 1
}

describe("build_query result", () => {
  it("should return at least one row and measure execution time", async () => {
    const start = Date.now(); // ⏱ start timer

    const built_query = await build_query(db, query, local_user, "user", structure);
    const result = await built_query.execute();

    const end = Date.now(); // ⏱ end timer
    const duration = end - start;


    // Handle both array or object with rows
    const rows = Array.isArray(result) ? result : result.rows;

    console.log(rows);
    console.log(`Query executed in ${duration} ms`);

    // Assert that there is at least one row
    expect(rows.length).toBeGreaterThan(0);
  });
});