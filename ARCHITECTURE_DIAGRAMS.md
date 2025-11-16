# Visual API Architecture

## Request Flow Diagram

### Endpoint 1: Get Current User

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT REQUEST                            │
├─────────────────────────────────────────────────────────────┤
│ GET /users/me                                               │
│ Headers:                                                     │
│   Authorization: Bearer {JWT_TOKEN}                         │
│   Content-Type: application/json                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              USER CONTROLLER (user.controller.ts)            │
├─────────────────────────────────────────────────────────────┤
│ @Get('me')                                                   │
│ @UseGuards(JwtAuthGuard)                                    │
│ getCurrentUser(@Req() request: Request)                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              JWT AUTH GUARD (jwt-auth.guard.ts)              │
├─────────────────────────────────────────────────────────────┤
│ ✅ Validates JWT Token                                       │
│ ✅ Extracts user ID from token                              │
│ ✅ Attaches user to request object                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│            USER SERVICE (user.service.ts)                    │
├─────────────────────────────────────────────────────────────┤
│ getUserById(userId: string)                                 │
│   - Query database for user                                 │
│   - Return user object                                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              DATABASE (PostgreSQL)                           │
├─────────────────────────────────────────────────────────────┤
│ SELECT * FROM user WHERE id = {userId}                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   SERVER RESPONSE                            │
├─────────────────────────────────────────────────────────────┤
│ Status: 200 OK                                              │
│ Body: {                                                      │
│   "id": "550e8400-e29b-41d4-a716-446655440000",           │
│   "name": "John Doe",                                       │
│   "email": "john@example.com",                             │
│   "phone": "+1234567890",                                   │
│   "type": "owner"                                           │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
```

---

### Endpoint 2: Get Store Categories

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT REQUEST                            │
├─────────────────────────────────────────────────────────────┤
│ GET /stores/categories                                      │
│ Headers:                                                     │
│   x-store-name: Nike Store                                  │
│   Content-Type: application/json                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│           STORE CONTROLLER (store.controller.ts)             │
├─────────────────────────────────────────────────────────────┤
│ @Get('categories')                                           │
│ getStoreCategoriesWithProducts(@Req() request: Request)    │
│ 1. Extract x-store-name header                             │
│ 2. Validate header exists                                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│             STORE SERVICE (store.service.ts)                 │
├─────────────────────────────────────────────────────────────┤
│ getStoreCategoriesWithProductsByName(storeName: string)    │
│ 1. Find store by name                                       │
│ 2. Handle URL-safe names (underscores → spaces)            │
│ 3. Validate store exists                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              DATABASE QUERIES (Step 1-3)                     │
├─────────────────────────────────────────────────────────────┤
│ Query 1: SELECT * FROM store WHERE name = {storeName}      │
│   └─ Returns: Store object with id                         │
│                                                              │
│ Query 2: SELECT * FROM branches WHERE store_id = {storeId} │
│   └─ Returns: Array of branches                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              DATABASE QUERIES (Step 4-5)                     │
├─────────────────────────────────────────────────────────────┤
│ Query 3: SELECT DISTINCT product_code FROM product_branch  │
│          WHERE branch_id IN ({branchIds})                   │
│   └─ Returns: Array of product codes                       │
│                                                              │
│ Query 4: SELECT category, COUNT(*) as productCount         │
│          FROM product                                       │
│          WHERE product_code IN ({productCodes})            │
│          AND category IS NOT NULL                          │
│          GROUP BY category                                  │
│          ORDER BY category ASC                             │
│   └─ Returns: Categories with counts                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   SERVER RESPONSE                            │
├─────────────────────────────────────────────────────────────┤
│ Status: 200 OK                                              │
│ Body: [                                                      │
│   {                                                          │
│     "category": "Shoes",                                    │
│     "productCount": 45                                      │
│   },                                                         │
│   {                                                          │
│     "category": "Apparel",                                  │
│     "productCount": 120                                     │
│   },                                                         │
│   {                                                          │
│     "category": "Accessories",                              │
│     "productCount": 30                                      │
│   }                                                          │
│ ]                                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Relevant Tables)

```
┌──────────────────┐
│      user        │
├──────────────────┤
│ id (PK)          │
│ name             │
│ email            │
│ phone            │
│ type             │
│ created_at       │
└──────────────────┘
        │
        │ owner_id
        │
        ▼
┌──────────────────┐
│      store       │
├──────────────────┤
│ id (PK)          │
│ name (UNIQUE)    │
│ logo             │
│ banner           │
│ owner_id (FK)    │
│ created_at       │
└──────────────────┘
        │
        │ 1:many
        │
        ▼
┌──────────────────────┐
│     branches         │
├──────────────────────┤
│ id (PK)              │
│ store_id (FK)        │
│ name                 │
│ address              │
│ created_at           │
└──────────────────────┘
        │
        │ 1:many
        │
        ▼
┌──────────────────────┐
│  product_branch      │
├──────────────────────┤
│ product_code (FK)    │
│ branch_id (FK)       │
└──────────────────────┘
        │
        │ N:1
        │
        ▼
┌──────────────────────┐
│     product          │
├──────────────────────┤
│ product_code (PK)    │
│ product_name         │
│ category             │
│ price                │
│ images[]             │
│ status               │
│ created_at           │
└──────────────────────┘
```

---

## Data Flow: Get Store Categories

```
Store Name "Nike Store"
        │
        ▼
Find Store by Name
        │
        ├─ Check: Nike Store exists? ✅
        ├─ Check: Unique name? ✅
        │
        ▼
Get Store ID: uuid-123
        │
        ▼
Find All Branches
        │
        ├─ Branch 1: Nike Store NY (branch-id-1)
        ├─ Branch 2: Nike Store LA (branch-id-2)
        └─ Branch 3: Nike Store CHI (branch-id-3)
        │
        ▼
Find All Products in Branches
        │
        ├─ Product Branch Relations:
        │  ├─ SHOE-001 → Branch 1,2,3
        │  ├─ SHIRT-001 → Branch 1,2
        │  ├─ HAT-001 → Branch 3
        │  └─ ... (more products)
        │
        ▼
Group by Category & Count
        │
        ├─ Shoes: 45 products
        ├─ Apparel: 120 products
        └─ Accessories: 30 products
        │
        ▼
Return Categories Array
```

---

## Error Handling Flow

```
┌─────────────────┐
│ Request Comes   │
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│ Missing Header Check?    │
├──────────────────────────┤
│ YES → Return 400         │
│ NO → Continue            │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Store Exists Check?      │
├──────────────────────────┤
│ YES → Continue           │
│ NO → Return 404          │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Database Query Error?    │
├──────────────────────────┤
│ YES → Return 500         │
│ NO → Return 200          │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Return Categories        │
└──────────────────────────┘
```

---

## Technology Stack

```
Frontend (Client)
    ↓ HTTP Request
    ↓ (Headers: x-store-name or Authorization)
    ↓
NestJS Controller
    ├─ Route Decorator (@Get)
    ├─ Guard Decorator (@UseGuards)
    └─ Request Extraction (@Req)
    ↓
NestJS Service
    ├─ Business Logic
    ├─ Database Query Building
    └─ Error Handling
    ↓
TypeORM
    ├─ Entity Models
    ├─ Query Builder
    └─ Database Abstraction
    ↓
PostgreSQL Database
    ├─ Tables
    ├─ Indexes
    └─ Constraints
    ↓
HTTP Response
    └─ JSON Data
```

---

## Deployment Architecture

```
        ┌─────────────────────────────┐
        │    Production Server        │
        ├─────────────────────────────┤
        │                             │
        │  ┌───────────────────────┐  │
        │  │   NestJS App          │  │
        │  │  ┌─────────────────┐  │  │
        │  │  │  Controllers    │  │  │
        │  │  │  Services       │  │  │
        │  │  │  Guards         │  │  │
        │  │  └─────────────────┘  │  │
        │  └───────────┬───────────┘  │
        │              │               │
        │  ┌───────────▼───────────┐  │
        │  │   TypeORM (ORM)       │  │
        │  └───────────┬───────────┘  │
        │              │               │
        │  ┌───────────▼───────────┐  │
        │  │  PostgreSQL Database  │  │
        │  │  ├─ users table       │  │
        │  │  ├─ stores table      │  │
        │  │  ├─ branches table    │  │
        │  │  ├─ products table    │  │
        │  │  └─ product_branch   │  │
        │  └───────────────────────┘  │
        │                             │
        └─────────────────────────────┘
                    ▲
                    │ HTTP/HTTPS
                    │
        ┌───────────▼──────────────┐
        │    Client Application    │
        ├────────────────────────┤
        │  - Web Browser          │
        │  - Mobile App           │
        │  - API Consumer         │
        └────────────────────────┘
```

---

**Last Updated:** November 14, 2025
**Version:** 1.0
**Status:** ✅ PRODUCTION READY
