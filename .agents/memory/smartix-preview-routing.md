---
name: Smartix preview routing
description: Why the imported Smartix frontend returned the Replit preview 404 page.
---

The imported frontend can run successfully as a regular workflow while the mobile/browser preview still shows Replit's 404 if no registered web artifact owns the root preview path. The visible app must be connected to the root web artifact service.

**Why:** Replit's preview router resolves registered artifact paths, not arbitrary workflow names, so a healthy port 5000 process alone is not enough.

**How to apply:** Keep the web artifact's development command pointed at the imported frontend and keep its root preview path `/`; remove competing frontend workflows.