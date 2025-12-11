/* app.js — REVA Wellness: modals fixed, Contact/FAQ wiring, pages & permissions */

/* ---------- Storage wrapper ---------- */
const Storage = (() => {
  const base = { logs: 'logs', rem: 'reminders', appt: 'appointments', arts: 'articles', contacts: 'contacts', users: 'reva_users' };
  const currentUser = () => sessionStorage.getItem('reva_user') || 'guest';
  const key = (k) => `${currentUser()}_${(base[k] || k)}`;

  function read(k){ try { return JSON.parse(localStorage.getItem(key(k)) || '[]'); } catch(e) { return []; } }
  function write(k,v){ localStorage.setItem(key(k), JSON.stringify(v)); }
  function uid(p='id'){ return `${p}_${Math.random().toString(36).slice(2,9)}`; }
  function today(){ return new Date().toISOString().slice(0,10); }

  function readUsers(){ try { return JSON.parse(localStorage.getItem(base.users) || '[]'); } catch(e) { return []; } }
  function writeUsers(list){ localStorage.setItem(base.users, JSON.stringify(list)); }

  return { read, write, uid, today, readUsers, writeUsers };
})();

/* ---------- Router ---------- */
const Router = (() => {
  const routes = {};
  function route(p, fn){ routes[p] = fn; }
  function render(){
    const raw = location.hash.replace('#','') || '/';
    document.querySelectorAll('.side-list a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#'+raw));
    (routes[raw] || routes['/'])();
  }
  window.addEventListener('hashchange', render);
  return { route, render };
})();

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
function setMain(html){ const el = $('app'); el.innerHTML = html; el.focus?.(); window.scrollTo({top:0, behavior:'smooth'}); }
function openModal(id){
  const m = $(id); if(!m) return;
  m.classList.add('show'); m.setAttribute('aria-hidden','false');
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  const card = m.querySelector('.modal-card');
  if(card){ const f = card.querySelector('input,button,textarea,select,a'); if(f) f.focus({preventScroll:true}); }
}
function closeModal(id){ const m = $(id); if(!m) return; m.classList.remove('show'); m.setAttribute('aria-hidden','true'); document.documentElement.style.overflow=''; document.body.style.overflow=''; }

/* ---------- Auth (demo) ---------- */
function getUsers(){ return Storage.readUsers(); }
function saveUsers(list){ Storage.writeUsers(list); }
function findUser(email){ return getUsers().find(u => u.email && u.email.toLowerCase() === email.toLowerCase()); }

function registerUser(name,email,pass){
  if(findUser(email)) return { ok:false, msg:'Email already registered' };
  const u = { id: email.toLowerCase(), name: name || email.split('@')[0], email: email.toLowerCase(), pass };
  const list = getUsers(); list.push(u); saveUsers(list);
  sessionStorage.setItem('reva_user', u.id);
  Storage.write('logs', []); Storage.write('rem', []); Storage.write('appt', []); Storage.write('arts', []); Storage.write('contacts', []);
  return { ok:true, user:u };
}

function loginUser(email,pass){
  const u = findUser(email);
  if(!u) return { ok:false, msg:'No such user' };
  if(u.pass !== pass) return { ok:false, msg:'Incorrect password' };
  sessionStorage.setItem('reva_user', u.id);
  return { ok:true, user:u };
}

function logoutUser(){ sessionStorage.removeItem('reva_user'); }

/* Admin demo credential */
const DEMO_ADMIN = { email: 'admin@reva.local', pass: 'admin123' };

/* ---------- UI ---------- */
function refreshCurrentUserUI(){
  const uid = sessionStorage.getItem('reva_user') || 'guest';
  const el = $('currentUser');
  if(!el) return;
  if(uid === 'guest') el.textContent = 'Guest';
  else {
    const u = findUser(uid) || { name: uid, email: uid };
    el.textContent = `${u.name} (${u.email})`;
  }
}

function requireAuth(){
  const uid = sessionStorage.getItem('reva_user') || 'guest';
  if(uid === 'guest'){ openModal('loginModal'); return false; }
  return true;
}

