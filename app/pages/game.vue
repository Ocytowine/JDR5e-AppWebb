<template>
  <div class="px-4 py-8">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">Mes Sauvegardes</h1>
      
      <div v-if="!isAuthenticated" class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
        <p>Vous devez être connecté pour jouer.</p>
        <NuxtLink to="/login" class="underline">Se connecter</NuxtLink>
      </div>

      <div v-else>
        <button
          @click="showCreateSave = true"
          class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md mb-4"
        >
          + Nouvelle Sauvegarde
        </button>

        <div v-if="loading" class="text-gray-600">
          Chargement...
        </div>

        <div v-else-if="saves.length === 0" class="bg-white rounded-lg shadow-md p-8 text-center">
          <p class="text-gray-600 mb-4">Aucune sauvegarde trouvée</p>
          <p class="text-sm text-gray-500">Créez votre première partie pour commencer !</p>
        </div>

        <div v-else class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="save in saves"
            :key="save.id"
            class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <h3 class="text-xl font-bold text-gray-900 mb-2">{{ save.name }}</h3>
            <p class="text-sm text-gray-500 mb-4">
              Dernière modification: {{ formatDate(save.updatedAt) }}
            </p>
            <button
              @click="loadSave(save)"
              class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md w-full"
            >
              Charger
            </button>
          </div>
        </div>

        <!-- Create Save Modal -->
        <div v-if="showCreateSave" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h2 class="text-2xl font-bold text-gray-900 mb-4">Nouvelle Sauvegarde</h2>
            <form @submit.prevent="createNewSave">
              <div class="mb-4">
                <label for="saveName" class="block text-sm font-medium text-gray-700 mb-2">
                  Nom de la sauvegarde
                </label>
                <input
                  id="saveName"
                  v-model="newSaveName"
                  type="text"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div class="flex gap-2">
                <button
                  type="submit"
                  class="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md"
                >
                  Créer
                </button>
                <button
                  type="button"
                  @click="showCreateSave = false"
                  class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from '~/stores/user'
import { useGameStore } from '~/stores/game'
import { storeToRefs } from 'pinia'

const userStore = useUserStore()
const gameStore = useGameStore()

const { user, isAuthenticated } = storeToRefs(userStore)
const { saves } = storeToRefs(gameStore)

const loading = ref(true)
const showCreateSave = ref(false)
const newSaveName = ref('')

onMounted(async () => {
  if (isAuthenticated.value && user.value) {
    try {
      await gameStore.loadSaves(user.value.id)
    } catch (error) {
      console.error('Error loading saves:', error)
    } finally {
      loading.value = false
    }
  } else {
    loading.value = false
  }
})

const createNewSave = async () => {
  if (!user.value) return

  try {
    const initialData = {
      character: null,
      progress: 0,
      inventory: []
    }
    
    await gameStore.createSave(user.value.id, newSaveName.value, initialData)
    newSaveName.value = ''
    showCreateSave.value = false
  } catch (error) {
    console.error('Error creating save:', error)
  }
}

const loadSave = (save: any) => {
  gameStore.setCurrentSave(save)
  // Navigate to game play page (to be created)
  alert(`Chargement de la sauvegarde: ${save.name}`)
}

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>
