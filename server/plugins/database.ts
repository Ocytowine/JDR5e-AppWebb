import { initializeDatabase } from '../utils/initDb'

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  
  // Only initialize SQLite database in development
  if (config.databaseType !== 'postgres') {
    try {
      initializeDatabase()
      console.log('Database plugin: SQLite initialized')
    } catch (error) {
      console.error('Database plugin: Error initializing database', error)
    }
  } else {
    console.log('Database plugin: Using PostgreSQL (no initialization needed)')
  }
})
