const { Client } = require('pg');

async function testTracking() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'store2',
    user: 'postgres',
    password: 'password',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Get a real user, store, and product
    const user = await client.query(`SELECT id FROM "user" WHERE type = 'owner' LIMIT 1`);
    const store = await client.query(`SELECT id FROM store LIMIT 1`);
    const product = await client.query(`SELECT product_code FROM product LIMIT 1`);

    if (user.rows.length === 0 || store.rows.length === 0 || product.rows.length === 0) {
      console.log('❌ Missing test data');
      console.log('User:', user.rows.length);
      console.log('Store:', store.rows.length);
      console.log('Product:', product.rows.length);
      return;
    }

    console.log('\n📝 Test Data:');
    console.log('User ID:', user.rows[0].id);
    console.log('Store ID:', store.rows[0].id);
    console.log('Product Code:', product.rows[0].product_code);

    // Insert a test tracking record
    console.log('\n🧪 Inserting test tracking record...');
    const result = await client.query(`
      INSERT INTO user_actions (user_id, action_type, store_id, product_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `, [
      user.rows[0].id,
      'product_favorite',
      store.rows[0].id,
      product.rows[0].product_code,
      JSON.stringify({ manual_test: true, timestamp: new Date().toISOString() })
    ]);

    console.log('✅ Record inserted successfully!');
    console.log('Record:', result.rows[0]);

    // Verify it's in the database
    const verify = await client.query(`
      SELECT * FROM user_actions WHERE id = $1
    `, [result.rows[0].id]);

    console.log('\n✅ Verification:');
    console.log('Found:', verify.rows.length, 'record(s)');

    // Count all records
    const count = await client.query(`SELECT COUNT(*) as total FROM user_actions`);
    console.log('\n📊 Total records in user_actions table:', count.rows[0].total);

    // Show recent records
    const recent = await client.query(`
      SELECT id, action_type, created_at, product_id, store_id 
      FROM user_actions 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    console.log('\n📋 Recent actions:');
    recent.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.action_type} - ${row.created_at} (Product: ${row.product_id}, Store: ${row.store_id})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

testTracking();
