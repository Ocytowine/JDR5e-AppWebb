import { getDb } from '../../database/connection'
import { usersTable, usersTablePg } from '../../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = body

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      message: 'Username and password are required'
    })
  }

  try {
    const db = getDb()
    const config = useRuntimeConfig()
    const table = config.databaseType === 'postgres' ? usersTablePg : usersTable

    // Find user
    const users = await db.select().from(table).where(eq(table.username, username))
    const user = users[0]

    if (!user) {
      throw createError({
        statusCode: 401,
        message: 'Invalid credentials'
      })
    }

    // In production, use proper password hashing (bcrypt, argon2, etc.)
    // For now, simple comparison
    if (user.password !== password) {
      throw createError({
        statusCode: 401,
        message: 'Invalid credentials'
      })
    }

    // Return user data (excluding password)
    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    })
  }
})
