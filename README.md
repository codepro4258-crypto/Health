# Health - Stroke Prevention App

This repository contains a simple Node.js MVP for patient routine tracking, vitals logging, and guardian monitoring.

## What this project includes

- **Patient dashboard** for daily routines and vitals entry.
- **Guardian dashboard** for remote monitoring and alerts.
- **HTTP API** for routines, vitals, monitor data, and alert acknowledgement.
- **Server-Sent Events (SSE)** stream for guardian real-time updates.

## Demo users

- Patient: `u1`
- Guardian: `g1`

## Run locally

```bash
npm install
npm start
```

Then open:

- `http://localhost:3000` - patient dashboard route served from `public/index.html`
- `http://localhost:3000/guardian.html` - guardian dashboard

## Notes

- This project currently uses in-memory data storage defined in `server.js`.
- Threshold-based alerts are triggered for elevated blood pressure and high pulse readings.
