const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'store2',
  password: 'password',
  port: 5432,
});

async function removeCountryColumn() {
  try {
    console.log('Removing country column from user table...');
    
    await pool.query('ALTER TABLE "user" DROP COLUMN IF EXISTS country CASCADE');
    
    console.log('✅ Successfully dropped country column from user table');
  } catch (error) {
    console.error('❌ Error removing country column:', error.message);
  } finally {
    await pool.end();
  }
}

removeCountryColumn();
