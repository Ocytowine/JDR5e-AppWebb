<template>
  <div class="min-h-screen bg-gray-100">
    <nav class="bg-white shadow-lg">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <div class="flex-shrink-0 flex items-center">
              <NuxtLink to="/" class="text-xl font-bold text-gray-800">
                JDR 5e
              </NuxtLink>
            </div>
            <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
              <NuxtLink to="/" class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900">
                Accueil
              </NuxtLink>
              <NuxtLink v-if="isAuthenticated" to="/game" class="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
                Jouer
              </NuxtLink>
            </div>
          </div>
          <div class="flex items-center">
            <template v-if="isAuthenticated">
              <span class="text-sm text-gray-700 mr-4">{{ user?.username }}</span>
              <button @click="handleLogout" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm">
                Déconnexion
              </button>
            </template>
            <template v-else>
              <NuxtLink to="/login" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm mr-2">
                Connexion
              </NuxtLink>
              <NuxtLink to="/register" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm">
                Inscription
              </NuxtLink>
            </template>
          </div>
        </div>
      </div>
    </nav>
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from '~/stores/user'
import { storeToRefs } from 'pinia'

const userStore = useUserStore()
const { user, isAuthenticated } = storeToRefs(userStore)

const handleLogout = () => {
  userStore.logout()
  navigateTo('/login')
}
</script>
