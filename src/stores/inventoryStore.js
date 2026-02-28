import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/authStore'

export const useInventoryStore = defineStore('inventory', () => {
  // State
  const products = ref([])
  const categories = ref([])
  const loading = ref(false)
  const error = ref(null)
  const unsubscribe = ref(null)

  // Getters
  const activeProducts = computed(() => 
    products.value.filter(p => p.isActive)
  )
  
  const lowStockProducts = computed(() => 
    products.value.filter(p => p.isActive && p.quantity <= p.reorderLevel)
  )
  
  const totalInventoryValue = computed(() => 
    products.value.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0)
  )
  
  const totalProducts = computed(() => activeProducts.value.length)

  // Actions
  async function fetchProducts() {
    loading.value = true
    error.value = null
    
    try {
      const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      products.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date()
      }))
    } catch (e) {
      error.value = e.message
      console.error('Error fetching products:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchCategories() {
    try {
      const q = query(collection(db, 'categories'), orderBy('name'))
      const snapshot = await getDocs(q)
      categories.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (e) {
      error.value = e.message
      console.error('Error fetching categories:', e)
    }
  }

  function subscribeToProducts() {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'))
    
    unsubscribe.value = onSnapshot(q, (snapshot) => {
      products.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date()
      }))
    })
  }

  function unsubscribeFromProducts() {
    if (unsubscribe.value) {
      unsubscribe.value()
      unsubscribe.value = null
    }
  }

  async function logActivity(action, details) {
    try {
      const authStore = useAuthStore()
      await addDoc(collection(db, 'activityLogs'), {
        action,
        details,
        userId: authStore.user?.uid,
        userName: authStore.userName,
        createdAt: serverTimestamp()
      })
    } catch (e) {
      console.error('Error logging activity:', e)
    }
  }

  async function addProduct(productData) {
    loading.value = true
    error.value = null
    
    try {
      const docRef = await addDoc(collection(db, 'products'), {
        ...productData,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      // Update category product count
      if (productData.category) {
        await updateCategoryProductCount(productData.category, 1)
      }
      
      // Log activity
      await logActivity('Product Created', `Created product: ${productData.name} (SKU: ${productData.sku})`)
      
      // Refresh products
      await fetchProducts()
      await fetchCategories()
      
      useToast().success('Product added successfully')
      return docRef.id
    } catch (e) {
      error.value = e.message
      useToast().error('Failed to add product')
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateProduct(id, productData) {
    loading.value = true
    error.value = null
    
    try {
      const docRef = doc(db, 'products', id)
      const oldDoc = await getDoc(docRef)
      const oldCategory = oldDoc.data()?.category
      
      await updateDoc(docRef, {
        ...productData,
        updatedAt: serverTimestamp()
      })
      
      // Update category counts if category changed
      if (oldCategory !== productData.category) {
        if (oldCategory) await updateCategoryProductCount(oldCategory, -1)
        if (productData.category) await updateCategoryProductCount(productData.category, 1)
      }
      
      // Log activity
      await logActivity('Product Updated', `Updated product: ${productData.name}`)
      
      // Refresh products
      await fetchProducts()
      await fetchCategories()
      
      useToast().success('Product updated successfully')
      return true
    } catch (e) {
      error.value = e.message
      useToast().error('Failed to update product')
      return false
    } finally {
      loading.value = false
    }
  }

  async function deleteProduct(id) {
    loading.value = true
    error.value = null
    
    try {
      const docRef = doc(db, 'products', id)
      const docSnap = await getDoc(docRef)
      
      let productName = 'Unknown'
      let category = null
      
      if (docSnap.exists()) {
        productName = docSnap.data().name
        category = docSnap.data().category
        await deleteDoc(docRef)
        
        if (category) {
          await updateCategoryProductCount(category, -1)
        }
      }
      
      // Log activity
      await logActivity('Product Deleted', `Deleted product: ${productName}`)
      
      // Refresh products
      await fetchProducts()
      await fetchCategories()
      
      useToast().success('Product deleted successfully')
      return true
    } catch (e) {
      error.value = e.message
      useToast().error('Failed to delete product')
      return false
    } finally {
      loading.value = false
    }
  }

  async function adjustStock(id, quantity, reason, type = 'adjustment') {
    loading.value = true
    error.value = null
    
    try {
      const productDoc = await getDoc(doc(db, 'products', id))
      const productName = productDoc.exists() ? productDoc.data().name : 'Unknown'
      
      const docRef = doc(db, 'products', id)
      await updateDoc(docRef, {
        quantity: increment(quantity),
        updatedAt: serverTimestamp()
      })
      
      // Log stock movement
      await addDoc(collection(db, 'stockMovements'), {
        productId: id,
        productName,
        quantity,
        type,
        reason,
        createdAt: serverTimestamp()
      })
      
      // Log activity
      const action = quantity > 0 ? 'Added' : 'Removed'
      await logActivity('Stock Adjusted', `${action} ${Math.abs(quantity)} units to ${productName}. Reason: ${reason}`)
      
      // Refresh products
      await fetchProducts()
      
      useToast().success('Stock adjusted successfully')
      return true
    } catch (e) {
      error.value = e.message
      useToast().error('Failed to adjust stock')
      return false
    } finally {
      loading.value = false
    }
  }

  async function addCategory(categoryData) {
    loading.value = true
    error.value = null
    
    try {
      const docRef = await addDoc(collection(db, 'categories'), {
        ...categoryData,
        productCount: 0,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      // Refresh categories
      await fetchCategories()
      
      useToast().success('Category added successfully')
      return docRef.id
    } catch (e) {
      error.value = e.message
      useToast().error('Failed to add category')
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateCategory(id, categoryData) {
    loading.value = true
    error.value = null
    
    try {
      const docRef = doc(db, 'categories', id)
      await updateDoc(docRef, {
        ...categoryData,
        updatedAt: serverTimestamp()
      })
      
      // Refresh categories
      await fetchCategories()
      
      useToast().success('Category updated successfully')
      return true
    } catch (e) {
      error.value = e.message
      useToast().error('Failed to update category')
      return false
    } finally {
      loading.value = false
    }
  }

  async function deleteCategory(id) {
    loading.value = true
    error.value = null
    
    try {
      await deleteDoc(doc(db, 'categories', id))
      
      // Refresh categories
      await fetchCategories()
      
      useToast().success('Category deleted successfully')
      return true
    } catch (e) {
      error.value = e.message
      useToast().error('Failed to delete category')
      return false
    } finally {
      loading.value = false
    }
  }

  async function updateCategoryProductCount(categoryId, delta) {
    try {
      const docRef = doc(db, 'categories', categoryId)
      await updateDoc(docRef, {
        productCount: increment(delta)
      })
    } catch (e) {
      console.error('Error updating category count:', e)
    }
  }

  function getProductById(id) {
    return products.value.find(p => p.id === id)
  }

  function getProductsByCategory(categoryId) {
    return products.value.filter(p => p.category === categoryId && p.isActive)
  }

  function searchProducts(query) {
    const q = query.toLowerCase()
    return products.value.filter(p => 
      p.isActive && (
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
      )
    )
  }

  return {
    // State
    products,
    categories,
    loading,
    error,
    // Getters
    activeProducts,
    lowStockProducts,
    totalInventoryValue,
    totalProducts,
    // Actions
    fetchProducts,
    fetchCategories,
    subscribeToProducts,
    unsubscribeFromProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    addCategory,
    updateCategory,
    deleteCategory,
    getProductById,
    getProductsByCategory,
    searchProducts
  }
})
