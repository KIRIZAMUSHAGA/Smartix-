import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def fix_avatars():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
    db = client.get_database("smartix")
    users_col = db.get_collection("users")
    
    async for user in users_col.find({"avatar": {"$exists": False}}):
        # Si l'utilisateur n'a pas d'avatar, on lui en assigne un basé sur son ID
        # (à condition que le fichier existe ou soit généré plus tard)
        user_id = user.get("id")
        if user_id:
            await users_col.update_one({"_id": user["_id"]}, {"$set": {"avatar": f"{user_id}.jpg"}})
            print(f"Updated user {user_id} with avatar {user_id}.jpg")

if __name__ == "__main__":
    asyncio.run(fix_avatars())
