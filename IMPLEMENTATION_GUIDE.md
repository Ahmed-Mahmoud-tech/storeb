# Quick API Reference Guide

## ✅ Implementation Complete

Two endpoints have been successfully implemented on the server-side:

---

## 1. Get Current User Data

**Endpoint:** `GET /users/me`

**Authentication:** Required (JWT Token)

**How it works:**

- Extract user ID from JWT token
- Return user information

**Example Request:**

```bash
curl -X GET http://localhost:8000/users/me \
  -H "Authorization: Bearer your_jwt_token_here"
```

**Example Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "type": "owner"
}
```

---

## 2. Get Store Categories with Products

**Endpoint:** `GET /stores/categories`

**Header Required:** `x-store-name`

**How it works:**

- Client sends store name in header
- Server validates store name exists (unique)
- Server finds all branches for that store
- Server groups products by category
- Return only categories that have products

**Example Request:**

```bash
curl -X GET http://localhost:8000/stores/categories \
  -H "x-store-name: Nike Store"
```

**Example Response:**

```json
[
  {
    "category": "Shoes",
    "productCount": 45
  },
  {
    "category": "Apparel",
    "productCount": 120
  },
  {
    "category": "Accessories",
    "productCount": 30
  }
]
```

---

## Key Features

✅ **Store Name Based:** Uses unique store name instead of ID
✅ **Header Extraction:** Reads store name from `x-store-name` header
✅ **Uniqueness Check:** Validates store name exists and is unique
✅ **Product Counting:** Returns only categories with products
✅ **Error Handling:** Comprehensive error messages
✅ **Logging:** All operations are logged for debugging

---

## Error Scenarios

### 1. Missing Store Name Header

```bash
# Error response
Status: 400
Message: "Store name must be provided in x-store-name header"
```

### 2. Store Not Found

```bash
# Error response
Status: 404
Message: "Store with name XYZ not found"
```

### 3. Authentication Failed

```bash
# For /users/me endpoint
Status: 401
Message: "Unauthorized"
```

---

## Usage Flow Example

### Scenario: Get user's store categories

**Step 1:** Authenticate and get user data

```bash
curl -X GET http://localhost:8000/users/me \
  -H "Authorization: Bearer user_token"
```

Response: User object with store information

**Step 2:** Get store categories

```bash
# Use the store name from your application
curl -X GET http://localhost:8000/stores/categories \
  -H "x-store-name: My Electronics Store"
```

Response: Array of categories with product counts

---

## Database Design Note

**Store Name Uniqueness:**

- Store names are unique in the database
- Enforced at the model level during store creation
- URL-safe conversion: underscores are converted to spaces
  - Example: "Nike_Store" → "Nike Store"

**Data Retrieval:**

1. Find store by name (with URL-safe handling)
2. Get branches for store
3. Get products in those branches
4. Group by category and count
5. Return categories with counts (no product details)

---

## Testing Recommendations

1. **Test with valid store name:**

   ```bash
   curl -X GET http://localhost:8000/stores/categories \
     -H "x-store-name: Test Store"
   ```

2. **Test with invalid store name:**

   ```bash
   curl -X GET http://localhost:8000/stores/categories \
     -H "x-store-name: NonExistent Store"
   # Should return 404
   ```

3. **Test with missing header:**

   ```bash
   curl -X GET http://localhost:8000/stores/categories
   # Should return 400
   ```

4. **Test user endpoint with JWT:**
   ```bash
   curl -X GET http://localhost:8000/users/me \
     -H "Authorization: Bearer invalid_token"
   # Should return 401
   ```

---

## Files Modified

1. **`src/services/store.service.ts`**

   - Added: `getStoreCategoriesWithProductsByName(storeName: string)`

2. **`src/controller/store.controller.ts`**

   - Added: `GET /categories` endpoint
   - Reads `x-store-name` from request headers

3. **`src/controller/user.controller.ts`**
   - Added: `GET /me` endpoint
   - Protected with JWT guard

---

## Next Steps (If Needed)

- Add caching for frequently accessed categories
- Add pagination for categories with many products
- Add filtering options (by date range, popularity, etc.)
- Add role-based access control to view only user's own stores
