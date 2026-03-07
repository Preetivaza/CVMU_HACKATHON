import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.DATABASE_NAME || 'road_damage_db';

async function run() {
  console.log(`Connecting to ${MONGODB_URI}...`);
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const users = db.collection('users');
    const zones = db.collection('zones');

    console.log('--- Verification: Zone Occupancy & Boundary Logic ---');

    // 1. Setup a Test Zone
    const testZone = {
      name: 'Test North Zone',
      code: 'TNZ',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [72.8, 19.0],
          [72.9, 19.0],
          [72.9, 19.1],
          [72.8, 19.1],
          [72.8, 19.0]
        ]]
      },
      created_at: new Date()
    };
    await zones.updateOne({ code: 'TNZ' }, { $set: testZone }, { upsert: true });
    const zoneDoc = await zones.findOne({ code: 'TNZ' });
    console.log('✅ Test Zone "TNZ" ready.');

    // 2. Setup first Zone Officer
    const officer1 = {
      email: 'officer1@test.com',
      name: 'Officer One',
      role: 'zone_officer',
      authority_zone: {
        id: zoneDoc._id.toString(),
        name: zoneDoc.name,
        code: zoneDoc.code,
        geometry: zoneDoc.geometry
      },
      created_at: new Date()
    };
    await users.updateOne({ email: 'officer1@test.com' }, { $set: officer1 }, { upsert: true });
    console.log('✅ Officer 1 assigned to TNZ.');

    // 3. Test Occupancy Logic (Simulate findByZoneId)
    const occupant = await users.findOne({ 'authority_zone.id': zoneDoc._id.toString() });
    if (occupant && occupant.email === 'officer1@test.com') {
      console.log('✅ findByZoneId (simulated) correctly identified Officer 1.');
    } else {
      console.error('❌ findByZoneId failed.');
    }

    // 4. Test Point-in-Polygon Logic (Simulate DetectionController)
    const insidePoint = [72.85, 19.05];
    const outsidePoint = [72.75, 19.05];

    function isPointInPolygon(point, polygon) {
      const x = point[0], y = point[1];
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        const intersect = ((yi > y) !== (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    }

    const poly = zoneDoc.geometry.coordinates[0];
    const check1 = isPointInPolygon(insidePoint, poly);
    const check2 = isPointInPolygon(outsidePoint, poly);

    console.log(`📍 Inside point [${insidePoint}] check: ${check1 ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`📍 Outside point [${outsidePoint}] check: ${!check2 ? 'PASS ✅' : 'FAIL ❌'}`);

    console.log('--- Verification Complete ---');

  } finally {
    await client.close();
  }
}

run().catch(console.dir);
