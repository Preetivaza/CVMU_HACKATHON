/**
 * AREA MODEL — Data Access Layer
 * Collection: areas
 * Handles all MongoDB operations for the areas (heatmap grid) collection.
 */
import { getCollection, COLLECTIONS } from '@/lib/db';

export class AreaModel {
  /** Paginated area list sorted by avg risk score descending */
  static async findWithFilters({ query = {}, page = 1, limit = 20 }) {
    const col = await getCollection(COLLECTIONS.AREAS);
    const total = await col.countDocuments(query);
    const items = await col
      .find(query)
      .sort({ 'properties.avg_risk_score': -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    return { total, items };
  }

  /** Fetch areas within a bounding box (for map-data endpoint) */
  static async findInBBox(bboxQuery = {}, limit = 500) {
    const col = await getCollection(COLLECTIONS.AREAS);
    return col.find(bboxQuery).limit(limit).toArray();
  }
}
