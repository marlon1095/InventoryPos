import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc,
  query, 
  where, 
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuthStore } from '@/stores/authStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useToast } from '@/composables/useToast'
import { useSettingsStore } from '@/stores/settingsStore'

export const usePOSStore = defineStore('pos', () => {
  // State
  const cart = ref([])
  const customer = ref(null)
  const discount = ref(0)
  const discountType = ref('percentage') // 'percentage' or 'fixed'
  const transactions = ref([])
  const loading = ref(false)
  const error = ref(null)
  const currentTransaction = ref(null)

  // Getters
  const cartItemCount = computed(() => 
    cart.value.reduce((sum, item) => sum + item.quantity, 0)
  )

  const subtotal = computed(() => 
    cart.value.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  )

  const discountAmount = computed(() => {
    if (discountType.value === 'percentage') {
      return subtotal.value * (discount.value / 100)
    }
    return discount.value
  })

  const taxableAmount = computed(() => 
    subtotal.value - discountAmount.value
  )

  // Actions
  function addToCart(product, quantity = 1) {
    const existingItem = cart.value.find(item => item.productId === product.id)
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity
      if (newQuantity > product.quantity) {
        useToast().warning('Not enough stock available')
        return false
      }
      existingItem.quantity = newQuantity
      existingItem.subtotal = existingItem.price * newQuantity
    } else {
      if (quantity > product.quantity) {
        useToast().warning('Not enough stock available')
        return false
      }
      cart.value.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        price: product.sellingPrice,
        quantity,
        stock: product.quantity,
        subtotal: product.sellingPrice * quantity
      })
    }
    
    return true
  }

  function updateCartItemQuantity(productId, quantity) {
    const item = cart.value.find(i => i.productId === productId)
    if (item) {
      if (quantity > item.stock) {
        useToast().warning('Not enough stock available')
        return false
      }
      if (quantity <= 0) {
        removeFromCart(productId)
      } else {
        item.quantity = quantity
        item.subtotal = item.price * quantity
      }
    }
    return true
  }

  function removeFromCart(productId) {
    const index = cart.value.findIndex(item => item.productId === productId)
    if (index > -1) {
      cart.value.splice(index, 1)
    }
  }

  function clearCart() {
    cart.value = []
    customer.value = null
    discount.value = 0
    discountType.value = 'percentage'
  }

  function setDiscount(value, type = 'percentage') {
    discount.value = value || 0
    discountType.value = type
  }

  function setCustomer(customerData) {
    customer.value = customerData
  }

  async function processTransaction(paymentMethod, amountPaid, taxAmount) {
    loading.value = true
    error.value = null
    
    const authStore = useAuthStore()
    const inventoryStore = useInventoryStore()
    const settingsStore = useSettingsStore()
    
    try {
      // Generate transaction number
      const transactionNumber = generateTransactionNumber()
      
      // Calculate change
      const change = amountPaid - (taxableAmount.value + taxAmount)
      
      // Create transaction record
      const transactionData = {
        transactionNumber,
        type: 'sale',
        cashierId: authStore.user?.uid,
        cashierName: authStore.userName,
        customerId: customer.value?.id || null,
        customerName: customer.value?.name || null,
        items: cart.value.map(item => ({
          productId: item.productId,
          productName: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.price,
          subtotal: item.subtotal
        })),
        subtotal: subtotal.value,
        discount: discountAmount.value,
        discountType: discountType.value,
        discountValue: discount.value,
        tax: taxAmount,
        taxRate: settingsStore.taxRate,
        grandTotal: taxableAmount.value + taxAmount,
        paymentMethod,
        amountPaid,
        change: Math.max(0, change),
        status: 'completed',
        currency: settingsStore.currency,
        createdAt: serverTimestamp()
      }
      
      const docRef = await addDoc(collection(db, 'transactions'), transactionData)
      
      // Update inventory
      for (const item of cart.value) {
        const productRef = doc(db, 'products', item.productId)
        await updateDoc(productRef, {
          quantity: increment(-item.quantity),
          updatedAt: serverTimestamp()
        })
      }
      
      currentTransaction.value = {
        id: docRef.id,
        ...transactionData
      }
      
      // Clear cart
      clearCart()
      
      useToast().success('Transaction completed successfully')
      return currentTransaction.value
    } catch (e) {
      error.value = e.message
      useToast().error('Failed to process transaction')
      return null
    } finally {
      loading.value = false
    }
  }

  async function voidTransaction(transactionId, reason) {
    loading.value = true
    error.value = null
    
    try {
      const transactionRef = doc(db, 'transactions', transactionId)
      const transactionDoc = await getDoc(transactionRef)
      
      if (!transactionDoc.exists()) {
        throw new Error('Transaction not found')
      }
      
      const transaction = transactionDoc.data()
      
      // Restore inventory
      for (const item of transaction.items) {
        const productRef = doc(db, 'products', item.productId)
        await updateDoc(productRef, {
          quantity: increment(item.quantity),
          updatedAt: serverTimestamp()
        })
      }
      
      // Update transaction status
      await updateDoc(transactionRef, {
        status: 'voided',
        voidReason: reason,
        voidedAt: serverTimestamp()
      })
      
      useToast().success('Transaction voided successfully')
      return true
    } catch (e) {
      error.value = e.message
      useToast().error('Failed to void transaction')
      return false
    } finally {
      loading.value = false
    }
  }

  async function fetchTransactions(startDate, endDate) {
    loading.value = true
    error.value = null
    
    try {
      const q = query(
        collection(db, 'transactions'),
        orderBy('createdAt', 'desc')
      )
      
      const snapshot = await getDocs(q)
      transactions.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      }))
    } catch (e) {
      error.value = e.message
      console.error('Error fetching transactions:', e)
    } finally {
      loading.value = false
    }
  }

  function generateTransactionNumber() {
    const date = new Date()
    const year = date.getFullYear().toString().slice(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `TXN${year}${month}${day}${random}`
  }

  return {
    // State
    cart,
    customer,
    discount,
    discountType,
    transactions,
    loading,
    error,
    currentTransaction,
    // Getters
    cartItemCount,
    subtotal,
    discountAmount,
    taxableAmount,
    // Actions
    addToCart,
    updateCartItemQuantity,
    removeFromCart,
    clearCart,
    setDiscount,
    setCustomer,
    processTransaction,
    voidTransaction,
    fetchTransactions
  }
})
