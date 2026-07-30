# Deployment

Minimum services:

- API on port 4000
- Web on port 3000
- Realtime gateway on port 4010
- PostgreSQL 16
- Redis 7

Optional:

- MinIO/S3-compatible storage for generated assets.

Use `.env.example` as the deployment checklist. Replace JWT secrets and sandbox admin credentials before exposing the system.
