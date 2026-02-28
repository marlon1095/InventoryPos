
<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useDashboardStore } from '@/stores/dashboardStore'
import { usePOSStore } from '@/stores/posStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { formatCurrency, formatNumber, formatDate, capitalize } from '@/utils/formatters'
import { DATE_RANGES } from '@/utils/constants'
import * as echarts from 'echarts'

// test

const authStore = useAuthStore()
const inventory = useInventoryStore()
const dashboard = useDashboardStore()
const posStore = usePOSStore()
const settingsStore = useSettingsStore()

const salesChartRef = ref(null)
const categoryChartRef = ref(null)
const selectedPeriod = ref('today')
const dateRanges = DATE_RANGES.filter(r => r.value !== 'custom')
const loading = ref(false)

let salesChart = null
let categoryChart = null

// Filtered transactions based on date range
const filteredTransactions = computed(() => {
  const start = dashboard.dateRange.start
  const end = dashboard.dateRange.end
  
  return posStore.transactions.filter(t => {
    if (t.status !== 'completed') return false
    const date = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt || 0)
    return date >= start && date <= end
  })
})

// Stats computed from filtered transactions
const filteredTotalSales = computed(() => {
  return filteredTransactions.value.reduce((sum, t) => sum + (t.grandTotal || 0), 0)
})

const filteredAverageTransaction = computed(() => {
  const count = filteredTransactions.value.length
  return count > 0 ? filteredTotalSales.value / count : 0
})

// Top products from filtered transactions
const filteredTopProducts = computed(() => {
  const productSales = new Map()
  
  filteredTransactions.value.forEach(t => {
    t.items?.forEach(item => {
      if (!item.productId) return
      const existing = productSales.get(item.productId) || {
        productId: item.productId,
        productName: item.productName || 'Unknown',
        quantity: 0,
        revenue: 0
      }
      existing.quantity += item.quantity || 0
      existing.revenue += item.subtotal || 0
      productSales.set(item.productId, existing)
    })
  })
  
  return Array.from(productSales.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
})

// Category data from filtered transactions
const filteredCategoryData = computed(() => {
  const categorySales = new Map()
  
  filteredTransactions.value.forEach(t => {
    t.items?.forEach(item => {
      // Get the actual category from the product in inventory
      const product = inventory.products.find(p => p.id === item.productId)
      const categoryId = product?.category || null
      
      // Get category name from inventory categories
      const categoryObj = inventory.categories.find(c => c.id === categoryId)
      const categoryName = categoryObj?.name || 'Uncategorized'
      
      const existing = categorySales.get(categoryName) || {
        category: categoryName,
        quantity: 0,
        revenue: 0
      }
      existing.quantity += item.quantity || 0
      existing.revenue += item.subtotal || 0
      categorySales.set(categoryName, existing)
    })
  })
  
  return Array.from(categorySales.values())
    .sort((a, b) => b.revenue - a.revenue)
})

const salesTrendData = computed(() => {
  const grouped = new Map()
  
  filteredTransactions.value.forEach(transaction => {
    const date = transaction.createdAt
    if (!date) return
    
    const key = date.toLocaleDateString()
    const existing = grouped.get(key) || { date: key, sales: 0, count: 0 }
    existing.sales += transaction.grandTotal || 0
    existing.count += 1
    grouped.set(key, existing)
  })
  
  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date))
})

const recentFilteredTransactions = computed(() => {
  return [...filteredTransactions.value]
    .sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0)
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0)
      return dateB - dateA
    })
    .slice(0, 5)
})

function getStatusBadge(status) {
  const badges = {
    completed: 'badge-success',
    voided: 'badge-danger',
    refunded: 'badge-warning'
  }
  return badges[status] || 'badge-info'
}

function handlePeriodChange() {
  const now = new Date()
  let start, end

  switch (selectedPeriod.value) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      break
    case 'yesterday':
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0)
      end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59)
      break
    case 'week':
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 0, 0, 0)
      end = new Date()
      break
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
      end = new Date()
      break
    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  }

  dashboard.setDateRange(start, end)
  // Charts will update automatically via watchers
}

async function refreshData() {
  loading.value = true
  try {
    await Promise.all([
      inventory.fetchProducts(),
      posStore.fetchTransactions()
    ])
    await nextTick()
    updateCharts()
  } finally {
    loading.value = false
  }
}

function initSalesChart() {
  if (!salesChartRef.value) return
  
  if (salesChart) {
    salesChart.dispose()
  }
  
  salesChart = echarts.init(salesChartRef.value)
  updateSalesChart()
}

