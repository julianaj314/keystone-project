// ════════════════════════════════════════════════════════════════
//  CUIDAMED — app.js
// ════════════════════════════════════════════════════════════════

const API = 'http://localhost:3000/api';

// ── Estado global ─────────────────────────────────────────────
const S = {
  token:         localStorage.getItem('cm_token'),
  user:          JSON.parse(localStorage.getItem('cm_user')  || 'null'),
  role:          localStorage.getItem('cm_role')  || null,
  patientId:     null,
  pendingDoseId: null,
  currentCedula: null,
  currentRole:   'pt'
};

// ── Fetch helper ──────────────────────────────────────────────
async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(S.token ? { Authorization: `Bearer ${S.token}` } : {})
    }
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res  = await fetch(API + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del servidor');
    return data;
  } catch (err) {
    if (err.message.includes('Failed to fetch'))
      throw new Error('Sin conexión con el servidor');
    throw err;
  }
}

// ── SVG Icons ─────────────────────────────────────────────────
const ICO = {
  check:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  warn:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  hglass: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2h14M5 22h14M7 2v5l5 5-5 5v5M17 2v5l-5 5 5 5v5"/></svg>`,
  xcirc:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  person: `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`
};

// ════════════════════════════════════════════════════════════════
//  LOGIN — FLUJO POR CÉDULA
// ════════════════════════════════════════════════════════════════
let role = 'pt';

function selRole(r) {
  role = r;
  S.currentRole = r;
  document.getElementById('rb-pt').className = 'rb' + (r === 'pt' ? ' sp' : '');
  document.getElementById('rb-ca').className = 'rb' + (r === 'ca' ? ' sc' : '');
  const btn = document.getElementById('btn-role');
  btn.className = 'btn-login ' + (r === 'pt' ? 'btn-pt' : 'btn-ca');
}

// Paso 1 → 2
function goStepCedula() {
  const title = document.getElementById('cedula-title');
  const sub   = document.getElementById('cedula-sub');
  if (role === 'pt') {
    title.textContent = 'Ingresa tu cédula';
    sub.textContent   = 'Sin puntos ni espacios';
  } else {
    title.textContent = 'Cédula del paciente';
    sub.textContent   = 'Ingresa la cédula de la persona que cuidas';
  }
  const inp = document.getElementById('inp-cedula');
  inp.value = '';
  setBtnState('btn-cedula', false);
  showStep('step-cedula');
  setTimeout(() => inp.focus(), 100);
}

function onCedulaInput() {
  const val = document.getElementById('inp-cedula').value.trim();
  setBtnState('btn-cedula', val.length >= 5);
}

function onNameInput() {
  const val = document.getElementById('inp-name').value.trim();
  setBtnState('btn-register', val.length >= 2);
}

function setBtnState(id, enabled) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled      = !enabled;
  btn.style.opacity = enabled ? '1' : '.5';
}

// Paso 2: buscar cédula
async function submitCedula() {
  const cedula = document.getElementById('inp-cedula').value.trim();
  if (!cedula) return;
  S.currentCedula = cedula;

  const btn = document.getElementById('btn-cedula');
  btn.textContent = 'Buscando...';
  btn.disabled    = true;

  try {
    // Raw fetch para manejar 404 sin lanzar error
    const res  = await fetch(API + `/auth/by-cedula/${cedula}`, {
      headers: S.token ? { Authorization: `Bearer ${S.token}` } : {}
    });
    const data = await res.json();
    const found = res.ok && data.exists;

    if (found) {
      document.getElementById('confirm-name').textContent   = data.user.name;
      document.getElementById('confirm-cedula').textContent = `Cédula: ${cedula}`;
      if (role === 'pt') {
        document.getElementById('confirm-title').textContent   = '¿Eres tú?';
        document.getElementById('btn-confirm-yes').textContent = 'Sí, soy yo';
      } else {
        document.getElementById('confirm-title').textContent   = '¿Es tu paciente?';
        document.getElementById('btn-confirm-yes').textContent = 'Sí, entrar';
      }
      showStep('step-confirm');
    } else {
      if (role === 'pt') {
        // Cédula no registrada → mostrar formulario de registro
        document.getElementById('inp-name').value = '';
        setBtnState('btn-register', false);
        showStep('step-register');
        setTimeout(() => document.getElementById('inp-name').focus(), 100);
      } else {
        toast('No encontramos un paciente con esa cédula. Pídele que se registre primero en la app.');
        setBtnState('btn-cedula', true);
      }
    }
  } catch (err) {
    toast('Error de conexión: ' + err.message);
    setBtnState('btn-cedula', true);
  } finally {
    btn.textContent = 'Buscar';
    btn.disabled    = false;
  }
}

// Paso 3: confirmar y entrar
async function confirmIdentity() {
  const btn = document.getElementById('btn-confirm-yes');
  btn.textContent = 'Entrando...';
  btn.disabled    = true;

  try {
    let data;
    if (role === 'pt') {
      data = await api('POST', '/auth/login-cedula', { cedula: S.currentCedula });
      saveSession({ token: data.token, user: data.user }, 'pt');
      await enterApp('pt');
    } else {
      // Cuidador: obtiene token con rol caregiver apuntando al paciente
      data = await api('POST', '/auth/caregiver-access', { cedula: S.currentCedula });
      // Guardamos el paciente como user y el token del cuidador
      saveSession({ token: data.token, user: data.patient }, 'ca');
      await enterApp('ca');
    }
  } catch (err) {
    console.error('confirmIdentity error:', err);
    toast('Error al entrar: ' + err.message);
    btn.textContent = role === 'pt' ? 'Sí, soy yo' : 'Sí, entrar';
    btn.disabled    = false;
  }
}

// Paso 4: registrar paciente nuevo
async function registerPatient() {
  const name = document.getElementById('inp-name').value.trim();
  if (!name || !S.currentCedula) return;

  const btn = document.getElementById('btn-register');
  btn.textContent = 'Creando perfil...';
  btn.disabled    = true;

  try {
    const data = await api('POST', '/auth/register-patient', {
      cedula: S.currentCedula,
      name
    });
    saveSession({ token: data.token, user: data.user }, 'pt');
    toast(`¡Bienvenido/a, ${data.user.name.split(' ')[0]}!`);
    await enterApp('pt');
  } catch (err) {
    toast('Error: ' + err.message);
    btn.textContent = 'Crear mi perfil';
    btn.disabled    = false;
    setBtnState('btn-register', true);
  }
}

