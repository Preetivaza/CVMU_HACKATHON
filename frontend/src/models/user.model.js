/**
 * USER MODEL — Data Access Layer
 * Collection: users
 * Handles all MongoDB operations for the users collection.
 */
import { getCollection, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';

export class UserModel {
  /** Find a user by email (case-insensitive) */
  static async findByEmail(email) {
    const col = await getCollection(COLLECTIONS.USERS);
    return col.findOne({ email: email.toLowerCase() });
  }

  /** Find a user by MongoDB _id, optionally excluding password_hash */
  static async findById(id, excludePassword = true) {
    const col = await getCollection(COLLECTIONS.USERS);
    const projection = excludePassword ? { password_hash: 0 } : {};
    return col.findOne({ _id: new ObjectId(id) }, { projection });
  }

  /** Find user by assigned zone ID (to check occupancy) */
  static async findByZoneId(zoneId) {
    const col = await getCollection(COLLECTIONS.USERS);
    return col.findOne({ 'authority_zone.id': zoneId });
  }

  /** Insert a new user document */
  static async create({ email, passwordHash, name, role = 'viewer', authority_zone = null }) {
    const col = await getCollection(COLLECTIONS.USERS);
    const doc = {
      email: email.toLowerCase(),
      password_hash: passwordHash,
      name: name.trim(),
      role,
      authority_zone, // { id, name, code, geometry } — full zone snapshot, or null
      created_at: new Date(),
      updated_at: new Date(),
    };
    const result = await col.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  /** Update a user's profile fields */
  static async updateProfile(id, fields = {}) {
    const col = await getCollection(COLLECTIONS.USERS);
    return col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...fields, updated_at: new Date() } }
    );
  }

  /** Touch last_login timestamp */
  static async touchLastLogin(id) {
    const col = await getCollection(COLLECTIONS.USERS);
    return col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { last_login: new Date() } }
    );
  }
}
