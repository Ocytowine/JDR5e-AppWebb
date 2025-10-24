import { defineStore } from 'pinia'

interface GameSave {
  id: number
  name: string
  data: any
  createdAt: Date
  updatedAt: Date
}

export const useGameStore = defineStore('game', {
  state: () => ({
    saves: [] as GameSave[],
    currentSave: null as GameSave | null
  }),

  actions: {
    async loadSaves(userId: number) {
      try {
        const response = await $fetch(`/api/saves?userId=${userId}`)
        
        if (response.success) {
          this.saves = response.saves
        }

        return response
      } catch (error) {
        console.error('Error loading saves:', error)
        throw error
      }
    },

    async createSave(userId: number, name: string, data: any) {
      try {
        const response = await $fetch('/api/saves', {
          method: 'POST',
          body: { userId, name, data }
        })

        if (response.success && response.save) {
          this.saves.push(response.save)
        }

        return response
      } catch (error) {
        console.error('Error creating save:', error)
        throw error
      }
    },

    async updateSave(saveId: number, name?: string, data?: any) {
      try {
        const response = await $fetch(`/api/saves/${saveId}`, {
          method: 'PUT',
          body: { name, data }
        })

        if (response.success && response.save) {
          const index = this.saves.findIndex(s => s.id === saveId)
          if (index !== -1) {
            this.saves[index] = response.save
          }
          if (this.currentSave?.id === saveId) {
            this.currentSave = response.save
          }
        }

        return response
      } catch (error) {
        console.error('Error updating save:', error)
        throw error
      }
    },

    setCurrentSave(save: GameSave | null) {
      this.currentSave = save
    }
  }
})
