"""Ocena odgovorov iz telefonskega klica: kateri odgovor kaže, da je lahko kaj narobe.

Vsako od 9 vprašanj ima svoje pravilo (glej RULES v enakem vrstnem redu kot QUESTIONS v
phone_call.py). Rezultat je oznaka "high" (rdeče), "medium" (oranžno), "low" (rumeno) ali
None (v redu / nejasno). Oznaka "high" naredi klic nujen (severity "critical").

To je preprosta, pregledna pravila na podlagi besed - ne diagnoza. Nejasen odgovor ostane
brez oznake, zato ga mora zdravnik prebrati v prepisu.
"""

from __future__ import annotations

import re

_DIACRITICS = str.maketrans({"č": "c", "ć": "c", "š": "s", "ž": "z", "đ": "d"})

_NO_WORDS = {"ne", "nisem", "nimam", "ni", "nic", "nikoli", "nobenih", "nobene", "noben", "nisva"}
_YES_WORDS = {"da", "ja", "seveda", "mhm", "aha", "imam", "sem", "jih", "res", "vcasih", "malo", "nekaj", "pa"}
_UNSURE = ("ne vem", "ne spomnim", "ne znam")

_NUMBERS = {
    "nic": 0, "nula": 0, "ena": 1, "en": 1, "eno": 1, "dva": 2, "dve": 2, "tri": 3, "stiri": 4,
    "pet": 5, "sest": 6, "sedem": 7, "osem": 8, "devet": 9, "deset": 10,
}

_BAD_FEELING = ("slab", "boli", "bolecin", "utrujen", "omotic", "vrti", "bruh", "vrocin", "mrzlic",
                "ni dobro", "ni v redu", "tako tako", "nisem dobro", "slabse", "tesk", "hujs")
_VERY_BAD = ("zelo slab", "grozno", "hudo", "ne morem", "ne vidim", "kri", "krvav", "nezavest", "padl")
_BAD_SIGHT = ("slabo", "slabse", "megl", "zamegl", "motno", "temno", "ne vidim", "nic ne vidim")


def _norm(text: str) -> str:
    text = text.lower().translate(_DIACRITICS)
    return re.sub(r"[^a-z0-9\s]", " ", text)


def _words(text: str) -> list[str]:
    return _norm(text).split()


def _yes_no(text: str) -> str | None:
    """'yes', 'no' ali None (nejasno)."""
    norm = _norm(text)
    if any(u in norm for u in _UNSURE):
        return None
    words = _words(text)
    if any(w in _NO_WORDS for w in words):
        return "no"
    if any(w in _YES_WORDS for w in words):
        return "yes"
    return None


def _number(text: str) -> int | None:
    match = re.search(r"\b(10|[0-9])\b", _norm(text))
    if match:
        return int(match.group(1))
    for word in _words(text):
        if word in _NUMBERS:
            return _NUMBERS[word]
    return None


def _has(text: str, needles: tuple[str, ...]) -> bool:
    norm = " " + _norm(text) + " "
    return any(n in norm for n in needles)


def _feeling(text: str) -> str | None:
    if _has(text, _VERY_BAD):
        return "high"
    if _has(text, _BAD_FEELING):
        return "medium"
    return None


def _pain(text: str) -> str | None:
    number = _number(text)
    if number is not None:
        return "high" if number >= 7 else "medium" if number >= 4 else None
    if _has(text, ("zelo", "mocno", "hudo", "neznosno")):
        return "high"
    if _has(text, (" ne boli", "nic ne boli", "ne boli")) or _yes_no(text) == "no":
        return None
    return "medium" if _yes_no(text) == "yes" or _has(text, ("boli",)) else None


def _sight(text: str) -> str | None:
    if _has(text, ("ne vidim", "nic ne vidim", "tema")):
        return "high"
    if _has(text, _BAD_SIGHT) or _yes_no(text) == "no":
        return "medium"
    return None


def _when(answer: str, level: str, also: tuple[str, ...] = ()):
    """Oznaka `level`, kadar je odgovor da/ne enak `answer` ali vsebuje katero od besed `also`.

    Pri answer="yes" jasen "ne" vedno prevlada (npr. "ni mi slabo").
    """
    def rule(text: str) -> str | None:
        decision = _yes_no(text)
        if answer == "yes" and decision == "no":
            return None
        if decision == answer or (also and _has(text, also)):
            return level
        return None
    return rule


def _free_text(text: str) -> str | None:
    return "medium" if _has(text, _VERY_BAD + ("boli", "slabo", "skrbi")) else None


# Enak vrstni red kot QUESTIONS v phone_call.py.
RULES = [
    _feeling,                  # Kako se danes počutite?
    _sight,                    # Ali z operiranim očesom vidite dobro?
    _pain,                     # Ali vas oko boli? Kako močno, od 0 do 10?
    _when("yes", "medium", ("rdec", "pordel", "bolj")),          # Ali je oko bolj rdeče kot včeraj?
    _when("yes", "high", ("vidim", "blisk", "pik", "senc")),     # Ali vidite bliske, pike ali temno senco?
    _when("yes", "high", ("slab", "bruh")),              # Ali vam je slabo ali ste bruhali?
    _when("no", "low", ("pozab",)),                               # Ali ste danes kapali kapljice za oko?
    _when("no", "low", ("pozab",)),                               # Ali ponoči nosite ščitnik za oko?
    _free_text,                # Bi radi zdravniku še kaj sporočili?
]


def assess_answer(position: int, text: str | None) -> str | None:
    """Oznaka za odgovor na vprašanje `position` (od 1)."""
    if not text or not 1 <= position <= len(RULES):
        return None
    return RULES[position - 1](text)
