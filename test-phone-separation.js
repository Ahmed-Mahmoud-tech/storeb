const axios = require('axios');

const BASE_URL = 'http://localhost:8000/api';

// Test data
const testUserId = 'a6a8fc9a-7bb4-40c2-b6e5-9cf5f889b4b5'; // Use a valid user ID from your database

async function testPhoneSeparation() {
  try {
    console.log('\n=== Testing Phone Separation Fix ===\n');

    // Step 1: Create a test user update with separated phone and country_code
    console.log('Step 1: Updating user with separated phone and country_code...');
    const updateResponse = await axios.patch(
      `${BASE_URL}/user/${testUserId}`,
      {
        name: 'Test User',
        phone: '11114444', // Just the phone number, no country code
        country_code: '+20', // Country code separate
        country: 'Egypt',
      }
    );
    console.log('✅ Update successful');
    console.log('Response data:', JSON.stringify(updateResponse.data, null, 2));

    // Step 2: Get the user data and verify phone and country_code are separate
    console.log('\nStep 2: Fetching user to verify separated phone and country_code...');
    const getResponse = await axios.get(`${BASE_URL}/user/${testUserId}`);
    console.log('✅ Fetch successful');
    
    const { phone, country_code } = getResponse.data;
    console.log(`\nPhone value: "${phone}"`);
    console.log(`Country code value: "${country_code}"`);

    // Verify separation
    if (phone && !phone.startsWith('+')) {
      console.log('✅ Phone is separated (no country code prefix)');
    } else {
      console.log('❌ ERROR: Phone still contains country code!');
    }

    if (country_code && country_code.startsWith('+')) {
      console.log('✅ Country code is properly stored with + prefix');
    } else {
      console.log('❌ ERROR: Country code format is incorrect!');
    }

    console.log('\n=== Test Complete ===\n');
  } catch (error) {
    console.error('❌ Error during test:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testPhoneSeparation();
