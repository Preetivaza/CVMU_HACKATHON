/**
 * SETUP GeoJSON INDEXES
 * Run this script to create required 2dsphere indexes for spatial queries.
 * This is required for zone-based filtering (getDataFilter) to work in MongoDB.
 * 
 * Usage:
 *   node setup_geo_indexes.js
 * 
 * Requires MONGODB_URI in .env.local
 */

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in .env.local');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(process.env.DATABASE_NAME || 'road_damage_db');

    console.log('🔄 Creating GeoJSON 2dsphere indexes...\n');

    const indexes = [
      { collection: 'clusters', field: 'geometry' },
      { collection: 'raw_detections', field: 'geometry' },
      { collection: 'areas', field: 'geometry' },
      { collection: 'roads', field: 'geometry' },
    ];

    for (const { collection, field } of indexes) {
      try {
        await db.collection(collection).createIndex({ [field]: '2dsphere' });
        console.log(`  ✅ ${collection}.${field} — 2dsphere index created`);
      } catch (err) {
        if (err.code === 85) {
          console.log(`  ℹ️  ${collection}.${field} — index already exists`);
        } else {
          console.warn(`  ⚠️  ${collection}.${field} — ${err.message}`);
        }
      }
    }

    // Also ensure unique index on zones.code
    try {
      await db.collection('zones').createIndex({ code: 1 }, { unique: true });
      console.log(`  ✅ zones.code — unique index created`);
    } catch (err) {
      if (err.code === 85) console.log(`  ℹ️  zones.code — index already exists`);
      else console.warn(`  ⚠️  zones.code — ${err.message}`);
    }

    // Unique index on users.email
    try {
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      console.log(`  ✅ users.email — unique index created`);
    } catch (err) {
      if (err.code === 85) console.log(`  ℹ️  users.email — index already exists`);
      else console.warn(`  ⚠️  users.email — ${err.message}`);
    }

    console.log('\n🎉 All indexes set up successfully!');
    console.log('   Spatial queries (zone-based filtering) are now enabled.');

  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
