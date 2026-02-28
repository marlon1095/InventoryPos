<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { formatCurrency } from '@/utils/formatters'
import { useToast } from '@/composables/useToast'

const inventory = useInventoryStore()
const settingsStore = useSettingsStore()
const toast = useToast()

const searchQuery = ref('')
const selectedCategory = ref('')
const stockFilter = ref('')
const currentPage = ref(1)
const itemsPerPage = 10

const showProductModal = ref(false)
const showStockModal = ref(false)
const showCategoryModal = ref(false)
const showDeleteModal = ref(false)

const editingProduct = ref(null)
const selectedProduct = ref(null)
const productToDelete = ref(null)
const newCategoryName = ref('')
const imagePreview = ref(null)
const selectedFile = ref(null)

const productForm = reactive({
  name: '',
  sku: '',
  barcode: '',
  category: '',
  description: '',
  costPrice: 0,
  sellingPrice: 0,
  quantity: 0,
  reorderLevel: 10,
  isActive: true,
  imageUrl: ''
})

const stockForm = reactive({
  type: 'add',
  quantity: 1,
  reason: ''
})

const filteredProducts = computed(() => {
  let products = inventory.activeProducts

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    products = products.filter(p =>
      p.name?.toLowerCase().includes(query) ||
      p.sku?.toLowerCase().includes(query) ||
      p.barcode?.toLowerCase().includes(query)
    )
  }

  // Category filter
  if (selectedCategory.value) {
    products = products.filter(p => p.category === selectedCategory.value)
  }

  // Stock filter
  if (stockFilter.value) {
    switch (stockFilter.value) {
      case 'inStock':
        products = products.filter(p => p.quantity > p.reorderLevel)
        break
      case 'lowStock':
        products = products.filter(p => p.quantity > 0 && p.quantity <= p.reorderLevel)
        break
      case 'outOfStock':
        products = products.filter(p => p.quantity <= 0)
        break
    }
  }

  // Sort by product name alphabetically (ascending)
  products = [...products].sort((a, b) => {
    return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
  })

  return products
})

// Pagination
const totalPages = computed(() => Math.ceil(filteredProducts.value.length / itemsPerPage))

const paginatedProducts = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredProducts.value.slice(start, end)
})

// Displayed pages for responsive pagination
const displayedPages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const pages = []
  
  if (total <= 7) {
    // Show all pages if 7 or fewer
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    // Always show first page
    pages.push(1)
    
    if (current > 3) {
      pages.push('...')
    }
    
    // Show pages around current
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    
    if (current < total - 2) {
      pages.push('...')
    }
    
    // Always show last page
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

// Reset to first page when filters change
watch([searchQuery, selectedCategory, stockFilter], () => {
  currentPage.value = 1
})

const newStockLevel = computed(() => {
  if (!selectedProduct.value) return 0
  const adjustment = stockForm.type === 'add' ? stockForm.quantity : -stockForm.quantity
  return selectedProduct.value.quantity + adjustment
})

function handleImageError(event) {
  event.target.style.display = 'none'
}

function handleImageSelect(event) {
  const file = event.target.files[0]
  if (!file) return
  
  // Validate file size (500KB max for Base64 - keeps Firestore document size reasonable)
  if (file.size > 500 * 1024) {
    toast.error('Image size must be less than 500KB')
    return
  }
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    toast.error('Please select an image file')
    return
  }
  
  // Convert to Base64 and store directly (avoids Firebase Storage CORS issues)
  const reader = new FileReader()
  reader.onload = (e) => {
    imagePreview.value = e.target.result
    selectedFile.value = e.target.result // Store Base64 string directly
  }
  reader.onerror = () => {
    toast.error('Failed to read image file')
  }
  reader.readAsDataURL(file)
}

function getCategoryName(categoryId) {
  if (!categoryId) return '-'
  const category = inventory.categories.find(c => c.id === categoryId)
  return category?.name || '-'
}

function getStockClass(product) {
  if (product.quantity <= 0) return 'text-red-600 font-medium'
  if (product.quantity <= product.reorderLevel) return 'text-yellow-600 font-medium'
  return 'text-gray-900'
}

