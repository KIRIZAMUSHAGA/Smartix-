---
name: Smartix onboarding persistence
description: Product rule for retaining onboarding progress and dismissal across reloads, devices, and sessions.
---

The onboarding state is account-owned. A dismissal or completion must update the authenticated user's persisted profile, and step progress must be restored from that account after reload or reconnect.

**Why:** The user explicitly requires onboarding actions to survive logout, login, remounts, and browser/device changes; local-only state cannot guarantee that.

**How to apply:** Keep the visibility flag and step progress in the authenticated user payload, use an authenticated server mutation for every action, and refresh the in-memory auth user from the server response. Home data fetches should depend on the stable user ID, not the whole user object, so profile mutations do not flash the page skeleton.