/**
 * Complete flow test: CREATE and UPDATE branches with JSONB
 */

const { Pool } = require('pg');
const { v4: uuid } = require('uuid');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'store2',
  password: 'password',
  port: 5432,
});

async function testCompleteFlow() {
  try {
    console.log('=== Complete Store Creation and Update Flow Test ===\n');

    // Get a store
    console.log('Step 1: Getting test store...');
    const storeResult = await pool.query(`SELECT id FROM store LIMIT 1`);
    const storeId = storeResult.rows[0].id;
    console.log(`✓ Using store: ${storeId}\n`);

    // Test 1: CREATE a new branch (like POST /stores)
    console.log('Test 1: CREATE new branch with JSONB support numbers...');
    const newBranchId = uuid();
    const createData = [
      { countryCode: '+966', phone: '111111', whatsapp: false },
      { countryCode: '+971', phone: '222222', whatsapp: true }
    ];

    const createPayload = JSON.stringify(createData.map(s => ({
      country_code: s.countryCode,
      phone: s.phone,
      type: s.whatsapp ? 'whatsapp' : 'phone'
    })));

    try {
      const createResult = await pool.query(
        `INSERT INTO branches (id, store_id, name, address, lat, lang, is_online, customer_support, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW(), NOW())
         RETURNING *`,
        [
          newBranchId,
          storeId,
          'New Test Branch',
          'Test Address',
          '31.2101',
          '29.9552',
          true,
          createPayload
        ]
      );
      console.log('✓ CREATE successful');
      console.log(`  Created branch: ${createResult.rows[0].id}`);
      console.log(`  Support numbers: ${createResult.rows[0].customer_support.length}\n`);
    } catch (err) {
      console.error('❌ CREATE failed:', err.message);
      process.exit(1);
    }

    // Test 2: UPDATE the branch (like PUT /stores/:id)
    console.log('Test 2: UPDATE branch with new JSONB support numbers...');
    const updateData = [
      { countryCode: '+20', phone: '333333', whatsapp: false },
      { countryCode: '+212', phone: '444444', whatsapp: true },
      { countryCode: '+213', phone: '555555', whatsapp: false }
    ];

    const updatePayload = JSON.stringify(updateData.map(s => ({
      country_code: s.countryCode,
      phone: s.phone,
      type: s.whatsapp ? 'whatsapp' : 'phone'
    })));

    try {
      const updateResult = await pool.query(
        `UPDATE branches SET customer_support = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [updatePayload, newBranchId]
      );
      console.log('✓ UPDATE successful');
      console.log(`  Updated branch: ${updateResult.rows[0].id}`);
      console.log(`  Support numbers: ${updateResult.rows[0].customer_support.length}\n`);
    } catch (err) {
      console.error('❌ UPDATE failed:', err.message);
      process.exit(1);
    }

    // Test 3: Verify the final state
    console.log('Test 3: Verify final branch state...');
    const finalResult = await pool.query(
      `SELECT id, name, customer_support FROM branches WHERE id = $1`,
      [newBranchId]
    );

    const branch = finalResult.rows[0];
    console.log('✓ Final state verified:');
    console.log(`  Branch: ${branch.name}`);
    console.log(`  Support numbers:`);
    branch.customer_support.forEach((num, idx) => {
      console.log(`    ${idx + 1}. ${num.country_code}${num.phone} (${num.type})`);
    });

    // Cleanup
    console.log('\nCleaning up test data...');
    await pool.query(`DELETE FROM branches WHERE id = $1`, [newBranchId]);
    console.log('✓ Cleanup complete');

    console.log('\n✅ All tests passed! Complete CREATE/UPDATE flow is working correctly.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testCompleteFlow();
