
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { usePOSStore } from '@/stores/posStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { formatCurrency, formatDate, capitalize } from '@/utils/formatters'
import { collection, getDocs, orderBy, query, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/services/firebase'

const pos = usePOSStore()
const inventory = useInventoryStore()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()

const activeTab = ref('sales')
const searchQuery = ref('')
const statusFilter = ref('')
const paymentFilter = ref('')
const sortOrder = ref('desc')
const showDetailModal = ref(false)
const showVoidModal = ref(false)
const selectedTransaction = ref(null)
const voidReason = ref('')
const activityLogs = ref([])
const logsSearchQuery = ref('')
const logsSortOrder = ref('desc')

// Pagination
const currentPage = ref(1)
const logsCurrentPage = ref(1)
const itemsPerPage = 10

const filteredTransactions = computed(() => {
  let transactions = [...pos.transactions]

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    transactions = transactions.filter(t =>
      t.transactionNumber?.toLowerCase().includes(query)
    )
  }

  if (statusFilter.value) {
    transactions = transactions.filter(t => t.status === statusFilter.value)
  }

  if (paymentFilter.value) {
    transactions = transactions.filter(t => t.paymentMethod === paymentFilter.value)
  }

  // Sort by date
  transactions.sort((a, b) => {
    const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0)
    const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0)
    return sortOrder.value === 'desc' ? dateB - dateA : dateA - dateB
  })

  return transactions
})

// Pagination for transactions
const totalPages = computed(() => Math.ceil(filteredTransactions.value.length / itemsPerPage))

const paginatedTransactions = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredTransactions.value.slice(start, end)
})

// Displayed pages for responsive pagination (Transactions)
const displayedPages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const pages = []
  
  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    pages.push(1)
    
    if (current > 3) {
      pages.push('...')
    }
    
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    
    if (current < total - 2) {
      pages.push('...')
    }
    
    pages.push(total)
  }
  
  return pages
})

// Filtered and sorted activity logs
const filteredActivityLogs = computed(() => {
  let logs = [...activityLogs.value]
  
  // Search filter
  if (logsSearchQuery.value) {
    const query = logsSearchQuery.value.toLowerCase()
    logs = logs.filter(log =>
      log.action?.toLowerCase().includes(query) ||
      log.userName?.toLowerCase().includes(query) ||
      log.details?.toLowerCase().includes(query)
    )
  }
  
  // Sort by date
  logs.sort((a, b) => {
    const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0)
    const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0)
    return logsSortOrder.value === 'desc' ? dateB - dateA : dateA - dateB
  })
  
  return logs
})

// Pagination for activity logs
const logsTotalPages = computed(() => Math.ceil(filteredActivityLogs.value.length / itemsPerPage))

const paginatedLogs = computed(() => {
  const start = (logsCurrentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredActivityLogs.value.slice(start, end)
})

// Displayed pages for responsive pagination (Activity Logs)
const logsDisplayedPages = computed(() => {
  const total = logsTotalPages.value
  const current = logsCurrentPage.value
  const pages = []
  
  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    pages.push(1)
    
    if (current > 3) {
      pages.push('...')
    }
    
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    
    if (current < total - 2) {
      pages.push('...')
    }
    
    pages.push(total)
  }
  
  return pages
})

