# Stroke Prevention App — Phase 4: Testing

## Objective
Validate the Phase 3 MVP for core functionality, role-based access, consent-based data visibility, alerting behavior, and security boundaries.

## Test Coverage Added

## 1) Automated API Integration Tests (`tests/api.test.js`)
- **Role enforcement**
  - Guardian cannot access patient-only endpoint.
  - Patient can access own dashboard and routine payload.
- **Clinical alerting behavior**
  - Critical blood pressure readings generate guardian-visible alerts.
- **Workflow integrity**
  - Guardian can acknowledge alert and status updates correctly.
- **Security/privacy controls**
  - Non-admin cannot access audit logs.
  - Admin can access audit logs and sees sensitive-read/action traces.

## 2) Static/Syntax Validation
- `node --check server.js` used to validate server syntax.

## Acceptance Criteria Status
- [x] Functional patient and guardian flows validated.
- [x] Alert generation and acknowledgement validated.
- [x] Access control boundaries validated.
- [x] Audit logging visibility validated.

## Execution Commands
```bash
node --check server.js
npm test
```

## Exit Notes
Phase 4 is complete for MVP-level validation. Recommended next steps for Phase 5:
- Deployment hardening (containerization + env secrets).
- Runtime monitoring and error telemetry.
- CI pipeline with automatic test execution on each PR.
