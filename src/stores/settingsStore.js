import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  // State
  const storeName = ref('My Store')
  const currency = ref('USD')
  const taxRate = ref(0.1)
  const lowStockThreshold = ref(10)
  const receiptHeader = ref('')
  const receiptFooter = ref('Thank you for your purchase!')
  const isInitialized = ref(false)

  // Currency symbols map
  const currencySymbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    PHP: '₱',
    JPY: '¥',
    KRW: '₩',
    CNY: '¥',
    INR: '₹',
    AUD: '$',
    CAD: '$',
    SGD: '$',
    MYR: 'RM',
    THB: '฿',
    IDR: 'Rp',
    VND: '₫'
  }

  // Getters
  const currencySymbol = computed(() => currencySymbols[currency.value] || '$')

  // Actions
  function initialize() {
    if (isInitialized.value) return
    
    const saved = localStorage.getItem('pos_settings')
    if (saved) {
      try {
        const settings = JSON.parse(saved)
        storeName.value = settings.storeName || 'My Store'
        currency.value = settings.currency || 'USD'
        taxRate.value = settings.taxRate ?? 0.1
        lowStockThreshold.value = settings.lowStockThreshold || 10
        receiptHeader.value = settings.receiptHeader || ''
        receiptFooter.value = settings.receiptFooter || 'Thank you for your purchase!'
      } catch (e) {
        console.error('Error loading settings:', e)
      }
    }
    isInitialized.value = true
  }

  function saveSettings(settings) {
    Object.assign({
      storeName: storeName.value,
      currency: currency.value,
      taxRate: taxRate.value,
      lowStockThreshold: lowStockThreshold.value,
      receiptHeader: receiptHeader.value,
      receiptFooter: receiptFooter.value
    }, settings)
    
    storeName.value = settings.storeName ?? storeName.value
    currency.value = settings.currency ?? currency.value
    taxRate.value = settings.taxRate ?? taxRate.value
    lowStockThreshold.value = settings.lowStockThreshold ?? lowStockThreshold.value
    receiptHeader.value = settings.receiptHeader ?? receiptHeader.value
    receiptFooter.value = settings.receiptFooter ?? receiptFooter.value
    
    localStorage.setItem('pos_settings', JSON.stringify({
      storeName: storeName.value,
      currency: currency.value,
      taxRate: taxRate.value,
      lowStockThreshold: lowStockThreshold.value,
      receiptHeader: receiptHeader.value,
      receiptFooter: receiptFooter.value
    }))
  }

  return {
    // State
    storeName,
    currency,
    taxRate,
    lowStockThreshold,
    receiptHeader,
    receiptFooter,
    isInitialized,
    // Getters
    currencySymbol,
    currencySymbols,
    // Actions
    initialize,
    saveSettings
  }
})