function goToPage(page) {
  currentPage.value = page
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

function logsGoToPage(page) {
  logsCurrentPage.value = page
}

function logsNextPage() {
  if (logsCurrentPage.value < logsTotalPages.value) {
    logsCurrentPage.value++
  }
}

function logsPrevPage() {
  if (logsCurrentPage.value > 1) {
    logsCurrentPage.value--
  }
}

// Reset to first page when filters change
watch([searchQuery, statusFilter, paymentFilter], () => {
  currentPage.value = 1
})

// Reset logs page when search changes
watch(logsSearchQuery, () => {
  logsCurrentPage.value = 1
})

function toggleSort() {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
}

function toggleLogsSort() {
  logsSortOrder.value = logsSortOrder.value === 'desc' ? 'asc' : 'desc'
}

function getStatusBadge(status) {
  const badges = {
    completed: 'badge-success',
    voided: 'badge-danger',
    refunded: 'badge-warning'
  }
  return badges[status] || 'badge-info'
}

function getActionBadge(action) {
  const badges = {
    'Product Created': 'badge-success',
    'Product Updated': 'badge-info',
    'Product Deleted': 'badge-danger',
    'Stock Adjusted': 'badge-warning',
    'Transaction Completed': 'badge-success',
    'Transaction Voided': 'badge-danger'
  }
  return badges[action] || 'badge-info'
}

function viewTransaction(transaction) {
  selectedTransaction.value = transaction
  showDetailModal.value = true
}

function openVoidModal(transaction) {
  selectedTransaction.value = transaction
  voidReason.value = ''
  showVoidModal.value = true
}

async function confirmVoid() {
  if (!voidReason.value) return
  
  const success = await pos.voidTransaction(selectedTransaction.value.id, voidReason.value)
  if (success) {
    // Log activity
    await logActivity('Transaction Voided', `Transaction ${selectedTransaction.value.transactionNumber} voided: ${voidReason.value}`)
    showVoidModal.value = false
    selectedTransaction.value = null
    await fetchActivityLogs()
  }
}

function printReceipt() {
  window.print()
}

async function logActivity(action, details) {
  try {
    await addDoc(collection(db, 'activityLogs'), {
      action,
      details,
      userId: authStore.user?.uid,
      userName: authStore.userName,
      createdAt: serverTimestamp()
    })
  } catch (error) {
    console.error('Error logging activity:', error)
  }
}

async function fetchActivityLogs() {
  try {
    const q = query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)
    activityLogs.value = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date()
    }))
  } catch (error) {
    console.error('Error fetching activity logs:', error)
  }
}

