import { defineStore } from 'pinia'

interface User {
  id: number
  username: string
  email?: string
}

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as User | null,
    isAuthenticated: false
  }),

  actions: {
    async login(username: string, password: string) {
      try {
        const response = await $fetch('/api/auth/login', {
          method: 'POST',
          body: { username, password }
        })

        if (response.success && response.user) {
          this.user = response.user
          this.isAuthenticated = true
        }

        return response
      } catch (error) {
        this.user = null
        this.isAuthenticated = false
        throw error
      }
    },

    async register(username: string, password: string, email?: string) {
      try {
        const response = await $fetch('/api/auth/register', {
          method: 'POST',
          body: { username, password, email }
        })

        if (response.success && response.user) {
          this.user = response.user
          this.isAuthenticated = true
        }

        return response
      } catch (error) {
        throw error
      }
    },

    logout() {
      this.user = null
      this.isAuthenticated = false
    }
  }
})
