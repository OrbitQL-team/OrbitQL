import { is, sql } from 'drizzle-orm';
import { mysqlTable, longtext, int, varchar, tinyint, bigint, text, decimal, date, datetime, time } from 'drizzle-orm/mysql-core';

export const attendances = mysqlTable('attendances', {
	id: int("id").primaryKey().autoincrement(),
	user_id: int('user_id').primaryKey().notNull().references(() => users.id),
	day: date('day').notNull(),
	hours_worked: time('hours_worked').notNull(),
	type: int('type_id').notNull().references(() => attendances_types.id),
	last_type: int('last_type_id').notNull().references(() => attendances_types.id),
});

export const attendances_types = mysqlTable('attendances_types', {
	id: int("id").primaryKey().autoincrement(),
	value: varchar('value', { length: 1 }).notNull().default("-"),
	today: tinyint('today').notNull().default(0),
	is_default: tinyint('is_default').notNull().default(0),
	color: varchar('color', { length: 50 }).default(sql`NULL`),
	full_name: varchar('full_name', { length: 50 }).default(sql`NULL`),
});

export const forma_tags = mysqlTable('forma_tags', {
	id: int("id").primaryKey().autoincrement(),
	name: text('formaTag').notNull(),
	user_id: int('user_id').primaryKey().notNull().references(() => users.id),
});

export const goals = mysqlTable('goals', {
	id: int("id").primaryKey().autoincrement(),
	title: varchar('title', { length: 255 }).notNull(),
	description: text("description").default(sql`NULL`),
	date: bigint('date', { mode: "number" }).default(sql`NULL`),
	state: tinyint('state').notNull().default(0),
	project_id: int('project_id').default(sql`NULL`),
});

export const roadmap_groups = mysqlTable('roadmap_groups', {
	id: int("id").primaryKey().autoincrement(),
	long_name: text("LongName").default(sql`NULL`),
	short_name: text("ShortName").default(sql`NULL`),
	order_num: int("order").default(sql`NULL`)
});

export const people_groups = mysqlTable('people_groups', {
	id: int("id").primaryKey().autoincrement(),
	group_id: int('group_id').primaryKey().default(sql`NULL`).references(() => roadmap_groups.id),
	user_id: int('group_id').primaryKey().default(sql`NULL`).references(() => users.id),
});

export const guest_code = mysqlTable('guest_code', {
	id: int('id').primaryKey().autoincrement().notNull(),
	user_id: int('user_id').notNull().references(() => users.id),
	code_hash: varchar('code_hash', { length: 64 }).default(sql`NULL`),
	refresh_token_hash: varchar('refresh_token_hash', { length: 64 }).default(sql`NULL`),

	created_at: datetime('created_at', { mode: 'string', fsp: 0 })
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),

	last_refresh: datetime('last_refresh', { mode: 'string', fsp: 0 }).default(sql`NULL`),

	enabled: tinyint('enabled').notNull().default(0),
})
export const images = mysqlTable('images', {
	id: int("id").primaryKey().autoincrement(),
	filename: varchar('filename', { length: 255 }).notNull(),
	mimetype: varchar('mimetype', { length: 255 }).notNull(),
	image_data: longtext('image_data').notNull(),
	is_360: tinyint('is_360').notNull().default(0)
})

export const labs = mysqlTable('labs', {
	id: int("id").primaryKey().autoincrement(),
	name: varchar('name', { length: 50 }).notNull(),
	image_id: int('image_id').default(sql`NULL`).references(() =>  images.id)
});

export const lab_positions = mysqlTable('lab_positions', {
	id: int("id").primaryKey().autoincrement(),
	user_id: int('user_id').primaryKey().notNull().references(() => users.id),
	posx: decimal('posx', { precision: 6, scale: 3 }).default('50.000'),
	posy: decimal('posy', { precision: 6, scale: 3 }).default('50.000'),
	lab_id: int('lab_id').notNull().references(() =>  labs.id)
})

export const projects = mysqlTable("projects", {
	id: int("id").primaryKey().autoincrement(),
	start_date: date("start_date").notNull(),
	end_date: date("end_date").notNull(),
	title: varchar("title", { length: 255 }).notNull(),
	description: text("description").default(sql`NULL`),
	project_group: int("projectGroup").default(sql`NULL`),
	color: varchar("color", { length: 7 }).default(sql`NULL`),
});

export const tips = mysqlTable('tips', {
	id: int("id").primaryKey().autoincrement(),
	section_tip: int('sectionTip').default(sql`NULL`).references(() =>  tips_sections.id),
	text_content: text('text_content').notNull(),
	order_num: int('order_num').notNull()
});

export const tips_sections = mysqlTable('tips_sections', {
	id: int("id").primaryKey().autoincrement(),
	title: text('title').notNull()
});

export const users = mysqlTable('users', {
	id: int("id").primaryKey().autoincrement(),
	name: varchar('name', { length: 50 }).notNull(),
	surname: varchar('surname', { length: 50 }).notNull(),
	organization_id: tinyint('organization_id').notNull().default(0),
	avatar_url: varchar('avatar_url', { length: 255 }).default(sql`NULL`),
	user_id_rpm: varchar('user_id_rpm', { length: 255 }).default(sql`NULL`),
	email: varchar('email', { length: 255 }).default(sql`NULL`),
	default_hours: time('default_hours').notNull().default("08:00:00"),
	admin: tinyint('admin').notNull().default(0),
	have_access: tinyint('have_access').notNull().default(0)
});

export const users_coordinators = mysqlTable('user_coordinators', {
	user_id: int('user_id').primaryKey().notNull().references(() => users.id),
	coordinator_id: int('coordinator_id').primaryKey().notNull().references(() => users.id)
});

export const organizations = mysqlTable('organizations', {
	id: int("id").primaryKey().autoincrement(),
	name: varchar('name', { length: 255 }).notNull(),
	email: varchar('email', { length: 255 }),
	send_email: tinyint('send_email').notNull().default(0),
	guest_login: tinyint('guest_login').notNull().default(0)
})