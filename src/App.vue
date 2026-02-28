<template>
  <div class="min-h-screen bg-gray-50">
    <router-view />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()

onMounted(async () => {
  await authStore.initializeAuth()
})
</script>
