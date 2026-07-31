FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY services/simulation-engine/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/simulation-engine/app ./app
COPY services/simulation-engine/tests ./tests
COPY services/simulation-engine/pytest.ini ./

EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
