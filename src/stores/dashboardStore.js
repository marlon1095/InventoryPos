import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
  collection, 
  getDocs,
  query, 
  where, 
  orderBy,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/services/firebase'

export const useDashboardStore = defineStore('dashboard', () => {
  // State
  const salesData = ref([])
  const topProducts = ref([])
  const categoryData = ref([])
  const loading = ref(false)
  const error = ref(null)
  const dateRange = ref({
    start: new Date(new Date().setHours(0, 0, 0, 0)),
    end: new Date(new Date().setHours(23, 59, 59, 999))
  })

  // Getters
  const totalSales = computed(() => 
    salesData.value.reduce((sum, t) => sum + (t.grandTotal || 0), 0)
  )
  
  const totalTransactions = computed(() => salesData.value.length)
  
  const averageTransaction = computed(() => 
    totalTransactions.value > 0 ? totalSales.value / totalTransactions.value : 0
  )

  // Actions
  async function fetchDashboardData() {
    loading.value = true
    error.value = null
    
    try {
      await Promise.all([
        fetchSalesData(),
        fetchTopProducts(),
        fetchCategoryData()
      ])
    } catch (e) {
      error.value = e.message
      console.error('Error fetching dashboard data:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchSalesData() {
    try {
      const q = query(
        collection(db, 'transactions'),
        where('status', '==', 'completed'),
        orderBy('createdAt', 'desc')
      )
      
      const snapshot = await getDocs(q)
      const allTransactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      }))
      
      // Filter by date range on client side
      salesData.value = allTransactions.filter(t => {
        const date = t.createdAt
        return date >= dateRange.value.start && date <= dateRange.value.end
      })
    } catch (e) {
      console.error('Error fetching sales data:', e)
      // If index doesn't exist, try without orderBy
      try {
        const q = query(
          collection(db, 'transactions'),
          where('status', '==', 'completed')
        )
        const snapshot = await getDocs(q)
        const allTransactions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date()
        }))
        salesData.value = allTransactions.filter(t => {
          const date = t.createdAt
          return date >= dateRange.value.start && date <= dateRange.value.end
        })
      } catch (e2) {
        console.error('Error fetching sales data (fallback):', e2)
        throw e2
      }
    }
  }

  async function fetchTopProducts() {
    try {
      const q = query(
        collection(db, 'transactions'),
        where('status', '==', 'completed')
      )
      
      const snapshot = await getDocs(q)
      const productSales = new Map()
      
      snapshot.docs.forEach(doc => {
        const transaction = doc.data()
        transaction.items?.forEach(item => {
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
      
      topProducts.value = Array.from(productSales.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
    } catch (e) {
      console.error('Error fetching top products:', e)
      topProducts.value = []
    }
  }

  async function fetchCategoryData() {
    try {
      const q = query(
        collection(db, 'transactions'),
        where('status', '==', 'completed')
      )
      
      const snapshot = await getDocs(q)
      const categorySales = new Map()
      
      snapshot.docs.forEach(doc => {
        const transaction = doc.data()
        transaction.items?.forEach(item => {
          const category = item.productName?.split(' ')[0] || 'Other'
          const existing = categorySales.get(category) || {
            category,
            quantity: 0,
            revenue: 0
          }
          existing.quantity += item.quantity || 0
          existing.revenue += item.subtotal || 0
          categorySales.set(category, existing)
        })
      })
      
      categoryData.value = Array.from(categorySales.values())
        .sort((a, b) => b.revenue - a.revenue)
    } catch (e) {
      console.error('Error fetching category data:', e)
      categoryData.value = []
    }
  }

  function setDateRange(start, end) {
    dateRange.value = { start, end }
  }

  function getSalesByPeriod(period = 'day') {
    const grouped = new Map()
    
    salesData.value.forEach(transaction => {
      let key
      const date = transaction.createdAt
      
      if (!date) return
      
      switch (period) {
        case 'hour':
          key = `${date.getHours()}:00`
          break
        case 'day':
          key = date.toLocaleDateString()
          break
        case 'week':
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          key = weekStart.toLocaleDateString()
          break
        case 'month':
          key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
          break
        default:
          key = date.toLocaleDateString()
      }
      
      const existing = grouped.get(key) || { date: key, sales: 0, count: 0 }
      existing.sales += transaction.grandTotal || 0
      existing.count += 1
      grouped.set(key, existing)
    })
    
    return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  return {
    // State
    salesData,
    topProducts,
    categoryData,
    loading,
    error,
    dateRange,
    // Getters
    totalSales,
    totalTransactions,
    averageTransaction,
    // Actions
    fetchDashboardData,
    fetchSalesData,
    fetchTopProducts,
    fetchCategoryData,
    setDateRange,
    getSalesByPeriod
  }
})
