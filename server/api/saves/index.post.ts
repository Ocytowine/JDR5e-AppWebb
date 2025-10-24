import { getDb } from '../../database/connection'
import { savesTable, savesTablePg } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, name, data } = body

  if (!userId || !name || !data) {
    throw createError({
      statusCode: 400,
      message: 'User ID, name, and data are required'
    })
  }

  try {
    const db = getDb()
    const config = useRuntimeConfig()
    const table = config.databaseType === 'postgres' ? savesTablePg : savesTable

    const now = new Date()
    const newSave = {
      userId: Number(userId),
      name,
      data: JSON.stringify(data),
      createdAt: now,
      updatedAt: now
    }

    const result = await db.insert(table).values(newSave).returning()

    return {
      success: true,
      save: {
        id: result[0].id,
        name: result[0].name,
        data: JSON.parse(result[0].data),
        createdAt: result[0].createdAt,
        updatedAt: result[0].updatedAt
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    })
  }
})
