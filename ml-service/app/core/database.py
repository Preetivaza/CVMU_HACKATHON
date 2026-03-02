from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

client = None
db = None


async def connect_to_mongo():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.DATABASE_NAME]
    print(f"Connected to MongoDB: {settings.DATABASE_NAME}")


async def close_mongo_connection():
    global client
    if client:
        client.close()
        print("MongoDB connection closed")


def get_database():
    return db


def get_collection(collection_name: str):
    return db[collection_name]


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
