const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');
const { loadJson, saveJson } = require('./lib/storage');

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'app-data.json');

function createDefaultDb() {
  return {
    users: {
      u1: { id: 'u1', role: 'patient', name: 'Alex Patient' },
      g1: { id: 'g1', role: 'guardian', name: 'Jordan Guardian' },
      admin1: { id: 'admin1', role: 'admin', name: 'Casey Admin' }
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
    lifestyle: { u1: [] },
    alerts: [],
    auditLogs: []
  };
}

function createApp(options = {}) {
  const sseClients = new Map();
  const rateWindowMs = options.rateWindowMs ?? 60_000;
  const rateLimitMax = options.rateLimitMax ?? 120;
  const rateLimitStore = new Map();
  const dataFile = options.dataFile || DATA_FILE;
  const db = options.inMemoryOnly ? createDefaultDb() : loadJson(dataFile, createDefaultDb());

  const metrics = {
    requestsTotal: 0,
    apiRequests: 0,
    alertsGenerated: 0,
    rateLimited: 0
  };

  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'"
  };

  function persist() {
    if (options.inMemoryOnly) return;
    saveJson(dataFile, db);
  }

  function json(res, status, data, extraHeaders = {}) {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Role, X-User-Id',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      ...securityHeaders,
      ...extraHeaders
    });
    res.end(JSON.stringify(data));
  }

  function logAudit(actorId, action, targetId) {
    db.auditLogs.push({ id: crypto.randomUUID(), actorId, action, targetId, at: new Date().toISOString() });
    persist();
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
    metrics.alertsGenerated += 1;
    persist();
    const links = db.consent.filter((c) => c.patientId === patientId && c.active);
    links.forEach((l) => broadcastGuardian(l.guardianId, 'alert', alert));
    return alert;
  }

  function serveStatic(req, res, pathname) {
    const safePath = pathname === '/' ? '/index.html' : pathname;
    const fullPath = path.join(__dirname, 'public', safePath);
    if (!fullPath.startsWith(path.join(__dirname, 'public'))) {
      res.writeHead(403, securityHeaders);
      return res.end('Forbidden');
    }
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        res.writeHead(404, securityHeaders);
        return res.end('Not found');
      }
      const ext = path.extname(fullPath);
      const types = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.webmanifest': 'application/manifest+json'
      };
      const cacheControl = pathname === '/sw.js'
        ? 'no-cache'
        : (ext === '.css' || ext === '.js' || ext === '.svg' ? 'public, max-age=86400' : 'no-cache');
      res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain; charset=utf-8', 'Cache-Control': cacheControl, ...securityHeaders });
      res.end(data);
    });
  }

  function enforceRateLimit(req, res, pathname) {
    if (!(pathname.startsWith('/api/') || pathname === '/guardian/stream')) return false;
    const ip = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const current = rateLimitStore.get(ip);
    if (!current || current.resetAt < now) {
      rateLimitStore.set(ip, { count: 1, resetAt: now + rateWindowMs });
      return false;
    }
    current.count += 1;
    const remaining = Math.max(rateLimitMax - current.count, 0);
    if (current.count > rateLimitMax) {
      metrics.rateLimited += 1;
      json(res, 429, { error: 'Too many requests. Please retry later.' }, {
        'Retry-After': Math.ceil((current.resetAt - now) / 1000),
        'X-RateLimit-Remaining': remaining
      });
      return true;
    }
    return false;
  }

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://${req.headers.host}`);
    const pathname = u.pathname;
    metrics.requestsTotal += 1;
    if (pathname.startsWith('/api/')) metrics.apiRequests += 1;

    res.setHeader('X-Request-Id', crypto.randomUUID().slice(0, 8));
    if (enforceRateLimit(req, res, pathname)) return;

    if (req.method === 'OPTIONS') return json(res, 200, { ok: true });

    if (req.method === 'GET' && pathname === '/health') {
      return json(res, 200, { status: 'ok', service: 'stroke-prevention-app', timestamp: new Date().toISOString() });
    }

    if (req.method === 'GET' && pathname === '/metrics') {
      const { role } = parseAuth(req, u);
      if (role !== 'admin') return json(res, 403, { error: 'admin role required' });
      return json(res, 200, metrics);
    }

    if (pathname === '/guardian/stream') {
      const { role, userId } = parseAuth(req, u);
      if (role !== 'guardian' || !db.users[userId]) return json(res, 403, { error: 'guardian role required' });
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        ...securityHeaders
      });
      res.write('event: connected\n');
      res.write(`data: ${JSON.stringify({ guardianId: userId })}\n\n`);
      if (!sseClients.has(userId)) sseClients.set(userId, []);
      sseClients.get(userId).push(res);
      req.on('close', () => sseClients.set(userId, (sseClients.get(userId) || []).filter((r) => r !== res)));
      return;
    }

    const patientDash = pathname.match(/^\/api\/patient\/([^/]+)\/dashboard$/);
    if (req.method === 'GET' && patientDash) {
      const patientId = patientDash[1];
      const { role, userId } = parseAuth(req, u);
      if (role !== 'patient' || userId !== patientId) return json(res, 403, { error: 'patient role required' });
      const routines = db.routines[patientId] || [];
      return json(res, 200, {
        patient: db.users[patientId],
        routines,
        adherence: { completed: routines.filter((r) => r.status === 'completed').length, total: routines.length },
        lastVitals: (db.vitals[patientId] || []).slice(-1)[0] || null,
        lastLifestyle: (db.lifestyle[patientId] || []).slice(-1)[0] || null
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
      persist();
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
        persist();
        if (systolic >= 140 || diastolic >= 90) pushAlert(patientId, 'critical', 'blood_pressure', `${systolic}/${diastolic}`, '>=140/90');
        if (pulse >= 120) pushAlert(patientId, 'warning', 'pulse', pulse, '>=120');
        db.consent.filter((c) => c.patientId === patientId && c.active).forEach((l) => broadcastGuardian(l.guardianId, 'vitals', { patientId, entry }));
        return json(res, 201, { ok: true, vitals: entry });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    const lifestyleLog = pathname.match(/^\/api\/patient\/([^/]+)\/lifestyle$/);
    if (req.method === 'POST' && lifestyleLog) {
      const patientId = lifestyleLog[1];
      const { role, userId } = parseAuth(req, u);
      if (role !== 'patient' || userId !== patientId) return json(res, 403, { error: 'patient role required' });
      try {
        const body = await readBody(req);
        const entry = {
          id: crypto.randomUUID(),
          steps: Number(body.steps || 0),
          sleepHours: Number(body.sleepHours || 0),
          hydrationMl: Number(body.hydrationMl || 0),
          smoking: Boolean(body.smoking),
          alcohol: Boolean(body.alcohol),
          stressLevel: body.stressLevel || 'moderate',
          at: new Date().toISOString()
        };
        db.lifestyle[patientId] = db.lifestyle[patientId] || [];
        db.lifestyle[patientId].push(entry);
        persist();
        db.consent.filter((c) => c.patientId === patientId && c.active).forEach((l) => broadcastGuardian(l.guardianId, 'lifestyle', { patientId, entry }));
        return json(res, 201, { ok: true, lifestyle: entry });
      } catch (e) {
        return json(res, 400, { error: e.message });
      }
    }

    if (req.method === 'GET' && lifestyleLog) {
      const patientId = lifestyleLog[1];
      const { role, userId } = parseAuth(req, u);
      if (role !== 'patient' || userId !== patientId) return json(res, 403, { error: 'patient role required' });
      return json(res, 200, (db.lifestyle[patientId] || []).slice(-30));
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
        adherence: { completed: routines.filter((r) => r.status === 'completed').length, total: routines.length },
        lastVitals: (db.vitals[patientId] || []).slice(-1)[0] || null,
        lastLifestyle: (db.lifestyle[patientId] || []).slice(-1)[0] || null,
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
      persist();
      logAudit(guardianId, 'ack_alert', alert.patientId);
      return json(res, 200, { ok: true, alert });
    }

    if (req.method === 'GET' && pathname === '/api/audit-logs') {
      const { role } = parseAuth(req, u);
      if (role !== 'admin') return json(res, 403, { error: 'admin role required' });
      return json(res, 200, db.auditLogs.slice(-100));
    }

    if (req.method === 'GET' && pathname.startsWith('/api/')) return json(res, 404, { error: 'Not found' });
    return serveStatic(req, res, pathname);
  });

  return { server, db, metrics, persist };
}

function startServer(port = PORT) {
  const { server } = createApp();
  server.listen(port, () => {
    console.log(`Stroke prevention app running on http://localhost:${port}`);
  });
  return server;
}

if (require.main === module) startServer();

module.exports = { createApp, startServer, createDefaultDb };
