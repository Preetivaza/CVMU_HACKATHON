/**
 * SEED MASTER ADMIN
 * Run this script to create the initial master_admin account.
 * 
 * Usage:
 *   node seed_master_admin.js
 * 
 * Requires MONGODB_URI in .env.local
 */

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const path = require('path');

// Load env from .env.local
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const MASTER_ADMIN = {
  email: 'admin@sadaksurksha.gov.in',
  password: 'Admin@123456',
  name: 'Master Administrator',
  role: 'master_admin',
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in .env.local');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(process.env.DATABASE_NAME || 'road_damage_db');
    const users = db.collection('users');

    // Check if master_admin already exists
    const existing = await users.findOne({ email: MASTER_ADMIN.email });
    if (existing) {
      console.log(`ℹ️  Master admin already exists: ${MASTER_ADMIN.email}`);
      console.log(`   Role: ${existing.role}`);
      
      // If it exists but with wrong role, fix it
      if (existing.role !== 'master_admin') {
        await users.updateOne(
          { email: MASTER_ADMIN.email },
          { $set: { role: 'master_admin', updated_at: new Date() } }
        );
        console.log('   ✅ Updated role to master_admin');
      }
      return;
    }

    const passwordHash = await bcrypt.hash(MASTER_ADMIN.password, 12);
    const doc = {
      email: MASTER_ADMIN.email,
      password_hash: passwordHash,
      name: MASTER_ADMIN.name,
      role: MASTER_ADMIN.role,
      authority_zone: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await users.insertOne(doc);
    console.log('\n🎉 Master Admin created successfully!');
    console.log('─'.repeat(40));
    console.log(`   Email    : ${MASTER_ADMIN.email}`);
    console.log(`   Password : ${MASTER_ADMIN.password}`);
    console.log(`   Role     : ${MASTER_ADMIN.role}`);
    console.log(`   ID       : ${result.insertedId}`);
    console.log('─'.repeat(40));
    console.log('\n⚠️  Change the password after first login!');

  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
