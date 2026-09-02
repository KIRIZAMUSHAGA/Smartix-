import requests
import time

def test_feed():
    url = "http://localhost:8000/api/feed/"
    start = time.time()
    try:
        r = requests.get(url, params={"limit": 5})
        duration = (time.time() - start) * 1000
        print(f"Status: {r.status_code}")
        print(f"RTT: {duration:.2f}ms")
        if r.status_code == 200:
            print(f"Posts: {len(r.json()['posts'])}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_feed()