// ── Helpers sesión ────────────────────────────────────────────
function saveSession({ token, user }, r) {
  S.token = token;
  S.user  = user;
  S.role  = r;
  localStorage.setItem('cm_token', token);
  localStorage.setItem('cm_user',  JSON.stringify(user));
  localStorage.setItem('cm_role',  r);
}

async function enterApp(r) {
  S.patientId = S.user.id;
  if (r === 'pt') {
    switchView('pt');
    await loadPatientHome();
  } else {
    switchView('ca');
    await loadCareDash();
  }
}

function showStep(stepId) {
  ['step-role','step-cedula','step-confirm','step-register'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = id === stepId ? 'flex' : 'none';
    if (id === stepId) {
      el.style.flexDirection = 'column';
      el.style.gap = '14px';
    }
  });
  // Scroll login wrap to top so register form is always fully visible
  const wrap = document.querySelector('.login-wrap');
  if (wrap) wrap.scrollTop = 0;
}

function backToRole() { showStep('step-role'); }
function backToStep(id) { showStep(id); }

function logout() {
  S.token = null; S.user = null; S.role = null; S.patientId = null;
  localStorage.removeItem('cm_token');
  localStorage.removeItem('cm_user');
  localStorage.removeItem('cm_role');
  showStep('step-role');
  switchView('lg');
}

// ── Auto-login ────────────────────────────────────────────────
(async function autoLogin() {
  if (!S.token || !S.user) return;
  try {
    await api('GET', '/auth/me');
    role = S.role || 'pt';
    S.patientId = S.user.id;
    if (role === 'pt') { switchView('pt'); await loadPatientHome(); }
    else               { switchView('ca'); await loadCareDash(); }
  } catch { logout(); }
})();

// ════════════════════════════════════════════════════════════════
//  NAVEGACIÓN
// ════════════════════════════════════════════════════════════════
function switchView(v) {
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  document.getElementById('sbar').className = 'sbar ' + (v === 'pt' ? 'pt' : v === 'ca' ? 'ca' : 'lg');
}

function goPt(id) {
  document.querySelectorAll('#view-pt .scr').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#view-pt .nb').forEach(b => { b.classList.remove('ap'); b.querySelector('.nbl').style.color = ''; });
  document.getElementById('ps-' + id).classList.add('active');
  document.getElementById('pnb-' + id).classList.add('ap');
  if (id === 'historial')    loadPatientHistory();
  if (id === 'bmo')          loadPatientBmo();
  if (id === 'notifs')       loadPanelNotifications('p-notifs-body', 'p-notif-count');
  if (id === 'medicamentos') loadMedications('patient');
}

function goCa(id) {
  document.querySelectorAll('#view-ca .scr').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#view-ca .nb').forEach(b => { b.classList.remove('ac'); b.querySelector('.nbl').style.color = ''; });
  document.getElementById('cs-' + id).classList.add('active');
  const nb = document.getElementById('cnb-' + id);
  nb.classList.add('ac');
  nb.querySelector('.nbl').style.color = 'var(--care-d)';
  if (id === 'historial')    loadCareHistory();
  if (id === 'bmo')          loadCareBmo();
  if (id === 'alertas')      loadPanelNotifications('c-alerts-body', 'c-notif-count');
  if (id === 'medicamentos') loadMedications('caregiver');
}

// ════════════════════════════════════════════════════════════════
//  PACIENTE — INICIO
// ════════════════════════════════════════════════════════════════
async function loadPatientHome() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const el = document.getElementById('p-greeting');
  if (el && S.user) el.innerHTML = `${greeting},<br>${S.user.name.split(' ')[0]}`;

  setHtml('p-today-doses', loadingSpinner());

  try {
    const [doses, adh] = await Promise.all([
      api('GET', `/doses/today?patient_id=${S.patientId}`),
      api('GET', `/doses/adherence?patient_id=${S.patientId}&days=7`)
    ]);
    renderPatientHero(doses);
    renderTodayDoses(doses);
    renderAdherence('p-adh-pct', 'p-streak', 'p-week', adh);
  } catch (err) {
    setHtml('p-today-doses', errorCard(err.message));
  }
}

function renderPatientHero(doses) {
  const next = doses.find(d => d.status === 'pending');
  if (!next) {
    setTxt('p-hero-n', 'Todo al día');
    setTxt('p-hero-m', 'No tienes dosis pendientes');
    setTxt('p-cd', 'Sin pendientes');
    S.pendingDoseId = null;
    return;
  }
  S.pendingDoseId = next.id;
  setTxt('p-hero-n', `${next.medication_name}${next.dose_mg ? ' ' + next.dose_mg + 'mg' : ''}`);
  setTxt('p-hero-m', `${fmtTime(next.scheduled_at)} · Compartimento ${next.compartment ?? '—'} · 1 pastilla`);
  startCountdown(next.scheduled_at);
}

function renderTodayDoses(doses) {
  const lbl = document.getElementById('p-today-label');
  if (lbl) lbl.textContent = `Hoy — ${fmtDateLong(new Date())}`;

  if (!doses.length) {
    setHtml('p-today-doses', emptyState('No hay medicamentos programados para hoy'));
    return;
  }
  setHtml('p-today-doses', doses.map(d => `
    <div class="mrow" data-dose-id="${d.id}">
      <div class="sc ${scClass(d.status)}" style="width:50px;height:50px;font-size:20px;">${scIcon(d.status)}</div>
      <div class="mrow-info">
        <div class="mrow-name">${d.medication_name}${d.dose_mg ? ' ' + d.dose_mg + 'mg' : ''}</div>
        <div class="mrow-sub">${fmtTime(d.scheduled_at)} · Comp. ${d.compartment ?? '—'}</div>
      </div>
      <span class="bd ${bdClass(d.status)} mrow-bd">${statusLabel(d.status)}</span>
    </div>`).join(''));
}

