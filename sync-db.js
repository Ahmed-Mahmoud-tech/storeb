const { Client } = require('pg');

// Local database (source)
const localConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'store2',
};

// Production database (target) - uses Railway public URL for external access
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

  const transferStats = {
    totalTables: 0,
    successfulTables: [],
    failedTables: [],
    verificationResults: [],
  };

  try {
    console.log('🔄 Starting database transfer...\n');

    // Connect to both databases
    console.log('Connecting to local database...');
    console.log(`   Host: ${localConfig.host}:${localConfig.port}`);
    console.log(`   Database: ${localConfig.database}\n`);
    await localClient.connect();
    console.log('✓ Connected to local\n');

    console.log('Connecting to production database...');
    if (prodConfig.connectionString) {
      console.log(`   Using connection string from DATABASE_PUBLIC_URL`);
    } else {
      console.log(`   Host: ${prodConfig.host}:${prodConfig.port}`);
      console.log(`   Database: ${prodConfig.database}`);
    }
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
    transferStats.totalTables = tables.length;
    console.log(`Found ${tables.length} tables: ${tables.join(', ')}\n`);

    // Disable foreign key checks on production
    await prodClient.query('SET session_replication_role = replica;');

    // Start a transaction
    await prodClient.query('BEGIN;');

    // First, truncate all tables at once to avoid cascade issues
    console.log('🗑️  Truncating all tables...');
    for (const tablename of tables) {
      await prodClient.query(`TRUNCATE TABLE "${tablename}" CASCADE;`);
      console.log(`   ✓ Truncated ${tablename}`);
    }
    console.log('');

    // Clear and transfer data for each table
    for (const tablename of tables) {
      try {
        console.log(`📦 ${tablename}...`);

        // Get data from local
        const localData = await localClient.query(
          `SELECT * FROM "${tablename}";`
        );
        const localRowCount = localData.rows.length;
        console.log(`   Found ${localRowCount} rows in local`);

        if (localRowCount > 0) {
          const columns = Object.keys(localData.rows[0]);
          const columnNames = columns.map((col) => `"${col}"`).join(', ');

          // Insert each row
          let insertedCount = 0;
          for (let i = 0; i < localData.rows.length; i++) {
            const row = localData.rows[i];
            const values = columns.map((col) => row[col]);
            const placeholders = values
              .map((_, idx) => `$${idx + 1}`)
              .join(', ');

            await prodClient.query(
              `INSERT INTO "${tablename}" (${columnNames}) VALUES (${placeholders})`,
              values
            );
            insertedCount++;
          }
          console.log(`   ✓ Inserted ${insertedCount} rows`);
        }

        // Verify the transfer within the transaction
        const prodData = await prodClient.query(
          `SELECT COUNT(*) FROM "${tablename}";`
        );
        const prodRowCount = parseInt(prodData.rows[0].count);

        console.log(`   📊 In-transaction count: ${prodRowCount} rows`);

        if (localRowCount === prodRowCount) {
          console.log(`   ✓ Verification passed (in transaction)`);
          transferStats.successfulTables.push(tablename);
          transferStats.verificationResults.push({
            table: tablename,
            status: 'SUCCESS',
            localRows: localRowCount,
            prodRows: prodRowCount,
          });
        } else {
          console.log(
            `   ⚠️  Verification failed: Expected ${localRowCount} rows, found ${prodRowCount}`
          );
          transferStats.failedTables.push(tablename);
          transferStats.verificationResults.push({
            table: tablename,
            status: 'MISMATCH',
            localRows: localRowCount,
            prodRows: prodRowCount,
          });
        }
      } catch (error) {
        console.error(
          `   ❌ Error transferring ${tablename}: ${error.message}`
        );
        transferStats.failedTables.push(tablename);
        transferStats.verificationResults.push({
          table: tablename,
          status: 'ERROR',
          error: error.message,
        });
      }
    }

    // Commit the transaction
    await prodClient.query('COMMIT;');
    console.log('\n✓ Transaction committed\n');

    // Re-enable foreign key checks
    await prodClient.query('SET session_replication_role = DEFAULT;');

    // Verify data persists after commit
    console.log('🔍 Verifying data persistence after commit...');
    for (const tablename of tables) {
      const result = await prodClient.query(
        `SELECT COUNT(*) FROM "${tablename}";`
      );
      const count = parseInt(result.rows[0].count);
      console.log(`   ${tablename.padEnd(30)} ${count} rows`);
    }
    console.log('');

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

    // Print comprehensive summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TRANSFER SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total tables: ${transferStats.totalTables}`);
    console.log(`✓ Successful: ${transferStats.successfulTables.length}`);
    console.log(`✗ Failed: ${transferStats.failedTables.length}`);
    console.log('='.repeat(60));

    if (transferStats.successfulTables.length > 0) {
      console.log('\n✅ Successfully transferred tables:');
      transferStats.verificationResults
        .filter((r) => r.status === 'SUCCESS')
        .forEach((r) => {
          console.log(`   ✓ ${r.table}: ${r.localRows} rows`);
        });
    }

    if (transferStats.failedTables.length > 0) {
      console.log('\n❌ Failed or mismatched tables:');
      transferStats.verificationResults
        .filter((r) => r.status !== 'SUCCESS')
        .forEach((r) => {
          if (r.status === 'MISMATCH') {
            console.log(
              `   ✗ ${r.table}: Expected ${r.localRows} rows, found ${r.prodRows} rows`
            );
          } else {
            console.log(`   ✗ ${r.table}: ${r.error}`);
          }
        });
      console.log('\n⚠️  Some tables failed to transfer correctly!');
      process.exit(1);
    }

    console.log('\n✅ Database transfer completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    try {
      await prodClient.query('ROLLBACK;');
      console.log('Transaction rolled back');
    } catch (rollbackError) {
      // Ignore rollback errors
    }
    process.exit(1);
  } finally {
    await localClient.end();
    await prodClient.end();
  }
}

transferDatabase();

// railway run node sync-db.js
