const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

const db = {
  users: {
    u1: { id: 'u1', role: 'patient', name: 'Alex Patient' },
    a1: { id: 'a1', role: 'admin', name: 'Case Manager Admin' }
  },
  assignments: [{ patientId: 'u1', adminId: 'a1', active: true }],
  routines: {
    u1: [
      { id: 'r1', title: 'Morning blood pressure check', status: 'pending', due: '08:00', createdBy: 'a1' },
      { id: 'r2', title: 'Medication intake confirmation', status: 'pending', due: '09:00', createdBy: 'a1' },
      { id: 'r3', title: '20-minute walk', status: 'pending', due: '17:00', createdBy: 'a1' },
      { id: 'r4', title: 'Hydration goal check', status: 'pending', due: '20:00', createdBy: 'a1' }
    ]
  },
  routineReports: { u1: [] },
  vitals: { u1: [] },
  alerts: [],
  auditLogs: []
};

const adminSseClients = new Map();

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

function hasAssignment(patientId, adminId) {
  return db.assignments.some((a) => a.patientId === patientId && a.adminId === adminId && a.active);
}

function assignedAdminIds(patientId) {
  return db.assignments.filter((a) => a.patientId === patientId && a.active).map((a) => a.adminId);
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

function broadcastAdmin(adminId, event, payload) {
  const clients = adminSseClients.get(adminId) || [];
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
  assignedAdminIds(patientId).forEach((adminId) => broadcastAdmin(adminId, 'alert', alert));
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

function patientSnapshot(patientId) {
  const routines = db.routines[patientId] || [];
  return {
    patient: db.users[patientId],
    adherence: {
      completed: routines.filter((r) => r.status === 'completed').length,
      total: routines.length
    },
    routines,
    routineReports: (db.routineReports[patientId] || []).slice(-30).reverse(),
    lastVitals: (db.vitals[patientId] || []).slice(-1)[0] || null,
    alerts: db.alerts.filter((a) => a.patientId === patientId).slice(-20).reverse()
  };
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const pathname = u.pathname;

  if (req.method === 'OPTIONS') return json(res, 200, { ok: true });

  if (pathname === '/admin/stream') {
    const { role, userId } = parseAuth(req, u);
    if (role !== 'admin' || !db.users[userId]) return json(res, 403, { error: 'admin role required' });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('event: connected\n');
    res.write(`data: ${JSON.stringify({ adminId: userId })}\n\n`);
    if (!adminSseClients.has(userId)) adminSseClients.set(userId, []);
    adminSseClients.get(userId).push(res);
    req.on('close', () => {
      const next = (adminSseClients.get(userId) || []).filter((r) => r !== res);
      adminSseClients.set(userId, next);
    });
    return;
  }

  const patientDash = pathname.match(/^\/api\/patient\/([^/]+)\/dashboard$/);
  if (req.method === 'GET' && patientDash) {
    const patientId = patientDash[1];
    const { role, userId } = parseAuth(req, u);
    if (role !== 'patient' || userId !== patientId) return json(res, 403, { error: 'patient role required' });
    return json(res, 200, patientSnapshot(patientId));
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

    const report = {
      id: crypto.randomUUID(),
      patientId,
      routineId,
      title: item.title,
      due: item.due,
      status: 'completed',
      submittedAt: item.completedAt
    };

    db.routineReports[patientId] = db.routineReports[patientId] || [];
    db.routineReports[patientId].push(report);

    assignedAdminIds(patientId).forEach((adminId) => broadcastAdmin(adminId, 'routine_report', report));
    return json(res, 200, { ok: true, routine: item, report });
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

      assignedAdminIds(patientId).forEach((adminId) => broadcastAdmin(adminId, 'vitals', { patientId, entry }));
      return json(res, 201, { ok: true, vitals: entry });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  const adminAddRoutine = pathname.match(/^\/api\/admin\/([^/]+)\/patients\/([^/]+)\/routines$/);
  if (req.method === 'POST' && adminAddRoutine) {
    const adminId = adminAddRoutine[1];
    const patientId = adminAddRoutine[2];
    const { role, userId } = parseAuth(req, u);
    if (role !== 'admin' || userId !== adminId) return json(res, 403, { error: 'admin role required' });
    if (!hasAssignment(patientId, adminId)) return json(res, 403, { error: 'assignment required' });

    try {
      const body = await readBody(req);
      const title = String(body.title || '').trim();
      const due = String(body.due || '').trim();
      if (!title || !/^\d{2}:\d{2}$/.test(due)) {
        return json(res, 400, { error: 'valid title and due time (HH:MM) are required' });
      }

      const routine = {
        id: crypto.randomUUID(),
        title,
        due,
        status: 'pending',
        createdBy: adminId,
        createdAt: new Date().toISOString()
      };
      db.routines[patientId] = db.routines[patientId] || [];
      db.routines[patientId].push(routine);
      logAudit(adminId, 'create_routine', patientId);
      broadcastAdmin(adminId, 'routine_added', { patientId, routine });
      return json(res, 201, { ok: true, routine });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  const adminPatientReport = pathname.match(/^\/api\/admin\/([^/]+)\/patients\/([^/]+)\/report$/);
  if (req.method === 'GET' && adminPatientReport) {
    const adminId = adminPatientReport[1];
    const patientId = adminPatientReport[2];
    const { role, userId } = parseAuth(req, u);
    if (role !== 'admin' || userId !== adminId) return json(res, 403, { error: 'admin role required' });
    if (!hasAssignment(patientId, adminId)) return json(res, 403, { error: 'assignment required' });
    logAudit(adminId, 'read_patient_report', patientId);
    return json(res, 200, patientSnapshot(patientId));
  }

  const adminAlerts = pathname.match(/^\/api\/admin\/([^/]+)\/alerts$/);
  if (req.method === 'GET' && adminAlerts) {
    const adminId = adminAlerts[1];
    const { role, userId } = parseAuth(req, u);
    if (role !== 'admin' || userId !== adminId) return json(res, 403, { error: 'admin role required' });
    const patientIds = db.assignments.filter((a) => a.adminId === adminId && a.active).map((a) => a.patientId);
    logAudit(adminId, 'read_alerts', patientIds.join(','));
    return json(res, 200, db.alerts.filter((a) => patientIds.includes(a.patientId)).slice(-50).reverse());
  }

  const ackAlert = pathname.match(/^\/api\/admin\/([^/]+)\/alerts\/([^/]+)\/ack$/);
  if (req.method === 'POST' && ackAlert) {
    const adminId = ackAlert[1];
    const alertId = ackAlert[2];
    const { role, userId } = parseAuth(req, u);
    if (role !== 'admin' || userId !== adminId) return json(res, 403, { error: 'admin role required' });
    const alert = db.alerts.find((a) => a.id === alertId);
    if (!alert || !hasAssignment(alert.patientId, adminId)) return json(res, 404, { error: 'alert not found' });
    alert.status = 'acknowledged';
    alert.acknowledgedBy = adminId;
    alert.acknowledgedAt = new Date().toISOString();
    logAudit(adminId, 'ack_alert', alert.patientId);
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
  console.log(`Health assistant running on http://localhost:${PORT}`);
});
