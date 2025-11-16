#!/bin/bash
# Testing Script for New Endpoints

# ============================================
# 1. GET CURRENT USER ENDPOINT
# ============================================

echo "=== Testing GET /users/me ==="
echo "Make sure to replace 'YOUR_JWT_TOKEN' with an actual JWT token"
echo ""

# Replace YOUR_JWT_TOKEN with actual token from login/auth endpoint
curl -X GET http://localhost:8000/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

echo ""
echo ""

# ============================================
# 2. GET STORE CATEGORIES ENDPOINT
# ============================================

echo "=== Testing GET /stores/categories ==="
echo "Replace 'Your Store Name' with actual store name"
echo ""

# Replace 'Your Store Name' with actual store name from your database
curl -X GET http://localhost:8000/stores/categories \
  -H "x-store-name: Your Store Name" \
  -H "Content-Type: application/json"

echo ""
echo ""

# ============================================
# EXAMPLE: Real Usage Scenarios
# ============================================

echo "=== Example 1: Getting user data ==="
curl -X GET http://localhost:8000/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -v

echo ""
echo ""

echo "=== Example 2: Getting Nike Store categories ==="
curl -X GET http://localhost:8000/stores/categories \
  -H "x-store-name: Nike Store" \
  -H "Content-Type: application/json" \
  -v

echo ""
echo ""

echo "=== Example 3: Error case - Missing header ==="
curl -X GET http://localhost:8000/stores/categories \
  -H "Content-Type: application/json" \
  -v

echo ""
echo ""

echo "=== Example 4: Error case - Non-existent store ==="
curl -X GET http://localhost:8000/stores/categories \
  -H "x-store-name: Non Existent Store" \
  -H "Content-Type: application/json" \
  -v

echo ""
echo ""

# ============================================
# NOTES
# ============================================

echo "=== IMPORTANT NOTES ==="
echo ""
echo "1. Replace 'YOUR_JWT_TOKEN' with a valid token from:"
echo "   - Login endpoint (/auth/login)"
echo "   - Google OAuth endpoint (/auth/google)"
echo ""
echo "2. Store name MUST exist in database and be UNIQUE"
echo ""
echo "3. Store name is case-sensitive"
echo ""
echo "4. URL-safe store names:"
echo "   - 'Nike Store' can be accessed as 'Nike_Store'"
echo "   - Underscores are converted to spaces internally"
echo ""
echo "5. Expected response format:"
echo "   [{"
echo "     \"category\": \"Category Name\","
echo "     \"productCount\": 10"
echo "   }]"
echo ""
