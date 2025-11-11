const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'store2',
});

async function fixRecord() {
  try {
    await client.connect();

    const result = await client.query(
      'UPDATE user_actions SET store_id = $1 WHERE action_type = $2 AND store_id IS NULL',
      ['4ccd6ca7-fccc-4d58-8555-4da4db8c5aa2', 'store_details_open']
    );

    console.log(`✓ Updated ${result.rowCount} records`);

    // Verify
    const check = await client.query(
      'SELECT id, store_id, action_type FROM user_actions WHERE action_type = $1 LIMIT 1',
      ['store_details_open']
    );

    if (check.rows.length > 0) {
      console.log(`✓ Verified: store_id = ${check.rows[0].store_id}`);
    }

    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

fixRecord();
