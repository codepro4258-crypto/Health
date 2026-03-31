const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createApp } = require('../server');

function headers(role, userId) {
  return { 'X-Role': role, 'X-User-Id': userId, 'Content-Type': 'application/json' };
}

function createTestApp(overrides = {}) {
  return createApp({ inMemoryOnly: true, ...overrides });
}

test('patient dashboard enforces role and returns routine data', async () => {
  const { server } = createTestApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const forbidden = await fetch(`${base}/api/patient/u1/dashboard`, { headers: headers('guardian', 'g1') });
  assert.equal(forbidden.status, 403);

  const ok = await fetch(`${base}/api/patient/u1/dashboard`, { headers: headers('patient', 'u1') });
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.patient.id, 'u1');
  assert.equal(body.routines.length, 4);

  await new Promise((resolve) => server.close(resolve));
});

test('critical vitals create alert visible to guardian', async () => {
  const { server } = createTestApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const vitalsRes = await fetch(`${base}/api/patient/u1/vitals`, {
    method: 'POST',
    headers: headers('patient', 'u1'),
    body: JSON.stringify({ systolic: 160, diastolic: 100, pulse: 85 })
  });
  assert.equal(vitalsRes.status, 201);

  const alertsRes = await fetch(`${base}/api/guardian/g1/alerts`, { headers: headers('guardian', 'g1') });
  assert.equal(alertsRes.status, 200);
  const alerts = await alertsRes.json();
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].type, 'critical');

  await new Promise((resolve) => server.close(resolve));
});

test('lifestyle logging is available to patient and guardian monitor', async () => {
  const { server } = createTestApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const post = await fetch(`${base}/api/patient/u1/lifestyle`, {
    method: 'POST',
    headers: headers('patient', 'u1'),
    body: JSON.stringify({ steps: 6500, sleepHours: 7.5, hydrationMl: 1800, stressLevel: 'low' })
  });
  assert.equal(post.status, 201);

  const list = await fetch(`${base}/api/patient/u1/lifestyle`, { headers: headers('patient', 'u1') });
  assert.equal(list.status, 200);
  const lifestyleRows = await list.json();
  assert.equal(lifestyleRows.length, 1);
  assert.equal(lifestyleRows[0].steps, 6500);

  const guardian = await fetch(`${base}/api/guardian/g1/monitors/u1`, { headers: headers('guardian', 'g1') });
  const guardianBody = await guardian.json();
  assert.equal(guardianBody.lastLifestyle.steps, 6500);

  await new Promise((resolve) => server.close(resolve));
});

test('security headers are present and rate limiting blocks excessive API calls', async () => {
  const { server } = createTestApp({ rateLimitMax: 2, rateWindowMs: 60_000 });
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const r1 = await fetch(`${base}/api/patient/u1/dashboard`, { headers: headers('patient', 'u1') });
  assert.equal(r1.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r1.headers.get('x-frame-options'), 'DENY');
  assert.ok(r1.headers.get('content-security-policy').includes("default-src 'self'"));
  assert.ok(r1.headers.get('x-request-id'));

  const r2 = await fetch(`${base}/api/patient/u1/dashboard`, { headers: headers('patient', 'u1') });
  const r3 = await fetch(`${base}/api/patient/u1/dashboard`, { headers: headers('patient', 'u1') });
  assert.equal(r2.status, 200);
  assert.equal(r3.status, 429);

  await new Promise((resolve) => server.close(resolve));
});

test('metrics endpoint is admin-only', async () => {
  const { server } = createTestApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const denied = await fetch(`${base}/metrics`, { headers: headers('guardian', 'g1') });
  assert.equal(denied.status, 403);

  const ok = await fetch(`${base}/metrics`, { headers: headers('admin', 'admin1') });
  assert.equal(ok.status, 200);

  await new Promise((resolve) => server.close(resolve));
});

test('file persistence survives app recreation', async () => {
  const tmp = path.join(os.tmpdir(), `stroke-app-${Date.now()}.json`);

  const app1 = createApp({ dataFile: tmp });
  await new Promise((resolve) => app1.server.listen(0, resolve));
  const base1 = `http://127.0.0.1:${app1.server.address().port}`;

  await fetch(`${base1}/api/patient/u1/lifestyle`, {
    method: 'POST',
    headers: headers('patient', 'u1'),
    body: JSON.stringify({ steps: 7000, sleepHours: 8, hydrationMl: 2000, stressLevel: 'low' })
  });

  await new Promise((resolve) => app1.server.close(resolve));

  const app2 = createApp({ dataFile: tmp });
  await new Promise((resolve) => app2.server.listen(0, resolve));
  const base2 = `http://127.0.0.1:${app2.server.address().port}`;
  const list = await fetch(`${base2}/api/patient/u1/lifestyle`, { headers: headers('patient', 'u1') });
  const rows = await list.json();
  assert.ok(rows.some((row) => row.steps === 7000));

  await new Promise((resolve) => app2.server.close(resolve));
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
});


test('cross-platform assets are served with expected headers', async () => {
  const { server } = createTestApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const manifest = await fetch(`${base}/manifest.webmanifest`);
  assert.equal(manifest.status, 200);
  assert.equal(manifest.headers.get('content-type'), 'application/manifest+json');

  const sw = await fetch(`${base}/sw.js`);
  assert.equal(sw.status, 200);
  assert.equal(sw.headers.get('cache-control'), 'no-cache');

  await new Promise((resolve) => server.close(resolve));
});

test('friendly web routes resolve without 404 in deployment-style URLs', async () => {
  const { server } = createTestApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const patientRoute = await fetch(`${base}/patient`);
  assert.equal(patientRoute.status, 200);
  assert.ok((await patientRoute.text()).includes('Stroke Prevention'));

  const guardianRoute = await fetch(`${base}/guardian`);
  assert.equal(guardianRoute.status, 200);
  assert.ok((await guardianRoute.text()).includes('Guardian Dashboard'));

  await new Promise((resolve) => server.close(resolve));
});
