const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

const db = {
  users: {
    u1: { id: 'u1', role: 'patient', name: 'Alex Patient' },
    g1: { id: 'g1', role: 'guardian', name: 'Jordan Guardian' }
  },
  consent: [{ patientId: 'u1', guardianId: 'g1', active: true }],
  routines: {
    u1: [
      { id: 'r1', title: 'Morning blood pressure check', status: 'pending', due: '08:00' },
      { id: 'r2', title: 'Medication intake confirmation', status: 'pending', due: '09:00' },
      { id: 'r3', title: '20-minute walk', status: 'pending', due: '17:00' },
      { id: 'r4', title: 'Hydration goal check', status: 'pending', due: '20:00' }
    ]
  },
  vitals: { u1: [] },
  alerts: [],
  auditLogs: []
};

const sseClients = new Map();

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Role, X-User-Id',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function logAudit(actorId, action, targetId) {
  db.auditLogs.push({ id: crypto.randomUUID(), actorId, action, targetId, at: new Date().toISOString() });
}

function hasConsent(patientId, guardianId) {
  return db.consent.some((c) => c.patientId === patientId && c.guardianId === guardianId && c.active);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

function parseAuth(req, urlObj = null) {
  return {
    role: req.headers['x-role'] || (urlObj && urlObj.searchParams.get('role')),
    userId: req.headers['x-user-id'] || (urlObj && urlObj.searchParams.get('userId'))
  };
}

function broadcastGuardian(guardianId, event, payload) {
  const clients = sseClients.get(guardianId) || [];
  for (const res of clients) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

function pushAlert(patientId, type, metric, value, threshold) {
  const alert = {
    id: crypto.randomUUID(),
    patientId,
    type,
    metric,
    value,
    threshold,
    status: 'open',
    createdAt: new Date().toISOString()
  };
  db.alerts.push(alert);
  const links = db.consent.filter((c) => c.patientId === patientId && c.active);
  links.forEach((l) => broadcastGuardian(l.guardianId, 'alert', alert));
  return alert;
}

function serveStatic(req, res, pathname) {
  const rootIndexPath = path.join(__dirname, 'index.html');
  if (pathname === '/' || pathname === '/index.html') {
    return fs.readFile(rootIndexPath, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('Not found');
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(data);
    });
  }

  const fullPath = path.join(__dirname, 'public', pathname);
  if (!fullPath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(fullPath);
    const types = {
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.svg': 'image/svg+xml',
      '.webmanifest': 'application/manifest+json'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const pathname = u.pathname;

  if (req.method === 'OPTIONS') return json(res, 200, { ok: true });

  if (pathname === '/guardian/stream') {
    const { role, userId } = parseAuth(req, u);
    if (role !== 'guardian' || !db.users[userId]) return json(res, 403, { error: 'guardian role required' });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('event: connected\n');
    res.write(`data: ${JSON.stringify({ guardianId: userId })}\n\n`);
    if (!sseClients.has(userId)) sseClients.set(userId, []);
    sseClients.get(userId).push(res);
    req.on('close', () => {
      const next = (sseClients.get(userId) || []).filter((r) => r !== res);
      sseClients.set(userId, next);
    });
    return;
  }

  const patientDash = pathname.match(/^\/api\/patient\/([^/]+)\/dashboard$/);
  if (req.method === 'GET' && patientDash) {
    const patientId = patientDash[1];
    const { role, userId } = parseAuth(req, u);
    if (role !== 'patient' || userId !== patientId) return json(res, 403, { error: 'patient role required' });
    const routines = db.routines[patientId] || [];
    const completed = routines.filter((r) => r.status === 'completed').length;
    return json(res, 200, {
      patient: db.users[patientId],
      routines,
      adherence: { completed, total: routines.length },
      lastVitals: (db.vitals[patientId] || []).slice(-1)[0] || null
    });
  }

  const routineComplete = pathname.match(/^\/api\/patient\/([^/]+)\/routines\/([^/]+)\/complete$/);
  if (req.method === 'POST' && routineComplete) {
    const patientId = routineComplete[1];
    const routineId = routineComplete[2];
    const { role, userId } = parseAuth(req, u);
    if (role !== 'patient' || userId !== patientId) return json(res, 403, { error: 'patient role required' });
    const item = (db.routines[patientId] || []).find((r) => r.id === routineId);
    if (!item) return json(res, 404, { error: 'routine not found' });
    item.status = 'completed';
    item.completedAt = new Date().toISOString();
    const payload = { patientId, routineId, title: item.title, completedAt: item.completedAt };
    db.consent.filter((c) => c.patientId === patientId && c.active).forEach((l) => broadcastGuardian(l.guardianId, 'routine', payload));
    return json(res, 200, { ok: true, routine: item });
  }

  const vitalsLog = pathname.match(/^\/api\/patient\/([^/]+)\/vitals$/);
  if (req.method === 'POST' && vitalsLog) {
    const patientId = vitalsLog[1];
    const { role, userId } = parseAuth(req, u);
    if (role !== 'patient' || userId !== patientId) return json(res, 403, { error: 'patient role required' });
    try {
      const body = await readBody(req);
      const systolic = Number(body.systolic);
      const diastolic = Number(body.diastolic);
      const pulse = Number(body.pulse);
      if (!systolic || !diastolic || !pulse) return json(res, 400, { error: 'systolic, diastolic, pulse are required' });
      const entry = { id: crypto.randomUUID(), systolic, diastolic, pulse, at: new Date().toISOString() };
      db.vitals[patientId] = db.vitals[patientId] || [];
      db.vitals[patientId].push(entry);

      if (systolic >= 140 || diastolic >= 90) {
        pushAlert(patientId, 'critical', 'blood_pressure', `${systolic}/${diastolic}`, '>=140/90');
      }
      if (pulse >= 120) {
        pushAlert(patientId, 'warning', 'pulse', pulse, '>=120');
      }

      db.consent.filter((c) => c.patientId === patientId && c.active).forEach((l) => broadcastGuardian(l.guardianId, 'vitals', { patientId, entry }));
      return json(res, 201, { ok: true, vitals: entry });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  const guardianMonitor = pathname.match(/^\/api\/guardian\/([^/]+)\/monitors\/([^/]+)$/);
  if (req.method === 'GET' && guardianMonitor) {
    const guardianId = guardianMonitor[1];
    const patientId = guardianMonitor[2];
    const { role, userId } = parseAuth(req, u);
    if (role !== 'guardian' || userId !== guardianId) return json(res, 403, { error: 'guardian role required' });
    if (!hasConsent(patientId, guardianId)) return json(res, 403, { error: 'consent required' });
    logAudit(guardianId, 'read_patient_monitor', patientId);
    const routines = db.routines[patientId] || [];
    return json(res, 200, {
      patient: db.users[patientId],
      adherence: {
        completed: routines.filter((r) => r.status === 'completed').length,
        total: routines.length
      },
      lastVitals: (db.vitals[patientId] || []).slice(-1)[0] || null,
      alerts: db.alerts.filter((a) => a.patientId === patientId).slice(-20)
    });
  }

  const guardianAlerts = pathname.match(/^\/api\/guardian\/([^/]+)\/alerts$/);
  if (req.method === 'GET' && guardianAlerts) {
    const guardianId = guardianAlerts[1];
    const { role, userId } = parseAuth(req, u);
    if (role !== 'guardian' || userId !== guardianId) return json(res, 403, { error: 'guardian role required' });
    const patientIds = db.consent.filter((c) => c.guardianId === guardianId && c.active).map((c) => c.patientId);
    logAudit(guardianId, 'read_alerts', patientIds.join(','));
    return json(res, 200, db.alerts.filter((a) => patientIds.includes(a.patientId)).slice(-50));
  }

  const ackAlert = pathname.match(/^\/api\/guardian\/([^/]+)\/alerts\/([^/]+)\/ack$/);
  if (req.method === 'POST' && ackAlert) {
    const guardianId = ackAlert[1];
    const alertId = ackAlert[2];
    const { role, userId } = parseAuth(req, u);
    if (role !== 'guardian' || userId !== guardianId) return json(res, 403, { error: 'guardian role required' });
    const alert = db.alerts.find((a) => a.id === alertId);
    if (!alert || !hasConsent(alert.patientId, guardianId)) return json(res, 404, { error: 'alert not found' });
    alert.status = 'acknowledged';
    alert.acknowledgedBy = guardianId;
    alert.acknowledgedAt = new Date().toISOString();
    logAudit(guardianId, 'ack_alert', alert.patientId);
    return json(res, 200, { ok: true, alert });
  }

  if (req.method === 'GET' && pathname === '/api/audit-logs') {
    const { role } = parseAuth(req);
    if (role !== 'admin') return json(res, 403, { error: 'admin role required' });
    return json(res, 200, db.auditLogs.slice(-100));
  }

  if (req.method === 'GET' && pathname.startsWith('/api/')) return json(res, 404, { error: 'Not found' });
  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Stroke prevention app running on http://localhost:${PORT}`);
});
