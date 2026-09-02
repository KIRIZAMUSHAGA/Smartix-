---
name: MongoDB URI sanitization
description: Environment-specific handling for MongoDB Atlas connection strings copied through chat or secret forms.
---

MongoDB Atlas connection strings should be normalized before creating the client: escape username and password components according to RFC 3986, and remove whitespace or invisible Unicode directionality markers that may be copied into the URI.

**Why:** A password containing `@` caused an invalid URI, and a copied invisible character caused Motor to reject the query options even though the visible URI looked correct.

**How to apply:** Keep the secret in Replit's secret manager, never log it, and normalize only the URI read at runtime before passing it to Motor.