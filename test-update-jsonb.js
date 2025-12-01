/**
 * Test script to verify the UPDATE branch flow with JSONB data
 */

const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'store2',
  password: 'password',
  port: 5432,
});

async function testUpdateBranchFlow() {
  try {
    console.log('=== Testing Branch UPDATE with JSONB Support Numbers ===\n');

    // 1. Get an existing branch
    console.log('Step 1: Getting an existing branch...');
    const branchResult = await pool.query(
      `SELECT id, customer_support FROM branches WHERE store_id IS NOT NULL LIMIT 1`
    );
    
    if (branchResult.rows.length === 0) {
      console.error('❌ No branches found in database');
      process.exit(1);
    }
    
    const branchId = branchResult.rows[0].id;
    console.log(`✓ Using branch: ${branchId}`);
    console.log(`  Current support data:`, JSON.stringify(branchResult.rows[0].customer_support, null, 2));

    // 2. Test data - exact format from user's payload for UPDATE
    console.log('\nStep 2: Preparing update data...');
    const supportNumbers = [
      { countryCode: '+966', phone: '55555', whatsapp: false },
      { countryCode: '+971', phone: '66666', whatsapp: true }
    ];

    // Transform to database format
    const customerSupportData = supportNumbers.map((support) => ({
      country_code: support.countryCode || '+20',
      phone: support.phone || '',
      type: support.whatsapp ? 'whatsapp' : 'phone',
    }));

    console.log('Data to update:', JSON.stringify(customerSupportData, null, 2));

    // 3. Test raw SQL update (what our fixed code uses)
    console.log('\nStep 3: Updating JSONB column with raw SQL...');
    
    try {
      const updateResult = await pool.query(
        `UPDATE branches SET customer_support = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [JSON.stringify(customerSupportData), branchId]
      );

      console.log('✓ Update successful!\n');
      console.log('Updated branch:');
      console.log(JSON.stringify(updateResult.rows[0], null, 2));
    } catch (err) {
      console.error('❌ Update failed:', err.message);
      console.error('Error details:', err);
      process.exit(1);
    }

    // 4. Verify data retrieval
    console.log('\nStep 4: Verifying updated data...');
    const queryResult = await pool.query(
      `SELECT id, customer_support FROM branches WHERE id = $1`,
      [branchId]
    );

    if (queryResult.rows.length === 0) {
      console.error('❌ Branch not found after update!');
      process.exit(1);
    }

    const retrievedData = queryResult.rows[0];
    console.log('✓ Data retrieved successfully:');
    console.log(JSON.stringify(retrievedData, null, 2));

    // 5. Verify the structure
    console.log('\nStep 5: Verifying data structure...');
    const data = retrievedData.customer_support;
    
    if (!Array.isArray(data)) {
      console.error('❌ customer_support is not an array!');
      process.exit(1);
    }
    
    if (data.length !== 2) {
      console.error(`❌ Expected 2 items, got ${data.length}`);
      process.exit(1);
    }

    // Check each item
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (!item.country_code || !item.phone || !item.type) {
        console.error(`❌ Item ${i} is missing required fields:`, item);
        process.exit(1);
      }
    }

    console.log('✓ Data structure is valid');
    console.log(`  - Item 0: ${data[0].country_code} ${data[0].phone} (${data[0].type})`);
    console.log(`  - Item 1: ${data[1].country_code} ${data[1].phone} (${data[1].type})`);

    console.log('\n✅ All tests passed! The UPDATE JSONB fix is working correctly.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testUpdateBranchFlow();
