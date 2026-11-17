"""Small dependency-free request guards for the private SraVaani service."""
from __future__ import annotations

import hmac
import re

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
ALLOWED_AUDIO_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "application/octet-stream",
}


def valid_model_revision(value: str) -> bool:
    return bool(re.fullmatch(r"[0-9a-fA-F]{40,64}", value or ""))


def valid_service_token(value: str) -> bool:
    return isinstance(value, str) and len(value) >= 32


def authorization_matches(header: str | None, expected_token: str) -> bool:
    if not header or not expected_token:
        return False
    expected = f"Bearer {expected_token}"
    return hmac.compare_digest(header, expected)


def validate_audio_upload(audio_bytes: bytes, content_type: str) -> str | None:
    """Return a safe validation error message, or None when basic checks pass."""
    if content_type not in ALLOWED_AUDIO_TYPES:
        return "Only WAV audio is accepted."
    if not audio_bytes:
        return "Audio file is empty."
    if len(audio_bytes) > MAX_UPLOAD_BYTES:
        return "Audio upload exceeds the 15 MB limit."
    if len(audio_bytes) < 12 or audio_bytes[:4] != b"RIFF" or audio_bytes[8:12] != b"WAVE":
        return "Only RIFF/WAVE audio is accepted."
    return None
