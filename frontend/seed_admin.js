const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DATABASE_NAME || 'road_damage_db';
  console.log(`Connecting to ${dbName}...`);
  
  if (!uri) {
    console.error('ERROR: MONGODB_URI is not defined in environment.');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const usersCol = db.collection('users');
    
    const email = 'admin@sadaksurksha.gov.in';
    const password = 'password123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    const doc = {
      email: email.toLowerCase(),
      password_hash: hash,
      name: 'Super Admin',
      role: 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    // Check if it exists and report it
    const existing = await usersCol.findOne({ email: email.toLowerCase() });
    if (existing) {
        console.log(`User ${email} already exists. Updating...`);
        await usersCol.updateOne({ email: email.toLowerCase() }, { $set: doc });
    } else {
        console.log(`Creating new admin user ${email}...`);
        await usersCol.insertOne(doc);
    }
    
    console.log('\nAdmin credentials READY:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Role: admin`);
    
  } finally {
    await client.close();
  }
}

createAdmin().catch(console.error);
