import Database from 'better-sqlite3'
import postgres from 'postgres'
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3'
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import * as schema from './schema'
import { join } from 'path'

let db: any = null

export function getDb() {
  if (db) return db

  const config = useRuntimeConfig()
  const databaseType = config.databaseType || 'sqlite'

  if (databaseType === 'postgres') {
    // PostgreSQL connection (for production)
    const connectionString = config.databaseUrl
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for PostgreSQL')
    }
    const client = postgres(connectionString)
    db = drizzlePg(client, { schema })
  } else {
    // SQLite connection (for development)
    const dbPath = join(process.cwd(), 'data', 'database.sqlite')
    const sqlite = new Database(dbPath)
    db = drizzleSqlite(sqlite, { schema })
  }

  return db
}

export function closeDb() {
  if (db) {
    db = null
  }
}
