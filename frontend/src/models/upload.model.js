/**
 * UPLOAD MODEL — Data Access Layer
 * Collection: video_uploads
 * Handles all MongoDB operations for the video_uploads collection.
 */
import { getCollection, COLLECTIONS } from '@/lib/db';

export class UploadModel {
  /** Insert a new video upload document */
  static async create(doc) {
    const col = await getCollection(COLLECTIONS.VIDEO_UPLOADS);
    const result = await col.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  /** Find upload by video_id string */
  static async findByVideoId(videoId) {
    const col = await getCollection(COLLECTIONS.VIDEO_UPLOADS);
    return col.findOne({ video_id: videoId });
  }

  /** Update upload status and optional extra fields */
  static async updateStatus(videoId, status, extra = {}) {
    const col = await getCollection(COLLECTIONS.VIDEO_UPLOADS);
    return col.updateOne(
      { video_id: videoId },
      { $set: { status, updated_at: new Date(), ...extra } }
    );
  }

  /** List uploads with optional status filter and pagination */
  static async findWithFilters({ query = {}, page = 1, limit = 20 }) {
    const col = await getCollection(COLLECTIONS.VIDEO_UPLOADS);
    const total = await col.countDocuments(query);
    const items = await col
      .find(query)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    return { total, items };
  }
}
