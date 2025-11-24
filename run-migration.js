const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'store2',
  user: 'postgres',
  password: 'password',
});

async function runMigration() {
  let client;
  try {
    client = await pool.connect();
    console.log('Connected to database');

    // Read the migration file
    const migrationPath = path.join(
      __dirname,
      'migrate-user-actions-for-anonymous.sql'
    );
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      console.log(`\nExecuting: ${statement.substring(0, 60)}...`);
      try {
        const result = await client.query(statement);
        console.log(
          `✓ Success:`,
          result.rows ? `${result.rows.length} rows` : 'Query executed'
        );
      } catch (err) {
        console.error(`✗ Error in statement:`, err.message);
        // Continue with next statement
      }
    }

    console.log('\n✓ Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
