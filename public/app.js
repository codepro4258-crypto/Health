const PATIENT_ID = 'u1';
const ADMIN_ID = 'a1';

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

const routineList = document.querySelector('#routine-list');
const adherence = document.querySelector('#adherence');
const lastVitals = document.querySelector('#last-vitals');
const vitalsForm = document.querySelector('#vitals-form');
const vitalsStatus = document.querySelector('#vitals-status');

const foodForm = document.querySelector('#food-reminder-form');
const foodReminderList = document.querySelector('#food-reminder-list');
const nextReminder = document.querySelector('#next-reminder');
const FOOD_KEY = 'health-food-reminders-v1';

const adminRoutineForm = document.querySelector('#admin-routine-form');
const adminRoutineStatus = document.querySelector('#admin-routine-status');
const patientStatus = document.querySelector('#patient-status');
const events = document.querySelector('#events');
const alerts = document.querySelector('#alerts');

function addEvent(message) {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()} — ${message}`;
  events.prepend(li);
}

function readFoodReminders() {
  return JSON.parse(localStorage.getItem(FOOD_KEY) || '[]');
}

function saveFoodReminders(items) {
  localStorage.setItem(FOOD_KEY, JSON.stringify(items));
}

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

async function loadPatientDashboard() {
  const res = await fetch(`/api/patient/${PATIENT_ID}/dashboard`, { headers: patientHeaders });
  const data = await res.json();
  adherence.textContent = `Completed ${data.adherence.completed}/${data.adherence.total} assigned routines`;
  if (data.lastVitals) {
    lastVitals.textContent = `${data.lastVitals.systolic}/${data.lastVitals.diastolic} mmHg, pulse ${data.lastVitals.pulse} bpm at ${new Date(data.lastVitals.at).toLocaleTimeString()}`;
  }

  routineList.innerHTML = '';
  for (const item of data.routines) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${item.title} (${item.due})</span>
      <button ${item.status === 'completed' ? 'disabled' : ''}>${item.status === 'completed' ? 'Submitted' : 'Mark Complete'}</button>
    `;
    li.querySelector('button').addEventListener('click', () => completeRoutine(item.id));
    routineList.appendChild(li);
  }
}

async function completeRoutine(id) {
  const res = await fetch(`/api/patient/${PATIENT_ID}/routines/${id}/complete`, { method: 'POST', headers: patientHeaders });
  if (res.ok) {
    addEvent('Patient marked a routine as completed');
    loadPatientDashboard();
    loadAdminReport();
  }
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
  vitalsStatus.textContent = `Submitted at ${new Date(data.vitals.at).toLocaleTimeString()}`;
  vitalsStatus.className = 'ok';
  vitalsForm.reset();
  loadPatientDashboard();
  loadAdminReport();
});

adminRoutineForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(adminRoutineForm);
  const payload = {
    title: String(fd.get('title')).trim(),
    due: String(fd.get('due'))
  };
  const res = await fetch(`/api/admin/${ADMIN_ID}/patients/${PATIENT_ID}/routines`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    adminRoutineStatus.textContent = data.error;
    adminRoutineStatus.className = 'bad';
    return;
  }
  adminRoutineStatus.textContent = `Assigned routine "${data.routine.title}" for ${data.routine.due}`;
  adminRoutineStatus.className = 'ok';
  adminRoutineForm.reset();
  loadPatientDashboard();
  loadAdminReport();
});

async function loadAdminReport() {
  const res = await fetch(`/api/admin/${ADMIN_ID}/patients/${PATIENT_ID}/report`, { headers: adminHeaders });
  const data = await res.json();
  patientStatus.textContent = JSON.stringify(
    {
      adherence: data.adherence,
      latestRoutineReport: data.routineReports[0] || null,
      lastVitals: data.lastVitals,
      openAlerts: data.alerts.filter((a) => a.status === 'open').length
    },
    null,
    2
  );
}

async function loadAdminAlerts() {
  const res = await fetch(`/api/admin/${ADMIN_ID}/alerts`, { headers: adminHeaders });
  const data = await res.json();
  alerts.innerHTML = '';
  for (const alert of data) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>[${alert.type}] ${alert.metric}=${alert.value} (${alert.status})</span>
      <button class="secondary" ${alert.status !== 'open' ? 'disabled' : ''}>Acknowledge</button>
    `;
    li.querySelector('button').addEventListener('click', async () => {
      await fetch(`/api/admin/${ADMIN_ID}/alerts/${alert.id}/ack`, { method: 'POST', headers: adminHeaders });
      addEvent(`Admin acknowledged alert ${alert.id.slice(0, 6)}`);
      loadAdminAlerts();
      loadAdminReport();
    });
    alerts.appendChild(li);
  }
}

function connectAdminStream() {
  const evt = new EventSource(`/admin/stream?role=admin&userId=${ADMIN_ID}`);
  evt.addEventListener('connected', () => addEvent('Admin real-time channel connected'));
  evt.addEventListener('routine_report', (e) => {
    const data = JSON.parse(e.data);
    addEvent(`Routine report submitted: ${data.title} (${data.status})`);
    loadAdminReport();
  });
  evt.addEventListener('routine_added', (e) => {
    const data = JSON.parse(e.data);
    addEvent(`Admin assigned routine: ${data.routine.title}`);
    loadPatientDashboard();
    loadAdminReport();
  });
  evt.addEventListener('vitals', (e) => {
    const data = JSON.parse(e.data);
    addEvent(`Vitals report: ${data.entry.systolic}/${data.entry.diastolic}, pulse ${data.entry.pulse}`);
    loadAdminReport();
  });
  evt.addEventListener('alert', (e) => {
    const data = JSON.parse(e.data);
    addEvent(`ALERT ${data.type}: ${data.metric}=${data.value}`);
    loadAdminAlerts();
    loadAdminReport();
  });
}

loadPatientDashboard();
renderFoodReminders();
loadAdminReport();
loadAdminAlerts();
connectAdminStream();
