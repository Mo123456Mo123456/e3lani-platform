FROM python:3.13-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY services/ai-orchestrator/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/ai-orchestrator/app ./app
RUN useradd --create-home --uid 10001 planet && chown -R planet:planet /app
USER planet
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