/* ---------- Pages (Home, Dashboard, Logs, Reminders, Appointments, Resources, Education, Assessment, Contacts, Admin) ---------- */
Router.route('/', () => {
  setMain(`
    <div class="card">
      <h2>Welcome to REVA Wellness</h2>
      <p class="muted">A compact educational web app for tracking mood, reminders, and basic health info. Sign in to save your data to your account.</p>
      <div class="controls" style="margin-top:12px">
        <button class="btn" id="enterApp">Enter App</button>
        <button class="btn ghost" id="openLogin">Login</button>
      </div>
    </div>
    <div style="height:20px"></div>
    <div class="card">
      <h3>Why use REVA Wellness?</h3>
      <ul>
        <li>Track mood and symptoms daily.</li>
        <li>Set reminders for medication and appointments.</li>
        <li>Read practical educational articles.</li>
        <li>Export your data for clinicians (CSV).</li>
      </ul>
    </div>
  `);
  $('enterApp').addEventListener('click', ()=> location.hash = '#/dashboard');
  $('openLogin').addEventListener('click', ()=> openModal('loginModal'));
});

Router.route('/dashboard', () => {
  if(!requireAuth()) return;
  const logs = Storage.read('logs').slice().sort((a,b)=> new Date(a.date)-new Date(b.date));
  const moods = logs.map(l => Number(l.mood)).filter(n => !isNaN(n));
  const avg = moods.length ? (moods.reduce((a,b)=>a+b,0)/moods.length).toFixed(2) : '—';
  setMain(`
    <div class="grid grid-2">
      <div class="card">
        <h3>Welcome</h3>
        <p class="muted">This dashboard shows your data.</p>
        <div style="margin-top:12px" class="controls">
          <button class="btn" id="toLogs">Add Log</button>
          <button class="btn ghost" id="toRem">Reminders</button>
        </div>
      </div>
      <div class="card">
        <h4>7-day average mood</h4>
        <div style="font-size:28px;font-weight:800;margin-top:8px">${avg}</div>
      </div>
    </div>

    <div style="margin-top:12px" class="card">
      <h3>Mood trend (last 30)</h3>
      <div style="margin-top:10px" class="chart-frame"><canvas id="moodChart"></canvas></div>
    </div>
  `);

  $('toLogs').addEventListener('click', ()=> location.hash = '#/logs');
  $('toRem').addEventListener('click', ()=> location.hash = '#/reminders');

  const ctx = document.getElementById('moodChart').getContext('2d');
  const labels = logs.slice(-30).map(l => l.date);
  const data = logs.slice(-30).map(l => Number(l.mood));
  if(window._chart) window._chart.destroy();
  window._chart = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[{ data, label:'Mood', borderColor:'#10B981', backgroundColor:'rgba(16,185,129,0.12)', tension:0.3 }]},
    options:{plugins:{legend:{display:false}}, scales:{y:{min:0, max:10}}}
  });
});

