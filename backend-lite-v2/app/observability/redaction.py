import hashlib
import re
from typing import Tuple

# Default patterns; can be extended per-tenant via DB later
DEFAULT_PATTERNS = [
    re.compile(r"(?i)(api|secret|token|key)[=:]\s*([A-Za-z0-9_\-]{16,})"),
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),  # SSN-like
    re.compile(r"\b\d{13,19}\b"),  # credit card-like (very rough)
    re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")  # emails
]

REPLACEMENT = "[REDACTED]"


def redact(text: str | None, patterns: list[re.Pattern] | None = None) -> Tuple[str | None, str | None, bool]:
    """Redact sensitive data and return (redacted_text, sha256_digest, redaction_applied).
    If text is None/empty, returns (text, None, False).
    """
    if not text:
        return text, None, False
    pats = patterns or DEFAULT_PATTERNS
    redaction_applied = False
    redacted = text
    for p in pats:
        if p.search(redacted):
            redaction_applied = True
            redacted = p.sub(REPLACEMENT, redacted)
    digest = hashlib.sha256(redacted.encode("utf-8")).hexdigest()
    return redacted, digest, redaction_applied
