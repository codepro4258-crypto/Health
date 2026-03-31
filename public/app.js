const PATIENT_ID = 'u1';
const ADMIN_ID = 'a1';
const FOOD_KEY = 'health-food-reminders-v2';

const patientHeaders = {
  'X-Role': 'patient',
  'X-User-Id': PATIENT_ID,
  'Content-Type': 'application/json'
};

const adminHeaders = {
  'X-Role': 'admin',
  'X-User-Id': ADMIN_ID,
  'Content-Type': 'application/json'
};

const ui = {
  routineList: document.querySelector('#routine-list'),
  adherence: document.querySelector('#adherence'),
  lastVitals: document.querySelector('#last-vitals'),
  vitalsForm: document.querySelector('#vitals-form'),
  vitalsStatus: document.querySelector('#vitals-status'),
  foodForm: document.querySelector('#food-reminder-form'),
  foodReminderList: document.querySelector('#food-reminder-list'),
  nextReminder: document.querySelector('#next-reminder'),
  adminRoutineForm: document.querySelector('#admin-routine-form'),
  adminRoutineStatus: document.querySelector('#admin-routine-status'),
  patientStatus: document.querySelector('#patient-status'),
  events: document.querySelector('#events'),
  alerts: document.querySelector('#alerts'),
  streamStatus: document.querySelector('#stream-status')
};

function setStatus(element, message, type = 'muted') {
  element.textContent = message;
  element.className = `status-text ${type}`;
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error || `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return data;
}

function addEvent(message) {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()} — ${message}`;
  ui.events.prepend(li);
}

function setStreamStatus(text, mode) {
  if (!ui.streamStatus) return;
  ui.streamStatus.textContent = text;
  ui.streamStatus.className = `stream-chip ${mode}`;
}

function formatVitals(vitals) {
  if (!vitals) return 'No vitals logged yet.';
  return `${vitals.systolic}/${vitals.diastolic} mmHg, pulse ${vitals.pulse} bpm at ${new Date(vitals.at).toLocaleTimeString()}`;
}

function readFoodReminders() {
  return JSON.parse(localStorage.getItem(FOOD_KEY) || '[]');
}

function saveFoodReminders(items) {
  localStorage.setItem(FOOD_KEY, JSON.stringify(items));
}

function isFrequencyActiveOnDay(frequency, day) {
  if (frequency === 'weekdays') return day >= 1 && day <= 5;
  if (frequency === 'weekends') return day === 0 || day === 6;
  return true;
}

function getNextDueDate(reminder, now = new Date()) {
  const [hh, mm] = reminder.time.split(':').map(Number);

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    const day = candidate.getDay();
    if (!isFrequencyActiveOnDay(reminder.frequency, day)) continue;

    candidate.setHours(hh, mm, 0, 0);
    if (offset > 0 || candidate >= now) {
      return candidate;
    }
  }
  return null;
}

function getReminderState(reminder, now = new Date()) {
  const nextDue = getNextDueDate(reminder, now);
  if (!nextDue) return { state: 'inactive', nextDue: null };

  const minutes = Math.round((nextDue - now) / 60000);
  if (minutes <= 10) return { state: 'due-now', nextDue };
  if (minutes <= 60) return { state: 'upcoming', nextDue };
  return { state: 'scheduled', nextDue };
}

function renderFoodReminders() {
  const reminders = readFoodReminders();
  const now = new Date();
  ui.foodReminderList.innerHTML = '';

  if (!reminders.length) {
    ui.nextReminder.textContent = 'No reminders scheduled.';
    return;
  }

  const computed = reminders
    .map((reminder) => ({ reminder, ...getReminderState(reminder, now) }))
    .sort((a, b) => {
      if (!a.nextDue) return 1;
      if (!b.nextDue) return -1;
      return a.nextDue - b.nextDue;
    });

  for (const item of computed) {
    const { reminder, state, nextDue } = item;
    const li = document.createElement('li');
    li.className = `status-${state}`;

    const nextDueText = nextDue ? nextDue.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'not scheduled';
    li.innerHTML = `
      <span>
        <strong>${reminder.title}</strong>
        <small>${reminder.frequency} · next at ${nextDueText}</small>
      </span>
      <div class="inline-actions">
        <span class="pill">${state.replace('-', ' ')}</span>
        <button class="secondary" type="button">Remove</button>
      </div>
    `;

    li.querySelector('button').addEventListener('click', () => {
      saveFoodReminders(reminders.filter((x) => x.id !== reminder.id));
      renderFoodReminders();
    });

    ui.foodReminderList.appendChild(li);
  }

  const nearest = computed.find((x) => x.nextDue);
  if (!nearest) {
    ui.nextReminder.textContent = 'No active reminder for the upcoming week.';
    return;
  }

  ui.nextReminder.textContent = `${nearest.reminder.title} at ${nearest.nextDue.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

async function loadPatientDashboard() {
  const data = await requestJson(`/api/patient/${PATIENT_ID}/dashboard`, { headers: patientHeaders });

  ui.adherence.textContent = `Completed ${data.adherence.completed}/${data.adherence.total} assigned routines`;
  ui.lastVitals.textContent = formatVitals(data.lastVitals);

  ui.routineList.innerHTML = '';
  for (const routine of data.routines) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${routine.title} (${routine.due})</span>
      <button type="button" ${routine.status === 'completed' ? 'disabled' : ''}>${routine.status === 'completed' ? 'Submitted' : 'Mark Complete'}</button>
    `;

    li.querySelector('button').addEventListener('click', async () => {
      try {
        await requestJson(`/api/patient/${PATIENT_ID}/routines/${routine.id}/complete`, {
          method: 'POST',
          headers: patientHeaders
        });
        addEvent(`Routine submitted: ${routine.title}`);
        await Promise.all([loadPatientDashboard(), loadAdminReport()]);
      } catch (error) {
        addEvent(`Routine submission failed: ${error.message}`);
      }
    });

    ui.routineList.appendChild(li);
  }
}

