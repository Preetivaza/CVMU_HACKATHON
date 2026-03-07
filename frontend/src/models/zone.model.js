/**
 * ZONE MODEL — Data Access Layer
 * Collection: zones
 * City zones used to restrict zone_officer data visibility.
 * Each zone is a GeoJSON Polygon feature stored in MongoDB.
 */
import { getCollection, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';

export class ZoneModel {
  /** List all zones (lightweight — no heavy polygon coords) */
  static async findAll() {
    const col = await getCollection(COLLECTIONS.ZONES);
    return col
      .find({})
      .sort({ name: 1 })
      .toArray();
  }

  /** Find a zone by ObjectId */
  static async findById(id) {
    const col = await getCollection(COLLECTIONS.ZONES);
    return col.findOne({ _id: new ObjectId(id) });
  }

  /** Find a zone by name (case-insensitive) */
  static async findByName(name) {
    const col = await getCollection(COLLECTIONS.ZONES);
    return col.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
  }

  /**
   * Create a new zone
   * @param {{ name: string, code: string, description?: string, geometry: GeoJSON.Polygon }} data
   */
  static async create({ name, code, description = '', geometry }) {
    const col = await getCollection(COLLECTIONS.ZONES);
    const doc = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description,
      geometry,        // GeoJSON Polygon { type: 'Polygon', coordinates: [...] }
      created_at: new Date(),
      updated_at: new Date(),
    };
    const result = await col.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  /** Update zone fields */
  static async updateById(id, fields = {}) {
    const col = await getCollection(COLLECTIONS.ZONES);
    return col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...fields, updated_at: new Date() } }
    );
  }

  /** Delete a zone */
  static async deleteById(id) {
    const col = await getCollection(COLLECTIONS.ZONES);
    return col.deleteOne({ _id: new ObjectId(id) });
  }

  /** Count all zones */
  static async count() {
    const col = await getCollection(COLLECTIONS.ZONES);
    return col.countDocuments({});
  }
}
