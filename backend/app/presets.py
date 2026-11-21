from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_RESOURCES_DIR = Path(__file__).parent / "resources"


@lru_cache
def question_presets() -> list[dict]:
    data = json.loads((_RESOURCES_DIR / "question-presets.json").read_text(encoding="utf-8"))
    return list(data["presets"])


def preset_by_id(preset_id: str) -> dict | None:
    for preset in question_presets():
        if preset["id"] == preset_id:
            return preset
    return None
