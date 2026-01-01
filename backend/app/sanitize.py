# app/sanitize.py
import html
import re

def sanitizeText(text: str | None, maxLength: int | None = None) -> str | None:
    """
    Sanitize user input to prevent XSS attacks.
    - Escapes HTML entities
    - Removes potentially dangerous patterns
    - Enforces max length if specified
    """
    if text is None:
        return None
    
    # Strip leading/trailing whitespace
    text = text.strip()
    
    if not text:
        return text
    
    # Escape HTML entities
    text = html.escape(text)
    
    # Remove null bytes
    text = text.replace('\x00', '')
    
    # Enforce max length
    if maxLength and len(text) > maxLength:
        text = text[:maxLength]
    
    return text


def sanitizeLabel(label: str, maxLength: int = 256) -> str:
    """Sanitize poll option labels"""
    sanitized = sanitizeText(label, maxLength)
    if not sanitized:
        raise ValueError("Label cannot be empty after sanitization")
    return sanitized


def sanitizeQuestion(question: str | None, maxLength: int = 1000) -> str | None:
    """Sanitize poll questions (optional field)"""
    return sanitizeText(question, maxLength)


def sanitizeTitle(title: str, maxLength: int = 256) -> str:
    """Sanitize poll titles"""
    sanitized = sanitizeText(title, maxLength)
    if not sanitized:
        raise ValueError("Title cannot be empty after sanitization")
    return sanitized


def sanitizeName(name: str, maxLength: int = 128) -> str:
    """Sanitize category/entity names"""
    sanitized = sanitizeText(name, maxLength)
    if not sanitized:
        raise ValueError("Name cannot be empty after sanitization")
    return sanitized


def sanitizeKey(key: str, maxLength: int = 64) -> str:
    """
    Sanitize keys (category keys, template keys).
    Keys should be lowercase alphanumeric with hyphens only.
    """
    if not key:
        raise ValueError("Key cannot be empty")
    
    # Remove any non-alphanumeric or hyphen characters
    key = re.sub(r'[^a-z0-9\-]', '', key.lower())
    
    # Limit length
    if maxLength and len(key) > maxLength:
        key = key[:maxLength]
    
    if not key:
        raise ValueError("Key cannot be empty after sanitization")
    
    return key
