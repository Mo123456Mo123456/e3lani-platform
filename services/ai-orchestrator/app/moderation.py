"""Input safety: banned content, prompt-injection and abuse heuristics.

Runs BEFORE any LLM call. User text is data, never instructions:
nothing here becomes code, SQL, or a system prompt.
"""
from __future__ import annotations

import re

from .schemas import ModerationVerdict

MAX_TEXT_LEN = 1200

_BANNED = [
    r"كيفية صنع (قنبلة|سلاح|متفجر)",
    r"(اقتل|اذبح)\s+(ال|كل|هؤلاء)",
    r"\b(how to make (a )?(bomb|weapon|explosive))\b",
    r"\b(kill all|exterminate)\s+\w+",
    r"\b(child|minor)\s+(porn|sexual)",
    r"محتوى جنسي",
]

_INJECTION = [
    r"تجاهل (جميع )?(التعليمات|الأوامر)",
    r"تظاهر انك|تظاهر أنك",
    r"اكتب (كود|شيفرة)",
    r"نفذ (أمر|الأمر)",
    r"\b(ignore|disregard)\b.{0,40}\b(instructions?|rules?|prompts?)\b",
    r"\b(system prompt|developer mode|jailbreak|DAN mode)\b",
    r"\b(you are now|act as|pretend to be)\b",
    r"\b(execute|run|eval)\s*\(",
    r"\bSELECT\b.+\bFROM\b",
    r"\b(DROP|DELETE|TRUNCATE)\s+TABLE\b",
    r"\{\{.*\}\}",
    r"<\s*/?\s*(script|iframe|img|svg)",
    r"javascript:",
    r"data:text/(html|javascript)",
    r"[A-Za-z0-9+/]{300,}={0,2}",  # long base64 blobs
]

_BYPASS = [
    r"(لا يموت|خالد|لا يمكن قتله).{0,60}(يدمر|يسيطر)",
    r"\b(god ?mode|admin access|root access|bypass)\b",
    r"(سيطرة مطلقة|تحكم كامل) على (الكوكب|العالم|النظام)",
    r"\bunlimited (energy|power|resources)\b.{0,50}\b(destroy|control)\b",
]


def moderate_text(text: str) -> ModerationVerdict:
    reasons: list[str] = []
    status = "allow"
    if not text or not text.strip():
        return ModerationVerdict(status="block", reasons=["empty_text"])
    if len(text) > MAX_TEXT_LEN:
        return ModerationVerdict(status="block", reasons=["text_too_long"])

    for pat in _BANNED:
        if re.search(pat, text, re.IGNORECASE):
            reasons.append("banned_content")
            status = "block"
            break
    for pat in _INJECTION:
        if re.search(pat, text, re.IGNORECASE | re.DOTALL):
            reasons.append("prompt_injection")
            status = "block"
            break
    if status != "block":
        for pat in _BYPASS:
            if re.search(pat, text, re.IGNORECASE):
                reasons.append("world_rule_bypass_attempt")
                status = "flag"
                break
    words = text.split()
    if len(words) != len(set(words)) and len(words) > 12:
        uniq = len(set(words)) / len(words)
        if uniq < 0.4:
            reasons.append("repetitive_spam")
            status = "block"
    return ModerationVerdict(status=status, reasons=reasons)