async function loadAdminReport() {
  const data = await requestJson(`/api/admin/${ADMIN_ID}/patients/${PATIENT_ID}/report`, { headers: adminHeaders });
  ui.patientStatus.textContent = JSON.stringify(
    {
      adherence: data.adherence,
      latestRoutineReport: data.routineReports[0] || null,
      lastVitals: data.lastVitals,
      openAlerts: data.alerts.filter((alert) => alert.status === 'open').length
    },
    null,
    2
  );
}

async function loadAdminAlerts() {
  const data = await requestJson(`/api/admin/${ADMIN_ID}/alerts`, { headers: adminHeaders });
  ui.alerts.innerHTML = '';

  for (const alert of data) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>[${alert.type}] ${alert.metric}=${alert.value} (${alert.status})</span>
      <button type="button" class="secondary" ${alert.status !== 'open' ? 'disabled' : ''}>Acknowledge</button>
    `;

    li.querySelector('button').addEventListener('click', async () => {
      try {
        await requestJson(`/api/admin/${ADMIN_ID}/alerts/${alert.id}/ack`, {
          method: 'POST',
          headers: adminHeaders
        });
        addEvent(`Alert acknowledged: ${alert.metric} ${alert.value}`);
        await Promise.all([loadAdminAlerts(), loadAdminReport()]);
      } catch (error) {
        addEvent(`Unable to acknowledge alert: ${error.message}`);
      }
    });

    ui.alerts.appendChild(li);
  }
}

function connectAdminStream() {
  const stream = new EventSource(`/admin/stream?role=admin&userId=${ADMIN_ID}`);
  stream.addEventListener('connected', () => {
    setStreamStatus('Live feed: connected', 'live');
    addEvent('Admin real-time channel connected');
  });

  stream.addEventListener('routine_report', async (event) => {
    const data = JSON.parse(event.data);
    addEvent(`Routine report submitted: ${data.title}`);
    await loadAdminReport();
  });

  stream.addEventListener('routine_added', async (event) => {
    const data = JSON.parse(event.data);
    addEvent(`Routine assigned: ${data.routine.title}`);
    await Promise.all([loadPatientDashboard(), loadAdminReport()]);
  });

  stream.addEventListener('vitals', async (event) => {
    const data = JSON.parse(event.data);
    addEvent(`Vitals report: ${data.entry.systolic}/${data.entry.diastolic}, pulse ${data.entry.pulse}`);
    await Promise.all([loadPatientDashboard(), loadAdminReport()]);
  });

  stream.addEventListener('alert', async (event) => {
    const data = JSON.parse(event.data);
    addEvent(`ALERT ${data.type}: ${data.metric}=${data.value}`);
    await Promise.all([loadAdminAlerts(), loadAdminReport()]);
  });

  stream.onerror = () => {
    setStreamStatus('Live feed: reconnecting…', 'offline');
    addEvent('Live stream disconnected; reconnecting automatically...');
  };
}

ui.vitalsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fd = new FormData(ui.vitalsForm);

  try {
    const payload = {
      systolic: Number(fd.get('systolic')),
      diastolic: Number(fd.get('diastolic')),
      pulse: Number(fd.get('pulse'))
    };

    const data = await requestJson(`/api/patient/${PATIENT_ID}/vitals`, {
      method: 'POST',
      headers: patientHeaders,
      body: JSON.stringify(payload)
    });

    setStatus(ui.vitalsStatus, `Vitals submitted at ${new Date(data.vitals.at).toLocaleTimeString()}`, 'ok');
    ui.vitalsForm.reset();
    await Promise.all([loadPatientDashboard(), loadAdminReport(), loadAdminAlerts()]);
  } catch (error) {
    setStatus(ui.vitalsStatus, error.message, 'bad');
  }
});

ui.adminRoutineForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fd = new FormData(ui.adminRoutineForm);

  try {
    const payload = {
      title: String(fd.get('title')).trim(),
      due: String(fd.get('due'))
    };

    const data = await requestJson(`/api/admin/${ADMIN_ID}/patients/${PATIENT_ID}/routines`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(payload)
    });

    setStatus(ui.adminRoutineStatus, `Assigned routine "${data.routine.title}" for ${data.routine.due}.`, 'ok');
    ui.adminRoutineForm.reset();
    await Promise.all([loadPatientDashboard(), loadAdminReport()]);
  } catch (error) {
    setStatus(ui.adminRoutineStatus, error.message, 'bad');
  }
});

ui.foodForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const fd = new FormData(ui.foodForm);
  const reminders = readFoodReminders();

  reminders.push({
    id: crypto.randomUUID(),
    title: String(fd.get('title')).trim(),
    time: String(fd.get('time')),
    frequency: String(fd.get('frequency'))
  });

  saveFoodReminders(reminders);
  ui.foodForm.reset();
  renderFoodReminders();
});

async function bootstrap() {
  setStreamStatus('Live feed: connecting…', '');
  try {
    await Promise.all([loadPatientDashboard(), loadAdminReport(), loadAdminAlerts()]);
  } catch (error) {
    addEvent(`Initial load warning: ${error.message}`);
  }

  renderFoodReminders();
  connectAdminStream();
  setInterval(renderFoodReminders, 60_000);
}

bootstrap();
