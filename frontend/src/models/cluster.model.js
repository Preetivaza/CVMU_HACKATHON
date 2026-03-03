/**
 * CLUSTER MODEL — Data Access Layer
 * Collection: clusters
 * Handles all MongoDB operations for the clusters collection.
 */
import { getCollection, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';

export class ClusterModel {
  /** Paginated list with filters, sorted by risk score descending */
  static async findWithFilters({ query = {}, page = 1, limit = 20 }) {
    const col = await getCollection(COLLECTIONS.CLUSTERS);
    const total = await col.countDocuments(query);
    const items = await col
      .find(query)
      .sort({ 'properties.final_risk_score': -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    return { total, items };
  }

  /** Find a single cluster by ObjectId */
  static async findById(id) {
    const col = await getCollection(COLLECTIONS.CLUSTERS);
    return col.findOne({ _id: new ObjectId(id) });
  }

  /** Update cluster status and push a repair history entry */
  static async updateStatus(id, status, historyEntry = null) {
    const col = await getCollection(COLLECTIONS.CLUSTERS);
    const update = {
      $set: {
        'properties.status': status,
        updated_at: new Date(),
      },
    };
    if (historyEntry) {
      update.$push = { 'properties.repair_history': historyEntry };
    }
    return col.updateOne({ _id: new ObjectId(id) }, update);
  }

  /** Generic update $set on a cluster */
  static async updateById(id, fields = {}) {
    const col = await getCollection(COLLECTIONS.CLUSTERS);
    return col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...fields, updated_at: new Date() } }
    );
  }

  /** Delete a cluster document */
  static async deleteById(id) {
    const col = await getCollection(COLLECTIONS.CLUSTERS);
    return col.deleteOne({ _id: new ObjectId(id) });
  }

  /** Count documents matching a query */
  static async count(query = {}) {
    const col = await getCollection(COLLECTIONS.CLUSTERS);
    return col.countDocuments(query);
  }

  /** Run a MongoDB aggregation pipeline */
  static async aggregate(pipeline) {
    const col = await getCollection(COLLECTIONS.CLUSTERS);
    return col.aggregate(pipeline).toArray();
  }

  /** Top N clusters sorted by risk score (for priority ranking) */
  static async findTopRisk({ query = {}, limit = 20 }) {
    const col = await getCollection(COLLECTIONS.CLUSTERS);
    return col
      .find(query)
      .sort({ 'properties.final_risk_score': -1 })
      .limit(limit)
      .toArray();
  }
}
