
<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useInventoryStore } from '@/stores/inventoryStore'
import { usePOSStore } from '@/stores/posStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { formatCurrency } from '@/utils/formatters'
import { PAYMENT_METHODS } from '@/utils/constants'

const inventory = useInventoryStore()
const pos = usePOSStore()
const settingsStore = useSettingsStore()

const searchQuery = ref('')
const selectedCategory = ref('')
const searchInput = ref(null)
const discountValue = ref(0)
const discountType = ref('percentage')
const paymentMethods = PAYMENT_METHODS

const showPaymentModal = ref(false)
const showCashModal = ref(false)
const cashReceived = ref(0)

// Mobile responsive
const isMobile = ref(false)
const mobileView = ref('products')

function checkMobile() {
  isMobile.value = window.innerWidth < 1024
}

// Computed totals using settings tax rate
const taxAmount = computed(() => {
  const taxableAmount = pos.subtotal - pos.discountAmount
  return taxableAmount * settingsStore.taxRate
})

const grandTotal = computed(() => {
  const taxableAmount = pos.subtotal - pos.discountAmount
  return taxableAmount + taxAmount.value
})

const quickCashAmounts = computed(() => {
  const total = grandTotal.value
  const amounts = [10, 20, 50, 100]
  return amounts.filter(a => a >= total).slice(0, 4)
})

const change = computed(() => {
  return Math.max(0, cashReceived.value - grandTotal.value)
})

const filteredProducts = computed(() => {
  let products = inventory.activeProducts.filter(p => p.quantity > 0)

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    products = products.filter(p =>
      p.name?.toLowerCase().includes(query) ||
      p.sku?.toLowerCase().includes(query) ||
      p.barcode?.toLowerCase().includes(query)
    )
  }

  if (selectedCategory.value) {
    products = products.filter(p => p.category === selectedCategory.value)
  }

  // Sort by name alphabetically (ascending) - case insensitive
  products.sort((a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()))

  return products
})

// Watch discount changes
watch([discountValue, discountType], () => {
  pos.setDiscount(discountValue.value, discountType.value)
})

function handleImageError(event) {
  event.target.style.display = 'none'
}

function addToCart(product) {
  pos.addToCart(product)
  // On mobile, switch to cart view after adding
  if (isMobile.value) {
    mobileView.value = 'cart'
  }
}

function updateQuantity(productId, quantity) {
  pos.updateCartItemQuantity(productId, quantity)
}

function removeFromCart(productId) {
  pos.removeFromCart(productId)
}

function clearCart() {
  if (confirm('Clear all items from cart?')) {
    pos.clearCart()
    discountValue.value = 0
  }
}

async function processPayment(method) {
  if (method === 'cash') {
    cashReceived.value = Math.ceil(grandTotal.value)
    showCashModal.value = true
  } else {
    const transaction = await pos.processTransaction(method, grandTotal.value, taxAmount.value)
    if (transaction) {
      showPaymentModal.value = true
    }
  }
}

async function completeCashPayment() {
  const transaction = await pos.processTransaction('cash', cashReceived.value, taxAmount.value)
  if (transaction) {
    showCashModal.value = false
    showPaymentModal.value = true
  }
}

function closePaymentModal() {
  showPaymentModal.value = false
  discountValue.value = 0
  mobileView.value = 'products'
}

function printReceipt() {
  window.print()
}

