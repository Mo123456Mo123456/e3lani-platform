from app.providers.sandbox import SandboxProvider


class AnthropicAdapter(SandboxProvider):
    """Anthropic provider placeholder with sandbox-safe structured behavior."""

    provider_name = "anthropic"
    is_sandbox = False
