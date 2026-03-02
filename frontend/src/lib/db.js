import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

let client;
let clientPromise;

if (!uri) {
  throw new Error('Please add your MongoDB URI to .env.local');
}

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

/**
 * Get database instance
 * @returns {Promise<import('mongodb').Db>}
 */
export async function getDb() {
  const client = await clientPromise;
  return client.db('road_damage_db');
}

/**
 * Get specific collection
 * @param {string} collectionName
 * @returns {Promise<import('mongodb').Collection>}
 */
export async function getCollection(collectionName) {
  const db = await getDb();
  return db.collection(collectionName);
}

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  VIDEO_UPLOADS: 'video_uploads',
  RAW_DETECTIONS: 'raw_detections',
  CLUSTERS: 'clusters',
  AREAS: 'areas',
  ROADS: 'roads',
  SATELLITE_ANALYSIS: 'satellite_analysis',
  ANALYTICS_SNAPSHOTS: 'analytics_snapshots',
};

export default clientPromise;
