# Store API Usage Guide

## Creating a Store with Complex Form Data

The `/stores` endpoint supports creating a new store with uploaded images (logo and banner) as well as complex nested data like branch information. When submitting data to this endpoint, please follow these guidelines to ensure proper data handling.

### Example Using Fetch API (JavaScript)

```javascript
// Create FormData object
const formData = new FormData();

// Add basic fields
formData.append('storeName', 'My Fashion Store');
formData.append('ownerId', '3a9fda4b-9068-4a7f-99bc-a7b927981c67');
formData.append('themeColor', '#3B82F6');
formData.append('phoneNumber', '+1234567890');
formData.append('hasDelivery', 'true');

// Add array of store types (must be stringified JSON)
formData.append('storeTypes', JSON.stringify(['men', 'women', 'children']));

// Add branch information (must be stringified JSON)
const branches = [
  {
    name: 'Downtown Branch',
    coordinates: {
      lat: 31.9634,
      lng: 35.9304,
      address: '123 Main St, Downtown'
    },
    supportNumbers: [
      {
        phone: '+10987654321',
        whatsapp: true
      }
    ]
  },
  {
    name: 'Uptown Branch',
    coordinates: {
      lat: 31.9816,
      lng: 35.8969,
      address: '456 High St, Uptown'
    },
    supportNumbers: [
      {
        phone: '+1234567890',
        whatsapp: false
      }
    ]
  }
];
formData.append('branches', JSON.stringify(branches));

// Add files
// Assuming you have file inputs in your HTML:
// <input type="file" id="logo" />
// <input type="file" id="banner" />
const logoInput = document.getElementById('logo');
const bannerInput = document.getElementById('banner');
if (logoInput.files[0]) {
  formData.append('logo', logoInput.files[0]);
}
if (bannerInput.files[0]) {
  formData.append('banner', bannerInput.files[0]);
}

// Send the request
fetch('/stores', {
  method: 'POST',
  body: formData,
  // Don't set Content-Type header, browser will set it to multipart/form-data
})
.then(response => response.json())
.then(data => {
  console.log('Store created:', data);
})
.catch(error => {
  console.error('Error creating store:', error);
});
```

### Important Notes

1. **Complex Data Types**: Arrays and objects must be JSON-stringified before being added to FormData.
   Example: `formData.append('storeTypes', JSON.stringify(['men', 'women']));`

2. **File Uploads**: 
   - Only JPG, JPEG, PNG, and WebP images are supported
   - Maximum file size is 5MB
   - Logo images will be resized to 600px width
   - Banner images will be resized to 1200px width and 400px height

3. **Required Fields**:
   - `storeName` - String
   - `ownerId` - UUID string
   - `storeTypes` - Array of strings (JSON stringified)

4. **Content Type**: Do not manually set the Content-Type header. Let the browser set it to `multipart/form-data` with the proper boundary.

### Example Response

```json
{
  "id": "5f8d0a1e-7b2d-4e3c-9b0a-1e7b2d4e3c9b",
  "type": "men",
  "name": "My Fashion Store",
  "logo": "/uploads/stores/logo-5f8d0a1e.webp",
  "banner": "/uploads/stores/banner-5f8d0a1e.webp",
  "theme_color": "#3B82F6",
  "delivery": true,
  "created_at": "2025-05-25T02:45:23.456Z",
  "updated_at": "2025-05-25T02:45:23.456Z",
  "owner_id": "3a9fda4b-9068-4a7f-99bc-a7b927981c67"
}
```
