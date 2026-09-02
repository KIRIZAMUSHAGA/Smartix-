import time
import asyncio
from collections import defaultdict
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

class DomainRateLimiter:
    """Rate limiter per domain to avoid 429 errors"""
    
    def __init__(self, default_delay: float = 2.0, max_delay: float = 30.0):
        self.default_delay = default_delay
        self.max_delay = max_delay
        self.last_request_time = defaultdict(float)
        self.domain_delays = defaultdict(lambda: default_delay)
        self.backoff_multiplier = defaultdict(lambda: 1.0)
        self.lock = asyncio.Lock()
    
    def get_domain(self, url: str) -> str:
        """Extract domain from URL"""
        try:
            parsed = urlparse(url)
            return parsed.netloc.lower()
        except:
            return "unknown"
    
    async def wait_for_domain(self, url: str):
        """Wait appropriate time before making request to domain"""
        domain = self.get_domain(url)
        
        async with self.lock:
            current_time = time.time()
            last_time = self.last_request_time[domain]
            delay = self.domain_delays[domain] * self.backoff_multiplier[domain]
            
            wait_time = max(0, delay - (current_time - last_time))
            
            if wait_time > 0:
                logger.debug(f"Rate limiting: waiting {wait_time:.1f}s for {domain}")
                await asyncio.sleep(wait_time)
            
            self.last_request_time[domain] = time.time()
    
    def mark_success(self, url: str):
        """Mark successful request - reduce backoff"""
        domain = self.get_domain(url)
        self.backoff_multiplier[domain] = max(1.0, self.backoff_multiplier[domain] * 0.9)
    
    def mark_rate_limited(self, url: str):
        """Mark 429 error - increase backoff"""
        domain = self.get_domain(url)
        self.backoff_multiplier[domain] = min(10.0, self.backoff_multiplier[domain] * 2.0)
        logger.warning(f"Rate limited by {domain}, backoff multiplier now: {self.backoff_multiplier[domain]}")
    
    def set_domain_delay(self, domain: str, delay: float):
        """Set specific delay for a domain"""
        self.domain_delays[domain] = min(delay, self.max_delay)


domain_rate_limiter = DomainRateLimiter(default_delay=1.5, max_delay=30.0)

domain_rate_limiter.set_domain_delay("www.jeuneafrique.com", 5.0)
domain_rate_limiter.set_domain_delay("jeuneafrique.com", 5.0)
domain_rate_limiter.set_domain_delay("congointelligence.com", 3.0)
