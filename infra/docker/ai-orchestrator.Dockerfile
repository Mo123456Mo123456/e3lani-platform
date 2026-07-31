FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY services/ai-orchestrator/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/ai-orchestrator/app ./app
COPY services/ai-orchestrator/tests ./tests
COPY services/ai-orchestrator/pytest.ini ./

EXPOSE 8002
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
