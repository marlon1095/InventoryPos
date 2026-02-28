import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/',
    component: () => import('@/components/common/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: 'Dashboard', roles: ['admin', 'manager'] }
      },
      {
        path: 'inventory',
        name: 'Inventory',
        component: () => import('@/views/InventoryView.vue'),
        meta: { title: 'Inventory Management', roles: ['admin', 'manager'] }
      },
      {
        path: 'pos',
        name: 'POS',
        component: () => import('@/views/POSView.vue'),
        meta: { title: 'Point of Sale' } // All roles can access
      },
      {
        path: 'transactions',
        name: 'Transactions',
        component: () => import('@/views/TransactionsView.vue'),
        meta: { title: 'Transactions', roles: ['admin', 'manager'] }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { title: 'Settings', roles: ['admin'] }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guards
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // Wait for auth to initialize
  if (!authStore.isInitialized) {
    await new Promise(resolve => {
      const unwatch = authStore.$subscribe((mutation, state) => {
        if (state.isInitialized) {
          unwatch()
          resolve()
        }
      })
      // Timeout after 5 seconds
      setTimeout(() => {
        unwatch()
        resolve()
      }, 5000)
    })
  }

  // Wait for userProfile to be loaded if authenticated
  if (authStore.isAuthenticated && !authStore.userProfile) {
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  const isAuthenticated = authStore.isAuthenticated
  const requiresAuth = to.meta.requiresAuth
  const requiresGuest = to.meta.requiresGuest
  const requiredRoles = to.meta.roles
  const userRole = authStore.userProfile?.role

  // Check authentication first
  if (requiresAuth && !isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }
  
  if (requiresGuest && isAuthenticated) {
    // Redirect based on role
    if (userRole === 'cashier') {
      next({ name: 'POS' })
    } else {
      next({ name: 'Dashboard' })
    }
    return
  }
  
  // Check role-based access
  if (requiredRoles && requiredRoles.length > 0) {
    if (!userRole || !requiredRoles.includes(userRole)) {
      // User doesn't have required role
      console.log(`Access denied to ${to.path}. Required roles: ${requiredRoles}, User role: ${userRole}`)
      // Redirect cashier to POS, others to Dashboard (which they can access)
      if (userRole === 'cashier') {
        next({ name: 'POS' })
      } else {
        next({ name: 'Dashboard' })
      }
      return
    }
  }
  
  next()
})

export default router
