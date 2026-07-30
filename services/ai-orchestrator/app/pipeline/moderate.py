from __future__ import annotations

from app.models import Locale, ModerationResult
from app.validation import detect_locale, normalize_text


ABUSE_KEYWORDS = (
    "kill yourself",
    "i hate you",
    "slur",
    "لعنة",
    "اكرهك",
    "اقتل نفسك",
)

PROMPT_INJECTION_KEYWORDS = (
    "ignore previous instructions",
    "ignore all previous",
    "system prompt",
    "developer message",
    "jailbreak",
    "reveal your instructions",
    "تجاهل التعليمات",
    "اكشف التعليمات",
    "رسالة النظام",
)

GOD_MODE_KEYWORDS = (
    "immortal",
    "infinite energy",
    "destroy planet instantly",
    "unlimited reproduction",
    "absolute control",
    "cancel all laws",
    "god mode",
    "خالد",
    "لا يموت",
    "طاقة لا نهائية",
    "يدمر الكوكب فورا",
    "تكاثر غير محدود",
    "سيطرة مطلقة",
    "يلغي كل القوانين",
)


def moderate_text(text: str, locale: Locale | None = None) -> ModerationResult:
    normalized = normalize_text(text)
    lowered = normalized.lower()
    active_locale = detect_locale(normalized, locale)
    flags: list[str] = []
    reasons: list[str] = []
    severity = 0.0

    if any(keyword in lowered for keyword in ABUSE_KEYWORDS):
        flags.append("abuse")
        reasons.append(_message("Abusive language is not allowed.", "اللغة المسيئة غير مسموحة.", active_locale))
        severity = max(severity, 0.75)

    if any(keyword in lowered for keyword in PROMPT_INJECTION_KEYWORDS):
        flags.append("prompt_injection")
        reasons.append(
            _message(
                "Prompt-injection attempts are ignored and cannot change system behavior.",
                "محاولات حقن التعليمات يتم تجاهلها ولا تغير سلوك النظام.",
                active_locale,
            )
        )
        severity = max(severity, 0.9)

    if any(keyword in lowered for keyword in GOD_MODE_KEYWORDS):
        flags.append("forbidden_god_mode")
        reasons.append(
            _message(
                "God-mode mechanics must be balanced or rejected before simulation.",
                "قدرات التحكم المطلق يجب موازنتها أو رفضها قبل المحاكاة.",
                active_locale,
            )
        )
        severity = max(severity, 0.6)

    allowed = "abuse" not in flags and "prompt_injection" not in flags
    return ModerationResult(allowed=allowed, flags=flags, reasons=reasons, severity=severity)


def _message(en: str, ar: str, locale: Locale) -> str:
    return ar if locale == "ar" else en
