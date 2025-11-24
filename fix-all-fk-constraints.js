const { Client } = require('pg');
require('dotenv').config();

async function checkAndFixConstraints() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'store2',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Get all constraints on user_actions table
    const constraintsQuery = `
      SELECT
        conname AS constraint_name,
        pg_get_constraintdef(oid) AS constraint_def
      FROM pg_constraint
      WHERE conrelid = 'user_actions'::regclass
      AND contype = 'f'
      ORDER BY conname;
    `;

    console.log('\n📋 Current foreign key constraints:');
    const result = await client.query(constraintsQuery);
    result.rows.forEach((row) => {
      console.log(`  ${row.constraint_name}: ${row.constraint_def}`);
    });

    // Drop and recreate the problematic constraint
    console.log('\n🔧 Fixing foreign key constraints...');

    // Get the exact constraint name that's causing issues
    const fkConstraints = result.rows.filter((r) =>
      r.constraint_name.includes('FK')
    );

    for (const constraint of fkConstraints) {
      console.log(`  Dropping: ${constraint.constraint_name}`);
      await client.query(
        `ALTER TABLE user_actions DROP CONSTRAINT IF EXISTS "${constraint.constraint_name}"`
      );
    }

    // Recreate store_id constraint
    console.log('  Creating store_id constraint (nullable, cascading delete)');
    await client.query(`
      ALTER TABLE user_actions
      ADD CONSTRAINT "FK_store_id"
      FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE SET NULL;
    `);

    // Recreate user_id constraint
    console.log('  Creating user_id constraint (nullable, cascading delete)');
    await client.query(`
      ALTER TABLE user_actions
      ADD CONSTRAINT "FK_user_id"
      FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;
    `);

    // Recreate product_id constraint
    console.log(
      '  Creating product_id constraint (nullable, cascading delete)'
    );
    await client.query(`
      ALTER TABLE user_actions
      ADD CONSTRAINT "FK_product_id"
      FOREIGN KEY (product_id) REFERENCES product(product_code) ON DELETE SET NULL;
    `);

    console.log('\n✅ Foreign key constraints fixed successfully');

    // Verify the fix
    console.log('\n📋 Updated constraints:');
    const updatedResult = await client.query(constraintsQuery);
    updatedResult.rows.forEach((row) => {
      console.log(`  ${row.constraint_name}: ${row.constraint_def}`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkAndFixConstraints();
