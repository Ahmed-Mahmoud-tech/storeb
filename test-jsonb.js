const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'store2',
  password: 'password',
  port: 5432,
});

async function testJSONB() {
  try {
    console.log('Testing JSONB insertion...\n');

    // First, check if a valid store exists
    console.log('Looking for a valid store...');
    const storeResult = await pool.query(`SELECT id FROM store LIMIT 1`);
    if (storeResult.rows.length === 0) {
      console.log('No stores found, creating test data...');
      await pool.query(`
        INSERT INTO store (id, name, owner_id) 
        VALUES ('00000000-0000-0000-0000-000000000001', 'TestStore', '55a832c7-5f02-4da1-a697-5c7762cd6ea3')
      `).catch(() => {});
    }

    const storeId = storeResult.rows[0]?.id || '00000000-0000-0000-0000-000000000001';

    // Test 1: Insert direct object
    console.log('Test 1: Inserting JSONB as direct object...');
    const testArray = [
      {
        country_code: '+966',
        phone: '77777',
        type: 'phone'
      }
    ];

    try {
      const result = await pool.query(
        `INSERT INTO branches (id, store_id, name, address, customer_support, is_online) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          '12345678-1234-1234-1234-123456789012',
          storeId,
          'Test Branch',
          'Test Address',
          JSON.stringify(testArray),  // Convert to JSON string
          true
        ]
      );
      console.log('✓ Success! Inserted:', result.rows[0].customer_support);
    } catch (err) {
      console.error('✗ Failed:', err.message);
    }

    // Test 2: Check what's in the database
    console.log('\nTest 2: Checking data type in database...');
    const checkResult = await pool.query(`
      SELECT 
        column_name,
        data_type,
        udt_name
      FROM information_schema.columns
      WHERE table_name = 'branches' AND column_name = 'customer_support'
    `);
    console.log('Column info:', checkResult.rows[0]);

    // Test 3: Query the data back
    console.log('\nTest 3: Querying data back...');
    const queryResult = await pool.query(`
      SELECT id, customer_support FROM branches WHERE id = '12345678-1234-1234-1234-123456789012'
    `);
    if (queryResult.rows.length > 0) {
      console.log('✓ Data retrieved:', JSON.stringify(queryResult.rows[0], null, 2));
    }

    await pool.end();
    console.log('\n✅ JSONB tests completed');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testJSONB();
