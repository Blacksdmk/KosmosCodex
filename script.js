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

if (raceList) {
  loadJson('data/races.json').then((races) => {
    raceList.replaceChildren(...races.map((race) => {
      const card = document.createElement('article');
      card.className = 'record';
      card.innerHTML = `<p>${race.classification}</p><h3>${race.name}</h3><span>${race.summary}</span>`;
      return card;
    }));
  }).catch(() => { raceList.innerHTML = '<p class="notice">No fue posible cargar el registro de razas.</p>'; });
}

if (reportList) {
  loadJson('data/reports.json').then((reports) => {
    reportList.replaceChildren(...reports.map((report) => {
      const card = document.createElement('article');
      card.className = `record ${report.status === 'locked' ? 'locked' : ''}`;
      card.innerHTML = `<p>${report.category}</p><h3>${report.title}</h3><span>${report.summary}</span><a href="registro.html?id=${encodeURIComponent(report.id)}">Abrir informe</a>`;
      return card;
    }));
  }).catch(() => { reportList.innerHTML = '<p class="notice">No fue posible cargar los documentos.</p>'; });
}

if (reportDetail) {
  const reportId = new URLSearchParams(location.search).get('id');
  loadJson('data/reports.json').then((reports) => {
    const report = reports.find((entry) => entry.id === reportId);
    if (!report) throw new Error('Registro no encontrado.');
    reportDetail.innerHTML = `<a class="back-link" href="biblioteca.html">Volver a Biblioteca</a><p class="eyebrow">${report.category}</p><h1>${report.title}</h1><p class="page-lead">${report.summary}</p><article class="report-body">${report.content.split('\n\n').map((paragraph) => `<p>${paragraph}</p>`).join('')}</article>`;
  }).catch(() => { reportDetail.innerHTML = '<p class="notice">El expediente solicitado no existe o no esta disponible.</p>'; });
}

const base64Encode = (value) => btoa(unescape(encodeURIComponent(value)));

if (adminForm) {
  const message = document.querySelector('#admin-message');
  const entryType = document.querySelector('#entry-type');
  const contentField = document.querySelector('#content-field');
  const statusField = document.querySelector('#status-field');
  const updateFormMode = () => {
    const isRace = entryType.value === 'race';
    contentField.hidden = isRace;
    statusField.hidden = isRace;
    document.querySelector('#content').required = !isRace;
  };
  entryType.addEventListener('change', updateFormMode);
  updateFormMode();
  adminForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = document.querySelector('#token').value.trim();
    const category = document.querySelector('#category').value.trim();
    const title = document.querySelector('#title').value.trim();
    const summary = document.querySelector('#summary').value.trim();
    const content = document.querySelector('#content').value.trim();
    const status = document.querySelector('#status').value;
    const isRace = entryType.value === 'race';
    const id = `${title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`;
    const endpoint = `https://api.github.com/repos/Blacksdmk/KosmosCodex/contents/${isRace ? 'data/races.json' : 'data/reports.json'}`;
    message.textContent = 'Leyendo el Archivo actual...';
    try {
      const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
      const currentResponse = await fetch(endpoint, { headers });
      if (!currentResponse.ok) throw new Error('GitHub rechazo el token o el permiso Contents.');
      const current = await currentResponse.json();
      const entries = JSON.parse(decodeURIComponent(escape(atob(current.content.replace(/\n/g, '')))));
      entries.push(isRace ? { id, name: title, classification: category, summary } : { id, category, title, summary, content, status });
      const updateResponse = await fetch(endpoint, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Add Archive ${isRace ? 'race' : 'report'}: ${title}`, content: base64Encode(JSON.stringify(entries, null, 2) + '\n'), sha: current.sha, branch: 'main' }) });
      if (!updateResponse.ok) throw new Error('GitHub no pudo publicar la entrada.');
      adminForm.reset();
      updateFormMode();
      message.textContent = 'Entrada publicada. GitHub Pages la mostrara al terminar el despliegue.';
    } catch (error) { message.textContent = error.message; }
  });
}
