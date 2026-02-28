export const validators = {
  required: (value) => {
    if (value === null || value === undefined || value === '') return 'This field is required'
    if (Array.isArray(value) && value.length === 0) return 'This field is required'
    return true
  },

  email: (value) => {
    if (!value) return true
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return pattern.test(value) || 'Please enter a valid email address'
  },

  minLength: (min) => (value) => {
    if (!value) return true
    return value.length >= min || `Must be at least ${min} characters`
  },

  maxLength: (max) => (value) => {
    if (!value) return true
    return value.length <= max || `Must be no more than ${max} characters`
  },

  min: (min) => (value) => {
    if (value === '' || value === null || value === undefined) return true
    return Number(value) >= min || `Must be at least ${min}`
  },

  max: (max) => (value) => {
    if (value === '' || value === null || value === undefined) return true
    return Number(value) <= max || `Must be no more than ${max}`
  },

  numeric: (value) => {
    if (!value) return true
    return !isNaN(parseFloat(value)) && isFinite(value) || 'Must be a valid number'
  },

  positiveNumber: (value) => {
    if (!value && value !== 0) return true
    return Number(value) > 0 || 'Must be a positive number'
  },

  nonNegativeNumber: (value) => {
    if (!value && value !== 0) return true
    return Number(value) >= 0 || 'Must be 0 or greater'
  },

  sku: (value) => {
    if (!value) return true
    const pattern = /^[A-Z0-9-]+$/
    return pattern.test(value.toUpperCase()) || 'SKU must contain only letters, numbers, and hyphens'
  },

  barcode: (value) => {
    if (!value) return true
    const pattern = /^[0-9]+$/
    return pattern.test(value) || 'Barcode must contain only numbers'
  }
}

export function validate(value, rules) {
  for (const rule of rules) {
    const result = rule(value)
    if (result !== true) {
      return result
    }
  }
  return true
}

export function validateForm(formData, schema) {
  const errors = {}
  let isValid = true

  for (const [field, rules] of Object.entries(schema)) {
    const result = validate(formData[field], rules)
    if (result !== true) {
      errors[field] = result
      isValid = false
    }
  }

  return { isValid, errors }
}
