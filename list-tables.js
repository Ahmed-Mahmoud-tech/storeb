const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'store2',
});

async function listTables() {
  try {
    await client.connect();

    const result = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);

    console.log('📋 Tables in database:');
    result.rows.forEach((row) => {
      console.log(`  - ${row.tablename}`);
    });

    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listTables();