Router.route('/logs', () => {
  if(!requireAuth()) return;
  setMain(`
    <div class="card">
      <h3>Daily Log</h3>
      <form id="logForm">
        <label>Date<input id="logDate" type="date" value="${Storage.today()}" required></label>
        <label>Mood (1-10)<input id="logMood" type="number" min="1" max="10" value="7" required></label>
        <label>Symptoms (comma separated)<input id="logSym" type="text" placeholder="fatigue, headache"></label>
        <label><input id="logMed" type="checkbox"> Medication taken</label>
        <label>Notes<textarea id="logNotes" placeholder="Optional notes"></textarea></label>
        <div class="controls"><button class="btn" type="submit">Save</button> <button class="btn ghost" id="clearLogs" type="button">Clear</button> <button class="btn ghost" id="exportLogs">Export CSV</button></div>
      </form>
    </div>
    <div style="margin-top:12px" class="card"><h3>Recent</h3><div id="listArea"></div></div>
  `);

  function renderList(){
    const arr = Storage.read('logs').slice().sort((a,b)=> new Date(b.date)-new Date(a.date));
    const area = document.getElementById('listArea');
    if(!arr.length){ area.innerHTML = '<p class="muted small">No logs yet.</p>'; if(window._chart) window._chart.destroy(); return; }
    area.innerHTML = arr.map(it => `
      <div class="list-item">
        <div>
          <strong>${it.date}</strong> • Mood ${it.mood}
          <div class="small muted">${(it.symptoms||[]).join(', ')} ${it.medTaken ? ' • Med taken':''}</div>
          <div class="small" style="margin-top:6px">${it.notes || ''}</div>
        </div>
        <div style="display:flex;gap:8px"><button class="btn ghost" data-id="${it.id}" data-action="edit">Edit</button><button class="btn ghost" data-id="${it.id}" data-action="del">Delete</button></div>
      </div>
    `).join('');
    area.querySelectorAll('button[data-action]').forEach(btn=>{
      btn.addEventListener('click', ()=> {
        const id = btn.getAttribute('data-id'), act = btn.getAttribute('data-action');
        if(act === 'del'){ const newArr = Storage.read('logs').filter(x=>x.id !== id); Storage.write('logs', newArr); renderList(); updateDashboardChart(); }
        if(act === 'edit'){ const item = Storage.read('logs').find(x=>x.id===id); if(!item) return; $('logDate').value=item.date; $('logMood').value=item.mood; $('logSym').value=(item.symptoms||[]).join(', '); $('logMed').checked=item.medTaken; $('logNotes').value=item.notes; window.scrollTo({top:0,behavior:'smooth'}); }
      });
    });
    updateDashboardChart();
  }
  renderList();

  document.getElementById('logForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const entry = { id: Storage.uid('log'), date: $('logDate').value, mood: Number($('logMood').value), symptoms: $('logSym').value.split(',').map(s=>s.trim()).filter(Boolean), medTaken: $('logMed').checked, notes: $('logNotes').value || '' };
    const arr = Storage.read('logs');
    const idx = arr.findIndex(x => x.date === entry.date);
    if(idx >= 0) arr[idx] = Object.assign(arr[idx], entry); else arr.push(entry);
    Storage.write('logs', arr); renderList(); updateDashboardChart();
  });

  $('clearLogs').addEventListener('click', ()=> { if(confirm('Clear all logs for this user?')){ Storage.write('logs', []); renderList(); updateDashboardChart(); } });

  $('exportLogs').addEventListener('click', ()=> {
    const logs = Storage.read('logs');
    const rows = logs.map(l => [l.date, l.mood, `"${(l.symptoms||[]).join(';')}"`, l.medTaken ? 'yes':'no', `"${(l.notes||'')}"`].join(','));
    const csv = ['date,mood,symptoms,medTaken,notes', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'reva_logs.csv'; a.click(); URL.revokeObjectURL(url);
  });

  function updateDashboardChart(){ if(location.hash === '#/dashboard'){ Router.render(); } }
});

/* Reminders */
Router.route('/reminders', ()=>{
  if(!requireAuth()) return;
  setMain(`
    <div class="card">
      <h3>Reminders</h3>
      <form id="remForm">
        <label>Title<input id="remTitle" type="text" required></label>
        <label>Date & time<input id="remDt" type="datetime-local" value="${new Date().toISOString().slice(0,16)}"></label>
        <label>Note<textarea id="remNote"></textarea></label>
        <div class="controls"><button class="btn" type="submit">Save</button></div>
      </form>
    </div>
    <div style="margin-top:12px" class="card"><h3>Upcoming</h3><div id="remList"></div></div>
  `);

  function render(){
    const list = Storage.read('rem').slice().sort((a,b)=> new Date(a.dt)-new Date(b.dt));
    const area = document.getElementById('remList');
    if(!list.length){ area.innerHTML = '<p class="muted small">No reminders</p>'; return; }
    area.innerHTML = list.map(r => `<div class="list-item"><div><strong>${r.title}</strong><div class="small muted">${new Date(r.dt).toLocaleString()} ${r.note? ' • '+r.note: ''}</div></div><div><button class="btn ghost" data-id="${r.id}">Delete</button></div></div>`).join('');
    area.querySelectorAll('button[data-id]').forEach(b=> b.addEventListener('click', ()=> {
      const id = b.getAttribute('data-id'); const arr = Storage.read('rem').filter(x=>x.id !== id); Storage.write('rem', arr); render();
    }));
  }
  render();

  document.getElementById('remForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const r = { id: Storage.uid('rem'), title: $('remTitle').value, dt: $('remDt').value, note: $('remNote').value };
    const arr = Storage.read('rem'); arr.push(r); Storage.write('rem', arr); render();
  });
});

