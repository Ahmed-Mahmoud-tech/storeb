// Test script to verify email verification endpoint
fetch('http://localhost:8000/auth/verify-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    token: '149b7964-0961-4b91-81b5-5574b0b656cc',
  }),
})
  .then((response) => {
    console.log('Status:', response.status);
    return response.json();
  })
  .then((data) => {
    console.log('Response:', data);
  })
  .catch((error) => {
    console.error('Error:', error);
  });
