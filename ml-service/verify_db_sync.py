import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

def main():
    uri = os.getenv("MONGODB_URI")
    client = MongoClient(uri)
    dbs = client.list_database_names()
    print("Databases:", dbs)
    
    for db_name in ["road_damage_db"]:
        if db_name in dbs:
            print(f"\nCollections in {db_name}:")
            db = client[db_name]
            cols = db.list_collection_names()
            for col in cols:
                count = db[col].count_documents({})
                print(f"  {col}: {count}")

if __name__ == "__main__":
    main()