/* Appointments */
Router.route('/appointments', ()=>{
  if(!requireAuth()) return;
  setMain(`
    <div class="card">
      <h3>Appointments</h3>
      <form id="aForm">
        <label>Title<input id="aTitle" type="text" required></label>
        <label>Date<input id="aDate" type="date" value="${Storage.today()}"></label>
        <label>Time<input id="aTime" type="time" value="09:00"></label>
        <label>Duration (mins)<input id="aDur" type="number" value="30"></label>
        <div class="controls"><button class="btn" type="submit">Save</button></div>
      </form>
    </div>
    <div style="margin-top:12px" class="card"><h3>Upcoming</h3><div id="aList"></div></div>
  `);

  function render(){
    const list = Storage.read('appt').slice().sort((a,b)=> new Date(a.date+'T'+a.time)-new Date(b.date+'T'+b.time));
    const area = document.getElementById('aList');
    if(!list.length){ area.innerHTML = '<p class="muted small">No appointments</p>'; return; }
    area.innerHTML = list.map(a => `<div class="list-item"><div><strong>${a.title}</strong><div class="small muted">${a.date} ${a.time} • ${a.duration} mins</div></div><div><button class="btn ghost" data-id="${a.id}">Delete</button></div></div>`).join('');
    area.querySelectorAll('button[data-id]').forEach(b=> b.addEventListener('click', ()=> {
      const id = b.getAttribute('data-id'); const arr = Storage.read('appt').filter(x=>x.id !== id); Storage.write('appt', arr); render();
    }));
  }
  render();

  document.getElementById('aForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const a = { id: Storage.uid('a'), title: $('aTitle').value, date: $('aDate').value, time: $('aTime').value, duration: Number($('aDur').value || 30) };
    const arr = Storage.read('appt'); arr.push(a); Storage.write('appt', arr); render();
  });
});

/* Resources */
Router.route('/resources', ()=>{
  const arts = Storage.read('arts');
  setMain(`
    <div class="card"><h3>Resources</h3><p class="muted small">Educational articles</p></div>
    <div style="margin-top:12px" id="resourcesArea"></div>
  `);
  const area = document.getElementById('resourcesArea');
  if(!arts.length){ area.innerHTML = '<div class="card"><p class="muted small">No articles.</p></div>'; return; }
  area.innerHTML = arts.map(a => `<div class="card" style="margin-bottom:10px"><h4>${a.title}</h4><div class="muted small">${a.summary||''}</div><div style="margin-top:8px">${a.body||''}</div></div>`).join('');
});

/* Health Info */
Router.route('/education', ()=>{
  setMain(`
    <div class="card"><h3>Health Info</h3><p class="muted small">Useful normal ranges and quick educational tips.</p></div>
    <div style="margin-top:12px" class="grid grid-2">
      <div class="card"><strong>Resting Heart Rate</strong><div class="muted small">60–100 bpm (adults)</div></div>
      <div class="card"><strong>Body Temperature</strong><div class="muted small">36.1–37.2 °C (normal)</div></div>
    </div>
    <div style="margin-top:12px" class="card">
      <h4>Quick tips</h4>
      <ul>
        <li>Sleep: maintain bed/wake consistency and avoid screens before bed.</li>
        <li>Stress: try 4-4-4 breathing (inhale 4s, hold 4s, exhale 4s).</li>
        <li>Activity: short regular walks and hydration help mood and focus.</li>
      </ul>
    </div>
  `);
});

/* Self-Check */
Router.route('/assessment', ()=>{
  if(!requireAuth()) return;
  setMain(`
    <div class="card">
      <h3>Self-Check</h3>
      <p class="muted small">This is educational only; not a diagnosis.</p>
      <form id="quiz">
        <label>1) Feeling low? <select id="q1"><option value="0">No</option><option value="1">Sometimes</option><option value="2">Often</option></select></label>
        <label>2) Sleep quality <select id="q2"><option value="2">Good</option><option value="1">Fair</option><option value="0">Poor</option></select></label>
        <label>3) Concentration <select id="q3"><option value="0">No</option><option value="1">Sometimes</option><option value="2">Often</option></select></label>
        <div class="controls"><button class="btn" type="submit">Get guidance</button></div>
      </form>
    </div>
  `);
  document.getElementById('quiz').addEventListener('submit', (e)=>{
    e.preventDefault();
    const score = Number($('#q1').value) + Number($('#q2').value) + Number($('#q3').value);
    let msg = 'You seem okay. Keep healthy routines.';
    if(score <= 2) msg = 'You may be experiencing low mood or poor sleep. Consider talking to someone or a clinician.';
    openModalWithContent('Guidance', `<p>${msg}</p>`);
  });
});

