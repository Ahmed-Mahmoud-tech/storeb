const { Client } = require('pg');

async function fixDatabase() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'store2',
    user: 'postgres',
    password: 'password',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if table exists
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_actions'
      );
    `);

    if (checkTable.rows[0].exists) {
      console.log('📋 Table user_actions exists, checking structure...');
      
      // Check product_id column type
      const checkColumn = await client.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_actions' AND column_name = 'product_id';
      `);
      
      if (checkColumn.rows.length > 0) {
        console.log(`   product_id column type: ${checkColumn.rows[0].data_type}`);
        
        if (checkColumn.rows[0].data_type === 'uuid') {
          console.log('🔧 Fixing product_id column type from uuid to varchar...');
          
          // Drop foreign key constraint if exists
          await client.query(`
            ALTER TABLE user_actions 
            DROP CONSTRAINT IF EXISTS "FK_user_actions_product";
          `);
          
          // Change column type
          await client.query(`
            ALTER TABLE user_actions 
            ALTER COLUMN product_id TYPE VARCHAR(50);
          `);
          
          // Recreate foreign key
          await client.query(`
            ALTER TABLE user_actions 
            ADD CONSTRAINT "FK_user_actions_product" 
            FOREIGN KEY (product_id) REFERENCES product(product_code) 
            ON DELETE CASCADE;
          `);
          
          console.log('✅ Fixed product_id column type');
        }
      }
      
      // Check id column
      const checkIdColumn = await client.query(`
        SELECT column_default 
        FROM information_schema.columns 
        WHERE table_name = 'user_actions' AND column_name = 'id';
      `);
      
      if (checkIdColumn.rows.length > 0) {
        console.log(`   id column default: ${checkIdColumn.rows[0].column_default}`);
        
        if (!checkIdColumn.rows[0].column_default || !checkIdColumn.rows[0].column_default.includes('uuid_generate_v4')) {
          console.log('🔧 Fixing id column to auto-generate UUIDs...');
          
          await client.query(`
            ALTER TABLE user_actions 
            ALTER COLUMN id SET DEFAULT uuid_generate_v4();
          `);
          
          console.log('✅ Fixed id column default');
        }
      }
      
    } else {
      console.log('📋 Table user_actions does not exist, creating...');
      
      // Create table
      await client.query(`
        CREATE TABLE user_actions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL,
          action_type VARCHAR(50) NOT NULL,
          store_id UUID,
          product_id VARCHAR(50),
          metadata JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ip_address VARCHAR(50),
          user_agent TEXT,
          CONSTRAINT "FK_user_actions_user" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT "FK_user_actions_store" FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE CASCADE,
          CONSTRAINT "FK_user_actions_product" FOREIGN KEY (product_id) REFERENCES product(product_code) ON DELETE CASCADE
        );
      `);
      
      console.log('✅ Created user_actions table');
      
      // Create indexes
      await client.query(`
        CREATE INDEX idx_user_actions_user_id ON user_actions(user_id);
        CREATE INDEX idx_user_actions_store_id ON user_actions(store_id);
        CREATE INDEX idx_user_actions_product_id ON user_actions(product_id);
        CREATE INDEX idx_user_actions_action_type ON user_actions(action_type);
        CREATE INDEX idx_user_actions_created_at ON user_actions(created_at);
      `);
      
      console.log('✅ Created indexes');
    }

    // Show table structure
    const structure = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'user_actions'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📊 Final table structure:');
    structure.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} ${row.column_default ? `(default: ${row.column_default})` : ''} ${row.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    // Test inserting a record
    console.log('\n🧪 Testing insert...');
    try {
      const testUser = await client.query(`SELECT id FROM "user" LIMIT 1`);
      const testStore = await client.query(`SELECT id FROM store LIMIT 1`);
      const testProduct = await client.query(`SELECT product_code FROM product LIMIT 1`);
      
      if (testUser.rows.length > 0 && testStore.rows.length > 0 && testProduct.rows.length > 0) {
        const testInsert = await client.query(`
          INSERT INTO user_actions (user_id, action_type, store_id, product_id, metadata)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id;
        `, [
          testUser.rows[0].id,
          'product_favorite',
          testStore.rows[0].id,
          testProduct.rows[0].product_code,
          { test: true }
        ]);
        
        console.log(`✅ Test insert successful! ID: ${testInsert.rows[0].id}`);
        
        // Clean up test record
        await client.query(`DELETE FROM user_actions WHERE id = $1`, [testInsert.rows[0].id]);
        console.log('✅ Test record cleaned up');
      } else {
        console.log('⚠️  Could not test insert - missing test data (users, store, or product)');
      }
    } catch (testError) {
      console.log('⚠️  Could not run test insert:', testError.message);
    }

    console.log('\n✅ Database fix completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

fixDatabase();
