import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/services/firebase'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const userProfile = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const isInitialized = ref(false)

  // Getters
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => userProfile.value?.role === 'admin')
  const isManager = computed(() => ['admin', 'manager'].includes(userProfile.value?.role))
  const userName = computed(() => userProfile.value?.displayName || user.value?.email || 'User')

  // Actions
  async function initializeAuth() {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          user.value = firebaseUser
          await fetchUserProfile(firebaseUser.uid)
        } else {
          user.value = null
          userProfile.value = null
        }
        isInitialized.value = true
        unsubscribe()
        resolve()
      })
    })
  }

  async function fetchUserProfile(uid) {
    try {
      const docRef = doc(db, 'users', uid)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        userProfile.value = { id: docSnap.id, ...docSnap.data() }
      } else {
        // Create default profile if not exists
        const defaultProfile = {
          email: user.value?.email || '',
          displayName: user.value?.email?.split('@')[0] || 'User',
          role: 'cashier',
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
        await setDoc(docRef, defaultProfile)
        userProfile.value = { id: uid, ...defaultProfile }
      }
    } catch (e) {
      console.error('Error fetching user profile:', e)
      error.value = e.message
    }
  }

  async function login(email, password) {
    loading.value = true
    error.value = null
    
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      user.value = result.user
      await fetchUserProfile(result.user.uid)
      
      // Update last login
      await setDoc(doc(db, 'users', result.user.uid), {
        lastLoginAt: serverTimestamp()
      }, { merge: true })
      
      return true
    } catch (e) {
      error.value = getErrorMessage(e.code)
      return false
    } finally {
      loading.value = false
    }
  }

  async function register(email, password, displayName, role = 'cashier') {
    loading.value = true
    error.value = null
    
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      
      // Create user profile
      await setDoc(doc(db, 'users', result.user.uid), {
        email,
        displayName,
        role,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      user.value = result.user
      await fetchUserProfile(result.user.uid)
      
      return true
    } catch (e) {
      error.value = getErrorMessage(e.code)
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await signOut(auth)
      user.value = null
      userProfile.value = null
      return true
    } catch (e) {
      error.value = e.message
      return false
    }
  }

  async function resetPassword(email) {
    loading.value = true
    error.value = null
    
    try {
      await sendPasswordResetEmail(auth, email)
      return true
    } catch (e) {
      error.value = getErrorMessage(e.code)
      return false
    } finally {
      loading.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  function getErrorMessage(code) {
    const messages = {
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/operation-not-allowed': 'Operation not allowed.',
      'auth/weak-password': 'Password should be at least 6 characters.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/requires-recent-login': 'Please log in again to perform this action.'
    }
    return messages[code] || 'An error occurred. Please try again.'
  }

  return {
    // State
    user,
    userProfile,
    loading,
    error,
    isInitialized,
    // Getters
    isAuthenticated,
    isAdmin,
    isManager,
    userName,
    // Actions
    initializeAuth,
    login,
    register,
    logout,
    resetPassword,
    clearError
  }
})
