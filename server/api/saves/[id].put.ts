import { getDb } from '../../database/connection'
import { savesTable, savesTablePg } from '../../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { name, data } = body

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Save ID is required'
    })
  }

  try {
    const db = getDb()
    const config = useRuntimeConfig()
    const table = config.databaseType === 'postgres' ? savesTablePg : savesTable

    const updateData: any = {
      updatedAt: new Date()
    }

    if (name) updateData.name = name
    if (data) updateData.data = JSON.stringify(data)

    const result = await db
      .update(table)
      .set(updateData)
      .where(eq(table.id, Number(id)))
      .returning()

    if (!result.length) {
      throw createError({
        statusCode: 404,
        message: 'Save not found'
      })
    }

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
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    })
  }
})
