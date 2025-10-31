const { Client } = require('pg');

// Local database (source)
const localConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'store2',
};

// Production database (target) - uses Railway environment variable
const prodConfig = process.env.DATABASE_PUBLIC_URL
  ? { connectionString: process.env.DATABASE_PUBLIC_URL }
  : {
      host: 'yamanote.proxy.rlwy.net',
      port: 48091,
      user: 'postgres',
      password: 'mzAYsKPjCuqPyMKWIbKcuxfPRJPYDpeq',
      database: 'railway',
    };

async function transferDatabase() {
  const localClient = new Client(localConfig);
  const prodClient = new Client(prodConfig);

  try {
    console.log('🔄 Starting database transfer...\n');

    // Connect to both databases
    console.log('Connecting to local database...');
    await localClient.connect();
    console.log('✓ Connected to local\n');

    console.log('Connecting to production database...');
    await prodClient.connect();
    console.log('✓ Connected to production\n');

    // Get tables from local
    const tablesResult = await localClient.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    const tables = tablesResult.rows.map((r) => r.tablename);
    console.log(`Found ${tables.length} tables: ${tables.join(', ')}\n`);

    // Disable foreign key checks on production
    await prodClient.query('SET session_replication_role = replica;');

    // Clear and transfer data for each table
    for (const tablename of tables) {
      console.log(`📦 ${tablename}...`);

      // Clear production table
      await prodClient.query(`TRUNCATE TABLE "${tablename}" CASCADE;`);

      // Get data from local
      const data = await localClient.query(`SELECT * FROM "${tablename}";`);
      console.log(`   Found ${data.rows.length} rows`);

      if (data.rows.length > 0) {
        const columns = Object.keys(data.rows[0]);
        const columnNames = columns.map((col) => `"${col}"`).join(', ');

        // Insert each row
        for (let i = 0; i < data.rows.length; i++) {
          const row = data.rows[i];
          const values = columns.map((col) => row[col]);
          const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');

          await prodClient.query(
            `INSERT INTO "${tablename}" (${columnNames}) VALUES (${placeholders})`,
            values
          );
        }
        console.log(`   ✓ Inserted ${data.rows.length} rows`);
      }
    }

    // Re-enable foreign key checks
    await prodClient.query('SET session_replication_role = DEFAULT;');

    // Update sequences
    console.log('\n🔢 Updating sequences...');
    for (const tablename of tables) {
      const seqs = await prodClient.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1 AND column_default LIKE 'nextval%';
      `,
        [tablename]
      );

      for (const { column_name } of seqs.rows) {
        try {
          await prodClient.query(
            `
            SELECT setval(
              pg_get_serial_sequence($1, $2),
              COALESCE((SELECT MAX("${column_name}") FROM "${tablename}"), 1),
              true
            );
          `,
            [tablename, column_name]
          );
        } catch (err) {
          // Ignore sequence errors
        }
      }
    }

    console.log('\n✅ Database transfer completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await localClient.end();
    await prodClient.end();
  }
}

transferDatabase();

// railway run node sync-db.js
