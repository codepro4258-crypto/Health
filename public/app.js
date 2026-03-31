const authHeaders = {
  'X-Role': 'patient',
  'X-User-Id': 'u1',
  'Content-Type': 'application/json'
};

const routineList = document.querySelector('#routine-list');
const adherence = document.querySelector('#adherence');
const form = document.querySelector('#vitals-form');
const statusEl = document.querySelector('#vitals-status');

async function loadDashboard() {
  const res = await fetch('/api/patient/u1/dashboard', { headers: authHeaders });
  const data = await res.json();
  adherence.textContent = `Completed ${data.adherence.completed}/${data.adherence.total} tasks`;
  routineList.innerHTML = '';
  for (const item of data.routines) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${item.title} (${item.due})</span>
      <button ${item.status === 'completed' ? 'disabled' : ''}>${item.status === 'completed' ? 'Done' : 'Complete'}</button>
    `;
    li.querySelector('button').addEventListener('click', () => completeRoutine(item.id));
    routineList.appendChild(li);
  }
}

async function completeRoutine(id) {
  await fetch(`/api/patient/u1/routines/${id}/complete`, { method: 'POST', headers: authHeaders });
  loadDashboard();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const body = {
    systolic: Number(fd.get('systolic')),
    diastolic: Number(fd.get('diastolic')),
    pulse: Number(fd.get('pulse'))
  };
  const res = await fetch('/api/patient/u1/vitals', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    statusEl.textContent = data.error;
    statusEl.className = 'bad';
    return;
  }
  statusEl.textContent = `Saved at ${new Date(data.vitals.at).toLocaleTimeString()}`;
  statusEl.className = 'ok';
  form.reset();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

loadDashboard();
