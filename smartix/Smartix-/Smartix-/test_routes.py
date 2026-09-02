import asyncio
import httpx

async def test():
    async with httpx.AsyncClient() as client:
        # Tester les routes probables
        routes = ["/api/posts", "/api/feed", "/posts", "/feed"]
        for route in routes:
            try:
                res = await client.get(f"http://0.0.0.0:8000{route}")
                print(f"Route {route}: {res.status_code}")
            except Exception as e:
                print(f"Route {route}: Error {e}")

if __name__ == "__main__":
    asyncio.run(test())
