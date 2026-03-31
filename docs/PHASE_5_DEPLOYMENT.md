# Stroke Prevention App — Phase 5: Deployment & Handover

## Objective
Package and operationalize the MVP for reproducible deployment with basic runtime health checks, CI test automation, and handover documentation.

## Deployment Deliverables

1. **Containerization**
   - `Dockerfile` created for a production-style Node 20 Alpine runtime.
   - Includes `HEALTHCHECK` against `/health` endpoint.

2. **Local orchestration**
   - `docker-compose.yml` added for one-command local deployment.
   - Exposes app on `http://localhost:3000` and enforces restart policy.

3. **Environment baseline**
   - `.env.example` added with runtime settings placeholders.

4. **CI quality gate**
   - GitHub Actions workflow (`.github/workflows/ci.yml`) executes `npm test` on push/PR.

5. **Runtime readiness endpoint**
   - Added `GET /health` to support platform and container health probes.

## Runbook

### Local (non-container)
```bash
npm start
```

### Docker build/run
```bash
docker build -t stroke-prevention-app .
docker run --rm -p 3000:3000 stroke-prevention-app
```

### Docker Compose
```bash
docker compose up --build
```

### Health check
```bash
curl http://localhost:3000/health
```

## Handover Notes
- Current data layer is in-memory and resets on restart.
- For production: replace with PostgreSQL + migrations + secrets manager.
- Replace header-based mock auth with signed JWT/OAuth provider.
- Add observability stack (metrics, logs, tracing) for live operations.

## Exit Criteria Status
- [x] Deployable artifact (Dockerfile) present.
- [x] Basic orchestration (docker-compose) present.
- [x] Runtime health probe endpoint present.
- [x] CI test workflow present.
- [x] Handover and operational notes documented.
