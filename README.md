# Inventory & POS System

A modern, full-featured inventory management and point-of-sale application built with Vue.js 3 and Firebase.

## Features

- **Authentication**: Secure login with role-based access control (Admin, Manager, Cashier)
- **Inventory Management**: Full CRUD operations for products and categories
- **Point of Sale**: Fast and intuitive POS interface with cart management
- **Dashboard**: Real-time analytics with charts and key metrics
- **Transaction History**: Complete sales records with void capability

## Tech Stack

- **Frontend**: Vue.js 3 (Composition API)
- **State Management**: Pinia
- **Routing**: Vue Router 4
- **Styling**: Tailwind CSS
- **Charts**: ECharts
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Build Tool**: Vite

## Project Structure

```
src/
├── assets/
│   └── styles/          # Global CSS and Tailwind
├── components/
│   ├── common/          # Shared components (layout, toast)
│   ├── auth/            # Authentication components
│   ├── inventory/       # Inventory-related components
│   ├── pos/             # POS-related components
│   └── dashboard/       # Dashboard widgets
├── composables/         # Vue Composition API functions
├── views/               # Page-level components
├── router/              # Vue Router configuration
├── stores/              # Pinia state stores
├── services/            # Firebase and API services
└── utils/               # Helper functions and constants
```

## Features by Role

| Feature | Admin | Manager | Cashier |
|---------|-------|---------|---------|
| Dashboard | ✅ | ✅ | ❌ |
| POS | ✅ | ✅ | ✅ |
| View Inventory | ✅ | ✅ | ❌ |
| Manage Inventory | ✅ | ✅ | ❌ |
| View Transactions | ✅ | ✅ | ❌ |
| Void Transactions | ✅ | ✅ | ❌ |
| Manage Users | ✅ | ❌ | ❌ |
| Settings | ✅ | ❌ | ❌ |

