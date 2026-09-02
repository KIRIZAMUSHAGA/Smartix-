#!/usr/bin/env python
"""Simple script to run the FastAPI server without installation."""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

if __name__ == "__main__":
    import uvicorn
    from server import app
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