// ════════════════════════════════════════════════════════════════
//  PACIENTE — HISTORIAL
// ════════════════════════════════════════════════════════════════
async function loadPatientHistory() {
  const body = document.getElementById('p-hist-body');
  if (!body) return;
  body.innerHTML = loadingSpinner();

  try {
    const [history, adh] = await Promise.all([
      api('GET', `/doses/history?patient_id=${S.patientId}&days=14`),
      api('GET', `/doses/adherence?patient_id=${S.patientId}&days=30`)
    ]);

    const entries = Object.entries(history);
    if (!entries.length) {
      body.innerHTML = emptyState('Sin historial en los últimos 14 días');
      return;
    }

    let html = '';
    for (const [date, doses] of entries) {
      const missed = doses.filter(d => d.status === 'missed').length;
      html += `
        <div class="hg-lbl" style="display:flex;align-items:center;justify-content:space-between;">
          <span>${fmtDateGroup(date)}</span>
          ${missed > 0
            ? `<span style="font-size:12px;font-weight:800;color:var(--red);background:var(--red-bg);padding:4px 10px;border-radius:50px;">${missed} olvidada${missed>1?'s':''}</span>`
            : `<span style="font-size:12px;font-weight:800;color:var(--green);background:var(--green-bg);padding:4px 10px;border-radius:50px;">Completo</span>`
          }
        </div>
        <div class="hist-card" style="margin-bottom:16px;">
          ${doses.map(d => `
            <div class="hi">
              <div class="sc ${scClass(d.status)}" style="width:40px;height:40px;font-size:18px;">${scIcon(d.status)}</div>
              <span class="hi-name">${d.medication_name}${d.dose_mg ? ' ' + d.dose_mg + 'mg' : ''}</span>
              <span class="bd ${bdClass(d.status)}" style="font-size:13px;padding:7px 14px;">${statusLabel(d.status)}</span>
            </div>`).join('')}
        </div>`;
    }

    html += `
      <div class="adh">
        <div class="adh-ttl">Adherencia del último mes</div>
        <div class="adh-row">
          <div><div class="adh-pct">${adh.adherence_pct ?? 0}%</div><div class="adh-sub">dosis tomadas</div></div>
          <div class="adh-streak"><div class="adh-sn">${adh.streak_days ?? 0}</div><div class="adh-sub">días seguidos</div></div>
        </div>
      </div>`;

    body.innerHTML = html;
  } catch (err) {
    body.innerHTML = errorCard('Error cargando historial: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════════
//  PACIENTE — BMO
// ════════════════════════════════════════════════════════════════
async function loadPatientBmo() {
  setHtml('p-bmo-comps', loadingSpinner());
  try {
    const data = await api('GET', `/bmo?patient_id=${S.patientId}`);
    renderBmoCard('p-bmo-card', 'p-bmo-comps', data, false);
    const badge = document.getElementById('p-bmo-badge');
    if (badge) badge.innerHTML = `<span class="ldot"></span>BMO ${data.device.connected ? 'Conectado' : 'Desconectado'}`;
  } catch (err) {
    setHtml('p-bmo-comps', emptyState('BMO no encontrado. Pídele a tu cuidador que lo registre.'));
  }
}

// ════════════════════════════════════════════════════════════════
//  PACIENTE — NOTIFICACIONES
// ════════════════════════════════════════════════════════════════
async function loadPatientNotifs() {
  const body = document.getElementById('p-notifs-body');
  if (!body) return;
  body.innerHTML = loadingSpinner();
  try {
    const { notifications } = await api('GET', '/notifications?limit=20');
    body.innerHTML = notifications.length
      ? notifications.map(n => renderNotif(n)).join('')
      : emptyState('No tienes notificaciones');
    api('PATCH', '/notifications/read-all').catch(() => {});
    updateNotifBadge('pnb-notifs', 0);
  } catch (err) {
    body.innerHTML = errorCard('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════════
//  CUIDADOR — DASHBOARD
// ════════════════════════════════════════════════════════════════
async function loadCareDash() {
  // Mostrar nombre del paciente que se está cuidando
  const greet = document.getElementById('c-greeting');
  if (greet && S.user) greet.innerHTML = `Cuidando a<br>${S.user.name.split(' ')[0]}`;
  setTxt('c-pat-name', S.user?.name || '—');

  setHtml('c-today-doses', loadingSpinner());

  try {
    // Cargar dosis del paciente usando el token de cuidador
    // El token de cuidador tiene id = patient_id, así que pasamos patient_id directamente
    const [doses, adh] = await Promise.all([
      api('GET', `/doses/today?patient_id=${S.patientId}`),
      api('GET', `/doses/adherence?patient_id=${S.patientId}&days=7`)
    ]);

    const taken   = doses.filter(d => d.status === 'taken').length;
    const pending = doses.filter(d => d.status === 'pending').length;
    const missed  = doses.filter(d => d.status === 'missed').length;

    setTxt('c-stat-taken',   taken);
    setTxt('c-stat-pending', pending);
    setTxt('c-stat-missed',  missed);
    setTxt('c-stat-pct',     (adh.adherence_pct ?? 0) + '%');

    // Badge estado paciente
    const badgeEl = document.querySelector('#view-ca .pat-status-chip');
    if (badgeEl) {
      badgeEl.className = 'pat-status-chip pb ' + (missed ? 'pb-r' : 'pb-g');
      badgeEl.innerHTML = missed
        ? `${ICO.warn} ${missed} olvidada${missed > 1 ? 's' : ''}`
        : `${ICO.check} Al día`;
    }

    renderCareTodayDoses(doses);
    renderAdherence('c-adh-pct', 'c-streak', 'c-week', adh);

  } catch (err) {
    setHtml('c-today-doses', errorCard('Error: ' + err.message));
  }
}

function renderCareTodayDoses(doses) {
  if (!doses.length) {
    setHtml('c-today-doses', emptyState('No hay medicamentos para hoy'));
    return;
  }
  setHtml('c-today-doses', doses.map(d => `
    <div class="cmrow" data-dose-id="${d.id}">
      <div class="sc ${scClass(d.status)}" style="width:42px;height:42px;font-size:18px;">${scIcon(d.status)}</div>
      <div class="cmr-info">
        <div class="cmr-name">${d.medication_name}${d.dose_mg ? ' ' + d.dose_mg + 'mg' : ''}</div>
        <div class="cmr-sub">${d.status === 'taken'
          ? `Tomada a las ${fmtTime(d.taken_at)}`
          : fmtTime(d.scheduled_at) + ' · ' + statusLabel(d.status)}</div>
      </div>
      ${d.status !== 'taken'
        ? `<button class="mini-btn" onclick="careMarkTook(this)">Marcar tomada</button>`
        : `<span class="bd bd-g" style="font-size:12px;padding:7px 13px;">Tomada</span>`}
    </div>`).join(''));
}

// ════════════════════════════════════════════════════════════════
//  CUIDADOR — HISTORIAL
// ════════════════════════════════════════════════════════════════
async function loadCareHistory() {
  const body = document.getElementById('c-hist-body');
  if (!body) return;

  const nameEl = document.getElementById('c-hist-name');
  if (nameEl && S.user) nameEl.textContent = S.user.name.split(' ')[0];

  _careHistPeriod = _careHistPeriod || 7;
  setActivePeriodBtn(_careHistPeriod);
  body.innerHTML = loadingSpinner();

  try {
    const [history, adh] = await Promise.all([
      api('GET', `/doses/history?patient_id=${S.patientId}&days=${_careHistPeriod}`),
      api('GET', `/doses/adherence?patient_id=${S.patientId}&days=${_careHistPeriod}`)
    ]);

    const totalTaken   = parseInt(adh.taken   || 0);
    const totalMissed  = parseInt(adh.missed  || 0);
    const totalPending = parseInt(adh.pending || 0);
    const pct          = parseFloat(adh.adherence_pct ?? 0);
    const pctColor     = pct >= 80 ? '#2edb96' : pct >= 50 ? '#d312e9' : '#fb3e3e';
    const pctBg        = pct >= 80 ? '#edfdf6' : pct >= 50 ? '#fbe8fe' : '#ffecec';

    // ── Resumen ───────────────────────────────────────────────
    const summaryEl = document.getElementById('c-adh-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
          <div>
            <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:1px;">Adherencia general</div>
            <div style="font-family:'Fraunces',serif;font-size:42px;font-weight:900;color:${pctColor};line-height:1.1;">${pct}%</div>
            <div style="font-size:12px;font-weight:700;color:var(--muted);">últimos ${_careHistPeriod} días</div>
          </div>
          <div style="width:80px;height:80px;position:relative;flex-shrink:0;">
            <svg viewBox="0 0 36 36" style="width:80px;height:80px;transform:rotate(-90deg);">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" stroke-width="3.2"/>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="${pctColor}" stroke-width="3.2"
                stroke-dasharray="${pct} ${100-pct}" stroke-linecap="round"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:${pctColor};">${Math.round(pct)}%</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          <div style="background:#edfdf6;border-radius:var(--r);padding:12px 8px;text-align:center;">
            <div style="font-size:22px;font-weight:900;color:#2edb96;font-family:'Fraunces',serif;">${totalTaken}</div>
            <div style="font-size:11px;font-weight:800;color:#2edb96;margin-top:2px;">Tomadas</div>
          </div>
          <div style="background:#ffecec;border-radius:var(--r);padding:12px 8px;text-align:center;">
            <div style="font-size:22px;font-weight:900;color:#fb3e3e;font-family:'Fraunces',serif;">${totalMissed}</div>
            <div style="font-size:11px;font-weight:800;color:#fb3e3e;margin-top:2px;">Olvidadas</div>
          </div>
          <div style="background:#fbe8fe;border-radius:var(--r);padding:12px 8px;text-align:center;">
            <div style="font-size:22px;font-weight:900;color:#d312e9;font-family:'Fraunces',serif;">${totalPending}</div>
            <div style="font-size:11px;font-weight:800;color:#d312e9;margin-top:2px;">Pendientes</div>
          </div>
        </div>`;
    }

    // ── Gráfico de barras ──────────────────────────────────────
    const entries = Object.entries(history).sort(([a],[b]) => a.localeCompare(b));
    const labels  = entries.map(([d]) =>
      new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { weekday:'short', day:'numeric' })
    );
    const takenD   = entries.map(([,d]) => d.filter(x => x.status==='taken').length);
    const missedD  = entries.map(([,d]) => d.filter(x => x.status==='missed').length);
    const pendingD = entries.map(([,d]) => d.filter(x => x.status==='pending').length);

    const canvas = document.getElementById('c-chart-bar');
    if (canvas) {
      if (window._careChart) { window._careChart.destroy(); window._careChart = null; }
      window._careChart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label:'Tomadas',    data:takenD,   backgroundColor:'#2edb96', borderRadius:6, borderSkipped:false },
            { label:'Olvidadas',  data:missedD,  backgroundColor:'#fb3e3e', borderRadius:3, borderSkipped:false },
            { label:'Pendientes', data:pendingD, backgroundColor:'#d312e9', borderRadius:6, borderSkipped:false }
          ]
        },
        options: {
          responsive:true,
          maintainAspectRatio:true,
          plugins:{
            legend:{
              position:'bottom',
              labels:{
                font:{ family:'Nunito', weight:'700', size:11 },
                padding:16,
                usePointStyle:true,
                pointStyle:'circle'
              }
            },
            tooltip:{
              backgroundColor:'var(--text)',
              titleFont:{ family:'Nunito', weight:'800', size:12 },
              bodyFont:{ family:'Nunito', weight:'700', size:11 },
              padding:10,
              cornerRadius:10
            }
          },
          scales:{
            x:{
              stacked:true,
              grid:{ display:false },
              border:{ display:false },
              ticks:{ font:{ family:'Nunito', weight:'700', size:10 }, color:'#6B8888' }
            },
            y:{
              stacked:true,
              beginAtZero:true,
              grid:{ color:'rgba(0,0,0,0.04)', drawBorder:false },
              border:{ display:false },
              ticks:{ stepSize:1, font:{ family:'Nunito', weight:'700', size:10 }, color:'#6B8888' }
            }
          }
        }
      });
    }

    // ── Desglose por medicamento ──────────────────────────────
    const medMap = {};
    entries.forEach(([,doses]) => doses.forEach(d => {
      const key = d.medication_name + (d.dose_mg ? ' ' + d.dose_mg + 'mg' : '');
      if (!medMap[key]) medMap[key] = { taken:0, missed:0, pending:0 };
      medMap[key][d.status] = (medMap[key][d.status]||0) + 1;
    }));

    const breakdown = document.getElementById('c-med-breakdown');
    if (breakdown) {
      breakdown.innerHTML = Object.entries(medMap).map(([name, s]) => {
        const completed = s.taken + s.missed;
        const pctMed   = completed ? Math.round(s.taken / completed * 100) : 0;
        const color    = pctMed >= 80 ? '#2edb96' : pctMed >= 50 ? '#d312e9' : '#fb3e3e';
        const barColor = pctMed >= 80 ? '#2edb96' : pctMed >= 50 ? '#d312e9' : '#fb3e3e';
        return `
          <div style="padding:12px 0;border-bottom:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
              <span style="font-size:14px;font-weight:800;color:var(--text);">${name}</span>
              <span style="font-family:'Fraunces',serif;font-size:18px;font-weight:900;color:${color};">${pctMed}%</span>
            </div>
            <div style="height:6px;background:var(--border);border-radius:99px;overflow:hidden;margin-bottom:8px;">
              <div style="height:100%;width:${pctMed}%;background:${barColor};border-radius:99px;"></div>
            </div>
            <div style="display:flex;gap:14px;">
              <div style="display:flex;align-items:center;gap:5px;">
                <div style="width:7px;height:7px;border-radius:50%;background:#2edb96;flex-shrink:0;"></div>
                <span style="font-size:11px;font-weight:700;color:var(--muted);">${s.taken} tomadas</span>
              </div>
              <div style="display:flex;align-items:center;gap:5px;">
                <div style="width:7px;height:7px;border-radius:50%;background:#fb3e3e;flex-shrink:0;"></div>
                <span style="font-size:11px;font-weight:700;color:var(--muted);">${s.missed} olvidadas</span>
              </div>
              ${s.pending ? `<div style="display:flex;align-items:center;gap:5px;">
                <div style="width:7px;height:7px;border-radius:50%;background:#d312e9;flex-shrink:0;"></div>
                <span style="font-size:11px;font-weight:700;color:var(--muted);">${s.pending} pendientes</span>
              </div>` : ''}
            </div>
          </div>`;
      }).join('');
    }

    // ── Historial detallado ───────────────────────────────────
    if (!entries.length) { body.innerHTML = emptyState('Sin historial para este período'); return; }
    body.innerHTML = [...entries].reverse().map(([date, doses]) => {
      const missed = doses.filter(d => d.status === 'missed').length;
      return `
        <div style="padding:14px 18px 0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span style="font-size:13px;font-weight:900;color:var(--care-d);letter-spacing:.2px;">${fmtDateGroup(date)}</span>
            <span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:50px;
              background:${missed ? 'var(--red-bg)' : 'var(--green-bg)'};
              color:${missed ? 'var(--red)' : 'var(--green)'};">
              ${missed ? missed + ' olvidada' + (missed>1?'s':'') : 'Día completo'}
            </span>
          </div>
          ${doses.map(d => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--border);">
              <div class="sc ${scClass(d.status)}" style="width:34px;height:34px;font-size:15px;flex-shrink:0;">${scIcon(d.status)}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:14px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.medication_name}${d.dose_mg ? ' ' + d.dose_mg + 'mg' : ''}</div>
                ${d.taken_at ? `<div style="font-size:11px;font-weight:700;color:var(--muted);">Tomada a las ${fmtTime(d.taken_at)}</div>` : ''}
              </div>
              <span class="bd ${bdClass(d.status)}" style="font-size:11px;padding:5px 11px;flex-shrink:0;">${statusLabel(d.status)}</span>
            </div>`).join('')}
          <div style="height:6px;"></div>
        </div>`;
    }).join('');

  } catch (err) {
    body.innerHTML = errorCard('Error: ' + err.message);
    console.error('loadCareHistory:', err);
  }
}

let _careHistPeriod = 7;

function setCareHistPeriod(days) {
  _careHistPeriod = days;
  setActivePeriodBtn(days);
  loadCareHistory();
}

function setActivePeriodBtn(days) {
  [7,14,30].forEach(d => {
    const btn = document.getElementById('pbtn-' + d);
    if (btn) btn.className = 'period-btn' + (d === days ? ' active' : '');
  });
}


// ════════════════════════════════════════════════════════════════
//  CUIDADOR — BMO
// ════════════════════════════════════════════════════════════════
async function loadCareBmo() {
  setHtml('c-bmo-comps', loadingSpinner());
  try {
    const data = await api('GET', `/bmo?patient_id=${S.patientId}`);
    renderBmoCard('c-bmo-card', 'c-bmo-comps', data, true);
  } catch (err) {
    setHtml('c-bmo-comps', emptyState('BMO no encontrado para este paciente.'));
  }
}

function renderBmoCard(cardId, compsId, data, isCare) {
  const { device, compartments } = data;
  const card = document.getElementById(cardId);
  if (card) {
    const connEl = card.querySelector('.bmo-conn');
    if (connEl) {
      connEl.textContent = device.connected ? 'Conectado · ' + (device.location || '') : 'Desconectado';
      connEl.className   = 'bmo-conn ' + (device.connected ? 'on' : 'off');
    }
    const stats = card.querySelector('.bmo-stats');
    if (stats) {
      stats.children[0].querySelector('.bmo-stat-n').textContent = (device.battery_pct ?? 0) + '%';
      stats.children[1].querySelector('.bmo-stat-n').textContent = device.last_sync ? fmtTime(device.last_sync) : '—';
    }
  }
  if (!compartments.length) { setHtml(compsId, emptyState('Sin compartimentos')); return; }
  setHtml(compsId, compartments.map(c => {
    const pct   = c.stock_pct ?? 0;
    const level = pct <= 5 ? 'empty' : pct <= 20 ? 'low' : 'ok';
    const alertMsg = level === 'empty'
      ? `${ICO.xcirc} Compartimento vacío${isCare ? ' — requiere carga' : ''}`
      : level === 'low'
      ? `${ICO.warn} Pocas pastillas${isCare ? ' — necesita reabastecimiento' : ' — avísale a tu familiar'}`
      : '';
    return `
      <div class="comp${level !== 'ok' ? ' ' + level + '-stock' : ''}">
        <div class="comp-row">
          <div>
            <div class="comp-label">Compartimento ${c.slot_number}</div>
            <div class="comp-name">${c.medication_name || 'Sin medicamento'}</div>
          </div>
          <div class="comp-pct ${level}">${level === 'empty' ? 'Vacío' : pct + '%'}</div>
        </div>
        <div class="level-bar"><div class="level-fill lf-${level}" style="width:${pct}%"></div></div>
        ${alertMsg ? `<div class="comp-alert ${level}">${alertMsg}</div>` : ''}
        ${isCare && level !== 'ok' ? `<button class="restock-btn" onclick="toast('Alerta enviada para compartimento ${c.slot_number}')">Solicitar reabastecimiento</button>` : ''}
      </div>`;
  }).join(''));
}

// ════════════════════════════════════════════════════════════════
//  CUIDADOR — ALERTAS
// ════════════════════════════════════════════════════════════════
async function loadCareAlerts() {
  const body = document.getElementById('c-alerts-body');
  if (!body) return;
  body.innerHTML = loadingSpinner();
  try {
    // Las alertas del cuidador son las notificaciones del paciente
    const { notifications } = await api('GET', '/notifications?limit=30');
    body.innerHTML = notifications.length
      ? notifications.map(n => renderNotif(n)).join('')
      : emptyState('Sin alertas por ahora');
    api('PATCH', '/notifications/read-all').catch(() => {});
    updateNotifBadge('cnb-alertas', 0);
  } catch (err) {
    body.innerHTML = errorCard('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════════
//  ACCIONES
// ════════════════════════════════════════════════════════════════
function openConfirm() { document.getElementById('ov-confirm').classList.add('show'); }
function closeOv(id)   { document.getElementById(id).classList.remove('show'); }

async function confirmYes() {
  closeOv('ov-confirm');
  if (!S.pendingDoseId) { toast('No hay dosis pendiente registrada'); return; }
  try {
    await api('POST', `/doses/${S.pendingDoseId}/take`, {});
    toast('¡Muy bien, ' + (S.user?.name?.split(' ')[0] || '') + '! Dosis registrada');
    await loadPatientHome();
  } catch (err) {
    toast('Error al registrar: ' + err.message);
  }
}

async function careMarkTook(btn) {
  const row    = btn.closest('.cmrow');
  const doseId = row?.dataset?.doseId;
  if (!doseId) { toast('No se encontró el ID de la dosis'); return; }
  btn.textContent = '...';
  btn.disabled    = true;
  try {
    await api('POST', `/doses/${doseId}/take`, {});
    row.querySelector('.sc').className = 'sc sc-g';
    row.querySelector('.sc').innerHTML = ICO.check;
    row.querySelector('.cmr-sub').textContent = 'Marcada por cuidador';
    row.lastElementChild.outerHTML =
      '<span class="bd bd-g" style="font-size:12px;padding:7px 13px;">Tomada</span>';
    toast('Dosis marcada correctamente');
  } catch (err) {
    btn.textContent = 'Marcar tomada';
    btn.disabled    = false;
    toast('Error: ' + err.message);
  }
}

function careQuickAction(action) {
  if (action === 'mark') {
    const pending = document.querySelector('#c-today-doses .mini-btn');
    if (!pending) { toast('No hay dosis pendientes para marcar'); return; }
    careMarkTook(pending);
  } else if (action === 'alert') {
    toast('Alerta enviada a ' + (S.user?.name?.split(' ')[0] || 'el paciente'));
  }
}

// ════════════════════════════════════════════════════════════════
//  LLAMADAS
// ════════════════════════════════════════════════════════════════
function openCall(name, phone) {
  if (phone) {
    window.location.href = 'tel:' + phone.replace(/[^+\d]/g, '');
  } else {
    toast('Número no registrado. Agrégalo en Configuración.');
  }
}

// ════════════════════════════════════════════════════════════════
//  RENDER HELPERS
// ════════════════════════════════════════════════════════════════
function renderNotif(n) {
  const colors = {
    dose_reminder:   'var(--amber)',
    dose_missed:     'var(--red)',
    caregiver_alert: 'var(--red)',
    dose_taken:      'var(--green)',
    low_stock:       'var(--amber)',
    empty_slot:      'var(--red)',
    weekly_summary:  'var(--care)'
  };
  return `
    <div class="notif${!n.read ? ' unread' : ''}">
      <div class="notif-bar" style="background:${colors[n.type] || 'var(--teal)'}"></div>
      <div class="notif-inner">
        <div class="notif-title">${n.title}</div>
        <div class="notif-msg">${n.message}</div>
        <div class="notif-time">${fmtRelative(n.created_at)}</div>
      </div>
    </div>`;
}

function renderAdherence(pctId, streakId, weekId, adh) {
  setTxt(pctId,    (adh.adherence_pct ?? 0) + '%');
  setTxt(streakId, adh.streak_days ?? 0);
  buildWeek(weekId, adh);
}

function buildWeek(containerId, adh) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = '';
  const days = ['L','M','X','J','V','S','D'];
  const pct  = parseFloat(adh?.adherence_pct ?? 71);
  const ok   = days.map((_, i) => i < Math.round(pct / 100 * 7));
  days.forEach((d, i) => {
    const div = document.createElement('div');
    div.className    = 'adh-d';
    div.style.background = ok[i] ? 'var(--green-bg)' : 'var(--red-bg)';
    div.innerHTML = `
      <span class="dl" style="color:${ok[i] ? 'var(--green)' : 'var(--red)'}">${d}</span>
      <span class="dd" style="background:${ok[i] ? 'var(--green)' : 'var(--red)'}"></span>`;
    c.appendChild(div);
  });
}


// ════════════════════════════════════════════════════════════════
//  MEDICAMENTOS — carga, guardado, edición y eliminación
// ════════════════════════════════════════════════════════════════
let expandedMedId = null; // ID del card actualmente expandido

async function loadMedications(view) {
  const listId = view === 'patient' ? 'pm-list' : 'cm-list';
  const el = document.getElementById(listId);
  console.log('[loadMedications] view:', view, 'listId:', listId, 'el found:', !!el, 'patientId:', S.patientId);
  if (!el) { console.error('[loadMedications] Element not found:', listId); return; }
  el.innerHTML = loadingSpinner();
  try {
    const url = `/medications?patient_id=${S.patientId}`;
    console.log('[loadMedications] calling GET', url);
    const resp = await api('GET', url);
    console.log('[loadMedications] response:', resp);
    const meds = Array.isArray(resp) ? resp : (resp.rows || []);
    console.log('[loadMedications] meds count:', meds.length);
    renderMedList(meds, listId, view);
  } catch (err) {
    el.innerHTML = errorCard('Error cargando medicamentos: ' + err.message);
    console.error('[loadMedications] ERROR:', err);
  }
}

function renderMedList(meds, listId, view) {
  const el = document.getElementById(listId);
  if (!el) return;
  if (!meds.length) {
    el.innerHTML = emptyState('Sin medicamentos registrados aún');
    return;
  }
  el.innerHTML = meds.map(m => {
    const time = fmtScheduledTime(m.scheduled_time);
    return `
    <div class="med-card" id="mcard-${m.id}">
      <div class="med-row" onclick="toggleMed('${m.id}')">
        <div class="med-icon" style="background:var(--teal-s);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal-d)" stroke-width="2" stroke-linecap="round"><path d="M10.5 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6.5"/><path d="M13.5 4H20a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6.5"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
        </div>
        <div class="med-info">
          <div class="med-name">${m.name}${m.dose_mg ? ' <span style="font-weight:700;color:var(--muted);">' + m.dose_mg + 'mg</span>' : ''}</div>
          <div class="med-sub">${time} · Comp. ${m.compartment ?? '—'} · ${freqLabel(m.frequency)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="med-badge ${m.active ? 'badge-green' : 'badge-gray'}">${m.active ? 'Activo' : 'Inactivo'}</span>
          <svg class="med-chevron" id="chev-${m.id}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="med-detail" id="mdetail-${m.id}" style="display:none;">
        ${m.notes ? `<div class="med-note">"${m.notes}"</div>` : ''}
        <div class="med-actions">
          <button class="med-btn-edit" onclick="openEditMed('${m.id}','${m.name}',${m.dose_mg||'null'},'${m.compartment||''}','${m.scheduled_time}','${m.frequency}','${(m.notes||'').replace(/'/g,"\\'")}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Editar
          </button>
          <button class="med-btn-del" onclick="confirmDeleteMed('${m.id}','${m.name}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            Desactivar
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleMed(id) {
  const detail = document.getElementById('mdetail-' + id);
  const chev   = document.getElementById('chev-' + id);
  if (!detail) return;
  const isOpen = detail.style.display !== 'none';
  // Close all
  document.querySelectorAll('.med-detail').forEach(d => d.style.display = 'none');
  document.querySelectorAll('.med-chevron').forEach(c => c.style.transform = '');
  if (!isOpen) {
    detail.style.display = 'block';
    if (chev) chev.style.transform = 'rotate(180deg)';
    expandedMedId = id;
  } else {
    expandedMedId = null;
  }
}

async function saveMedication(view) {
  const pre    = view === 'patient' ? 'pm' : 'cm';
  const nombre = document.getElementById(pre + '-nombre')?.value.trim();
  const dosis  = document.getElementById(pre + '-dosis')?.value.trim();
  const comp   = document.getElementById(pre + '-comp')?.value;
  const hora   = document.getElementById(pre + '-hora')?.value;
  const freq   = document.getElementById(pre + '-freq')?.value || 'daily';
  const nota   = document.getElementById(pre + '-nota')?.value.trim();

  if (!nombre)  { toast('Escribe el nombre del medicamento'); return; }
  if (!hora)    { toast('Elige la hora de la dosis'); return; }
  if (!comp)    { toast('Selecciona el compartimento BMO'); return; }

  const btn = document.getElementById(pre + '-save-btn');
  if (btn) { btn.textContent = 'Guardando...'; btn.disabled = true; }

  try {
    const payload = {
      patient_id:     S.patientId,
      name:           nombre,
      dose_mg:        dosis ? parseFloat(dosis) : null,
      compartment:    parseInt(comp),
      scheduled_time: hora,
      frequency:      freq,
      notes:          nota || null
    };
    console.log('[saveMedication] POST /medications payload:', payload);
    const created = await api('POST', '/medications', payload);
    console.log('[saveMedication] Created:', created);
    // Limpiar formulario
    ['nombre','dosis','hora','nota'].forEach(f => {
      const el = document.getElementById(pre + '-' + f);
      if (el) el.value = '';
    });
    const compEl = document.getElementById(pre + '-comp');
    const freqEl = document.getElementById(pre + '-freq');
    if (compEl) compEl.value = '';
    if (freqEl) freqEl.value = 'daily';

    toast('¡Medicamento guardado!');
    await loadMedications(view);
    if (view === 'patient') loadPatientHome();
    else loadCareDash();
  } catch (err) {
    console.error('saveMedication error:', err);
    toast('Error al guardar: ' + err.message);
  } finally {
    if (btn) { btn.textContent = 'Guardar medicamento'; btn.disabled = false; }
  }
}

// ── Editar medicamento ────────────────────────────────────────
let _editingMedView = null;

function openEditMed(id, name, dose, comp, time, freq, notes) {
  _editingMedView = getActiveMedView();
  const pre = _editingMedView === 'patient' ? 'pm' : 'cm';

  // Fill form with existing data
  const setVal = (field, val) => {
    const el = document.getElementById(pre + '-' + field);
    if (el && val !== null && val !== 'null') el.value = val;
  };
  setVal('nombre', name);
  setVal('dosis', dose);
  setVal('comp', comp);
  setVal('hora', time ? time.substring(0,5) : '');
  setVal('freq', freq);
  setVal('nota', notes);

  // Change save button to update mode
  const btn = document.getElementById(pre + '-save-btn');
  if (btn) {
    btn.textContent = 'Actualizar medicamento';
    btn.onclick = () => updateMedication(id, _editingMedView);
  }
  // Scroll to form
  const form = document.getElementById(pre + '-nombre');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  toast('Editando: ' + name);
}

async function updateMedication(id, view) {
  const pre    = view === 'patient' ? 'pm' : 'cm';
  const nombre = document.getElementById(pre + '-nombre')?.value.trim();
  const dosis  = document.getElementById(pre + '-dosis')?.value.trim();
  const comp   = document.getElementById(pre + '-comp')?.value;
  const hora   = document.getElementById(pre + '-hora')?.value;
  const freq   = document.getElementById(pre + '-freq')?.value;
  const nota   = document.getElementById(pre + '-nota')?.value.trim();

  if (!nombre || !hora || !comp) { toast('Completa todos los campos requeridos'); return; }

  const btn = document.getElementById(pre + '-save-btn');
  if (btn) { btn.textContent = 'Actualizando...'; btn.disabled = true; }

  try {
    await api('PUT', `/medications/${id}`, {
      name: nombre,
      dose_mg: dosis ? parseFloat(dosis) : null,
      compartment: parseInt(comp),
      scheduled_time: hora,
      frequency: freq,
      notes: nota || null
    });
    // Reset form and button
    ['nombre','dosis','hora','nota'].forEach(f => {
      const el = document.getElementById(pre + '-' + f);
      if (el) el.value = '';
    });
    const compEl = document.getElementById(pre + '-comp');
    const freqEl = document.getElementById(pre + '-freq');
    if (compEl) compEl.value = '';
    if (freqEl) freqEl.value = 'daily';
    if (btn) {
      btn.textContent = 'Guardar medicamento';
      btn.onclick = () => saveMedication(view);
      btn.disabled = false;
    }
    toast('¡Medicamento actualizado!');
    await loadMedications(view);
    if (view === 'patient') loadPatientHome();
    else loadCareDash();
  } catch (err) {
    toast('Error: ' + err.message);
    if (btn) { btn.textContent = 'Actualizar medicamento'; btn.disabled = false; }
  }
}

// ── Eliminar (con doble confirmación) ────────────────────────
function confirmDeleteMed(id, name) {
  const card = document.getElementById('mcard-' + id);
  if (!card) return;
  // Replace actions with confirm step
  const actions = card.querySelector('.med-actions');
  if (!actions) return;
  actions.innerHTML = `
    <div style="background:var(--red-bg);border-radius:var(--r);padding:12px 14px;width:100%;">
      <div style="font-size:13px;font-weight:800;color:var(--red);margin-bottom:10px;">¿Desactivar "${name}"?</div>
      <div style="font-size:12px;color:var(--muted);font-weight:700;margin-bottom:12px;">El medicamento dejará de aparecer en el horario. Podrás reactivarlo desde la base de datos.</div>
      <div style="display:flex;gap:8px;">
        <button onclick="cancelDelete('${id}')" style="flex:1;padding:10px;background:var(--surface);border:1.5px solid var(--border);border-radius:var(--r);font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;cursor:pointer;color:var(--muted);">Cancelar</button>
        <button onclick="deleteMedication('${id}')" style="flex:1;padding:10px;background:var(--red);border:none;border-radius:var(--r);font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;cursor:pointer;color:#fff;">Sí, desactivar</button>
      </div>
    </div>`;
}

function getActiveMedView() {
  // Check which medication screen is currently active
  const ptActive = document.getElementById('ps-medicamentos')?.classList.contains('active');
  return ptActive ? 'patient' : 'caregiver';
}

function cancelDelete(id) {
  loadMedications(getActiveMedView());
}

async function deleteMedication(id) {
  try {
    await api('DELETE', `/medications/${id}`);
    toast('Medicamento desactivado');
    const view = getActiveMedView();
    await loadMedications(view);
    if (view === 'patient') loadPatientHome();
    else loadCareDash();
  } catch (err) {
    toast('Error: ' + err.message);
  }
}

function freqLabel(f) {
  const m = { daily:'Diario', twice_daily:'Cada 12h', three_times:'Cada 8h', weekly:'Semanal' };
  return m[f] || f;
}

function fmtScheduledTime(t) {
  if (!t) return '—';
  try {
    // Handle "HH:MM:SS" or "HH:MM" format from PostgreSQL
    const parts = String(t).split(':');
    const h = parseInt(parts[0]);
    const m = parts[1] || '00';
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12  = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  } catch { return t; }
}


// ════════════════════════════════════════════════════════════════
//  COUNTDOWN
// ════════════════════════════════════════════════════════════════
let countdownTimer;
function startCountdown(scheduledAt) {
  clearInterval(countdownTimer);
  const el = document.getElementById('p-cd');
  if (!el) return;
  function update() {
    const diff = new Date(scheduledAt) - new Date();
    if (diff <= 0) { el.textContent = 'Ahora'; clearInterval(countdownTimer); return; }
    const h = Math.floor(diff / 36e5);
    const m = Math.floor((diff % 36e5) / 6e4);
    el.textContent = h > 0 ? `${h}h ${m}min` : `${m} min`;
  }
  update();
  countdownTimer = setInterval(update, 60000);
}


// ════════════════════════════════════════════════════════════════
//  PANEL DE ALERTAS / NOTIFICACIONES (drawer)
// ════════════════════════════════════════════════════════════════
async function openAlertsPanel(view) {
  // Navigate to the correct alerts/notifs screen
  if (view === 'patient') {
    goPt('notifs');
  } else {
    goCa('alertas');
  }
}

function closeAlertsPanel() {}

async function loadPanelNotifications(containerId, badgeId) {
  const body = document.getElementById(containerId);
  if (!body) return;
  body.innerHTML = loadingSpinner();
  try {
    const { notifications, unread_count } = await api('GET', '/notifications?limit=30');
    body.innerHTML = notifications.length
      ? notifications.map(n => renderNotif(n)).join('')
      : emptyState('Sin notificaciones por ahora');
    api('PATCH', '/notifications/read-all').catch(() => {});
    const badge = document.getElementById(badgeId);
    if (badge) badge.style.display = 'none';
    updateNotifBadge('pnb-notifs', 0);
  } catch (err) {
    body.innerHTML = errorCard('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════════════════════════
let tt;
function toast(msg) {
  clearTimeout(tt);
  const el = document.getElementById('toast-el');
  el.innerHTML = msg;
  el.classList.add('show');
  tt = setTimeout(() => el.classList.remove('show'), 3200);
}

// ════════════════════════════════════════════════════════════════
//  ACCESIBILIDAD
// ════════════════════════════════════════════════════════════════
function sz(m) {
  document.body.classList.toggle('lg', m === 'l');
  toast(m === 'l' ? 'Texto grande activado' : 'Texto normal');
}

// ════════════════════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════════════════════
function setTxt(id, val)  { const el = document.getElementById(id); if (el) el.textContent = val; }
function setHtml(id, val) { const el = document.getElementById(id); if (el) el.innerHTML   = val; }

function scClass(s) { return s === 'taken' ? 'sc-g' : s === 'pending' ? 'sc-a' : 'sc-r'; }
function bdClass(s) { return s === 'taken' ? 'bd-g' : s === 'pending' ? 'bd-a' : 'bd-r'; }
function scIcon(s)  { return s === 'taken' ? ICO.check : s === 'pending' ? ICO.hglass : ICO.warn; }

function statusLabel(s) {
  return { taken:'Tomada', pending:'Pendiente', missed:'Olvidada', skipped:'Omitida' }[s] || s;
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateLong(d) {
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}
function fmtDateGroup(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}
function fmtRelative(iso) {
  const diff = Date.now() - new Date(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Ahora';
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h}h`;
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function updateNotifBadge(nbId, count) {
  const nb = document.getElementById(nbId);
  if (!nb) return;
  const badge = nb.querySelector('.nbadge');
  if (!badge) return;
  badge.style.display = count <= 0 ? 'none' : '';
  if (count > 0) badge.textContent = count > 9 ? '9+' : count;
}

function loadingSpinner() {
  return `<div style="padding:32px;text-align:center;color:var(--muted);font-size:15px;font-weight:700;">Cargando...</div>`;
}
function emptyState(msg) {
  return `<div style="padding:32px 24px;text-align:center;color:var(--muted);font-size:15px;font-weight:700;background:var(--surface);border-radius:var(--rL);border:1.5px solid var(--border);">${msg}</div>`;
}
function errorCard(msg) {
  return `<div style="padding:16px 18px;color:var(--red);font-size:14px;font-weight:700;background:var(--red-bg);border-radius:var(--rL);">${msg}</div>`;
}

// ── Init ──────────────────────────────────────────────────────
selRole('pt');