function updateSalesChart() {
  if (!salesChart) return
  
  const data = salesTrendData.value
  
  if (data.length === 0) {
    salesChart.clear()
    return
  }
  
  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const data = params[0]
        return `${data.name}<br/>Sales: ${formatCurrency(data.value)}`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '5%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.date),
      axisLabel: { 
        color: '#64748b', 
        rotate: 45,
        fontSize: 10,
        interval: 0
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#64748b',
        formatter: (value) => settingsStore.currencySymbol + value,
        fontSize: 10
      }
    },
    series: [{
      name: 'Sales',
      type: 'line',
      smooth: true,
      data: data.map(d => d.sales),
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(14, 165, 233, 0.3)' },
          { offset: 1, color: 'rgba(14, 165, 233, 0.05)' }
        ])
      },
      lineStyle: { color: '#0ea5e9', width: 2 },
      itemStyle: { color: '#0ea5e9' }
    }]
  }
  
  salesChart.setOption(option, true)
}

function initCategoryChart() {
  if (!categoryChartRef.value) return
  
  if (categoryChart) {
    categoryChart.dispose()
  }
  
  categoryChart = echarts.init(categoryChartRef.value)
  updateCategoryChart()
}

function updateCategoryChart() {
  if (!categoryChart) return
  
  const data = filteredCategoryData.value
  
  if (data.length === 0) {
    categoryChart.clear()
    return
  }
  
  const chartData = data.map(d => ({
    name: d.category,
    value: d.revenue
  }))
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        return `${params.name}<br/>Revenue: ${formatCurrency(params.value)}`
      }
    },
    legend: {
      type: 'scroll',
      orient: 'horizontal',
      bottom: '0%',
      left: 'center',
      textStyle: { color: '#64748b', fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10
    },
    series: [{
      name: 'Category',
      type: 'pie',
      radius: ['30%', '50%'],
      center: ['50%', '40%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 6,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: { show: false },
      emphasis: {
        label: {
          show: true,
          fontSize: 12,
          fontWeight: 'bold'
        }
      },
      data: chartData,
      color: ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899', '#14b8a6']
    }]
  }
  
  categoryChart.setOption(option, true)
}

function updateCharts() {
  updateSalesChart()
  updateCategoryChart()
}

function handleResize() {
  salesChart?.resize()
  categoryChart?.resize()
}

// Watch for data changes and update charts
watch([salesTrendData, filteredCategoryData], () => {
  nextTick(() => {
    updateCharts()
  })
}, { deep: true })

onMounted(async () => {
  settingsStore.initialize()
  handlePeriodChange() // Initialize date range
  
  // Fetch data first
  await Promise.all([
    inventory.fetchProducts(),
    posStore.fetchTransactions()
  ])
  
  // Then initialize charts
  await nextTick()
  initSalesChart()
  initCategoryChart()
  
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  salesChart?.dispose()
  categoryChart?.dispose()
})
</script>

