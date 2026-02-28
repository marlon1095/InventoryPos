
<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToast } from '@/composables/useToast'
import { capitalize } from '@/utils/formatters'
import { collection, getDocs, addDoc, setDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { db, auth } from '@/services/firebase'

const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const toast = useToast()

const tabs = [
  { id: 'general', label: 'General' },
  { id: 'users', label: 'Users' },
  { id: 'receipt', label: 'Receipt' },
  { id: 'about', label: 'About' }
]

const activeTab = ref('general')
const isLoading = ref(false)
const showUserModal = ref(false)
const showDeleteModal = ref(false)
const editingUser = ref(null)
const userToDelete = ref(null)
const users = ref([])

const settings = reactive({
  storeName: 'My Store',
  currency: 'USD',
  taxRate: 10,
  lowStockThreshold: 10,
  receiptHeader: '',
  receiptFooter: 'Thank you for your purchase!'
})

const userForm = reactive({
  displayName: '',
  email: '',
  password: '',
  role: 'cashier',
  isActive: true
})

function getInitials(name) {
  if (!name) return 'U'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function getRoleBadge(role) {
  const badges = {
    admin: 'badge-danger',
    manager: 'badge-warning',
    cashier: 'badge-info'
  }
  return badges[role] || 'badge-info'
}

function saveSettings() {
  settingsStore.saveSettings({
    storeName: settings.storeName,
    currency: settings.currency,
    taxRate: settings.taxRate / 100,
    lowStockThreshold: settings.lowStockThreshold,
    receiptHeader: settings.receiptHeader,
    receiptFooter: settings.receiptFooter
  })
  toast.success('Settings saved successfully')
}

function openUserModal(user = null) {
  editingUser.value = user
  if (user) {
    Object.assign(userForm, {
      displayName: user.displayName,
      email: user.email,
      password: '',
      role: user.role,
      isActive: user.isActive
    })
  } else {
    Object.assign(userForm, {
      displayName: '',
      email: '',
      password: '',
      role: 'cashier',
      isActive: true
    })
  }
  showUserModal.value = true
}

function closeUserModal() {
  showUserModal.value = false
  editingUser.value = null
}

async function handleSaveUser() {
  if (isLoading.value) return // Prevent double submission
  
  isLoading.value = true
  
  try {
    if (editingUser.value) {
      // Update existing user
      const userRef = doc(db, 'users', editingUser.value.id)
      await updateDoc(userRef, {
        displayName: userForm.displayName,
        role: userForm.role,
        isActive: userForm.isActive,
        updatedAt: serverTimestamp()
      })
      toast.success('User updated successfully')
    } else {
      // Create new user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, userForm.email, userForm.password)
      
      // Create user profile in Firestore using uid as document ID
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        displayName: userForm.displayName,
        email: userForm.email,
        role: userForm.role,
        isActive: userForm.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      toast.success('User created successfully')
    }
    
    closeUserModal()
    await fetchUsers()
  } catch (error) {
    console.error('Error saving user:', error)
    toast.error(error.message || 'Failed to save user')
  } finally {
    isLoading.value = false
  }
}

function confirmDeleteUser(user) {
  // Prevent deleting yourself
  if (user.uid === authStore.user?.uid) {
    toast.error('You cannot delete your own account')
    return
  }
  userToDelete.value = user
  showDeleteModal.value = true
}

function closeDeleteModal() {
  showDeleteModal.value = false
  userToDelete.value = null
}

async function handleDeleteUser() {
  if (!userToDelete.value || isLoading.value) return
  
  isLoading.value = true
  
  try {
    // Delete user document from Firestore
    await deleteDoc(doc(db, 'users', userToDelete.value.id))
    
    toast.success('User deleted successfully')
    closeDeleteModal()
    await fetchUsers()
  } catch (error) {
    console.error('Error deleting user:', error)
    toast.error(error.message || 'Failed to delete user')
  } finally {
    isLoading.value = false
  }
}

async function fetchUsers() {
  try {
    const snapshot = await getDocs(collection(db, 'users'))
    users.value = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  } catch (error) {
    console.error('Error fetching users:', error)
  }
}

onMounted(() => {
  settingsStore.initialize()
  
  // Load settings
  settings.storeName = settingsStore.storeName
  settings.currency = settingsStore.currency
  settings.taxRate = settingsStore.taxRate * 100
  settings.lowStockThreshold = settingsStore.lowStockThreshold
  settings.receiptHeader = settingsStore.receiptHeader
  settings.receiptFooter = settingsStore.receiptFooter
  
  fetchUsers()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Settings</h1>
      <p class="text-gray-500 mt-1">Manage application settings and user accounts</p>
    </div>

    <!-- Settings tabs -->
    <div class="border-b border-gray-200">
      <nav class="flex gap-4">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="[
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === tab.id
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- General Settings -->
    <div v-if="activeTab === 'general'" class="card">
      <div class="card-header">
        <h3 class="font-semibold">General Settings</h3>
      </div>
      <div class="card-body space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="label">Store Name</label>
            <input v-model="settings.storeName" type="text" class="input" />
          </div>
          <div>
            <label class="label">Currency</label>
            <select v-model="settings.currency" class="input">
              <option v-for="(symbol, code) in settingsStore.currencySymbols" :key="code" :value="code">
                {{ code }} ({{ symbol }})
              </option>
            </select>
          </div>
          <div>
            <label class="label">Tax Rate (%)</label>
            <input v-model.number="settings.taxRate" type="number" step="0.01" class="input" />
          </div>
          <div>
            <label class="label">Low Stock Threshold</label>
            <input v-model.number="settings.lowStockThreshold" type="number" class="input" />
          </div>
        </div>

        <div class="flex justify-end">
          <button type="button" @click="saveSettings" class="btn-primary">Save Settings</button>
        </div>
      </div>
    </div>

    <!-- User Management -->
    <div v-if="activeTab === 'users'" class="card">
      <div class="card-header flex items-center justify-between">
        <h3 class="font-semibold">User Management</h3>
        <button type="button" @click="openUserModal()" class="btn-primary">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th class="text-left">User</th>
              <th class="text-left">Email</th>
              <th class="text-left">Role</th>
              <th class="text-left">Status</th>
              <th class="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td class="text-left">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span class="text-primary-700 font-semibold text-sm">{{ getInitials(user.displayName) }}</span>
                  </div>
                  <span class="font-medium">{{ user.displayName }}</span>
                </div>
              </td>
              <td class="text-left">{{ user.email }}</td>
              <td class="text-left">
                <span :class="getRoleBadge(user.role)">{{ capitalize(user.role) }}</span>
              </td>
              <td class="text-left">
                <span :class="user.isActive ? 'badge-success' : 'badge-danger'">
                  {{ user.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="text-left">
                <div class="flex items-center gap-1">
                  <button type="button" @click="openUserModal(user)" class="p-2 hover:bg-gray-100 rounded-lg" title="Edit">
                    <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button 
                    type="button"
                    @click="confirmDeleteUser(user)" 
                    class="p-2 hover:bg-red-50 rounded-lg" 
                    title="Delete"
                    :disabled="user.uid === authStore.user?.uid"
                    :class="{ 'opacity-50 cursor-not-allowed': user.uid === authStore.user?.uid }"
                  >
                    <svg class="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="users.length === 0">
              <td colspan="5" class="text-center text-gray-500 py-8">No users found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Receipt Settings -->
    <div v-if="activeTab === 'receipt'" class="card">
      <div class="card-header">
        <h3 class="font-semibold">Receipt Settings</h3>
      </div>
      <div class="card-body space-y-6">
        <div>
          <label class="label">Receipt Header</label>
          <textarea v-model="settings.receiptHeader" class="input" rows="2" placeholder="Store name, address, etc."></textarea>
        </div>
        <div>
          <label class="label">Receipt Footer</label>
          <textarea v-model="settings.receiptFooter" class="input" rows="2" placeholder="Thank you message, return policy, etc."></textarea>
        </div>
        <div class="flex justify-end">
          <button type="button" @click="saveSettings" class="btn-primary">Save Settings</button>
        </div>
      </div>
    </div>

    <!-- About -->
    <div v-if="activeTab === 'about'" class="card">
      <div class="card-body text-center py-12">
        <div class="w-20 h-20 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-12 h-12 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-900 mb-2">InventoryPOS</h2>
        <p class="text-gray-500 mb-4">Version 1.0.0</p>
        <p class="text-sm text-gray-400 max-w-md mx-auto">
          A simple inventory management and point of sale system built with Vue.js and Firebase.
        </p>
      </div>
    </div>

    <!-- User Modal -->
    <div v-if="showUserModal" class="modal-overlay" @click.self="closeUserModal">
      <div class="modal">
        <div class="modal-header">
          <h3 class="text-lg font-semibold">{{ editingUser ? 'Edit User' : 'Add New User' }}</h3>
          <button type="button" @click="closeUserModal" class="text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form @submit.prevent="handleSaveUser">
          <div class="modal-body space-y-4">
            <div>
              <label class="label">Display Name</label>
              <input v-model="userForm.displayName" type="text" class="input" required />
            </div>
            <div>
              <label class="label">Email</label>
              <input v-model="userForm.email" type="email" class="input" required :disabled="!!editingUser" />
            </div>
            <div v-if="!editingUser">
              <label class="label">Password</label>
              <input v-model="userForm.password" type="password" class="input" required minlength="6" />
            </div>
            <div>
              <label class="label">Role</label>
              <select v-model="userForm.role" class="input">
                <option value="admin">Administrator - Full Access</option>
                <option value="manager">Manager - All Except Settings</option>
                <option value="cashier">Cashier - POS Only</option>
              </select>
            </div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="userForm.isActive" class="rounded border-gray-300 text-primary-600" />
              <span class="text-sm text-gray-600">Active</span>
            </label>
          </div>
          <div class="modal-footer">
            <button type="button" @click="closeUserModal" class="btn-secondary">Cancel</button>
            <button type="submit" :disabled="isLoading" class="btn-primary">
              {{ editingUser ? 'Update' : 'Add' }} User
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete User Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal">
        <div class="modal-header bg-red-50">
          <h3 class="text-lg font-semibold text-red-600">Delete User</h3>
          <button type="button" @click="closeDeleteModal" class="text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p class="text-gray-600">
            Are you sure you want to delete user <strong>{{ userToDelete?.displayName }}</strong>?
          </p>
          <p class="text-sm text-gray-500 mt-2">This will remove their access to the system. This action cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button type="button" @click="closeDeleteModal" class="btn-secondary">Cancel</button>
          <button type="button" @click="handleDeleteUser" :disabled="isLoading" class="btn-danger">Delete User</button>
        </div>
      </div>
    </div>
  </div>
</template>

