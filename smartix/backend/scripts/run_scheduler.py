# Run scheduler as separate process if needed
from app.news.scheduler import start_scheduler

if __name__ == "__main__":
    start_scheduler()
    import time
    while True:
        time.sleep(60)
