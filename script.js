const firebaseConfig = {
  apiKey: "AIzaSyCiRHmRoJUujwfCQ_v5NwuwQ2lBQ0yrpUQ",
  authDomain: "kosmos-4a934.firebaseapp.com",
  databaseURL: "https://kosmos-4a934-default-rtdb.firebaseio.com",
  projectId: "kosmos-4a934",
  storageBucket: "kosmos-4a934.firebasestorage.app",
  messagingSenderId: "37621654617",
  appId: "1:37621654617:web:6a012273a9ffef47117d48"
};

const topbar = document.querySelector('.topbar');
const menu = document.querySelector('.menu');
const raceList = document.querySelector('#race-list');
const reportList = document.querySelector('#report-list');
const reportDetail = document.querySelector('#report-detail');
const adminForm = document.querySelector('#admin-form');

menu?.addEventListener('click', () => {
  topbar.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(topbar.classList.contains('open')));
});

const loadJson = (path) => fetch(path).then((response) => {
  if (!response.ok) throw new Error('No se pudo cargar el Archivo.');
  return response.json();
});

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[character]));

const renderRaces = (races) => {
  raceList.replaceChildren(...races.map((race) => {
    const card = document.createElement('article');
    card.className = 'record';
    card.innerHTML = `<p>${escapeHtml(race.classification)}</p><h3>${escapeHtml(race.name)}</h3><span>${escapeHtml(race.summary)}</span>`;
    return card;
  }));
};

const renderReports = (reports) => {
  reportList.replaceChildren(...reports.map((report) => {
    const card = document.createElement('article');
    card.className = `record ${report.status === 'locked' ? 'locked' : ''}`;
    card.innerHTML = `<p>${escapeHtml(report.category)}</p><h3>${escapeHtml(report.title)}</h3><span>${escapeHtml(report.summary)}</span><a href="registro.html?id=${encodeURIComponent(report.id)}">Abrir informe</a>`;
    return card;
  }));
};

const fallback = async (path) => {
  try { return await loadJson(path); } catch { return []; }
};

(async () => {
  const [{ initializeApp }, authSdk, dbSdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js')
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = authSdk.getAuth(app);
  const database = dbSdk.getDatabase(app);
  const asArray = (value) => value && typeof value === 'object' ? Object.values(value) : [];

  if (raceList) {
    const local = await fallback('data/races.json');
    renderRaces(local);
    dbSdk.onValue(dbSdk.ref(database, 'codex/races'), (snapshot) => {
      const remote = asArray(snapshot.val());
      if (remote.length) renderRaces(remote);
    });
  }

  if (reportList) {
    const local = await fallback('data/reports.json');
    renderReports(local);
    dbSdk.onValue(dbSdk.ref(database, 'codex/reports'), (snapshot) => {
      const remote = asArray(snapshot.val());
      if (remote.length) renderReports(remote);
    });
  }

  if (reportDetail) {
    const reportId = new URLSearchParams(location.search).get('id');
    const showReport = (reports) => {
      const report = reports.find((entry) => entry.id === reportId);
      if (!report) return false;
      const paragraphs = String(report.content || '').split('\n\n').filter(Boolean)
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
      reportDetail.innerHTML = `<a class="back-link" href="biblioteca.html">Volver a Biblioteca</a><p class="eyebrow">${escapeHtml(report.category)}</p><h1>${escapeHtml(report.title)}</h1><p class="page-lead">${escapeHtml(report.summary)}</p><article class="report-body">${paragraphs}</article>`;
      return true;
    };
    const local = await fallback('data/reports.json');
    showReport(local);
    dbSdk.onValue(dbSdk.ref(database, 'codex/reports'), (snapshot) => {
      const remote = asArray(snapshot.val());
      if (!showReport(remote) && !showReport(local)) reportDetail.innerHTML = '<p class="notice">El expediente solicitado no existe o no esta disponible.</p>';
    });
  }

  if (!adminForm) return;

  const gate = document.querySelector('#auth-gate');
  const editor = document.querySelector('#editor');
  const loginForm = document.querySelector('#login-form');
  const authMessage = document.querySelector('#auth-message');
  const adminMessage = document.querySelector('#admin-message');
  const entryType = document.querySelector('#entry-type');
  const contentField = document.querySelector('#content-field');
  const statusField = document.querySelector('#status-field');
  const content = document.querySelector('#content');
  const updateFormMode = () => {
    const isRace = entryType.value === 'race';
    contentField.hidden = isRace;
    statusField.hidden = isRace;
    content.required = !isRace;
  };
  entryType.addEventListener('change', updateFormMode);
  updateFormMode();

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    authMessage.textContent = 'Verificando acceso...';
    try {
      await authSdk.signInWithEmailAndPassword(auth, document.querySelector('#login-email').value.trim(), document.querySelector('#login-password').value);
    } catch {
      authMessage.textContent = 'No se pudo iniciar sesion. Revisa el correo y la contrasena.';
    }
  });

  document.querySelector('#logout').addEventListener('click', () => authSdk.signOut(auth));

  authSdk.onAuthStateChanged(auth, async (user) => {
    if (!user) {
      gate.hidden = false;
      editor.hidden = true;
      return;
    }
    const permission = await dbSdk.get(dbSdk.ref(database, `admins/${user.uid}`));
    if (permission.val() !== true) {
      authMessage.textContent = 'Esta cuenta no tiene permiso de administracion.';
      await authSdk.signOut(auth);
      return;
    }
    gate.hidden = true;
    editor.hidden = false;
    adminMessage.textContent = `Sesion autorizada: ${user.email}`;
  });

  adminForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    const isRace = entryType.value === 'race';
    const title = document.querySelector('#title').value.trim();
    const id = `${title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`;
    const entry = isRace
      ? { id, name: title, classification: document.querySelector('#category').value.trim(), summary: document.querySelector('#summary').value.trim() }
      : { id, category: document.querySelector('#category').value.trim(), title, summary: document.querySelector('#summary').value.trim(), content: content.value.trim(), status: document.querySelector('#status').value };
    try {
      adminMessage.textContent = 'Publicando entrada...';
      await dbSdk.set(dbSdk.ref(database, `codex/${isRace ? 'races' : 'reports'}/${id}`), entry);
      adminForm.reset();
      updateFormMode();
      adminMessage.textContent = 'Entrada publicada en el Archivo.';
    } catch {
      adminMessage.textContent = 'Firebase rechazo la publicacion. Revisa las reglas.';
    }
  });
})();
