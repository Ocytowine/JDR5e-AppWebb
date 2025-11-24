<template>
  <div class="px-4 py-8">
    <div class="text-center mb-8">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">
        Bienvenue dans JDR 5e - Jeu Web
      </h1>
      <p class="text-xl text-gray-600 mb-8">
        Projet de jeu web - jeu de rôle solo sur navigateur, mécaniques complexes
      </p>
    </div>

    <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      <div class="bg-white rounded-lg shadow-md p-6">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">Caractéristiques</h2>
        <ul class="space-y-2 text-gray-600">
          <li class="flex items-start">
            <span class="text-green-500 mr-2">✓</span>
            <span>Système de jeu de rôle complet basé sur D&D 5e</span>
          </li>
          <li class="flex items-start">
            <span class="text-green-500 mr-2">✓</span>
            <span>Création et gestion de personnages</span>
          </li>
          <li class="flex items-start">
            <span class="text-green-500 mr-2">✓</span>
            <span>Système de sauvegarde persistant</span>
          </li>
          <li class="flex items-start">
            <span class="text-green-500 mr-2">✓</span>
            <span>Interface moderne avec Tailwind CSS</span>
          </li>
        </ul>
      </div>

      <div class="bg-white rounded-lg shadow-md p-6">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">Technologies</h2>
        <ul class="space-y-2 text-gray-600">
          <li class="flex items-start">
            <span class="text-blue-500 mr-2">●</span>
            <span>Nuxt 3 + Vue 3 + TypeScript</span>
          </li>
          <li class="flex items-start">
            <span class="text-blue-500 mr-2">●</span>
            <span>Pinia pour la gestion d'état</span>
          </li>
          <li class="flex items-start">
            <span class="text-blue-500 mr-2">●</span>
            <span>Tailwind CSS pour le style</span>
          </li>
          <li class="flex items-start">
            <span class="text-blue-500 mr-2">●</span>
            <span>SQLite (dev) / PostgreSQL (prod)</span>
          </li>
        </ul>
      </div>
    </div>

    <div class="text-center mt-12">
      <NuxtLink v-if="!isAuthenticated" to="/register" class="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-lg text-lg">
        Commencer à jouer
      </NuxtLink>
      <NuxtLink v-else to="/game" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg text-lg">
        Aller au jeu
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from '~/stores/user'
import { storeToRefs } from 'pinia'

const userStore = useUserStore()
const { isAuthenticated } = storeToRefs(userStore)
</script>
