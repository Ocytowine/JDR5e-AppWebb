import { getDb } from '../../database/connection'
import { savesTable, savesTablePg } from '../../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const userId = query.userId as string

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required'
    })
  }

  try {
    const db = getDb()
    const config = useRuntimeConfig()
    const table = config.databaseType === 'postgres' ? savesTablePg : savesTable

    const saves = await db.select().from(table).where(eq(table.userId, Number(userId)))

    return {
      success: true,
      saves: saves.map(save => ({
        id: save.id,
        name: save.name,
        data: JSON.parse(save.data),
        createdAt: save.createdAt,
        updatedAt: save.updatedAt
      }))
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    })
  }
})
