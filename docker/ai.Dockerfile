FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY services/ai-orchestrator/pyproject.toml .
COPY services/ai-orchestrator/app ./app
RUN pip install --no-cache-dir .
RUN useradd --create-home --uid 10001 planet && chown -R planet:planet /app
USER planet
EXPOSE 8100
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
