/**
 * Test with exact user payload to debug the error
 */

const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'store2',
  password: 'password',
  port: 5432,
});

async function testUserPayload() {
  try {
    console.log('=== Testing with Exact User Payload ===\n');

    // Get the store from the user's payload
    const storeResult = await pool.query(
      `SELECT id FROM store WHERE id = (SELECT store_id FROM branches WHERE id = '6111874b-b7bd-4e50-ab9c-57ceb4104871')`
    );

    if (storeResult.rows.length === 0) {
      console.error('❌ Store not found');
      process.exit(1);
    }

    const storeId = storeResult.rows[0].id;
    console.log(`✓ Store found: ${storeId}\n`);

    // User's exact payload - branch 1
    const branch1 = {
      id: '80768971-a9ca-428b-bc66-351b91609df9',
      supportNumbers: [
        { countryCode: '+20', phone: '11114444', whatsapp: false }
      ]
    };

    // User's exact payload - branch 2
    const branch2 = {
      id: '6111874b-b7bd-4e50-ab9c-57ceb4104871',
      supportNumbers: [
        { countryCode: '+966', phone: '55555', whatsapp: false },
        { countryCode: '+971', phone: '66666', whatsapp: true }
      ]
    };

    console.log('Test 1: Update branch 1 (sidigaber)...');
    const supportArray1 = branch1.supportNumbers.map((support) => ({
      country_code: support.countryCode || '+20',
      phone: support.phone || '',
      type: support.whatsapp ? 'whatsapp' : 'phone',
    }));

    console.log('Data to insert:', JSON.stringify(supportArray1));

    try {
      const result1 = await pool.query(
        `UPDATE branches SET customer_support = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [JSON.stringify(supportArray1), branch1.id]
      );
      console.log('✓ Branch 1 updated successfully\n');
    } catch (err) {
      console.error('❌ Branch 1 update failed:', err.message);
      console.error('SQL:', `UPDATE branches SET customer_support = '${JSON.stringify(supportArray1)}'::jsonb WHERE id = '${branch1.id}'`);
    }

    console.log('Test 2: Update branch 2 (main branch)...');
    const supportArray2 = branch2.supportNumbers.map((support) => ({
      country_code: support.countryCode || '+20',
      phone: support.phone || '',
      type: support.whatsapp ? 'whatsapp' : 'phone',
    }));

    console.log('Data to insert:', JSON.stringify(supportArray2));

    try {
      const result2 = await pool.query(
        `UPDATE branches SET customer_support = $1::jsonb, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [JSON.stringify(supportArray2), branch2.id]
      );
      console.log('✓ Branch 2 updated successfully\n');
    } catch (err) {
      console.error('❌ Branch 2 update failed:', err.message);
      console.error('SQL:', `UPDATE branches SET customer_support = '${JSON.stringify(supportArray2)}'::jsonb WHERE id = '${branch2.id}'`);
    }

    // Verify final state
    console.log('Verifying final state...');
    const finalResult = await pool.query(
      `SELECT id, name, customer_support FROM branches WHERE id IN ($1, $2)`,
      [branch1.id, branch2.id]
    );

    finalResult.rows.forEach(row => {
      console.log(`\nBranch: ${row.name}`);
      console.log('Support numbers:');
      row.customer_support.forEach((num, idx) => {
        console.log(`  ${idx + 1}. ${num.country_code}${num.phone} (${num.type})`);
      });
    });

    console.log('\n✅ All tests passed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testUserPayload();
