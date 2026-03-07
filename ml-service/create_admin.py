import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import bcrypt

load_dotenv()

async def create_admin():
    uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("DATABASE_NAME", "road_damage_db")
    
    print(f"Connecting to {db_name}...")
    client = AsyncIOMotorClient(uri)
    db = client[db_name]
    
    email = "admin@sadaksurksha.gov.in"
    password = "password123"
    
    # Check if already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        print(f"User {email} already exists. Updating password...")
        salt = bcrypt.gensalt(10)
        password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        await db.users.update_one({"email": email}, {"$set": {"password_hash": password_hash, "role": "admin", "name": "Super Admin"}})
    else:
        print(f"Creating new admin user {email}...")
        salt = bcrypt.gensalt(10)
        password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        doc = {
            "email": email,
            "password_hash": password_hash,
            "name": "Super Admin",
            "role": "admin",
            "created_at": "2026-03-05T00:00:00Z",
            "updated_at": "2026-03-05T00:00:00Z"
        }
        await db.users.insert_one(doc)
    
    print(f"\nAdmin credentials:")
    print(f"Email: {email}")
    print(f"Password: {password}")
    print(f"Role: admin")
    client.close()

if __name__ == "__main__":
    asyncio.run(create_admin())
