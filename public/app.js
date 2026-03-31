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
  alerts: document.querySelector('#alerts')
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
  'Content-Type': 'application/json'
};

const guardianHeaders = {
  'X-Role': 'guardian',
  'X-User-Id': 'g1',
  'Content-Type': 'application/json'
};

const routineList = document.querySelector('#routine-list');
const adherence = document.querySelector('#adherence');
const lastVitals = document.querySelector('#last-vitals');
const vitalsForm = document.querySelector('#vitals-form');
const vitalsStatus = document.querySelector('#vitals-status');

const foodForm = document.querySelector('#food-reminder-form');
const foodReminderList = document.querySelector('#food-reminder-list');
const nextReminder = document.querySelector('#next-reminder');
const FOOD_KEY = 'health-food-reminders-v1';

const patientStatus = document.querySelector('#patient-status');
const events = document.querySelector('#events');
const alerts = document.querySelector('#alerts');

function addEvent(message) {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()} — ${message}`;
  ui.events.prepend(li);
}

function formatVitals(vitals) {
  if (!vitals) return 'No vitals logged yet.';
  return `${vitals.systolic}/${vitals.diastolic} mmHg, pulse ${vitals.pulse} bpm at ${new Date(vitals.at).toLocaleTimeString()}`;
  events.prepend(li);
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
function isReminderActiveToday(reminder, now = new Date()) {
  const day = now.getDay();
  if (reminder.frequency === 'weekdays') return day >= 1 && day <= 5;
  if (reminder.frequency === 'weekends') return day === 0 || day === 6;
  return true;
}

function dueState(reminder, now = new Date()) {
  if (!isReminderActiveToday(reminder, now)) return 'inactive';
  const [hh, mm] = reminder.time.split(':').map(Number);
  const due = new Date(now);
  due.setHours(hh, mm, 0, 0);
  const diffMin = Math.round((due - now) / 60000);
  if (diffMin < -30) return 'overdue';
  if (diffMin <= 10) return 'due-now';
  return 'upcoming';
}

function renderFoodReminders() {
  const items = readFoodReminders();
  const now = new Date();
  foodReminderList.innerHTML = '';

  if (!items.length) {
    nextReminder.textContent = 'No reminders scheduled.';
    return;
  }

  const sorted = [...items].sort((a, b) => a.time.localeCompare(b.time));
  let nearest = null;

  for (const reminder of sorted) {
    const state = dueState(reminder, now);
    if (!nearest && (state === 'upcoming' || state === 'due-now')) {
      nearest = reminder;
    }

    const li = document.createElement('li');
    li.className = `status-${state}`;
    li.innerHTML = `
      <span>
        <strong>${reminder.title}</strong> at ${reminder.time}
        <small>(${reminder.frequency})</small>
      </span>
      <div class="inline-actions">
        <span class="pill">${state.replace('-', ' ')}</span>
        <button class="secondary" data-id="${reminder.id}">Remove</button>
      </div>
    `;
    li.querySelector('button').addEventListener('click', () => {
      saveFoodReminders(items.filter((x) => x.id !== reminder.id));
      renderFoodReminders();
    });
    foodReminderList.appendChild(li);
  }

  if (!nearest) nearest = sorted[0];
  nextReminder.textContent = `${nearest.title} at ${nearest.time} (${nearest.frequency})`;
}

foodForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(foodForm);
  const reminders = readFoodReminders();
  reminders.push({
    id: crypto.randomUUID(),
    title: String(fd.get('title')).trim(),
    time: String(fd.get('time')),
    frequency: String(fd.get('frequency'))
  });
  saveFoodReminders(reminders);
  foodForm.reset();
  renderFoodReminders();
});

setInterval(renderFoodReminders, 60_000);

async function loadDashboard() {
  const res = await fetch('/api/patient/u1/dashboard', { headers: patientHeaders });
  const data = await res.json();
  adherence.textContent = `Completed ${data.adherence.completed}/${data.adherence.total} tasks`;
  if (data.lastVitals) {
    lastVitals.textContent = `${data.lastVitals.systolic}/${data.lastVitals.diastolic} mmHg, pulse ${data.lastVitals.pulse} bpm at ${new Date(data.lastVitals.at).toLocaleTimeString()}`;
  }

  routineList.innerHTML = '';
  for (const item of data.routines) {
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
      <span>${item.title} (${item.due})</span>
      <button ${item.status === 'completed' ? 'disabled' : ''}>${item.status === 'completed' ? 'Submitted' : 'Mark Complete'}</button>
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
  stream.addEventListener('connected', () => addEvent('Admin real-time channel connected'));

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

  stream.onerror = () => addEvent('Live stream disconnected; reconnecting automatically...');
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
async function completeRoutine(id) {
  await fetch(`/api/patient/u1/routines/${id}/complete`, { method: 'POST', headers: patientHeaders });
  loadDashboard();
}

vitalsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(vitalsForm);
  const body = {
    systolic: Number(fd.get('systolic')),
    diastolic: Number(fd.get('diastolic')),
    pulse: Number(fd.get('pulse'))
  };
  const res = await fetch(`/api/patient/${PATIENT_ID}/vitals`, {
    method: 'POST',
    headers: patientHeaders,
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    vitalsStatus.textContent = data.error;
    vitalsStatus.className = 'bad';
    return;
  }
  vitalsStatus.textContent = `Saved at ${new Date(data.vitals.at).toLocaleTimeString()}`;
  vitalsStatus.className = 'ok';
  vitalsForm.reset();
  loadDashboard();
  loadGuardianStatus();
});

async function loadGuardianStatus() {
  const res = await fetch('/api/guardian/g1/monitors/u1', { headers: guardianHeaders });
  const data = await res.json();
  patientStatus.textContent = JSON.stringify(data, null, 2);
}

async function loadAlerts() {
  const res = await fetch('/api/guardian/g1/alerts', { headers: guardianHeaders });
  const data = await res.json();
  alerts.innerHTML = '';
  for (const alert of data.reverse()) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>[${alert.type}] ${alert.metric}=${alert.value} (${alert.status})</span>
      <button class="secondary" ${alert.status !== 'open' ? 'disabled' : ''}>Acknowledge</button>
    `;
    li.querySelector('button').addEventListener('click', async () => {
      await fetch(`/api/guardian/g1/alerts/${alert.id}/ack`, { method: 'POST', headers: guardianHeaders });
      addEvent(`Acknowledged alert ${alert.id.slice(0, 6)}`);
      loadAlerts();
      loadGuardianStatus();
    });
    alerts.appendChild(li);
  }
}

function connectStream() {
  const evt = new EventSource('/guardian/stream?role=guardian&userId=g1');
  evt.addEventListener('connected', () => addEvent('Live connection established'));
  evt.addEventListener('routine', (e) => {
    const data = JSON.parse(e.data);
    addEvent(`Routine complete: ${data.title}`);
    loadGuardianStatus();
  });
  evt.addEventListener('vitals', (e) => {
    const data = JSON.parse(e.data);
    addEvent(`Vitals logged: ${data.entry.systolic}/${data.entry.diastolic}, pulse ${data.entry.pulse}`);
    loadGuardianStatus();
  });
  evt.addEventListener('alert', (e) => {
    const data = JSON.parse(e.data);
    addEvent(`ALERT ${data.type}: ${data.metric}=${data.value}`);
    loadAlerts();
    loadGuardianStatus();
  });
}

loadDashboard();
renderFoodReminders();
loadGuardianStatus();
loadAlerts();
connectStream();
