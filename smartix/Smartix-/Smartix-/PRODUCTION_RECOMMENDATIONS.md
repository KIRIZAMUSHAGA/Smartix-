# Production Readiness Checklist - Auth & Mutex System

## 🔐 Critical: Mutex + Auth System

### Backend Token Validation
- [ ] Add **30-60 second tolerance** on token expiration to handle:
  - Clock drift between client/server
  - Multi-tab refresh scenarios
  - Network latency
  
```python
# backend/auth.py example
EXPIRATION_TOLERANCE_SECONDS = 30

def verify_token(token):
    decoded = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
    exp_timestamp = decoded['exp']
    current_time = datetime.utcnow().timestamp()
    
    # Allow token to be valid for extra 30 seconds
    if current_time > exp_timestamp + EXPIRATION_TOLERANCE_SECONDS:
        raise TokenExpiredError()
    
    return decoded
```

### Frontend Mutex Validation
- [ ] Monitor logs for multiple refresh attempts:
  ```javascript
  // Should see EXACTLY ONE "Refresh déjà en cours" log per group of 401s
  // Not multiple simultaneous refresh calls
  ```

- [ ] Validate queue replay:
  ```javascript
  // Console should show:
  // "🔄 Refresh déjà en cours, queue cette requête" (for 2nd-5th requests)
  // "✅ Token rafraîchi - Retry de la requête originale" (after refresh)
  ```

---

## 📊 Monitoring & Observability

### Metrics to Track in Production

1. **401 Rate**
   - Alert if > 1% of requests return 401
   - Indicates token generation/validation issues

2. **Refresh Success Rate**
   - Should be > 95%
   - < 90% indicates refresh_token TTL issues

3. **Queued Request Count**
   - Per refresh event
   - Should be 2-5 on average
   - > 20 indicates potential race condition

4. **Retry Success Rate**
   - After refresh, retry should succeed > 99%
   - If < 95%, indicates new token still invalid

### Logging Setup
```python
# backend/logging_config.py
import logging

auth_logger = logging.getLogger('auth')
auth_logger.addHandler(logging.FileHandler('logs/auth.log'))

# Log all token operations
auth_logger.info(f"Token refreshed for user {user_id}")
auth_logger.warning(f"Refresh token invalid for user {user_id}")
auth_logger.error(f"Multiple refresh attempts detected for user {user_id}")
```

### Frontend Console Tracking
```javascript
// frontend/src/services/authService.js - Add telemetry
const logAuthEvent = (event, details) => {
  console.log(`[AUTH] ${event}`, details);
  // Send to analytics service
  sendToAnalytics({
    event,
    timestamp: Date.now(),
    ...details
  });
};
```

---

## 🛡️ Code Quality Gates

### ESLint Rules (Pre-commit Hook)
```bash
# .husky/pre-commit
npm run lint:auth
```

```json
{
  "scripts": {
    "lint:auth": "eslint --config frontend/.eslintrc-auth.js frontend/src --fix",
    "test:auth": "jest frontend/src/__tests__/AuthMutex401Parallel.test.js"
  }
}
```

### Test Coverage Requirements
- [ ] All 401 scenarios covered in tests
- [ ] Mutex behavior validated
- [ ] Queue replay tested
- [ ] Logout flow tested

---

## 🚀 Deployment Checklist

### Before Deploy to Production
- [ ] Run full test suite: `npm test`
- [ ] Verify no direct axios imports: `grep -r "import axios from 'axios'" frontend/src --exclude-dir=node_modules`
- [ ] Check token TTL matches frontend timeout (15000ms)
- [ ] Verify refresh endpoint returns new refresh_token
- [ ] Load test with 100+ simultaneous users
- [ ] Test multi-tab scenario (multiple tabs + token expiry)

### Monitoring Post-Deploy
- [ ] Dashboard showing 401 rate (should drop to near 0)
- [ ] Alerts on auth failures
- [ ] Daily report of auth metrics
- [ ] Weekly review of edge cases

---

## 🔄 Multi-Tab Scenario

**Problem:** User has 3 tabs open, token expires in tab 1
**Solution:** Mutex should handle this automatically:

1. Tab 1 detects 401 → acquires lock → triggers refresh
2. Tabs 2, 3 detect 401 → try to acquire lock → fail → enter queue
3. Refresh completes in Tab 1 → releases lock
4. Tabs 2, 3 receive new token from queue → retry automatically

**Validation Test:**
```javascript
// Open 3 tabs, simulate token expiry in console:
// Tab 1: axios.defaults.headers['Authorization'] = 'Bearer invalid'
// Tab 2: Make a request (should queue)
// Tab 3: Make a request (should queue)
// Check console logs for queue behavior
```

---

## 📋 Continuous Monitoring Rules

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| 401 rate | > 1% | Investigate token generation |
| Refresh failure | > 5% | Check refresh_token TTL |
| Queue size | > 50 | Increase timeout or check server |
| Logout rate spike | 2x normal | Check for session issues |
| Token overlap | < 60s | Increase tolerance window |

---

## 🔒 Security Review

- [ ] Refresh token never exposed in logs
- [ ] Access token never printed in console (except dev)
- [ ] Both tokens encrypted in transit (HTTPS only)
- [ ] withCredentials: true enforced for all auth requests
- [ ] CSRF protection enabled on backend

---

## 📞 Support Plan

**If users report "Feed not loading" in production:**

1. Check backend auth logs for token validation errors
2. Check frontend logs for refresh failures
3. Verify token TTL matches middleware
4. Check for clock drift: `timedatectl status` (backend)
5. Restart auth service if tokens are "stuck"

---

**Last Updated:** December 18, 2025  
**Status:** Ready for Implementation  
**Author:** Architecture Review
