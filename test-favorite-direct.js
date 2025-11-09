const { DataSource } = require('typeorm');
require('dotenv').config();

async function testFavoriteTracking() {
  console.log('\n=== TEST: Direct Favorite Creation with Tracking ===\n');

  const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'store2',
    entities: ['dist/src/**/*.model.{ts,js}'],
    synchronize: false,
  });
  
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected');

    // Get test data
    const userResult = await AppDataSource.query(`SELECT id FROM "user" WHERE type = 'owner' LIMIT 1`);
    const productResult = await AppDataSource.query(`SELECT product_code FROM product LIMIT 1`);
    
    if (!userResult.length || !productResult.length) {
      console.log('❌ Missing test data');
      return;
    }

    const userId = userResult[0].id;
    const productCode = productResult[0].product_code;

    console.log(`📝 Test Data:`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Product Code: ${productCode}`);

    // Check current count
    const beforeCount = await AppDataSource.query(`SELECT COUNT(*) as count FROM user_actions WHERE user_id = $1`, [userId]);
    console.log(`\n📊 User actions before favorite: ${beforeCount[0].count}`);

    // Insert favorite manually
    console.log(`\n🧪 Inserting favorite...`);
    const favoriteResult = await AppDataSource.query(
      `INSERT INTO favorite (product, user_id) VALUES ($1, $2) RETURNING id`,
      [productCode, userId]
    );
    const favoriteId = favoriteResult[0].id;
    console.log(`✅ Favorite created with ID: ${favoriteId}`);

    // Check if tracking was recorded
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const afterCount = await AppDataSource.query(`SELECT COUNT(*) as count FROM user_actions WHERE user_id = $1`, [userId]);
    const newActions = await AppDataSource.query(
      `SELECT * FROM user_actions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );

    console.log(`\n📊 User actions after favorite: ${afterCount[0].count}`);
    
    if (newActions.length > beforeCount[0].count) {
      console.log(`✅ NEW TRACKING RECORDS DETECTED!`);
      console.log(`   New actions: ${newActions.length - beforeCount[0].count}`);
      console.log('\n📋 Recent actions:');
      newActions.slice(0, 3).forEach((action, i) => {
        console.log(`   ${i + 1}. ${action.action_type} - ${action.created_at}`);
        console.log(`      Product: ${action.product_id}, Store: ${action.store_id}`);
      });
    } else {
      console.log(`❌ NO NEW TRACKING RECORDS FOUND`);
      console.log(`   Expected action records to be created automatically`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await AppDataSource.destroy();
  }
}

testFavoriteTracking();
