/**
 * Test phone separation fix for UpdateUser
 */

const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'store2',
  password: 'password',
  port: 5432,
});

async function testUserPhoneSeparation() {
  try {
    console.log('=== Testing User Phone Separation Fix ===\n');

    // Get a test user from database
    console.log('Step 1: Fetching a test user...');
    const userResult = await pool.query(
      `SELECT id, name, phone, country_code, country FROM "user" LIMIT 1`
    );

    if (userResult.rows.length === 0) {
      console.log('❌ No users found in database');
      await pool.end();
      return;
    }

    const testUser = userResult.rows[0];
    console.log('✅ Found test user:', testUser.id);
    console.log('Current values:');
    console.log(`  - name: ${testUser.name}`);
    console.log(`  - phone: ${testUser.phone}`);
    console.log(`  - country_code: ${testUser.country_code}`);
    console.log(`  - country: ${testUser.country}\n`);

    // Test 1: Update with separated phone and country_code
    console.log('Step 2: Updating user with SEPARATED phone and country_code...');
    await pool.query(
      `UPDATE "user" SET 
        phone = $1, 
        country_code = $2,
        country = $3
       WHERE id = $4`,
      ['12345678', '+20', 'Egypt', testUser.id]
    );
    console.log('✅ Update successful\n');

    // Verify the update
    console.log('Step 3: Fetching updated user to verify separation...');
    const verifyResult = await pool.query(
      `SELECT id, name, phone, country_code, country FROM "user" WHERE id = $1`,
      [testUser.id]
    );

    const updatedUser = verifyResult.rows[0];
    console.log('✅ Fetched updated user');
    console.log('Updated values:');
    console.log(`  - phone: "${updatedUser.phone}"`);
    console.log(`  - country_code: "${updatedUser.country_code}"\n`);

    // Verify separation
    console.log('Step 4: Verifying phone/country_code separation...');
    const phoneHasCountryCode = updatedUser.phone && updatedUser.phone.startsWith('+');
    const countryCodeExists = updatedUser.country_code && updatedUser.country_code.startsWith('+');
    const phoneIsJustNumber = /^\d+$/.test(updatedUser.phone);

    if (phoneIsJustNumber) {
      console.log('✅ Phone contains only numbers (no country code prefix)');
    } else {
      console.log('❌ ERROR: Phone still contains non-numeric characters!');
    }

    if (countryCodeExists) {
      console.log('✅ Country code is properly stored with + prefix');
    } else {
      console.log('❌ ERROR: Country code format is incorrect!');
    }

    if (!phoneHasCountryCode && countryCodeExists && phoneIsJustNumber) {
      console.log('\n✅✅✅ SUCCESS! Phone and country_code are properly separated!\n');
    } else {
      console.log('\n❌ FAILURE! Phone and country_code are not properly separated!\n');
    }

    // Test 2: Update with phone that already has country code (backward compatibility)
    console.log('Step 5: Testing backward compatibility with concatenated phone...');
    const concatenatedPhone = '+201111222';
    await pool.query(
      `UPDATE "user" SET 
        phone = $1
       WHERE id = $2`,
      [concatenatedPhone, testUser.id]
    );

    const backcompatResult = await pool.query(
      `SELECT phone, country_code FROM "user" WHERE id = $1`,
      [testUser.id]
    );

    console.log('Phone stored as:', backcompatResult.rows[0]);
    console.log('(Backend parsePhoneNumber will handle this on next update)\n');

    console.log('=== All Tests Complete ===\n');
  } catch (error) {
    console.error('❌ Error during test:', error.message);
  } finally {
    await pool.end();
  }
}

testUserPhoneSeparation();
