<template>
  <div class="flex h-screen bg-gray-100">
    <!-- Sidebar -->
    <aside :class="[
      'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
      sidebarOpen ? 'translate-x-0' : '-translate-x-full'
    ]">
      <!-- Logo -->
      <div class="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span class="font-bold text-lg text-gray-900">InventoryPOS</span>
        </div>
        <button type="button" @click="sidebarOpen = false" class="lg:hidden p-1 rounded-lg hover:bg-gray-100">
          <svg class="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <!-- Dashboard - Admin & Manager only -->
        <router-link v-if="canAccessDashboard" to="/" class="sidebar-link" :class="{ active: isActive('/') }" @click="sidebarOpen = false">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span>Dashboard</span>
        </router-link>

        <!-- POS - All users -->
        <router-link to="/pos" class="sidebar-link" :class="{ active: isActive('/pos') }" @click="sidebarOpen = false">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span>Point of Sale</span>
        </router-link>

        <!-- Inventory - Admin & Manager only -->
        <router-link v-if="canAccessInventory" to="/inventory" class="sidebar-link" :class="{ active: isActive('/inventory') }" @click="sidebarOpen = false">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span>Inventory</span>
        </router-link>

        <!-- Transactions - Admin & Manager only -->
        <router-link v-if="canAccessTransactions" to="/transactions" class="sidebar-link" :class="{ active: isActive('/transactions') }" @click="sidebarOpen = false">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span>Transactions</span>
        </router-link>

        <!-- Settings - Admin only -->
        <router-link v-if="canAccessSettings" to="/settings" class="sidebar-link" :class="{ active: isActive('/settings') }" @click="sidebarOpen = false">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Settings</span>
        </router-link>
      </nav>

      <!-- User info -->
      <div class="p-4 border-t border-gray-200">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
            <span class="text-primary-700 font-semibold">{{ userInitials }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 truncate">{{ authStore.userName }}</p>
            <p class="text-xs text-gray-500 capitalize">{{ userRole }}</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- Mobile sidebar overlay -->
    <div 
      v-if="sidebarOpen" 
      @click="sidebarOpen = false"
      class="fixed inset-0 z-40 bg-black/50 lg:hidden"
    ></div>

    <!-- Main content -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Header -->
      <header class="sticky top-0 z-30 bg-white shadow-sm border-b border-gray-200">
        <div class="flex items-center justify-between h-16 px-4">
          <div class="flex items-center gap-4">
            <button type="button" @click="sidebarOpen = true" class="lg:hidden p-2 rounded-lg hover:bg-gray-100">
              <svg class="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 class="text-lg font-semibold text-gray-900">{{ pageTitle }}</h1>
          </div>

          <div class="flex items-center gap-3">
            <!-- Low stock alert with tooltip (only for admin/manager) -->
            <div class="relative" v-if="lowStockCount > 0 && canAccessInventory">
              <button 
                type="button"
                @click="showAlertTooltip = !showAlertTooltip" 
                class="relative p-2 rounded-lg hover:bg-gray-100"
              >
                <svg class="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span class="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {{ lowStockCount > 9 ? '9+' : lowStockCount }}
                </span>
              </button>
              
              <!-- Tooltip -->
              <div 
                v-if="showAlertTooltip" 
                class="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50"
              >
                <p class="font-semibold text-gray-900 mb-2">Low Stock Alert</p>
                <p class="text-sm text-gray-600 mb-2">{{ lowStockCount }} product(s) are running low on stock.</p>
                <router-link 
                  to="/inventory" 
                  @click="showAlertTooltip = false"
                  class="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  View Inventory →
                </router-link>
              </div>
            </div>

            <!-- User dropdown -->
            <div class="relative" ref="userMenuRef">
              <button type="button" @click="userMenuOpen = !userMenuOpen" class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100">
                <div class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span class="text-primary-700 font-semibold text-sm">{{ userInitials }}</span>
                </div>
                <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div v-if="userMenuOpen" class="dropdown">
                <div class="px-4 py-3 border-b border-gray-100">
                  <p class="text-sm font-medium text-gray-900">{{ authStore.userName }}</p>
                  <p class="text-xs text-gray-500">{{ authStore.user?.email }}</p>
                </div>
                <button type="button" @click="handleLogout" class="dropdown-item w-full text-left text-red-600 hover:bg-red-50">
                  <svg class="w-4 h-4 inline mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Page content -->
      <main class="flex-1 overflow-y-auto p-4 lg:p-6">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- Toast notifications -->
    <ToastContainer />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useSettingsStore } from '@/stores/settingsStore'
import ToastContainer from '@/components/common/ToastContainer.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const inventory = useInventoryStore()
const settingsStore = useSettingsStore()

const sidebarOpen = ref(false)
const userMenuOpen = ref(false)
const showAlertTooltip = ref(false)
const userMenuRef = ref(null)

const pageTitle = computed(() => route.meta?.title || 'Dashboard')

const userInitials = computed(() => {
  const name = authStore.userName
  if (!name) return 'U'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
})

const lowStockCount = computed(() => inventory.lowStockProducts.length)

// Get user role
const userRole = computed(() => {
  return authStore.userProfile?.role || 'loading...'
})

// Role-based access control
// Admin: All access
// Manager: All except Settings
// Cashier: Only POS

const isAdmin = computed(() => authStore.userProfile?.role === 'admin')
const isManager = computed(() => authStore.userProfile?.role === 'manager')
const isCashier = computed(() => authStore.userProfile?.role === 'cashier')

// Navigation visibility
const canAccessDashboard = computed(() => {
  return isAdmin.value || isManager.value
})

const canAccessInventory = computed(() => {
  return isAdmin.value || isManager.value
})

const canAccessTransactions = computed(() => {
  return isAdmin.value || isManager.value
})

const canAccessSettings = computed(() => {
  return isAdmin.value
})

function isActive(path) {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}

function handleClickOutside(event) {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target)) {
    userMenuOpen.value = false
  }
  
  showAlertTooltip.value = false
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  settingsStore.initialize()
  inventory.fetchProducts()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
