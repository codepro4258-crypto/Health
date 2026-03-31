# Stroke Prevention App — Phase 3: Development

## Implemented MVP Scope

This phase delivers a runnable end-to-end MVP with:
- Patient experience for daily routines and vitals logging.
- Guardian dashboard with live monitoring and alerts.
- Security baseline via role checks, consent checks, and audit logs.

## Delivered Components

1. **Backend service (`server.js`)**
   - HTTP API endpoints for patient and guardian workflows.
   - SSE channel for live updates to guardian dashboard.
   - In-memory data store for routines, vitals, alerts, consent, and audit logs.

2. **Patient UI (`public/index.html`, `public/app.js`)**
   - Responsive routine checklist with completion actions.
   - Vitals entry form (systolic/diastolic/pulse) and status feedback.

3. **Guardian UI (`public/guardian.html`, `public/guardian.js`)**
   - Live patient status panel.
   - Live event feed (routine complete, vitals logged, alerts).
   - Alert acknowledgement actions.

4. **Responsive styling (`public/styles.css`)**
   - Mobile-first layout.
   - Tablet split layout for patient.
   - Desktop 3-column layout for guardian dashboard.

## Security & Privacy Controls Included in MVP
- Role-based endpoint authorization (`patient`, `guardian`, `admin`).
- Consent validation before guardian can access patient data.
- Audit logging for sensitive guardian reads and alert actions.
- CORS and request parsing controls for API boundaries.

## API Surface (MVP)
- `GET /api/patient/:id/dashboard`
- `POST /api/patient/:id/routines/:routineId/complete`
- `POST /api/patient/:id/vitals`
- `GET /api/guardian/:id/monitors/:patientId`
- `GET /api/guardian/:id/alerts`
- `POST /api/guardian/:id/alerts/:alertId/ack`
- `GET /api/audit-logs` (admin only)
- `GET /guardian/stream` (SSE live feed)

## How to Run
```bash
npm start
# then open:
# http://localhost:3000/            (patient)
# http://localhost:3000/guardian.html (guardian)
```

## Notes
- Data persistence is currently in-memory for MVP speed.
- Production phase should replace in-memory storage with PostgreSQL and real auth tokens.
