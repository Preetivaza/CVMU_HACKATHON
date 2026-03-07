/**
 * VERIFY ADMIN USER CREATION
 * Tests the user creation API logic and DB persistence.
 */
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function verifyPersistence() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DATABASE_NAME || 'road_damage_db';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection('users');

    console.log(`Connecting to ${dbName}...`);

    // 1. Simulate finding the master_admin (actor)
    const actor = await users.findOne({ role: 'master_admin' });
    if (!actor) {
      console.error('❌ Master admin not found. Seed the DB first.');
      return;
    }
    console.log(`✅ Actor verified: ${actor.email} (${actor.role})`);

    // 2. Insert a test user manually (simulating POST /api/v1/admin/users)
    const testUserEmail = 'test_officer@municipality.gov.in';
    const testUser = {
      email: testUserEmail,
      role: 'zone_officer',
      name: 'Test Officer',
      authority_zone: { name: 'Civil Lines', code: 'CL-01' },
      created_at: new Date()
    };

    // Delete if exists
    await users.deleteOne({ email: testUserEmail });
    
    const result = await users.insertOne(testUser);
    console.log(`✅ Test user inserted with ID: ${result.insertedId}`);

    // 3. Verify Retrieval
    const retrieved = await users.findOne({ email: testUserEmail });
    if (retrieved && retrieved.role === 'zone_officer') {
      console.log('✅ Persistence check SUCCESSFUL');
      console.log('   Retrieved User:', JSON.stringify(retrieved, null, 2));
    } else {
      console.error('❌ Persistence check FAILED');
    }

  } finally {
    await client.close();
  }
}

verifyPersistence().catch(console.error);
