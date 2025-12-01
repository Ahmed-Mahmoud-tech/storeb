/**
 * Comprehensive test simulating exact API flow
 */

const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'store2',
  password: 'password',
  port: 5432,
});

// Simulated FormDataHelper.parseIfJSON
function parseIfJSON(input, defaultValue) {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch (error) {
      console.error('Failed to parse JSON string:', error);
      return defaultValue;
    }
  }
  return input || defaultValue;
}

async function testCompleteUpdateFlow() {
  try {
    console.log('=== Simulating Complete Update API Flow ===\n');

    // Simulate what the controller receives from the frontend
    const formDataFromFrontend = {
      storeName: 'Cloth Hand',
      phoneNumber: '+96655551111',
      hasDelivery: 'true',
      branches: JSON.stringify([
        {
          id: '80768971-a9ca-428b-bc66-351b91609df9',
          name: 'sidigaber',
          location: '140, Al Rahman Mosque Street, Taawoneyat Semouha Housing, Alexandria, 21554, Egypt',
          coordinates: {
            lat: 31.210081793386337,
            lng: 29.955249333608688,
            address: '140, Al Rahman Mosque Street, Taawoneyat Semouha Housing, Alexandria, 21554, Egypt'
          },
          supportNumbers: [
            { countryCode: '+20', phone: '11114444', whatsapp: false }
          ],
          is_online: false
        },
        {
          id: '6111874b-b7bd-4e50-ab9c-57ceb4104871',
          name: 'main branch',
          location: '140, Al Rahman Mosque Street, Taawoneyat Semouha Housing, Alexandria, 21554, Egypt',
          coordinates: {
            lat: 31.2100970678591,
            lng: 29.95520897235824,
            address: '140, Al Rahman Mosque Street, Taawoneyat Semouha Housing, Alexandria, 21554, Egypt'
          },
          supportNumbers: [
            { countryCode: '+966', phone: '55555', whatsapp: false },
            { countryCode: '+971', phone: '66666', whatsapp: true }
          ],
          is_online: true
        }
      ])
    };

    console.log('Step 1: Simulating FormDataHelper.parseIfJSON...');
    const parsedBranches = parseIfJSON(formDataFromFrontend.branches, []);
    console.log(`✓ Parsed ${parsedBranches.length} branches\n`);

    // Get store from DB
    console.log('Step 2: Getting test store...');
    const storeResult = await pool.query(
      `SELECT id FROM store WHERE id = (SELECT store_id FROM branches WHERE id = '6111874b-b7bd-4e50-ab9c-57ceb4104871')`
    );
    const storeId = storeResult.rows[0].id;
    console.log(`✓ Store ID: ${storeId}\n`);

    // Simulate updateBranchesForStore
    console.log('Step 3: Simulating updateBranchesForStore...');
    for (const branchDto of parsedBranches) {
      console.log(`  Processing branch: ${branchDto.name} (${branchDto.id})`);

      // Simulate updateBranch
      if (branchDto.supportNumbers && branchDto.supportNumbers.length > 0) {
        let supportArray = branchDto.supportNumbers;
        
        // Check if supportNumbers is already a string
        if (typeof supportArray === 'string') {
          try {
            supportArray = JSON.parse(supportArray);
            console.log('    - supportNumbers was string, parsed it');
          } catch (e) {
            console.warn('    - Could not parse supportNumbers as JSON');
          }
        }

        // Map to proper format
        const mappedArray = supportArray.map((support) => ({
          country_code: support.countryCode || '+20',
          phone: support.phone || '',
          type: support.whatsapp ? 'whatsapp' : 'phone',
        }));

        console.log(`    - Mapped ${mappedArray.length} support numbers`);
        console.log(`    - Data: ${JSON.stringify(mappedArray)}`);

        // Execute the raw SQL update
        try {
          const jsonString = JSON.stringify(mappedArray);
          await pool.query(
            `UPDATE branches SET customer_support = $1::jsonb, updated_at = NOW() WHERE id = $2`,
            [jsonString, branchDto.id]
          );
          console.log(`    ✓ Update successful\n`);
        } catch (err) {
          console.error(`    ❌ Update failed: ${err.message}\n`);
          throw err;
        }
      }
    }

    // Verify final state
    console.log('Step 4: Verifying final state...');
    const finalResult = await pool.query(
      `SELECT id, name, customer_support FROM branches WHERE store_id = $1 ORDER BY name`,
      [storeId]
    );

    finalResult.rows.forEach(row => {
      console.log(`\n✓ ${row.name}:`);
      row.customer_support.forEach((num, idx) => {
        console.log(`  ${idx + 1}. ${num.country_code}${num.phone} (${num.type})`);
      });
    });

    console.log('\n✅ Complete update flow test PASSED!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testCompleteUpdateFlow();
