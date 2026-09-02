import asyncio
import os
import json
from bson import json_util
import sys

# Add current directory to sys.path to find 'app'
sys.path.append(os.getcwd())

from app.db_mongo import get_db
from app.news.router import NewsOutEncoder
from app.services.news_service import list_news

async def test():
    try:
        db = await get_db()
        print("---DB_CONNECTED---")
        items = await list_news(db, limit=5)
        print(f"---ITEMS_FOUND: {len(items)}---")
        result = {'data': [NewsOutEncoder.encode(i) for i in items], 'success': True}
        print('---TEST_START---')
        print(json.dumps(result, default=json_util.default))
        print('---TEST_END---')
    except Exception as e:
        print(f"---ERROR: {str(e)}---")

if __name__ == "__main__":
    asyncio.run(test())
