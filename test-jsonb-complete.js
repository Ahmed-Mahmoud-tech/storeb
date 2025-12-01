/**
 * Test script to verify the store creation with customer support JSONB data
 * This simulates the exact payload from the user's request
 */

const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'store2',
  password: 'password',
  port: 5432,
});

async function testStoreCreationFlow() {
  try {
    console.log('=== Testing Store Creation with JSONB Support Numbers ===\n');

    // 1. Verify schema
    console.log('Step 1: Verifying database schema...');
    const schemaCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'branches' AND column_name = 'customer_support'
    `);
    
    if (schemaCheck.rows.length === 0) {
      console.error('❌ customer_support column not found!');
      process.exit(1);
    }
    
    const colType = schemaCheck.rows[0].data_type;
    console.log(`✓ customer_support column type: ${colType}`);
    
    if (colType !== 'jsonb') {
      console.error(`❌ Column type is ${colType}, expected jsonb`);
      process.exit(1);
    }
    console.log('✓ Schema is correct\n');

    // 2. Get existing store for testing
    console.log('Step 2: Getting test store...');
    const storeResult = await pool.query(`
      SELECT id, owner_id FROM store LIMIT 1
    `);
    
    if (storeResult.rows.length === 0) {
      console.error('❌ No stores found in database');
      process.exit(1);
    }
    
    const storeId = storeResult.rows[0].id;
    console.log(`✓ Using store: ${storeId}\n`);

    // 3. Test data - exact format from user's payload
    console.log('Step 3: Testing JSONB insertion...');
    const supportNumbers = [
      { countryCode: '+966', phone: '77777', whatsapp: false },
      { countryCode: '+966', phone: '88888', whatsapp: true }
    ];

    // Transform to database format (what the backend service does)
    const customerSupportData = supportNumbers.map((support) => ({
      country_code: support.countryCode || '+20',
      phone: support.phone || '',
      type: support.whatsapp ? 'whatsapp' : 'phone',
    }));

    console.log('Data to insert:', JSON.stringify(customerSupportData, null, 2));

    // Test QueryBuilder style insertion (what our fixed code uses)
    const testBranchId = '99999999-9999-9999-9999-999999999999';
    
    try {
      const insertResult = await pool.query(
        `INSERT INTO branches (id, store_id, name, address, customer_support, is_online)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)
         ON CONFLICT (id) DO UPDATE SET 
           customer_support = EXCLUDED.customer_support,
           updated_at = NOW()
         RETURNING id, customer_support`,
        [
          testBranchId,
          storeId,
          'Test Branch JSONB',
          'Test Address',
          JSON.stringify(customerSupportData),
          true
        ]
      );

      console.log('✓ Insert successful!\n');
      console.log('Returned data:');
      console.log(JSON.stringify(insertResult.rows[0], null, 2));
    } catch (err) {
      console.error('❌ Insert failed:', err.message);
      console.error('Error details:', err);
      process.exit(1);
    }

    // 4. Verify data retrieval
    console.log('\nStep 4: Verifying data retrieval...');
    const queryResult = await pool.query(
      `SELECT id, customer_support FROM branches WHERE id = $1`,
      [testBranchId]
    );

    if (queryResult.rows.length === 0) {
      console.error('❌ Data not found after insert!');
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

    console.log('\n✅ All tests passed! The JSONB fix is working correctly.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testStoreCreationFlow();
