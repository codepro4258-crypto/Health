# Stroke Prevention App — Phase 1: Planning

## 1) Project Vision
Build a secure, responsive healthcare application that helps users reduce stroke risk through structured daily routines, continuous behavior tracking, and real-time monitoring by authorized caregivers (admin/parent/guardian).

## 2) Primary Users and Roles
- **Patient/User**: Follows routines, logs activities, records vitals, receives reminders.
- **Guardian/Admin**: Monitors user status in real time, receives alerts, reviews adherence trends.
- **Clinician (future extension)**: Reviews long-term risk indicators and intervention notes.

## 3) Core Outcomes (MVP)
1. Improve routine adherence (exercise, medication, hydration, diet, sleep).
2. Increase early visibility of non-adherence and stroke risk signals.
3. Provide secure access control and privacy-first data handling.

## 4) Functional Scope

### A. Structured Daily Routines
- Guided daily checklist with time blocks:
  - Morning blood pressure check
  - Medication intake confirmation
  - 20–30 minute activity session
  - Meal plan adherence (low sodium / DASH-style)
  - Hydration goals
  - Evening sleep-prep and stress reduction
- Habit completion scoring and streaks.
- Smart reminders (push/in-app/SMS later).

### B. Health Tracking Modules
- Vitals: blood pressure, heart rate, glucose (optional), weight.
- Lifestyle: steps/activity, meals, smoking/alcohol status, sleep duration, stress/mood.
- Symptoms quick check (FAST prompts: Face, Arm, Speech, Time).

### C. Real-Time Monitoring
- Guardian dashboard with:
  - Live status (online, last sync time)
  - Latest routine completion state
  - Recent vitals and threshold breaches
  - Alert feed for missed medication / abnormal readings
- Near-real-time updates via WebSockets.

### D. Security & Privacy
- Role-based access control (RBAC).
- OAuth/JWT-based auth with refresh token rotation.
- Encryption in transit (TLS) and at rest (database encryption).
- Audit logs for sensitive reads.
- Consent-based sharing and revocation.
- HIPAA-aligned architectural controls (minimum necessary access).

## 5) Non-Functional Requirements
- **Responsive UI**: mobile-first, tablet and desktop optimized.
- **Performance**: dashboard update latency target < 3s.
- **Availability**: 99.9% service target for monitoring APIs.
- **Accessibility**: WCAG 2.1 AA baseline.
- **Scalability**: support 10k concurrent monitored users (phase-wise).

## 6) Proposed Technical Architecture (MVP)
- **Frontend**: React + TypeScript + Tailwind CSS.
- **Backend**: Node.js (NestJS or Express) + TypeScript.
- **Database**: PostgreSQL.
- **Realtime**: WebSocket gateway (Socket.IO).
- **Queue/Jobs**: BullMQ + Redis for reminders/notifications.
- **Auth/Security**: JWT + refresh tokens, bcrypt/argon2, RBAC middleware.
- **Deployment**: Docker containers, cloud-managed DB, CDN for frontend.

## 7) Data Entities (High-Level)
- User
- GuardianLink (user-guardian relationship + consent)
- RoutineTemplate
- RoutineTask
- RoutineCompletion
- VitalLog
- LifestyleLog
- AlertEvent
- Notification
- AuditLog

## 8) Risk Management
- **Data sensitivity risk** → strict RBAC + audit trails + encryption.
- **False alerts / alert fatigue** → threshold personalization + severity tiers.
- **Low engagement** → onboarding tutorial + streak rewards + reminder tuning.
- **Connectivity issues** → offline cache and background sync.

## 9) Phase Plan (5 Phases)

### Phase 1 — Planning (Current)
- Finalize scope, architecture, features, and security baseline.
- Define acceptance criteria for each module.

### Phase 2 — UX/UI Design
- Information architecture and user flows.
- Responsive wireframes for mobile/tablet/desktop.
- Design system (colors, components, spacing, typography, accessibility).
- High-fidelity screens for patient app and guardian dashboard.

### Phase 3 — Development
- Build frontend screens and backend APIs.
- Implement routine engine, reminders, logs, and real-time monitoring.
- Integrate authentication, RBAC, consent controls, and audit logging.

### Phase 4 — Testing
- Unit tests (frontend/backend), API integration tests, end-to-end flows.
- Security testing (auth/session/access checks, input validation).
- Responsive and accessibility validation.
- Performance checks for real-time dashboards.

### Phase 5 — Deployment & Handover
- Containerized deployment pipeline.
- Environment hardening and secrets management.
- Monitoring/observability dashboards and alerting.
- Production readiness checklist and handover docs.

## 10) MVP Acceptance Criteria
- User can complete daily routine tasks and see adherence progress.
- Guardian can view near-real-time updates and alerts.
- System enforces secure role access and logs sensitive events.
- Responsive UX works across mobile/tablet/desktop form factors.

## 11) Immediate Next Deliverables for Phase 2
1. Sitemap + task flow diagrams.
2. Low-fidelity wireframes (3 breakpoints).
3. High-fidelity UI mockups for:
   - User Home / Daily Plan
   - Vitals Logging
   - Medication Reminder
   - Guardian Live Dashboard
   - Alert Center
4. Clickable prototype and component design tokens.
