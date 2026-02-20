import { AppDataSource } from './data-source';

async function runMigrations() {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established');
    
    const migrations = await AppDataSource.runMigrations();
    console.log(`${migrations.length} migration(s) executed successfully`);
    
    await AppDataSource.destroy();
    console.log('Migration completed');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
