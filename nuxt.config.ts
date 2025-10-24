// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  
  modules: [
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss'
  ],

  runtimeConfig: {
    // Private keys (only available server-side)
    databaseUrl: process.env.DATABASE_URL || '',
    databaseType: process.env.DATABASE_TYPE || 'sqlite',
    
    // Public keys (exposed to client)
    public: {
      apiBase: process.env.API_BASE || '/api'
    }
  }
})
