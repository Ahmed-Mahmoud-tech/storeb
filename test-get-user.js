const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'store2',
  password: 'password',
  port: 5432,
});

async function testGetUser() {
  try {
    console.log('\n=== Testing GET User Endpoint ===\n');

    const userId = '55a832c7-5f02-4da1-a697-5c7762cd6ea3';
    
    console.log(`Fetching user with ID: ${userId}\n`);
    
    const result = await pool.query(
      `SELECT id, name, email, phone, country_code, type, email_verified, created_at, updated_at FROM "user" WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found');
      await pool.end();
      return;
    }

    const user = result.rows[0];
    console.log('✅ User found');
    console.log('\nUser Data (as API would return):');
    console.log(JSON.stringify(user, null, 2));

    // Verify field structure
    console.log('\n✅ Field verification:');
    console.log(`  - id: ${user.id ? '✅ present' : '❌ missing'}`);
    console.log(`  - name: ${user.name ? '✅ present' : '❌ missing'}`);
    console.log(`  - email: ${user.email ? '✅ present' : '❌ missing'}`);
    console.log(`  - phone: ${user.phone ? '✅ present (value: ' + user.phone + ')' : '⚠️  null/empty'}`);
    console.log(`  - country_code: ${user.country_code ? '✅ present (value: ' + user.country_code + ')' : '⚠️  null/empty'}`);
    console.log(`  - type: ${user.type ? '✅ present (value: ' + user.type + ')' : '❌ missing'}`);
    console.log(`  - country: ${user.country ? '❌ SHOULD BE REMOVED' : '✅ removed'}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testGetUser();
