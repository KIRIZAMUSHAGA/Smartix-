"""ID validation helpers."""
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException


def validate_object_id(id_str: str) -> ObjectId:
    """Validate and convert a string to a MongoDB ObjectId.

    Raises HTTP 400 if the string is not a valid ObjectId.
    """
    if not id_str or not isinstance(id_str, str):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    try:
        return ObjectId(id_str)
    except (InvalidId, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid ID format")


def is_valid_object_id(id_str: str) -> bool:
    """Non-raising variant: returns True if id_str is a valid ObjectId."""
    if not id_str or not isinstance(id_str, str):
        return False
    try:
        ObjectId(id_str)
        return True
    except (InvalidId, TypeError, ValueError):
        return False


def validate_id_string(id_str: str, max_len: int = 64) -> str:
    """Generic ID validator for UUID/timestamp string IDs used in this project.

    Accepts non-empty alphanumeric/hyphen/underscore/dot strings within a length cap.
    Raises HTTP 400 otherwise.
    """
    if not id_str or not isinstance(id_str, str):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    s = id_str.strip()
    if not s or len(s) > max_len:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    for ch in s:
        if not (ch.isalnum() or ch in "-_."):
            raise HTTPException(status_code=400, detail="Invalid ID format")
    return s