function openProductModal(product = null) {
  editingProduct.value = product
  imagePreview.value = null
  selectedFile.value = null
  
  if (product) {
    Object.assign(productForm, {
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      category: product.category || '',
      description: product.description || '',
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      quantity: product.quantity,
      reorderLevel: product.reorderLevel,
      isActive: product.isActive,
      imageUrl: product.imageUrl || ''
    })
  } else {
    Object.assign(productForm, {
      name: '',
      sku: '',
      barcode: '',
      category: '',
      description: '',
      costPrice: 0,
      sellingPrice: 0,
      quantity: 0,
      reorderLevel: 10,
      isActive: true,
      imageUrl: ''
    })
  }
  showProductModal.value = true
}

function closeProductModal() {
  showProductModal.value = false
  editingProduct.value = null
  imagePreview.value = null
  selectedFile.value = null
}

async function saveProduct() {
  // Use Base64 image if a new file was selected, otherwise use existing URL
  let imageUrl = productForm.imageUrl
  
  if (selectedFile.value) {
    // selectedFile now contains the Base64 string
    imageUrl = selectedFile.value
  }
  
  const data = { 
    ...productForm,
    imageUrl: imageUrl || ''
  }
  
  if (editingProduct.value) {
    await inventory.updateProduct(editingProduct.value.id, data)
  } else {
    await inventory.addProduct(data)
  }
  
  // Refresh products list
  await inventory.fetchProducts()
  closeProductModal()
}

function openStockModal(product) {
  selectedProduct.value = product
  stockForm.type = 'add'
  stockForm.quantity = 1
  stockForm.reason = ''
  showStockModal.value = true
}

function closeStockModal() {
  showStockModal.value = false
  selectedProduct.value = null
}

async function saveStockAdjustment() {
  const adjustment = stockForm.type === 'add' ? stockForm.quantity : -stockForm.quantity
  await inventory.adjustStock(selectedProduct.value.id, adjustment, stockForm.reason, stockForm.type)
  await inventory.fetchProducts()
  closeStockModal()
}

function confirmDelete(product) {
  productToDelete.value = product
  showDeleteModal.value = true
}

async function deleteProduct() {
  if (productToDelete.value) {
    await inventory.deleteProduct(productToDelete.value.id)
    await inventory.fetchProducts()
    showDeleteModal.value = false
    productToDelete.value = null
  }
}

async function addCategory() {
  if (!newCategoryName.value.trim()) return
  await inventory.addCategory({ name: newCategoryName.value.trim() })
  await inventory.fetchCategories()
  newCategoryName.value = ''
}

async function deleteCategory(id) {
  if (confirm('Are you sure you want to delete this category?')) {
    await inventory.deleteCategory(id)
    await inventory.fetchCategories()
  }
}

