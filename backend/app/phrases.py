from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

_RESOURCES_DIR = Path(__file__).parent / "resources"

_DIACRITICS = {
    "č": "c",
    "ć": "c",
    "š": "s",
    "ž": "z",
    "đ": "d",
}


def _normalize_words(text: str) -> list[str]:
    text = text.lower()
    text = "".join(_DIACRITICS.get(ch, ch) for ch in text)
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return text.split()


@lru_cache
def emergency_phrases() -> list[str]:
    data = json.loads((_RESOURCES_DIR / "emergency-phrases.json").read_text(encoding="utf-8"))
    return list(data["phrases"])


def contains_emergency_phrase(text: str) -> bool:
    if not text:
        return False
    words = _normalize_words(text)
    for phrase in emergency_phrases():
        stems = _normalize_words(phrase)
        if _stems_in(stems, words, prefix=True):
            return True
    return False


def _stems_in(stems: list[str], words: list[str], *, prefix: bool) -> bool:
    count = len(stems)
    if count == 0:
        return False
    for start in range(len(words) - count + 1):
        if prefix:
            matches = all(words[start + i].startswith(stems[i]) for i in range(count))
        else:
            matches = all(words[start + i] == stems[i] for i in range(count))
        if matches:
            return True
    return False


def text_contains(needle: str, haystack: str) -> bool:
    """Whether `needle`, ignoring case and punctuation, appears word for word in `haystack`."""
    needle_words = _normalize_words(needle)
    haystack_words = _normalize_words(haystack)
    return _stems_in(needle_words, haystack_words, prefix=False)
