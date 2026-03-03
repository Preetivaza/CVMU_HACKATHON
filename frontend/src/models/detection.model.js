/**
 * DETECTION MODEL — Data Access Layer
 * Collection: raw_detections
 * Handles all MongoDB operations for the raw_detections collection.
 */
import { getCollection, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';

export class DetectionModel {
  /** Insert many detection documents at once */
  static async bulkInsert(detections) {
    const col = await getCollection(COLLECTIONS.RAW_DETECTIONS);
    return col.insertMany(detections);
  }

  /** Paginated list with arbitrary query and sort */
  static async findWithFilters({
    query = {},
    page = 1,
    limit = 20,
    sort = { 'properties.timestamp': -1 },
  }) {
    const col = await getCollection(COLLECTIONS.RAW_DETECTIONS);
    const total = await col.countDocuments(query);
    const items = await col
      .find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    return { total, items };
  }

  /** Find all detections belonging to a cluster */
  static async findByClusterId(clusterId) {
    const col = await getCollection(COLLECTIONS.RAW_DETECTIONS);
    return col.find({ cluster_id: new ObjectId(clusterId) }).toArray();
  }

  /** Run a MongoDB aggregation pipeline */
  static async aggregate(pipeline) {
    const col = await getCollection(COLLECTIONS.RAW_DETECTIONS);
    return col.aggregate(pipeline).toArray();
  }

  /** Unlink detections from a deleted cluster */
  static async unlinkCluster(clusterId) {
    const col = await getCollection(COLLECTIONS.RAW_DETECTIONS);
    return col.updateMany(
      { cluster_id: new ObjectId(clusterId) },
      { $set: { cluster_id: null, processed: false } }
    );
  }
}
