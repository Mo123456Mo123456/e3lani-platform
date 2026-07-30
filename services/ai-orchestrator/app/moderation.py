"""Rule-based moderation and prompt-injection detection."""

from __future__ import annotations

import re
from typing import Iterable

from .schemas import ModerationResult

BANNED_PATTERNS: list[tuple[str, str]] = [
    (r"(?i)\b(child\s*porn|csam|exploit\s*minor)\b", "banned_content"),
    (r"(?i)\b(make\s+a\s+bomb|build\s+a\s+weapon|synthesize\s+sarin)\b", "dangerous_real_world"),
    (r"(?i)\b(credit\s*card\s*dump|ransomware\s*kit)\b", "cybercrime"),
]

INJECTION_PATTERNS: list[tuple[str, str]] = [
    (r"(?i)ignore\s+(all\s+)?(previous|prior|above)\s+instructions", "prompt_injection"),
    (r"(?i)disregard\s+(your|the)\s+(system|developer)\s+prompt", "prompt_injection"),
    (r"(?i)you\s+are\s+now\s+(dan|jailbroken|unrestricted)", "jailbreak"),
    (r"(?i)system\s*:\s*you\s+must", "role_hijack"),
    (r"(?i)<\s*/?\s*system\s*>", "system_tag_injection"),
    (r"(?i)reveal\s+(your\s+)?(system\s+prompt|hidden\s+instructions)", "prompt_exfiltration"),
    (r"(?i)أ تجاهل\s+التعليمات", "prompt_injection_ar"),
    (r"(?i)تجاهل\s+(كل\s+)?التعليمات\s+السابقة", "prompt_injection_ar"),
]

# Concepts that need rate-limiting style soft flags (not hard bans)
RATE_CONCEPTS: list[tuple[str, str]] = [
    (r"(?i)\bomnipotent\b|\binvincible\b|\bunlimited\s+power\b", "overpowered_concept"),
    (r"(?i)\bwipes?\s+out\s+(all\s+)?life\b", "extinction_concept"),
    (r"(?i)\binstant\s+god\b|\bone[- ]shot\s+win\b", "overpowered_concept"),
    (r"(?i)قدرة\s+غير\s+محدودة|قوة\s+مطلقة", "overpowered_concept_ar"),
]


def _match_flags(text: str, patterns: Iterable[tuple[str, str]]) -> list[str]:
    flags: list[str] = []
    for pattern, flag in patterns:
        if re.search(pattern, text):
            flags.append(flag)
    return flags


def moderate(text: str) -> ModerationResult:
    """Rule-based gate: bans, injection detection, rate-concept flags."""
    reasons: list[str] = []
    flags: list[str] = []

    banned = _match_flags(text, BANNED_PATTERNS)
    injections = _match_flags(text, INJECTION_PATTERNS)
    rated = _match_flags(text, RATE_CONCEPTS)

    flags.extend(banned)
    flags.extend(injections)
    flags.extend(rated)

    if banned:
        reasons.append("Text matches banned safety patterns.")
    if injections:
        reasons.append("Prompt injection / jailbreak attempt detected.")
    if rated:
        reasons.append("Overpowered or extreme concepts flagged for balancing.")

    allowed = not banned and not injections
    sanitized = text.strip()
    if injections:
        # Strip common injection phrases for downstream sandbox use
        sanitized = re.sub(
            r"(?i)ignore\s+(all\s+)?(previous|prior|above)\s+instructions[^.!?\n]*[.!?]?",
            "",
            sanitized,
        ).strip()

    return ModerationResult(
        allowed=allowed,
        reasons=reasons,
        flags=sorted(set(flags)),
        sanitized_text=sanitized if sanitized else None,
    )