<template>
  <div class="space-y-4 md:space-y-6">
    <!-- Page header -->
    <div class="flex flex-col gap-4">
      <div>
        <h1 class="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h1>
        <p class="text-sm md:text-base text-gray-500 mt-1">Welcome back, {{ authStore.userName }}!</p>
      </div>
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <select v-model="selectedPeriod" @change="handlePeriodChange" class="input w-full sm:w-auto">
          <option v-for="period in dateRanges" :key="period.value" :value="period.value">
            {{ period.label }}
          </option>
        </select>
        <button @click="refreshData" :disabled="loading" class="btn-outline w-full sm:w-auto">
          <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span class="sm:hidden ml-2">Refresh</span>
        </button>
      </div>
    </div>

    <!-- Stats cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div class="min-w-0">
            <p class="stat-label text-xs md:text-sm">Total Sales</p>
            <p class="stat-value text-lg md:text-2xl">{{ formatCurrency(filteredTotalSales) }}</p>
          </div>
          <div class="w-6 h-6 md:w-12 md:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 md:w-6 md:h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div class="min-w-0">
            <p class="stat-label text-xs md:text-sm">Transactions</p>
            <p class="stat-value text-lg md:text-2xl">{{ formatNumber(filteredTransactions.length) }}</p>
          </div>
          <div class="w-6 h-6 md:w-12 md:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 md:w-6 md:h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div class="min-w-0">
            <p class="stat-label text-xs md:text-sm">Avgerage Sale</p>
            <p class="stat-value text-lg md:text-2xl">{{ formatCurrency(filteredAverageTransaction) }}</p>
          </div>
          <div class="w-6 h-6 md:w-12 md:h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 md:w-6 md:h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="flex items-center justify-between">
          <div class="min-w-0">
            <p class="stat-label text-xs md:text-sm">Products</p>
            <p class="stat-value text-lg md:text-2xl">{{ formatNumber(inventory.totalProducts) }}</p>
          </div>
          <div class="w-6 h-6 md:w-12 md:h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 md:w-6 md:h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts row -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
      <!-- Sales trend chart -->
      <div class="card">
        <div class="card-header">
          <h3 class="font-semibold text-gray-900 text-sm md:text-base">Sales Trend</h3>
        </div>
        <div class="card-body p-2 md:p-6">
          <div v-if="salesTrendData.length === 0" class="h-[250px] md:h-[300px] flex items-center justify-center text-gray-500">
            <div class="text-center">
              <svg class="w-10 h-10 md:w-12 md:h-12 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p class="text-sm">No sales data for this period</p>
            </div>
          </div>
          <div v-else ref="salesChartRef" class="h-[250px] md:h-[300px]"></div>
        </div>
      </div>

      <!-- Category distribution chart -->
      <div class="card">
        <div class="card-header">
          <h3 class="font-semibold text-gray-900 text-sm md:text-base">Sales by Category</h3>
        </div>
        <div class="card-body p-2 md:p-6">
          <div v-if="filteredCategoryData.length === 0" class="h-[250px] md:h-[300px] flex items-center justify-center text-gray-500">
            <div class="text-center">
              <svg class="w-10 h-10 md:w-12 md:h-12 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              <p class="text-sm">No category data available</p>
            </div>
          </div>
          <div v-else ref="categoryChartRef" class="h-[250px] md:h-[300px]"></div>
        </div>
      </div>
    </div>

    <!-- Tables row -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
      <!-- Top products -->
      <div class="card">
        <div class="card-header">
          <h3 class="font-semibold text-gray-900 text-sm md:text-base">Top Selling Products</h3>
        </div>
        <div class="table-container">
          <div class="overflow-x-auto">
            <table class="table w-full min-w-[300px]">
              <thead>
                <tr>
                  <th class="text-left whitespace-nowrap">Product</th>
                  <th class="text-left whitespace-nowrap">Qty</th>
                  <th class="text-left whitespace-nowrap">Revenue</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="product in filteredTopProducts.slice(0, 5)" :key="product.productId">
                  <td class="text-left truncate max-w-[150px]">{{ product.productName }}</td>
                  <td class="text-left">{{ formatNumber(product.quantity) }}</td>
                  <td class="text-left">{{ formatCurrency(product.revenue) }}</td>
                </tr>
                <tr v-if="filteredTopProducts.length === 0">
                  <td colspan="3" class="text-center text-gray-500 py-8">No sales data available</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Low stock alerts -->
      <div class="card">
        <div class="card-header flex items-center justify-between">
          <h3 class="font-semibold text-gray-900 text-sm md:text-base">Low Stock Alerts</h3>
          <router-link to="/inventory" class="text-xs md:text-sm text-primary-600 hover:text-primary-700">View All</router-link>
        </div>
        <div class="table-container">
          <div class="overflow-x-auto">
            <table class="table w-full min-w-[300px]">
              <thead>
                <tr>
                  <th class="text-left whitespace-nowrap">Product</th>
                  <th class="text-left whitespace-nowrap">Stock</th>
                  <th class="text-left whitespace-nowrap">Reorder Level</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="product in inventory.lowStockProducts.slice(0, 5)" :key="product.id">
                  <td class="text-left truncate max-w-[150px]">{{ product.name }}</td>
                  <td class="text-left">
                    <span :class="product.quantity <= 0 ? 'text-red-600 font-medium' : 'text-yellow-600'">
                      {{ product.quantity }}
                    </span>
                  </td>
                  <td class="text-left text-gray-500">{{ product.reorderLevel }}</td>
                </tr>
                <tr v-if="inventory.lowStockProducts.length === 0">
                  <td colspan="3" class="text-center text-gray-500 py-8">All products are well stocked</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent transactions -->
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <h3 class="font-semibold text-gray-900 text-sm md:text-base">Recent Transactions</h3>
        <router-link to="/transactions" class="text-xs md:text-sm text-primary-600 hover:text-primary-700">View All</router-link>
      </div>
      <div class="table-container">
        <div class="overflow-x-auto">
          <table class="table w-full min-w-[500px]">
            <thead>
              <tr>
                <th class="text-left whitespace-nowrap">Transaction #</th>
                <th class="text-left whitespace-nowrap">Date</th>
                <th class="text-left whitespace-nowrap hidden sm:table-cell">Cashier</th>
                <th class="text-left whitespace-nowrap">Items</th>
                <th class="text-left whitespace-nowrap">Total</th>
                <th class="text-left whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="transaction in recentFilteredTransactions" :key="transaction.id">
                <td class="text-left font-mono text-xs md:text-sm">{{ transaction.transactionNumber }}</td>
                <td class="text-left text-xs md:text-sm">{{ formatDate(transaction.createdAt, 'short') }}</td>
                <td class="text-left hidden sm:table-cell">{{ transaction.cashierName }}</td>
                <td class="text-left">{{ transaction.items?.length || 0 }}</td>
                <td class="text-left font-medium">{{ formatCurrency(transaction.grandTotal) }}</td>
                <td class="text-left">
                  <span :class="getStatusBadge(transaction.status)">
                    {{ capitalize(transaction.status) }}
                  </span>
                </td>
              </tr>
              <tr v-if="recentFilteredTransactions.length === 0">
                <td colspan="6" class="text-center text-gray-500 py-8">No transactions yet</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
