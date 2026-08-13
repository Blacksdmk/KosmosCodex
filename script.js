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
const collectionList = document.querySelector('[data-codex-collection]');
const reportDetail = document.querySelector('#report-detail');
const adminForm = document.querySelector('#admin-form');

menu?.addEventListener('click', () => {
  topbar.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(topbar.classList.contains('open')));
});

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[character]));

const formatText = (value) => escapeHtml(value).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

const asArray = (value) => value && typeof value === 'object' ? Object.values(value) : [];
const emptyMessage = (list, message) => { list.innerHTML = `<p class="notice">${escapeHtml(message)}</p>`; };

const renderCollection = (list, entries, collection) => {
  if (!entries.length) {
    emptyMessage(list, 'Aun no hay registros publicados en este apartado.');
    return;
  }
  list.replaceChildren(...entries.map((entry) => {
    const card = document.createElement('article');
    card.className = `record ${entry.status === 'locked' ? 'locked' : ''}`;
    const category = entry.category || entry.classification || 'REGISTRO';
    const title = entry.title || entry.name || 'Sin titulo';
    const detail = `<a href="registro.html?section=${encodeURIComponent(collection)}&id=${encodeURIComponent(entry.id)}">Abrir registro</a>`;
    card.innerHTML = `<p>${escapeHtml(category)}</p><h3>${escapeHtml(title)}</h3><span>${escapeHtml(entry.summary)}</span>${detail}`;
    return card;
  }));
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

  if (collectionList) {
    const collection = collectionList.dataset.codexCollection;
    emptyMessage(collectionList, 'Consultando registros...');
    dbSdk.onValue(dbSdk.ref(database, `codex/${collection}`), (snapshot) => {
      renderCollection(collectionList, asArray(snapshot.val()), collection);
    }, () => emptyMessage(collectionList, 'No fue posible consultar este apartado.'));
  }

  if (reportDetail) {
    const params = new URLSearchParams(location.search);
    const collection = params.get('section') || 'reports';
    const entryId = params.get('id');
    const sectionNames = { reports: 'Biblioteca', races: 'Razas', places: 'Lugares', factions: 'Facciones', magic: 'Magia', bestiary: 'Bestiario' };
    if (!sectionNames[collection]) {
      reportDetail.innerHTML = '<p class="notice">El apartado solicitado no existe.</p>';
      return;
    }
    dbSdk.onValue(dbSdk.ref(database, `codex/${collection}`), (snapshot) => {
      const report = asArray(snapshot.val()).find((entry) => entry.id === entryId);
      if (!report) {
        reportDetail.innerHTML = '<p class="notice">El expediente solicitado no existe o aun no esta publicado.</p>';
        return;
      }
      const paragraphs = String(report.content || '').split('\n\n').filter(Boolean)
        .map((paragraph) => `<p>${formatText(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
      const returnPages = { reports: 'biblioteca.html', races: 'razas.html', places: 'lugares.html', factions: 'facciones.html', magic: 'magia.html', bestiary: 'bestiario.html' };
      reportDetail.innerHTML = `<a class="back-link" href="${returnPages[collection]}">Volver a ${sectionNames[collection]}</a><p class="eyebrow">${escapeHtml(report.category)}</p><h1>${escapeHtml(report.title)}</h1><p class="page-lead">${escapeHtml(report.summary)}</p><article class="report-body">${paragraphs || '<p>Este registro aun no contiene una descripcion extensa.</p>'}</article>`;
    });
  }

  if (!adminForm) return;
  const gate = document.querySelector('#auth-gate');
  const editor = document.querySelector('#editor');
  const loginForm = document.querySelector('#login-form');
  const authMessage = document.querySelector('#auth-message');
  const adminMessage = document.querySelector('#admin-message');
  const entryType = document.querySelector('#entry-type');
  const existingEntry = document.querySelector('#existing-entry');
  const loadEntry = document.querySelector('#load-entry');
  const saveEntry = document.querySelector('#save-entry');
  const contentField = document.querySelector('#content-field');
  const statusField = document.querySelector('#status-field');
  const content = document.querySelector('#content');
  let entriesById = {};
  let selectedEntryId = '';
  const updateFormMode = () => {
    contentField.hidden = false;
    statusField.hidden = entryType.value !== 'reports';
    content.required = true;
  };
  entryType.addEventListener('change', updateFormMode);
  updateFormMode();

  const resetEditor = () => {
    selectedEntryId = '';
    adminForm.reset();
    existingEntry.replaceChildren(new Option('Nueva entrada', ''));
    saveEntry.textContent = 'Publicar entrada';
    updateFormMode();
  };

  const loadEntriesForEditor = async () => {
    const collection = entryType.value;
    const snapshot = await dbSdk.get(dbSdk.ref(database, `codex/${collection}`));
    entriesById = snapshot.val() || {};
    existingEntry.replaceChildren(new Option('Nueva entrada', ''));
    Object.values(entriesById)
      .sort((a, b) => String(a.title || a.name).localeCompare(String(b.title || b.name), 'es'))
      .forEach((entry) => existingEntry.add(new Option(entry.title || entry.name || entry.id, entry.id)));
  };

  entryType.addEventListener('change', async () => {
    const collection = entryType.value;
    selectedEntryId = '';
    adminForm.reset();
    entryType.value = collection;
    saveEntry.textContent = 'Publicar entrada';
    updateFormMode();
    if (auth.currentUser) await loadEntriesForEditor();
  });

  loadEntry.addEventListener('click', () => {
    const entry = entriesById[existingEntry.value];
    if (!entry) {
      selectedEntryId = '';
      saveEntry.textContent = 'Publicar entrada';
      return;
    }
    selectedEntryId = entry.id;
    document.querySelector('#category').value = entry.category || entry.classification || '';
    document.querySelector('#title').value = entry.title || entry.name || '';
    document.querySelector('#summary').value = entry.summary || '';
    content.value = entry.content || '';
    document.querySelector('#status').value = entry.status || 'public';
    saveEntry.textContent = 'Guardar cambios';
    adminMessage.textContent = `Editando: ${entry.title || entry.name}`;
  });

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
    await loadEntriesForEditor();
  });

  adminForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!auth.currentUser) return;
    const collection = entryType.value;
    const title = document.querySelector('#title').value.trim();
    const id = selectedEntryId || `${title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`;
    const entry = {
      id,
      title,
      name: title,
      category: document.querySelector('#category').value.trim(),
      classification: document.querySelector('#category').value.trim(),
      summary: document.querySelector('#summary').value.trim(),
      status: document.querySelector('#status').value
    };
    entry.content = content.value.trim();
    try {
      const updating = Boolean(selectedEntryId);
      adminMessage.textContent = updating ? 'Guardando cambios...' : 'Publicando entrada...';
      await dbSdk.set(dbSdk.ref(database, `codex/${collection}/${id}`), entry);
      await loadEntriesForEditor();
      existingEntry.value = id;
      selectedEntryId = id;
      saveEntry.textContent = 'Guardar cambios';
      adminMessage.textContent = updating ? 'Cambios guardados en el Archivo.' : 'Entrada publicada en el Archivo.';
    } catch {
      adminMessage.textContent = 'Firebase rechazo la publicacion. Revisa las reglas.';
    }
  });
})();
