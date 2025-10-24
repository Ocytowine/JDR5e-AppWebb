import { getDb } from '../../database/connection'
import { usersTable, usersTablePg } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password, email } = body

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

    // In production, hash the password with bcrypt, argon2, etc.
    const newUser = {
      username,
      password, // Should be hashed in production
      email: email || null,
      createdAt: new Date()
    }

    const result = await db.insert(table).values(newUser).returning()

    return {
      success: true,
      user: {
        id: result[0].id,
        username: result[0].username,
        email: result[0].email
      }
    }
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      throw createError({
        statusCode: 409,
        message: 'Username already exists'
      })
    }
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    })
  }
})
