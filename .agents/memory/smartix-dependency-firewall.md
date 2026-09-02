---
name: Smartix dependency firewall
description: Replit package firewall constraints encountered while installing the imported Smartix frontend.
---

The imported CRA frontend must resolve `websocket-driver` to a current safe release and `shell-quote` to a current safe release through npm overrides; older transitive versions are blocked by the Replit package firewall.

**Why:** A normal lockfile install was rejected for legacy transitive tarballs, while the updated releases installed successfully.

**How to apply:** Preserve the overrides in the frontend package manifest whenever regenerating or reinstalling its lockfile.