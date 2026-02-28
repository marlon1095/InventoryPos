import { useSettingsStore } from '@/stores/settingsStore'

export function formatCurrency(value, currencyCode = null) {
  const settings = useSettingsStore()
  const currency = currencyCode || settings.currency || 'USD'
  
  // Currency locale map for proper formatting
  const locales = {
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    PHP: 'en-PH',
    JPY: 'ja-JP',
    KRW: 'ko-KR',
    CNY: 'zh-CN',
    INR: 'en-IN',
    AUD: 'en-AU',
    CAD: 'en-CA',
    SGD: 'en-SG',
    MYR: 'ms-MY',
    THB: 'th-TH',
    IDR: 'id-ID',
    VND: 'vi-VN'
  }
  
  const locale = locales[currency] || 'en-US'
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0)
}

export function formatDate(date, format = 'medium') {
  if (!date) return ''
  
  const d = date instanceof Date ? date : new Date(date)
  
  if (isNaN(d.getTime())) return ''
  
  const options = {
    short: { month: 'numeric', day: 'numeric', year: '2-digit' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit' },
    datetime: { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    full: { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }
  }
  
  return new Intl.DateTimeFormat('en-US', options[format] || options.medium).format(d)
}

export function formatNumber(value, decimals = 0) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value || 0)
}

export function formatPercentage(value, decimals = 1) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format((value || 0) / 100)
}

export function truncate(str, length = 50) {
  if (!str) return ''
  return str.length > length ? str.substring(0, length) + '...' : str
}

export function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}