onMounted(() => {
  settingsStore.initialize()
  inventory.fetchProducts()
  inventory.fetchCategories()
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<template>
  <div class="flex flex-col lg:flex-row h-[calc(100vh-7rem)] lg:h-auto gap-4">
    <!-- Mobile: POS Mode Toggle -->
    <div v-if="pos.cart.length > 0 && isMobile" class="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 p-3">
      <div class="flex gap-2">
        <button 
          @click="mobileView = 'products'" 
          :class="['flex-1 py-2 rounded-lg text-sm font-medium', mobileView === 'products' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600']"
        >
          Products
        </button>
        <button 
          @click="mobileView = 'cart'" 
          :class="['flex-1 py-2 rounded-lg text-sm font-medium relative', mobileView === 'cart' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600']"
        >
          Cart
          <span v-if="pos.cart.length > 0" class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {{ pos.cart.length }}
          </span>
        </button>
      </div>
    </div>

    <!-- Products section -->
    <div :class="[
      'flex-1 flex flex-col min-w-0',
      isMobile && mobileView === 'cart' ? 'hidden lg:flex' : 'flex'
    ]">
      <!-- Search bar -->
      <div class="card p-3 md:p-4 mb-3 md:mb-4">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            class="input pl-10"
            placeholder="Search products..."
            ref="searchInput"
          />
        </div>
      </div>

      <!-- Categories -->
      <div class="flex gap-2 mb-3 md:mb-4 overflow-x-auto pb-2 -mx-2 px-2">
        <button
          @click="selectedCategory = ''"
          :class="[
            'px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap transition-colors',
            selectedCategory === '' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
          ]"
        >
          All
        </button>
        <button
          v-for="cat in inventory.categories"
          :key="cat.id"
          @click="selectedCategory = cat.id"
          :class="[
            'px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap transition-colors',
            selectedCategory === cat.id ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
          ]"
        >
          {{ cat.name }}
        </button>
      </div>

      <!-- Products grid -->
      <div class="flex-1 overflow-y-auto -mx-2 px-2">
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
          <button
            v-for="product in filteredProducts"
            :key="product.id"
            @click="addToCart(product)"
            :disabled="product.quantity <= 0"
            :class="[
              'card p-1.5 md:p-2 text-left transition-all hover:shadow-md',
              product.quantity <= 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary-300'
            ]"
          >
            <div class="w-full aspect-square bg-gray-100 rounded-lg mb-1 flex items-center justify-center overflow-hidden">
              <img 
                v-if="product.imageUrl" 
                :src="product.imageUrl" 
                class="w-full h-full object-cover"
                @error="handleImageError"
              />
              <svg v-else class="w-5 h-5 md:w-6 md:h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p class="font-medium text-gray-900 text-[10px] md:text-xs truncate">{{ product.name }}</p>
            <div class="flex items-center justify-between mt-0.5 md:mt-1">
              <p class="font-semibold text-primary-600 text-xs md:text-sm">{{ formatCurrency(product.sellingPrice) }}</p>
              <span :class="['text-[9px] md:text-[10px] px-1 py-0.5 rounded-full', product.quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700']">
                {{ product.quantity > 0 ? product.quantity : 'Out' }}
              </span>
            </div>
          </button>
        </div>
        <div v-if="filteredProducts.length === 0" class="text-center py-8 md:py-12 text-gray-500 text-sm">
          No products found
        </div>
      </div>
    </div>

    <!-- Cart section -->
    <div :class="[
      'w-full lg:w-80 xl:w-96 flex flex-col',
      isMobile && mobileView === 'products' ? 'hidden lg:flex' : 'flex'
    ]">
      <!-- Cart header -->
      <div class="card-header rounded-t-xl">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-gray-900 text-sm md:text-base">Current Sale</h3>
          <button
            v-if="pos.cart.length > 0"
            @click="clearCart"
            class="text-xs md:text-sm text-red-600 hover:text-red-700"
          >
            Clear All
          </button>
        </div>
      </div>

      <!-- Cart items -->
      <div class="card-body flex-1 overflow-y-auto p-0 max-h-[200px] lg:max-h-[300px]">
        <div v-if="pos.cart.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400 py-8">
          <svg class="w-12 h-12 md:w-16 md:h-16 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p class="text-sm">Cart is empty</p>
          <p class="text-xs text-gray-400 hidden lg:block">Add products to start a sale</p>
        </div>
        <div v-else class="divide-y divide-gray-100">
          <div
            v-for="item in pos.cart"
            :key="item.productId"
            class="p-2 md:p-3 hover:bg-gray-50"
          >
            <div class="flex items-start justify-between mb-1.5 md:mb-2">
              <div class="flex-1 min-w-0">
                <p class="font-medium text-gray-900 text-xs md:text-sm truncate">{{ item.name }}</p>
                <p class="text-[10px] md:text-xs text-gray-500">{{ formatCurrency(item.price) }} each</p>
              </div>
              <button @click="removeFromCart(item.productId)" class="text-red-500 hover:text-red-700 p-1">
                <svg class="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1">
                <button
                  @click="updateQuantity(item.productId, item.quantity - 1)"
                  class="w-6 h-6 md:w-7 md:h-7 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                >
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                  </svg>
                </button>
                <input
                  :value="item.quantity"
                  @change="updateQuantity(item.productId, parseInt($event.target.value) || 1)"
                  type="number"
                  class="w-8 h-6 md:w-10 md:h-7 text-center border border-gray-300 rounded text-xs md:text-sm"
                  min="1"
                  :max="item.stock"
                />
                <button
                  @click="updateQuantity(item.productId, item.quantity + 1)"
                  :disabled="item.quantity >= item.stock"
                  class="w-6 h-6 md:w-7 md:h-7 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-100 disabled:opacity-50"
                >
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              <p class="font-semibold text-gray-900 text-xs md:text-sm">{{ formatCurrency(item.subtotal) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Cart summary -->
      <div class="border-t border-gray-200 p-2 md:p-3 space-y-1.5 md:space-y-2 bg-gray-50 rounded-b-xl">
        <div class="flex justify-between text-xs md:text-sm">
          <span class="text-gray-500">Subtotal ({{ pos.cartItemCount }} items)</span>
          <span class="text-gray-900">{{ formatCurrency(pos.subtotal) }}</span>
        </div>
        
        <!-- Discount -->
        <div v-if="pos.cart.length > 0" class="flex items-center gap-2">
          <select v-model="discountType" class="input w-auto text-[10px] md:text-xs py-1 px-2">
            <option value="percentage">%</option>
            <option value="fixed">{{ settingsStore.currencySymbol }}</option>
          </select>
          <input
            v-model.number="discountValue"
            type="number"
            class="input text-[10px] md:text-xs py-1 flex-1"
            placeholder="Discount"
            min="0"
            step="0.01"
          />
        </div>

        <div class="flex justify-between text-xs md:text-sm">
          <span class="text-gray-500">Discount</span>
          <span class="text-red-600">-{{ formatCurrency(pos.discountAmount) }}</span>
        </div>
        <div class="flex justify-between text-xs md:text-sm">
          <span class="text-gray-500">Tax ({{ Math.round(settingsStore.taxRate * 100) }}%)</span>
          <span class="text-gray-900">{{ formatCurrency(taxAmount) }}</span>
        </div>
        <div class="flex justify-between text-base md:text-lg font-bold border-t border-gray-200 pt-2">
          <span>Total</span>
          <span class="text-primary-600">{{ formatCurrency(grandTotal) }}</span>
        </div>

        <!-- Payment buttons -->
        <div class="grid grid-cols-3 gap-1.5 md:gap-2 pt-2">
          <button
            v-for="method in paymentMethods"
            :key="method.value"
            @click="processPayment(method.value)"
            :disabled="pos.cart.length === 0 || pos.loading"
            class="btn flex flex-col items-center py-1.5 md:py-2"
            :class="method.value === 'cash' ? 'bg-green-600 text-white hover:bg-green-700' : 'btn-outline'"
          >
            <span class="text-sm md:text-base">{{ method.icon }}</span>
            <span class="text-[9px] md:text-[10px] mt-0.5 hidden sm:block">{{ method.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Payment Modal -->
    <div v-if="showPaymentModal" class="modal-overlay" @click.self="closePaymentModal">
      <div class="modal max-w-md mx-4">
        <div class="modal-header bg-green-50">
          <h3 class="text-base md:text-lg font-semibold text-green-800">Payment Received</h3>
          <button @click="closePaymentModal" class="text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="modal-body text-center">
          <div class="w-14 h-14 md:w-16 md:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
            <svg class="w-7 h-7 md:w-8 md:h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <div v-if="pos.currentTransaction">
            <p class="text-xs md:text-sm text-gray-500 mb-1">Transaction #</p>
            <p class="font-mono text-base md:text-lg font-semibold mb-3 md:mb-4">{{ pos.currentTransaction.transactionNumber }}</p>
            
            <div class="bg-gray-50 rounded-lg p-3 md:p-4 text-left space-y-1.5 md:space-y-2 text-xs md:text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Items</span>
                <span>{{ pos.currentTransaction.items?.length || 0 }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Subtotal</span>
                <span>{{ formatCurrency(pos.currentTransaction.subtotal) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Tax</span>
                <span>{{ formatCurrency(pos.currentTransaction.tax) }}</span>
              </div>
              <div class="flex justify-between font-bold text-base md:text-lg border-t pt-2">
                <span>Total</span>
                <span>{{ formatCurrency(pos.currentTransaction.grandTotal) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Payment</span>
                <span class="capitalize">{{ pos.currentTransaction.paymentMethod }}</span>
              </div>
              <div v-if="pos.currentTransaction.paymentMethod === 'cash'" class="flex justify-between text-green-600">
                <span>Change</span>
                <span class="font-medium">{{ formatCurrency(pos.currentTransaction.change) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer justify-center gap-2 md:gap-3">
          <button @click="printReceipt" class="btn-outline text-xs md:text-sm">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          <button @click="closePaymentModal" class="btn-primary text-xs md:text-sm">
            New Sale
          </button>
        </div>
      </div>
    </div>

    <!-- Cash Payment Modal -->
    <div v-if="showCashModal" class="modal-overlay" @click.self="showCashModal = false">
      <div class="modal mx-4">
        <div class="modal-header">
          <h3 class="text-base md:text-lg font-semibold">Cash Payment</h3>
          <button @click="showCashModal = false" class="text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="text-center mb-3 md:mb-4">
            <p class="text-xs md:text-sm text-gray-500">Amount Due</p>
            <p class="text-2xl md:text-3xl font-bold text-gray-900">{{ formatCurrency(grandTotal) }}</p>
          </div>
          
          <div class="mb-3 md:mb-4">
            <label class="label">Amount Received</label>
            <input
              v-model.number="cashReceived"
              type="number"
              class="input text-lg md:text-xl text-center font-semibold"
              step="0.01"
              @focus="$event.target.select()"
            />
          </div>

          <!-- Quick cash buttons -->
          <div class="grid grid-cols-4 gap-1.5 md:gap-2 mb-3 md:mb-4">
            <button
              v-for="amount in quickCashAmounts"
              :key="amount"
              @click="cashReceived = amount"
              class="btn-outline py-1.5 md:py-2 text-[10px] md:text-sm"
            >
              {{ formatCurrency(amount) }}
            </button>
            <button
              @click="cashReceived = Math.ceil(grandTotal)"
              class="btn-outline py-1.5 md:py-2 text-[10px] md:text-sm bg-primary-50 border-primary-200 text-primary-700"
            >
              Exact
            </button>
          </div>

          <div v-if="change >= 0" class="p-3 md:p-4 bg-green-50 rounded-lg text-center">
            <p class="text-xs md:text-sm text-green-600">Change Due</p>
            <p class="text-xl md:text-2xl font-bold text-green-700">{{ formatCurrency(change) }}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showCashModal = false" class="btn-secondary text-xs md:text-sm">Cancel</button>
          <button
            @click="completeCashPayment"
            :disabled="cashReceived < grandTotal || pos.loading"
            class="btn-success text-xs md:text-sm"
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

