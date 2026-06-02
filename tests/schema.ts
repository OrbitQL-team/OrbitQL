import { date, int, mysqlTable, tinyint, varchar } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { decimal } from "drizzle-orm/mysql-core";

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