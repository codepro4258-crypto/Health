# Health - Stroke Prevention App

This repository contains a simple Node.js MVP for patient routine tracking, admin-assigned routine reporting, vitals logging, and real-time administrator monitoring.

## What this project includes

- **Patient dashboard** for daily routines and vitals entry.
- **Food reminder planner** for meal scheduling with due-time status indicators.
- **Administrator console** for assigning routines to patients and viewing reports in real-time.
- **Guardian dashboard** for remote monitoring and alerts.
- **HTTP API** for routines, vitals, monitor data, and alert acknowledgement.
- **Server-Sent Events (SSE)** stream for administrator real-time updates.

## Demo users

- Patient: `u1`
- Administrator: `a1`

## Run locally

```bash
npm install
npm start
```

Then open:

- `http://localhost:3000` - unified health assistant dashboard with patient + administrator views
- `http://localhost:3000` - unified health assistant dashboard served from `index.html`

## Notes

- This project currently uses in-memory data storage defined in `server.js`.
- Threshold-based alerts are triggered for elevated blood pressure and high pulse readings.
