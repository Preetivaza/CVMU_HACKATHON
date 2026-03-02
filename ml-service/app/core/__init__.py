# Core module initialization
from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection, get_database, get_collection, Collections
