const headers = {
  'X-Role': 'guardian',
  'X-User-Id': 'g1',
  'Content-Type': 'application/json'
};

const status = document.querySelector('#patient-status');
const events = document.querySelector('#events');
const alerts = document.querySelector('#alerts');

function addEvent(message) {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()} — ${message}`;
  events.prepend(li);
}

async function loadStatus() {
  const res = await fetch('/api/guardian/g1/monitors/u1', { headers });
  const data = await res.json();
  status.textContent = JSON.stringify(data, null, 2);
}

async function loadAlerts() {
  const res = await fetch('/api/guardian/g1/alerts', { headers });
  const data = await res.json();
  alerts.innerHTML = '';
  for (const alert of data.reverse()) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>[${alert.type}] ${alert.metric}=${alert.value} (${alert.status})</span>
      <button class="secondary" ${alert.status !== 'open' ? 'disabled' : ''}>Acknowledge</button>
    `;
    li.querySelector('button').addEventListener('click', async () => {
      await fetch(`/api/guardian/g1/alerts/${alert.id}/ack`, { method: 'POST', headers });
      addEvent(`Acknowledged alert ${alert.id.slice(0, 6)}`);
      loadAlerts();
      loadStatus();
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
    loadStatus();
  });
  evt.addEventListener('vitals', (e) => {
    const data = JSON.parse(e.data);
    addEvent(`Vitals logged: ${data.entry.systolic}/${data.entry.diastolic}, pulse ${data.entry.pulse}`);
    loadStatus();
  });
  evt.addEventListener('alert', (e) => {
    const data = JSON.parse(e.data);
    addEvent(`ALERT ${data.type}: ${data.metric}=${data.value}`);
    loadAlerts();
    loadStatus();
  });
}

loadStatus();
loadAlerts();
connectStream();
