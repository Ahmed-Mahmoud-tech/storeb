import { AppDataSource } from './data-source';

async function verifyMigration() {
  try {
    await AppDataSource.initialize();
    console.log('Connected to database');
    
    // Check if address column is nullable
    const result = await AppDataSource.query(
      `SELECT is_nullable FROM information_schema.columns WHERE table_name='branches' AND column_name='address'`
    );
    
    if (result.length > 0) {
      const isNullable = result[0].is_nullable === 'YES';
      console.log(`\nAddress column nullable: ${isNullable}`);
      
      if (isNullable) {
        console.log('✅ SUCCESS: Migration has been applied correctly!');
        console.log('Branches can now be created without location information.');
      } else {
        console.log('❌ FAILED: Address column is still NOT NULL');
        console.log('Migration may not have been applied.');
      }
    } else {
      console.log('❌ Could not find address column');
    }
    
    // Check migration history
    const migrations = await AppDataSource.query(
      `SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 5`
    );
    
    console.log('\nLast 5 migrations executed:');
    migrations.forEach((m: any) => {
      console.log(`- ${m.name} (${m.timestamp})`);
    });
    
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verifyMigration();
