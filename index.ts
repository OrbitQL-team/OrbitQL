import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const client = mysql.createPool(env.DATABASE_URL ? env.DATABASE_URL : "mysql://root:example%25@example:3306/example");

export const db = drizzle(client, { schema, mode: 'default' }) ?? null as unknown as MySql2Database