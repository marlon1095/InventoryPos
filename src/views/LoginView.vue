
<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()

const form = reactive({
  email: '',
  password: '',
  remember: false
})

const showPassword = ref(false)
const showForgotPassword = ref(false)
const resetEmail = ref('')

async function handleLogin() {
  authStore.clearError()
  
  const success = await authStore.login(form.email, form.password)
  
  if (success) {
    toast.success('Welcome back!')
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  }
}

async function handleResetPassword() {
  if (!resetEmail.value) {
    toast.warning('Please enter your email address')
    return
  }
  
  const success = await authStore.resetPassword(resetEmail.value)
  
  if (success) {
    toast.success('Password reset email sent!')
    showForgotPassword.value = false
    resetEmail.value = ''
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Logo and title -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
          <svg class="w-10 h-10 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-white">InventoryPOS</h1>
        <p class="text-primary-200 mt-1">Sign in to your account</p>
      </div>

      <!-- Login form -->
      <div class="bg-white rounded-2xl shadow-xl p-8">
        <form @submit.prevent="handleLogin" class="space-y-5">
          <!-- Error message -->
          <div v-if="authStore.error" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {{ authStore.error }}
          </div>

          <!-- Email -->
          <div>
            <label for="email" class="label">Email address</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              class="input"
              placeholder="Enter your email"
              required
            />
          </div>

          <!-- Password -->
          <div>
            <label for="password" class="label">Password</label>
            <div class="relative">
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                class="input pr-10"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg v-if="showPassword" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
                <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Remember me -->
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="form.remember" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span class="text-sm text-gray-600">Remember me</span>
            </label>
            <button type="button" @click="showForgotPassword = true" class="text-sm text-primary-600 hover:text-primary-700">
              Forgot password?
            </button>
          </div>

          <!-- Submit button -->
          <button
            type="submit"
            :disabled="authStore.loading"
            class="w-full btn-primary py-3"
          >
            <span v-if="authStore.loading" class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Signing in...
            </span>
            <span v-else>Sign in</span>
          </button>
        </form>

        <!-- Demo credentials -->
        <!-- <div class="mt-6 p-4 bg-gray-50 rounded-lg">
          <p class="text-xs font-medium text-gray-500 mb-2">Demo Credentials:</p>
          <div class="space-y-1 text-xs text-gray-600">
            <p><span class="font-medium">Admin:</span> admin@demo.com / demo123</p>
            <p><span class="font-medium">Manager:</span> manager@demo.com / demo123</p>
            <p><span class="font-medium">Cashier:</span> cashier@demo.com / demo123</p>
          </div>
        </div> -->
      </div>

      <!-- Footer -->
      <p class="text-center text-primary-200 text-sm mt-8">
        © 2026 InventoryPOS. All rights reserved.
      </p>
    </div>

    <!-- Forgot password modal -->
    <div v-if="showForgotPassword" class="modal-overlay" @click.self="showForgotPassword = false">
      <div class="modal">
        <div class="modal-header">
          <h3 class="text-lg font-semibold">Reset Password</h3>
          <button @click="showForgotPassword = false" class="text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p class="text-sm text-gray-600 mb-4">Enter your email address and we'll send you a link to reset your password.</p>
          <input
            v-model="resetEmail"
            type="email"
            class="input"
            placeholder="Enter your email"
          />
        </div>
        <div class="modal-footer">
          <button @click="showForgotPassword = false" class="btn-secondary">Cancel</button>
          <button @click="handleResetPassword" :disabled="authStore.loading" class="btn-primary">
            Send Reset Link
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
