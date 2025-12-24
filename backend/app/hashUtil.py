# app/hashUtil.py
import hashlib

def hashString(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