/* Contacts page */
Router.route('/contacts', ()=>{
  if(!requireAuth()) return;
  const uid = sessionStorage.getItem('reva_user');
  const isAdmin = sessionStorage.getItem('reva_admin') === '1';
  let content = `<div class="card"><h3>Contacts</h3><p class="muted small">Messages submitted via Contact Us. Signed-in users see their messages; Admin can view all.</p></div>`;
  if(isAdmin){
    const users = Storage.readUsers();
    let listHtml = '';
    users.forEach(u => {
      const prev = sessionStorage.getItem('reva_user') || 'guest';
      sessionStorage.setItem('reva_user', u.email);
      const msgs = Storage.read('contacts');
      sessionStorage.setItem('reva_user', prev);
      if(msgs.length){
        listHtml += `<div class="card" style="margin-top:12px"><h4>${u.name} — ${u.email}</h4><div>${msgs.map(m=>`<div style="padding:8px;border-radius:6px;background:#f6faf6;margin-bottom:8px"><strong>${m.name} — ${new Date(m.date).toLocaleString()}</strong><div class="small muted">${m.email}</div><div style="margin-top:6px">${m.msg}</div></div>`).join('')}</div></div>`;
      }
    });
    if(!listHtml) listHtml = '<p class="muted small">No messages from users.</p>';
    content += listHtml;
  } else {
    const msgs = Storage.read('contacts');
    content += '<div style="margin-top:12px" class="card"><h4>Your messages</h4>';
    if(!msgs.length){ content += '<p class="muted small">You have not submitted any messages.</p>'; }
    else { content += msgs.map(m=>`<div style="padding:8px;border-radius:6px;background:#071a12;margin-bottom:8px"><strong>${m.name} — ${new Date(m.date).toLocaleString()}</strong><div class="small muted">${m.email}</div><div style="margin-top:6px">${m.msg}</div></div>`).join(''); }
    content += '</div>';
  }
  setMain(content);
});

/* Admin route */
Router.route('/admin', ()=> {
  const authed = sessionStorage.getItem('reva_admin') === '1';
  if(authed){
    const users = Storage.readUsers();
    setMain(`
      <div class="card"><h3>Admin — Demo Panel</h3><p class="muted small">Inspect per-user local data.</p></div>
      <div style="margin-top:12px" class="card"><h4>Registered users</h4><div id="userList"></div></div>
      <div style="margin-top:12px" id="userData"></div>
      <div style="margin-top:12px" class="controls"><button class="btn" id="logoutAdmin">Logout admin</button></div>
    `);
    const ul = document.getElementById('userList');
    if(!users.length) ul.innerHTML = '<p class="muted small">No registered users</p>';
    else ul.innerHTML = users.map(u => `<div class="list-item"><div><strong>${u.name}</strong><div class="small muted">${u.email}</div></div><div><button class="btn" data-email="${u.email}" data-action="view">View</button></div></div>`).join('');
    ul.querySelectorAll('button[data-action="view"]').forEach(b => b.addEventListener('click', ()=>{
      const email = b.getAttribute('data-email'); const prev = sessionStorage.getItem('reva_user') || 'guest'; sessionStorage.setItem('reva_user', email);
      const raw = { logs: Storage.read('logs'), reminders: Storage.read('rem'), appointments: Storage.read('appt'), articles: Storage.read('arts'), contacts: Storage.read('contacts') };
      sessionStorage.setItem('reva_user', prev);
      document.getElementById('userData').innerHTML = `<div class="card"><pre style="max-height:360px;overflow:auto;background:#f5f8fb;padding:12px;border-radius:8px;color:#071018">${JSON.stringify(raw,null,2)}</pre></div>`;
    }));
    document.getElementById('logoutAdmin').addEventListener('click', ()=> { sessionStorage.removeItem('reva_admin'); Router.render(); });
    return;
  }
  openModal('adminLoginModal');
});

/* ---------- Small helpers ---------- */
function openModalWithContent(title, bodyHtml){
  const modal = $('modal'); if(!modal) return;
  $('modalTitle').innerHTML = title;
  $('modalBody').innerHTML = bodyHtml;
  openModal('modal');
}

