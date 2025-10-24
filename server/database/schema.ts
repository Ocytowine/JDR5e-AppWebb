import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { pgTable, text as pgText, integer as pgInteger, timestamp } from 'drizzle-orm/pg-core'

// SQLite schema
export const usersTable = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  email: text('email'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})

export const savesTable = sqliteTable('saves', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => usersTable.id),
  name: text('name').notNull(),
  data: text('data').notNull(), // JSON string
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
})

// PostgreSQL schema (for production)
export const usersTablePg = pgTable('users', {
  id: pgInteger('id').primaryKey().generatedAlwaysAsIdentity(),
  username: pgText('username').notNull().unique(),
  password: pgText('password').notNull(),
  email: pgText('email'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const savesTablePg = pgTable('saves', {
  id: pgInteger('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: pgInteger('user_id').notNull().references(() => usersTablePg.id),
  name: pgText('name').notNull(),
  data: pgText('data').notNull(), // JSON string
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})
