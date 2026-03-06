from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

client = None
db = None


async def connect_to_mongo():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.DATABASE_NAME]
    print(f"Connected to MongoDB: {settings.DATABASE_NAME}")
    # ── Ensure all performance indexes on startup ────────────────────────────
    await ensure_indexes()


async def close_mongo_connection():
    global client
    if client:
        client.close()
        print("MongoDB connection closed")


def get_database():
    return db


def get_collection(collection_name: str):
    return db[collection_name]


async def ensure_indexes():
    """
    Create all required indexes on startup (idempotent — safe to call repeatedly).

    Index strategy:
      clusters         → 2dsphere (geospatial bbox/near queries)
                       → (risk_level, created_at) compound (filter+sort)
                       → created_at desc (time-range scans)
      raw_detections   → (processed, video_id) compound (pipeline fetch)
      video_uploads    → video_id unique (idempotency guard lookups)
    """
    try:
        # ── clusters ────────────────────────────────────────────────────────
        clusters_col = db[Collections.CLUSTERS]
        await clusters_col.create_index(
            [("geometry", "2dsphere")],
            name="geo_2dsphere", background=True
        )
        await clusters_col.create_index(
            [("properties.risk_level", 1), ("created_at", -1)],
            name="risk_level_created_at", background=True
        )
        await clusters_col.create_index(
            [("created_at", -1)],
            name="created_at_desc", background=True
        )
        await clusters_col.create_index(
            [("properties.status", 1), ("created_at", -1)],
            name="status_created_at", background=True
        )

        # ── raw_detections ───────────────────────────────────────────────────
        detections_col = db[Collections.RAW_DETECTIONS]
        await detections_col.create_index(
            [("processed", 1), ("properties.video_id", 1)],
            name="processed_video_id", background=True
        )
        await detections_col.create_index(
            [("geometry", "2dsphere")],
            name="det_geo_2dsphere", background=True
        )

        # ── video_uploads ────────────────────────────────────────────────────
        uploads_col = db[Collections.VIDEO_UPLOADS]
        await uploads_col.create_index(
            [("video_id", 1)],
            name="video_id_unique", unique=True, background=True
        )

        print("[DB] All indexes ensured.")
    except Exception as e:
        # Non-fatal: log and continue (indexes may already exist)
        print(f"[DB] Warning: index creation failed (may already exist): {e}")


# Collection names
class Collections:
    USERS = "users"
    VIDEO_UPLOADS = "video_uploads"
    RAW_DETECTIONS = "raw_detections"
    CLUSTERS = "clusters"
    AREAS = "areas"
    ROADS = "roads"
    SATELLITE_ANALYSIS = "satellite_analysis"
    ANALYTICS_SNAPSHOTS = "analytics_snapshots"
