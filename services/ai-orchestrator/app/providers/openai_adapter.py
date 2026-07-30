from app.providers.sandbox import SandboxProvider


class OpenAIAdapter(SandboxProvider):
    """OpenAI provider placeholder with sandbox-safe behavior.

    The orchestration contract requires structured, validated output. Until a
    production prompt/schema is wired in, this adapter reuses the deterministic
    parser rather than producing unverified free-form results.
    """

    provider_name = "openai"
    is_sandbox = False
