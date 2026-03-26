# Stroke Prevention App — Phase 2: UX/UI Design

## 1) Phase Objective
Translate the approved planning scope into a production-ready, responsive UX/UI specification for:
1. Patient mobile-first experience.
2. Guardian/admin live monitoring dashboard.
3. Accessible interactions across mobile, tablet, desktop.

---

## 2) Information Architecture

## 2.1 Patient App Sitemap
- Auth
  - Sign In
  - Sign Up
  - Forgot Password
- Onboarding
  - Consent & privacy
  - Guardian linking
  - Baseline goals setup
- Home
  - Today’s risk score card
  - Daily routine timeline
  - Pending tasks/reminders
- Routines
  - Morning routine
  - Midday routine
  - Evening routine
  - Weekly goals
- Health Logs
  - Vitals logging
  - Medication adherence
  - Meals/hydration
  - Activity/sleep/stress
- Alerts & Safety
  - FAST symptom checker
  - Emergency call actions
- Profile & Settings
  - Notifications
  - Privacy controls
  - Connected devices

## 2.2 Guardian/Admin Sitemap
- Dashboard
  - Live monitored users list
  - Priority alerts
  - Trend snapshot cards
- User Detail
  - Today’s adherence status
  - Last vitals and thresholds
  - Alert/event timeline
  - Messaging/check-in
- Analytics
  - 7/30-day adherence trends
  - Missed-medication patterns
- Access Control
  - Link/unlink patient consent
  - Permission scopes

---

## 3) Core User Flows

## 3.1 Patient — Complete Daily Routine
1. Open app → Home loads “Today’s Plan”.
2. User taps first pending task.
3. Task detail shows instructions + timer/input.
4. User marks complete and optionally logs notes.
5. Progress ring updates and next task is surfaced.
6. Guardian receives completion event in near real time.

## 3.2 Patient — Log Abnormal Vital
1. User opens Health Logs → Vitals.
2. Inputs blood pressure + pulse.
3. App validates range and saves.
4. If threshold breached, app shows guidance card.
5. Alert event pushed to guardian dashboard.

## 3.3 Guardian — Monitor Live Status
1. Guardian opens Dashboard.
2. Sees live cards: online status, last sync, adherence.
3. Clicks user card to open detail timeline.
4. Reviews latest missed tasks or high BP events.
5. Sends check-in prompt or escalation action.

---

## 4) Responsive Design Strategy

## 4.1 Breakpoints
- **Mobile**: 320–767px (primary-first).
- **Tablet**: 768–1023px.
- **Desktop**: 1024px and above.

## 4.2 Layout Rules
- 8px spacing grid; max content widths by device.
- Mobile: single-column, sticky bottom navigation.
- Tablet: two-column split for list/detail.
- Desktop: multi-panel dashboard with persistent sidebar.

## 4.3 Navigation Model
- Patient mobile: bottom tabs (Home, Routines, Logs, Alerts, Profile).
- Tablet/desktop: left sidebar + top utility bar.
- Guardian desktop: left user list, center details, right alert rail.

---

## 5) Screen Blueprints (Low-Fidelity)

## 5.1 Patient Home / Daily Plan
- Header: greeting + date + risk status badge.
- Cards:
  - Progress ring (completed/total tasks)
  - Next reminder countdown
  - High-priority tasks list
- CTA: “Log Vitals”, “Mark Medication Taken”.

## 5.2 Vitals Logging
- Input sections:
  - Blood Pressure (systolic/diastolic)
  - Heart rate
  - Optional glucose/weight
- Inline validation + normal-range helper text.
- Save action with confirmation toast.

## 5.3 Medication Reminder
- Dose card with med name, dosage, schedule.
- Actions: Taken / Skip (reason required).
- Auto-log adherence history entry.

## 5.4 Guardian Live Dashboard
- User tiles sorted by risk priority.
- Live indicators: online dot + last sync timestamp.
- Critical alerts panel and quick-filter chips.

## 5.5 Alert Center
- Severity tabs: Critical / Warning / Info.
- Event row: user, metric, timestamp, action taken.
- Acknowledge + escalation actions.

---

## 6) High-Fidelity UI Spec

## 6.1 Visual Language
- **Style**: clean medical UI, low cognitive load.
- **Color palette**:
  - Primary: #0E7490 (calming cyan)
  - Success: #15803D
  - Warning: #D97706
  - Critical: #B91C1C
  - Surface: #FFFFFF / #F8FAFC
- **Typography**: Inter / system sans fallback.
- **Iconography**: outlined health icons with simple metaphors.

## 6.2 Component States
- Buttons: default / hover / pressed / disabled / loading.
- Form inputs: default / focus / invalid / valid.
- Alert cards: info/warning/critical with semantic color bars.
- Status chips: online/offline/syncing.

## 6.3 Accessibility
- WCAG 2.1 AA contrast targets.
- Minimum tap targets: 44x44 px.
- Visible keyboard focus states.
- Screen-reader labels for vitals forms and alerts.
- Do not use color-only indicators for risk severity.

---

## 7) Real-Time UX Behavior
- Live updates arrive via WebSocket.
- UI event policy:
  - Soft update for routine completion.
  - Sticky banner for critical vitals.
  - Sound/vibration cue (opt-in) for emergency-level alerts.
- If connection drops:
  - Show reconnect chip.
  - Continue local logging queue.
  - Auto-sync on reconnection.

---

## 8) Design Tokens (Initial)

```json
{
  "spacing": { "xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32 },
  "radius": { "sm": 8, "md": 12, "lg": 16, "pill": 999 },
  "fontSize": { "xs": 12, "sm": 14, "md": 16, "lg": 20, "xl": 24 },
  "elevation": { "card": "0 1px 3px rgba(0,0,0,0.08)" }
}
```

---

## 9) Phase 2 Deliverables Checklist
- [x] Information architecture and route map.
- [x] Core user flows (patient + guardian).
- [x] Responsive behavior spec for 3 breakpoints.
- [x] Low-fidelity screen blueprint definitions.
- [x] High-fidelity visual system specification.
- [x] Accessibility and real-time behavior rules.
- [x] Initial design tokens.

---

## 10) Exit Criteria for Phase 2
Phase 2 is complete when stakeholders approve:
1. Navigation and screen hierarchy.
2. Responsive layouts for mobile/tablet/desktop.
3. Patient and guardian interaction flows.
4. Visual language and accessibility constraints.
5. Real-time update behavior and alert semantics.

Upon approval, proceed to **Phase 3: Development**.
