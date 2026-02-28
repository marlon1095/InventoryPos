export const USER_ROLES = [
  { value: 'admin', label: 'Administrator' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Cashier' }
]

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash Payment', icon: '💵' },
  // TODO: Add more payment methods in the future
  // { value: 'card', label: 'Credit/Debit Card', icon: '💳' },
  // { value: 'transfer', label: 'Bank Transfer', icon: '🏦' }
]

export const TRANSACTION_TYPES = [
  { value: 'sale', label: 'Sale' },
  { value: 'return', label: 'Return' },
  { value: 'void', label: 'Void' }
]

export const TRANSACTION_STATUS = [
  { value: 'completed', label: 'Completed', color: 'success' },
  { value: 'voided', label: 'Voided', color: 'danger' },
  { value: 'refunded', label: 'Refunded', color: 'warning' }
]

export const STOCK_MOVEMENT_TYPES = [
  { value: 'purchase', label: 'Purchase/Restock' },
  { value: 'sale', label: 'Sale' },
  { value: 'return', label: 'Customer Return' },
  { value: 'adjustment', label: 'Manual Adjustment' },
  { value: 'damage', label: 'Damage/Loss' }
]

export const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' }
]

export const DEFAULT_TAX_RATE = 0.1 // 10%

export const DEFAULT_CURRENCY = 'USD'

export const ITEMS_PER_PAGE = 20

export const LOW_STOCK_THRESHOLD = 10

export const DEMO_USERS = [
  { email: 'admin@demo.com', password: 'demo123', role: 'admin', displayName: 'Admin User' },
  { email: 'manager@demo.com', password: 'demo123', role: 'manager', displayName: 'Manager User' },
  { email: 'cashier@demo.com', password: 'demo123', role: 'cashier', displayName: 'Cashier User' }
]
