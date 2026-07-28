import { date, int, mysqlTable, text, tinyint, varchar } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { decimal } from "drizzle-orm/mysql-core";

import { pgTable, serial, integer, varchar as postGresVarchar, boolean } from "drizzle-orm/pg-core";
import { int as intMSSQL, varchar as varcharMSSQL, bit, mssqlTable } from "drizzle-orm/mssql-core";

// export const users = mssqlTable("users", {
//   id: intMSSQL("id").primaryKey().identity({ seed: 1, increment: 1 }),

//   name: varcharMSSQL("name", { length: 50 }).notNull(),

//   surname: varcharMSSQL("surname", { length: 50 }).notNull(),

//   age: int("age"),

//   email: varcharMSSQL("email", { length: 255 }),

//   have_access: bit("have_access")
//     .notNull()
//     .default(sql`0`),
// });

// export const users = pgTable("users", {
//   id: serial("id").primaryKey(),

//   name: postGresVarchar("name", { length: 50 }).notNull(),

//   surname: postGresVarchar("surname", { length: 50 }).notNull(),

//   age: integer("age"),

//   email: postGresVarchar("email", { length: 255 }),

//   have_access: boolean("have_access").notNull().default(false),
// });

export const users = mysqlTable('users', {
    id: int("id").primaryKey().autoincrement(),
    name: varchar('name', { length: 50 }).notNull(),
    surname: varchar('surname', { length: 50 }).notNull(),
    age: int('age'),
    email: varchar('email', { length: 255 }).default(sql`NULL`),
    have_access: tinyint('have_access').notNull().default(0)
});

export const employees = mysqlTable('employees', {
    employee_id: int('employee_id').primaryKey().autoincrement(),
    first_name: varchar('first_name', { length: 50 }).notNull(),
    last_name: varchar('last_name', { length: 50 }).notNull(),
    email: varchar('email', { length: 100 }).notNull(),
    hire_date: date('hire_date').notNull(),
    salary: decimal('salary', { precision: 10, scale: 2 }).notNull()
});

export const test = mysqlTable('test', {
    name: text().notNull(),
});