onMounted(() => {
  settingsStore.initialize()
  pos.fetchTransactions()
  fetchActivityLogs()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Transactions</h1>
        <p class="text-gray-500 mt-1">View and manage all sales transactions</p>
      </div>
      <div class="flex gap-2">
        <button @click="activeTab = 'sales'" :class="['btn', activeTab === 'sales' ? 'btn-primary' : 'btn-outline']">
          Sales
        </button>
        <button @click="activeTab = 'logs'" :class="['btn', activeTab === 'logs' ? 'btn-primary' : 'btn-outline']">
          Activity Logs
        </button>
      </div>
    </div>

    <!-- Sales Tab -->
    <template v-if="activeTab === 'sales'">
      <!-- Filters -->
      <div class="card p-4">
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="flex-1">
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                v-model="searchQuery"
                type="text"
                class="input pl-10"
                placeholder="Search by transaction number..."
              />
            </div>
          </div>
          <select v-model="statusFilter" class="input w-auto">
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="voided">Voided</option>
          </select>
          <select v-model="paymentFilter" class="input w-auto">
            <option value="">All Payments</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
      </div>

      <!-- Transactions table -->
      <div class="card">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th class="text-left">Transaction #</th>
                <th class="text-left">
                  <button @click="toggleSort" class="flex items-center gap-1 hover:text-primary-600">
                    Date & Time
                    <svg v-if="sortOrder === 'desc'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                    <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                </th>
                <th class="text-left">Cashier</th>
                <th class="text-left">Items</th>
                <th class="text-left">Total</th>
                <th class="text-left">Payment</th>
                <th class="text-left">Status</th>
                <th class="text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="transaction in paginatedTransactions" :key="transaction.id">
                <td class="text-left">
                  <span class="font-mono text-sm">{{ transaction.transactionNumber }}</span>
                </td>
                <td class="text-left">
                  <div>
                    <p class="text-gray-900">{{ formatDate(transaction.createdAt, 'short') }}</p>
                    <p class="text-xs text-gray-500">{{ formatDate(transaction.createdAt, 'time') }}</p>
                  </div>
                </td>
                <td class="text-left">{{ transaction.cashierName }}</td>
                <td class="text-left">
                  <button @click="viewTransaction(transaction)" class="text-primary-600 hover:text-primary-700">
                    {{ transaction.items?.length || 0 }} items
                  </button>
                </td>
                <td class="text-left font-medium">{{ formatCurrency(transaction.grandTotal) }}</td>
                <td class="text-left">
                  <span class="capitalize">{{ transaction.paymentMethod }}</span>
                </td>
                <td class="text-left">
                  <span :class="getStatusBadge(transaction.status)">
                    {{ capitalize(transaction.status) }}
                  </span>
                </td>
                <td class="text-left">
                  <div class="flex items-center gap-1">
                    <button
                      v-if="transaction.status === 'completed'"
                      @click="openVoidModal(transaction)"
                      class="p-2 hover:bg-red-50 rounded-lg text-red-500"
                      title="Void Transaction"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </button>
                    <button @click="viewTransaction(transaction)" class="p-2 hover:bg-gray-100 rounded-lg" title="View Details">
                      <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="paginatedTransactions.length === 0">
                <td colspan="8" class="text-center text-gray-500 py-12">
                  No transactions found
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Pagination -->
        <div v-if="filteredTransactions.length > itemsPerPage" class="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-gray-200 gap-3">
          <div class="text-sm text-gray-500 order-2 sm:order-1">
            Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to {{ Math.min(currentPage * itemsPerPage, filteredTransactions.length) }} of {{ filteredTransactions.length }} transactions
          </div>
          <div class="flex items-center gap-2 order-1 sm:order-2">
            <button 
              @click="prevPage" 
              :disabled="currentPage === 1"
              :class="['btn-outline px-3 py-1 text-sm', currentPage === 1 ? 'opacity-50 cursor-not-allowed' : '']"
            >
              Previous
            </button>
            <div class="flex items-center gap-1 flex-wrap justify-center">
              <button
                v-for="page in displayedPages"
                :key="page"
                @click="page !== '...' ? goToPage(page) : null"
                :class="[
                  'w-8 h-8 rounded text-sm font-medium',
                  page === '...' 
                    ? 'bg-transparent text-gray-400 cursor-default' 
                    : currentPage === page 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                ]"
              >
                {{ page }}
              </button>
            </div>
            <button 
              @click="nextPage" 
              :disabled="currentPage === totalPages"
              :class="['btn-outline px-3 py-1 text-sm', currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : '']"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Activity Logs Tab -->
    <template v-if="activeTab === 'logs'">
      <!-- Search for Activity Logs -->
      <div class="card p-4">
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="flex-1">
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                v-model="logsSearchQuery"
                type="text"
                class="input pl-10"
                placeholder="Search by action, user, or details..."
              />
            </div>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th class="text-left">
                  <button @click="toggleLogsSort" class="flex items-center gap-1 hover:text-primary-600">
                    Date & Time
                    <svg v-if="logsSortOrder === 'desc'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                    <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                </th>
                <th class="text-left">Action</th>
                <th class="text-left">User</th>
                <th class="text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in paginatedLogs" :key="log.id">
                <td class="text-left">{{ formatDate(log.createdAt, 'datetime') }}</td>
                <td class="text-left">
                  <span :class="getActionBadge(log.action)">{{ log.action }}</span>
                </td>
                <td class="text-left">{{ log.userName }}</td>
                <td class="text-left text-sm text-gray-600">{{ log.details }}</td>
              </tr>
              <tr v-if="paginatedLogs.length === 0">
                <td colspan="4" class="text-center text-gray-500 py-12">
                  No activity logs yet
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Pagination for Activity Logs -->
        <div v-if="filteredActivityLogs.length > itemsPerPage" class="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-gray-200 gap-3">
          <div class="text-sm text-gray-500 order-2 sm:order-1">
            Showing {{ (logsCurrentPage - 1) * itemsPerPage + 1 }} to {{ Math.min(logsCurrentPage * itemsPerPage, filteredActivityLogs.length) }} of {{ filteredActivityLogs.length }} logs
          </div>
          <div class="flex items-center gap-2 order-1 sm:order-2">
            <button 
              @click="logsPrevPage" 
              :disabled="logsCurrentPage === 1"
              :class="['btn-outline px-3 py-1 text-sm', logsCurrentPage === 1 ? 'opacity-50 cursor-not-allowed' : '']"
            >
              Previous
            </button>
            <div class="flex items-center gap-1 flex-wrap justify-center">
              <button
                v-for="page in logsDisplayedPages"
                :key="page"
                @click="page !== '...' ? logsGoToPage(page) : null"
                :class="[
                  'w-8 h-8 rounded text-sm font-medium',
                  page === '...' 
                    ? 'bg-transparent text-gray-400 cursor-default' 
                    : logsCurrentPage === page 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                ]"
              >
                {{ page }}
              </button>
            </div>
            <button 
              @click="logsNextPage" 
              :disabled="logsCurrentPage === logsTotalPages"
              :class="['btn-outline px-3 py-1 text-sm', logsCurrentPage === logsTotalPages ? 'opacity-50 cursor-not-allowed' : '']"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Transaction Detail Modal -->
    <div v-if="showDetailModal" class="modal-overlay" @click.self="showDetailModal = false">
      <div class="modal max-w-lg">
        <div class="modal-header">
          <h3 class="text-lg font-semibold">Transaction Details</h3>
          <button @click="showDetailModal = false" class="text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div v-if="selectedTransaction" class="modal-body">
          <div class="flex items-center justify-between mb-4">
            <span class="font-mono text-sm text-gray-500">{{ selectedTransaction.transactionNumber }}</span>
            <span :class="getStatusBadge(selectedTransaction.status)">
              {{ capitalize(selectedTransaction.status) }}
            </span>
          </div>

          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p class="text-gray-500">Date</p>
                <p class="font-medium">{{ formatDate(selectedTransaction.createdAt, 'datetime') }}</p>
              </div>
              <div>
                <p class="text-gray-500">Cashier</p>
                <p class="font-medium">{{ selectedTransaction.cashierName }}</p>
              </div>
              <div>
                <p class="text-gray-500">Payment Method</p>
                <p class="font-medium capitalize">{{ selectedTransaction.paymentMethod }}</p>
              </div>
              <div v-if="selectedTransaction.paymentMethod === 'cash'">
                <p class="text-gray-500">Amount Paid</p>
                <p class="font-medium">{{ formatCurrency(selectedTransaction.amountPaid) }}</p>
              </div>
            </div>

            <div class="border-t pt-4">
              <p class="font-medium mb-2">Items ({{ selectedTransaction.items?.length || 0 }})</p>
              <div class="space-y-2">
                <div
                  v-for="(item, index) in selectedTransaction.items"
                  :key="index"
                  class="flex justify-between text-sm"
                >
                  <div>
                    <p>{{ item.productName }}</p>
                    <p class="text-gray-500 text-xs">{{ item.quantity }} × {{ formatCurrency(item.unitPrice) }}</p>
                  </div>
                  <p class="font-medium">{{ formatCurrency(item.subtotal) }}</p>
                </div>
              </div>
            </div>

            <div class="border-t pt-4 space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Subtotal</span>
                <span>{{ formatCurrency(selectedTransaction.subtotal) }}</span>
              </div>
              <div v-if="selectedTransaction.discount > 0" class="flex justify-between text-red-600">
                <span>Discount</span>
                <span>-{{ formatCurrency(selectedTransaction.discount) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Tax</span>
                <span>{{ formatCurrency(selectedTransaction.tax) }}</span>
              </div>
              <div class="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total</span>
                <span>{{ formatCurrency(selectedTransaction.grandTotal) }}</span>
              </div>
              <div v-if="selectedTransaction.paymentMethod === 'cash'" class="flex justify-between text-green-600">
                <span>Change</span>
                <span>{{ formatCurrency(selectedTransaction.change) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="printReceipt" class="btn-outline">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          <button @click="showDetailModal = false" class="btn-secondary">Close</button>
        </div>
      </div>
    </div>

    <!-- Void Confirmation Modal -->
    <div v-if="showVoidModal" class="modal-overlay" @click.self="showVoidModal = false">
      <div class="modal">
        <div class="modal-header bg-red-50">
          <h3 class="text-lg font-semibold text-red-600">Void Transaction</h3>
          <button @click="showVoidModal = false" class="text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p class="text-gray-600">
            Are you sure you want to void transaction <strong>{{ selectedTransaction?.transactionNumber }}</strong>?
          </p>
          <p class="text-sm text-gray-500 mt-2">This will restore the inventory for all items in this transaction.</p>
          
          <div class="mt-4">
            <label class="label">Reason for Void</label>
            <select v-model="voidReason" class="input">
              <option value="">Select reason...</option>
              <option value="customer_request">Customer Request</option>
              <option value="wrong_item">Wrong Item Sold</option>
              <option value="pricing_error">Pricing Error</option>
              <option value="system_error">System Error</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showVoidModal = false" class="btn-secondary">Cancel</button>
          <button @click="confirmVoid" :disabled="!voidReason || pos.loading" class="btn-danger">
            Void Transaction
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