/* ---------- Wiring: DOM events ---------- */
document.addEventListener('DOMContentLoaded', ()=> {
  $('year').textContent = new Date().getFullYear();
  refreshCurrentUserUI();

  // global modal close
  document.querySelectorAll('.modal .modal-close').forEach(btn => btn.addEventListener('click', ()=> { const m = btn.closest('.modal'); if(m) closeModal(m.id); }));

  // login/register
  $('btnUser').addEventListener('click', ()=> openModal('loginModal'));
  $('openRegister')?.addEventListener('click', ()=> { closeModal('loginModal'); openModal('registerModal'); });

  $('loginForm').addEventListener('submit', (e)=> {
    e.preventDefault();
    const email = $('loginEmail').value.trim(), pass = $('loginPass').value;
    // check normal users
    const res = loginUser(email,pass);
    if(res.ok){ alert(`Welcome back, ${res.user.name || res.user.email}`); closeModal('loginModal'); refreshCurrentUserUI(); Router.render(); return; }
    // else maybe admin
    if(email === DEMO_ADMIN.email && pass === DEMO_ADMIN.pass){ sessionStorage.setItem('reva_admin','1'); alert('Admin signed in'); closeModal('loginModal'); location.hash='#/admin'; Router.render(); return; }
    alert(res.msg);
  });

  $('registerFormMain').addEventListener('submit', (e)=> {
    e.preventDefault();
    const name = $('regFullName').value.trim(), email = $('regEmailMain').value.trim(), pass = $('regPassMain').value;
    if(!name || !email || !pass){ alert('Complete all fields'); return; }
    const res = registerUser(name,email,pass);
    if(!res.ok){ alert(res.msg); return; }
    alert('Account created — signed in as ' + res.user.name);
    closeModal('registerModal'); refreshCurrentUserUI(); Router.render();
  });

  // admin modal wiring
  $('adminLoginForm').addEventListener('submit', (e)=> {
    e.preventDefault();
    const email = $('adminEmail').value.trim(), pass = $('adminPassword').value;
    if(email === DEMO_ADMIN.email && pass === DEMO_ADMIN.pass){
      sessionStorage.setItem('reva_admin','1');
      closeModal('adminLoginModal');
      location.hash = '#/admin';
      Router.render();
    } else { alert('Invalid admin credentials'); }
  });

  // contact modal handlers
  $('contactFormModal').addEventListener('submit', (e)=> {
    e.preventDefault();
    if(!requireAuth()) return;
    const msg = { id: Storage.uid('c'), name: $('cName').value.trim(), email: $('cEmail').value.trim(), msg: $('cMsg').value.trim(), date: new Date().toISOString() };
    const arr = Storage.read('contacts'); arr.push(msg); Storage.write('contacts', arr);
    alert('Thanks — message saved to your account.');
    closeModal('contactModal');
    Router.render();
  });

  // open contact & faq via sidebar buttons
  $('openContactSide').addEventListener('click', ()=> openModal('contactModal'));
  $('openFaqSide').addEventListener('click', ()=> {
    openModal('faqModal');
    // attach FAQ toggles (ensures listeners present)
    attachFaqListeners();
  });

  // faq modal close already handled by generic close buttons; ensure toggles still attach when modal content exists
  function attachFaqListeners(){
    document.querySelectorAll('.faq-q-modal').forEach(q => {
      q.removeEventListener('click', faqToggleHandler);
      q.addEventListener('click', faqToggleHandler);
    });
  }
  function faqToggleHandler(e){
    const a = e.currentTarget.nextElementSibling;
    if(!a) return;
    a.style.display = (a.style.display === 'block') ? 'none' : 'block';
  }

  // ensure nav closes modals
  document.querySelectorAll('.side-list a').forEach(a => a.addEventListener('click', ()=> { closeModal('modal'); closeModal('loginModal'); closeModal('registerModal'); closeModal('adminLoginModal'); closeModal('contactModal'); closeModal('faqModal'); }));

  // currentUser click toggles login/logout
  $('currentUser').addEventListener('click', ()=> {
    if(sessionStorage.getItem('reva_user') && sessionStorage.getItem('reva_user') !== 'guest'){
      if(confirm('Logout?')){ logoutUser(); refreshCurrentUserUI(); Router.render(); }
    } else { openModal('loginModal'); }
  });

  // social demo placeholders
  $('googleLogin')?.addEventListener('click', ()=> alert('Google sign-in placeholder. Use Register to create a local account.'));
  $('facebookLogin')?.addEventListener('click', ()=> alert('Facebook sign-in placeholder. Use Register to create a local account.'));

  // seed articles
  if(Storage.read('arts').length === 0){
    Storage.write('arts', [
      { id: Storage.uid('art'), title:'Healthy Sleep Tips', summary:'Improve sleep hygiene', body:'<p>Keep a regular sleep schedule, avoid screens 1 hour before bed, and maintain a cool, dark environment.</p>' },
      { id: Storage.uid('art2'), title:'Stress Breaks', summary:'Short practices', body:'<p>Try breathing exercises (4-4-4), short walks, and hydration breaks.</p>' }
    ]);
  }

  // show year & initial render
  $('year').textContent = new Date().getFullYear();
  Router.render();
});
