# API Endpoints Summary

## New Endpoints Added

### 1. Get Current User (Protected)

- **Endpoint:** `GET /users/me`
- **Guard:** JWT Authentication required
- **Description:** Retrieves the currently authenticated user's data from their JWT token
- **Response:** User object with id, name, email, phone, type
- **Usage:** Use this to get the authenticated user's information

```bash
curl -X GET http://localhost:8000/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 2. Get Store Categories with Products (By Store Name)

- **Endpoint:** `GET /stores/categories`
- **Headers Required:**
  - `x-store-name` (required) - The unique name of the store
- **Description:** Retrieves all categories that have products in a specific store by store name
- **Response:** Array of categories with product count
- **Note:** Store name must be unique in the database

```bash
curl -X GET http://localhost:8000/stores/categories \
  -H "x-store-name: Your Store Name"
```

**Response Format:**

```json
[
  {
    "category": "Electronics",
    "productCount": 15
  },
  {
    "category": "Clothing",
    "productCount": 32
  },
  {
    "category": "Books",
    "productCount": 8
  }
]
```

---

## How to Use These Endpoints

### Flow Example:

1. **Get current user data:**

   ```bash
   GET /users/me
   # Required: JWT token in Authorization header
   # Returns: { id, name, email, phone, type }
   ```

2. **Get store categories with products:**
   ```bash
   GET /stores/categories
   # Required: x-store-name header with the store name
   # Returns: Array of categories with product counts
   ```

---

## Implementation Details

### Backend Changes:

#### 1. StoreService (`src/services/store.service.ts`)

- **New Method:** `getStoreCategoriesWithProductsByName(storeName: string)`
- **Functionality:**
  - Validates store name exists in database (unique check)
  - Fetches all branches for the store
  - Gets all product-branch relationships
  - Groups products by category
  - Counts products per category
  - Returns categories with only product count (no product details)
  - Handles URL-safe names (underscores converted to spaces)

#### 2. StoreController (`src/controller/store.controller.ts`)

- **New Route:** `GET /categories`
- **Headers:** Expects `x-store-name` header
- **Handler:**
  - Extracts store name from header
  - Validates header presence
  - Calls `storeService.getStoreCategoriesWithProductsByName()`
  - Includes proper error handling and logging

#### 3. UserController (`src/controller/user.controller.ts`)

- **New Route:** `GET /me`
- **Guard:** `@UseGuards(JwtAuthGuard)`
- **Handler:** Returns current authenticated user from JWT token
- **Imports:** Added Request, UseGuards, Req, and JwtAuthGuard

---

## Error Handling

### Possible Errors:

1. **Store Not Found**

   - Status: 404
   - Message: "Store with name {storeName} not found"

2. **Missing Header**

   - Status: 400
   - Message: "Store name must be provided in x-store-name header"

3. **Internal Server Error**
   - Status: 500
   - Message: Detailed error message

### Database Validation:

- Store names must be unique (enforced at creation time)
- Store name lookup is case-sensitive
- Handles URL-safe names (underscores → spaces)

---

## Database Queries Optimized

The `getStoreCategoriesWithProductsByName` method:

- Uses efficient SQL GROUP BY queries
- Filters only categories that have products
- Avoids loading unnecessary product data
- Orders categories alphabetically for better UX
- Validates store name uniqueness

---

## Usage Examples

### Example 1: Get categories for "Nike Store"

```bash
curl -X GET http://localhost:8000/stores/categories \
  -H "x-store-name: Nike Store"
```

### Example 2: Get categories for store with URL-safe name

```bash
# Store name "Nike Store" can also be accessed as "Nike_Store"
curl -X GET http://localhost:8000/stores/categories \
  -H "x-store-name: Nike_Store"
```

### Example 3: Get current user and then fetch their store categories

```bash
# Step 1: Get current user
curl -X GET http://localhost:8000/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Step 2: Use the store name to get categories
curl -X GET http://localhost:8000/stores/categories \
  -H "x-store-name: Electronics Hub"
```
