/**
 * ROAD MODEL — Data Access Layer
 * Collection: roads
 * Handles all MongoDB operations for the roads collection.
 */
import { getCollection, COLLECTIONS } from '@/lib/db';

export class RoadModel {
  /** Paginated road list sorted by avg risk score descending */
  static async findWithFilters({ query = {}, page = 1, limit = 20 }) {
    const col = await getCollection(COLLECTIONS.ROADS);
    const total = await col.countDocuments(query);
    const items = await col
      .find(query)
      .sort({ 'properties.avg_risk_score': -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    return { total, items };
  }

  /** Fetch roads within a bounding box (for map-data endpoint) */
  static async findInBBox(bboxQuery = {}, limit = 500) {
    const col = await getCollection(COLLECTIONS.ROADS);
    return col.find(bboxQuery).limit(limit).toArray();
  }
}
