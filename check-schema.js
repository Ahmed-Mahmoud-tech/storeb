const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'store2',
  password: 'password', // Update with actual password
  port: 5432,
});

async function checkSchema() {
  try {
    // Check user table columns
    const userTableResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user'
      ORDER BY ordinal_position;
    `);

    console.log('=== USER TABLE COLUMNS ===');
    userTableResult.rows.forEach((row) => {
      console.log(`${row.column_name}: ${row.data_type}`);
    });

    // Check branches table columns
    const branchesTableResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'branches'
      ORDER BY ordinal_position;
    `);

    console.log('\n=== BRANCHES TABLE COLUMNS ===');
    branchesTableResult.rows.forEach((row) => {
      console.log(`${row.column_name}: ${row.data_type}`);
    });

    // Check sample customer_support data
    const customerSupportResult = await pool.query(`
      SELECT id, customer_support 
      FROM branches 
      WHERE customer_support IS NOT NULL 
      LIMIT 1;
    `);

    console.log('\n=== SAMPLE CUSTOMER SUPPORT DATA ===');
    if (customerSupportResult.rows.length > 0) {
      console.log(JSON.stringify(customerSupportResult.rows[0], null, 2));
    } else {
      console.log('No customer support data found');
    }

    pool.end();
  } catch (err) {
    console.error('Error:', err);
    pool.end();
  }
}

checkSchema();
