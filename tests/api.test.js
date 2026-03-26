const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');

function headers(role, userId) {
  return { 'X-Role': role, 'X-User-Id': userId, 'Content-Type': 'application/json' };
}

test('patient dashboard enforces role and returns routine data', async () => {
  const { server } = createApp();
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
  const { server } = createApp();
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

test('guardian can acknowledge alert and admin can read audit logs', async () => {
  const { server } = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  await fetch(`${base}/api/patient/u1/vitals`, {
    method: 'POST',
    headers: headers('patient', 'u1'),
    body: JSON.stringify({ systolic: 145, diastolic: 95, pulse: 90 })
  });

  const alertsRes = await fetch(`${base}/api/guardian/g1/alerts`, { headers: headers('guardian', 'g1') });
  const alerts = await alertsRes.json();
  const alertId = alerts[0].id;

  const ackRes = await fetch(`${base}/api/guardian/g1/alerts/${alertId}/ack`, {
    method: 'POST',
    headers: headers('guardian', 'g1')
  });
  assert.equal(ackRes.status, 200);
  const ack = await ackRes.json();
  assert.equal(ack.alert.status, 'acknowledged');

  const auditForbidden = await fetch(`${base}/api/audit-logs`, { headers: headers('guardian', 'g1') });
  assert.equal(auditForbidden.status, 403);

  const auditOk = await fetch(`${base}/api/audit-logs`, { headers: headers('admin', 'admin1') });
  assert.equal(auditOk.status, 200);
  const logs = await auditOk.json();
  assert.ok(logs.some((entry) => entry.action === 'read_alerts'));
  assert.ok(logs.some((entry) => entry.action === 'ack_alert'));

  await new Promise((resolve) => server.close(resolve));
});

test('security headers are present on API responses', async () => {
  const { server } = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const res = await fetch(`${base}/api/patient/u1/dashboard`, { headers: headers('patient', 'u1') });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.ok(res.headers.get('content-security-policy').includes("default-src 'self'"));
  assert.ok(res.headers.get('x-request-id'));

  await new Promise((resolve) => server.close(resolve));
});

test('rate limiting blocks excessive API calls and metrics endpoint works', async () => {
  const { server } = createApp({ rateLimitMax: 2, rateWindowMs: 60_000 });
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const r1 = await fetch(`${base}/api/patient/u1/dashboard`, { headers: headers('patient', 'u1') });
  const r2 = await fetch(`${base}/api/patient/u1/dashboard`, { headers: headers('patient', 'u1') });
  const r3 = await fetch(`${base}/api/patient/u1/dashboard`, { headers: headers('patient', 'u1') });

  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);
  assert.equal(r3.status, 429);

  const metricsForbidden = await fetch(`${base}/metrics`, { headers: headers('guardian', 'g1') });
  assert.equal(metricsForbidden.status, 403);

  const metricsOk = await fetch(`${base}/metrics`, { headers: headers('admin', 'admin1') });
  assert.equal(metricsOk.status, 200);
  const metrics = await metricsOk.json();
  assert.ok(metrics.requestsTotal >= 3);
  assert.ok(metrics.rateLimited >= 1);

  await new Promise((resolve) => server.close(resolve));
});