onMounted(() => {
  settingsStore.initialize()
  inventory.fetchProducts()
  inventory.fetchCategories()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Inventory Management</h1>
        <p class="text-gray-500 mt-1">{{ inventory.totalProducts }} products, {{ formatCurrency(inventory.totalInventoryValue) }} total value</p>
      </div>
      <div class="flex items-center gap-3">
        <button @click="showCategoryModal = true" class="btn-outline">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Categories
        </button>
        <button @click="openProductModal()" class="btn-primary">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Product
        </button>
      </div>
    </div>

    <!-- Filters and search -->
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
              placeholder="Search products by name, SKU, or barcode..."
            />
          </div>
        </div>
        <select v-model="selectedCategory" class="input w-auto">
          <option value="">All Categories</option>
          <option v-for="cat in inventory.categories" :key="cat.id" :value="cat.id">
            {{ cat.name }}
          </option>
        </select>
        <select v-model="stockFilter" class="input w-auto">
          <option value="">All Stock</option>
          <option value="inStock">In Stock</option>
          <option value="lowStock">Low Stock</option>
          <option value="outOfStock">Out of Stock</option>
        </select>
      </div>
    </div>

    <!-- Products table -->
    <div class="card">
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th class="text-left">Product</th>
              <th class="text-left">SKU</th>
              <th class="text-left">Category</th>
              <th class="text-left">Cost</th>
              <th class="text-left">Price</th>
              <th class="text-left">Stock</th>
              <th class="text-left">Status</th>
              <th class="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in paginatedProducts" :key="product.id">
              <td class="text-left">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                    <img 
                      v-if="product.imageUrl" 
                      :src="product.imageUrl" 
                      class="w-full h-full object-cover"
                      @error="handleImageError"
                    />
                    <svg v-else class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <p class="font-medium text-gray-900">{{ product.name }}</p>
                    <p class="text-xs text-gray-500 truncate max-w-xs">{{ product.description }}</p>
                  </div>
                </div>
              </td>
              <td class="text-left font-mono text-sm">{{ product.sku }}</td>
              <td class="text-left">{{ getCategoryName(product.category) }}</td>
              <td class="text-left">{{ formatCurrency(product.costPrice) }}</td>
              <td class="text-left">{{ formatCurrency(product.sellingPrice) }}</td>
              <td class="text-left">
                <span :class="getStockClass(product)">{{ product.quantity }}</span>
              </td>
              <td class="text-left">
                <span :class="product.isActive ? 'badge-success' : 'badge-danger'">
                  {{ product.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="text-left">
                <div class="flex items-center gap-1">
                  <button @click="openStockModal(product)" class="p-2 hover:bg-gray-100 rounded-lg" title="Adjust Stock">
                    <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                  <button @click="openProductModal(product)" class="p-2 hover:bg-gray-100 rounded-lg" title="Edit">
                    <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button @click="confirmDelete(product)" class="p-2 hover:bg-red-50 rounded-lg" title="Delete">
                    <svg class="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="paginatedProducts.length === 0">
              <td colspan="8" class="text-center text-gray-500 py-12">
                <div class="flex flex-col items-center">
                  <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <p>No products found</p>
                  <button @click="openProductModal()" class="btn-primary mt-4">Add Your First Product</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination -->
      <div v-if="filteredProducts.length > itemsPerPage" class="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-gray-200 gap-3">
        <div class="text-sm text-gray-500 order-2 sm:order-1">
          Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to {{ Math.min(currentPage * itemsPerPage, filteredProducts.length) }} of {{ filteredProducts.length }} products
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

    <!-- Product Modal -->
    <div v-if="showProductModal" class="modal-overlay" @click.self.stop>
      <div class="modal max-w-lg">
        <div class="modal-header">
          <h3 class="text-lg font-semibold">{{ editingProduct ? 'Edit Product' : 'Add New Product' }}</h3>
          <button @click="closeProductModal" class="text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form @submit.prevent="saveProduct">
          <div class="modal-body space-y-4">
            <!-- Image Upload -->
            <div>
              <label class="label">Product Image</label>
              <div class="flex items-center gap-4">
                <div class="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                  <img 
                    v-if="imagePreview || productForm.imageUrl" 
                    :src="imagePreview || productForm.imageUrl" 
                    class="w-full h-full object-cover"
                  />
                  <svg v-else class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div class="flex-1">
                  <input 
                    type="file" 
                    ref="fileInput"
                    @change="handleImageSelect"
                    accept="image/*"
                    class="hidden"
                  />
                  <button type="button" @click="$refs.fileInput.click()" class="btn-outline text-sm">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Upload Image
                  </button>
                  <p class="text-xs text-gray-500 mt-1">JPG, PNG up to 2MB</p>
                </div>
              </div>
            </div>

            <div>
              <label class="label">Product Name *</label>
              <input v-model="productForm.name" type="text" class="input" required />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">SKU *</label>
                <input v-model="productForm.sku" type="text" class="input" required />
              </div>
              <div>
                <label class="label">Barcode</label>
                <input v-model="productForm.barcode" type="text" class="input" />
              </div>
            </div>
            <div>
              <label class="label">Category</label>
              <select v-model="productForm.category" class="input">
                <option value="">Select Category</option>
                <option v-for="cat in inventory.categories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="label">Description</label>
              <textarea v-model="productForm.description" class="input" rows="2"></textarea>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Cost Price *</label>
                <input v-model.number="productForm.costPrice" type="number" step="0.01" class="input" required />
              </div>
              <div>
                <label class="label">Selling Price *</label>
                <input v-model.number="productForm.sellingPrice" type="number" step="0.01" class="input" required />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Quantity *</label>
                <input v-model.number="productForm.quantity" type="number" class="input" required />
              </div>
              <div>
                <label class="label">Reorder Level</label>
                <input v-model.number="productForm.reorderLevel" type="number" class="input" />
              </div>
            </div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="productForm.isActive" class="rounded border-gray-300 text-primary-600" />
              <span class="text-sm text-gray-600">Active (available for sale)</span>
            </label>
          </div>
          <div class="modal-footer">
            <button type="button" @click="closeProductModal" class="btn-secondary">Cancel</button>
            <button type="submit" :disabled="inventory.loading" class="btn-primary">
              {{ editingProduct ? 'Update' : 'Add' }} Product
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Stock Adjustment Modal -->
    <div v-if="showStockModal" class="modal-overlay" @click.self="closeStockModal">
      <div class="modal">
        <div class="modal-header">
          <h3 class="text-lg font-semibold">Adjust Stock - {{ selectedProduct?.name }}</h3>
          <button @click="closeStockModal" class="text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form @submit.prevent="saveStockAdjustment">
          <div class="modal-body space-y-4">
            <div class="p-4 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-500">Current Stock</p>
              <p class="text-2xl font-bold text-gray-900">{{ selectedProduct?.quantity }}</p>
            </div>
            <div>
              <label class="label">Adjustment Type</label>
              <select v-model="stockForm.type" class="input">
                <option value="add">Add Stock</option>
                <option value="remove">Remove Stock</option>
              </select>
            </div>
            <div>
              <label class="label">Quantity</label>
              <input v-model.number="stockForm.quantity" type="number" class="input" min="1" required />
            </div>
            <div>
              <label class="label">Reason</label>
              <select v-model="stockForm.reason" class="input">
                <option value="">Select reason...</option>
                <option value="purchase">Purchase/Restock</option>
                <option value="return">Customer Return</option>
                <option value="damage">Damage/Loss</option>
                <option value="adjustment">Stock Correction</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="p-4 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-500">New Stock Level</p>
              <p class="text-2xl font-bold" :class="newStockLevel < 0 ? 'text-red-600' : 'text-green-600'">
                {{ newStockLevel }}
              </p>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" @click="closeStockModal" class="btn-secondary">Cancel</button>
            <button type="submit" :disabled="inventory.loading || newStockLevel < 0" class="btn-primary">
              Confirm Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Category Modal -->
    <div v-if="showCategoryModal" class="modal-overlay" @click.self="showCategoryModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3 class="text-lg font-semibold">Manage Categories</h3>
          <button @click="showCategoryModal = false" class="text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <!-- Add category form -->
          <div class="flex gap-2 mb-4">
            <input v-model="newCategoryName" type="text" class="input flex-1" placeholder="New category name" @keyup.enter="addCategory" />
            <button @click="addCategory" :disabled="!newCategoryName.trim() || inventory.loading" class="btn-primary">Add</button>
          </div>
          <!-- Categories list -->
          <div class="space-y-2 max-h-60 overflow-y-auto">
            <div v-for="cat in inventory.categories" :key="cat.id" class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p class="font-medium">{{ cat.name }}</p>
                <p class="text-xs text-gray-500">{{ cat.productCount || 0 }} products</p>
              </div>
              <button @click="deleteCategory(cat.id)" class="text-red-500 hover:text-red-700 p-1">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <p v-if="inventory.categories.length === 0" class="text-center text-gray-500 py-4">No categories yet</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3 class="text-lg font-semibold text-red-600">Delete Product</h3>
          <button @click="showDeleteModal = false" class="text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p class="text-gray-600">Are you sure you want to delete <strong>{{ productToDelete?.name }}</strong>? This action cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button @click="showDeleteModal = false" class="btn-secondary">Cancel</button>
          <button @click="deleteProduct" :disabled="inventory.loading" class="btn-danger">Delete Product</button>
        </div>
      </div>
    </div>
  </div>
</template>


