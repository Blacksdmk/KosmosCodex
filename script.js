const topbar = document.querySelector('.topbar');
const menu = document.querySelector('.menu');
const raceList = document.querySelector('#race-list');

menu?.addEventListener('click', () => {
  topbar.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(topbar.classList.contains('open')));
});

if (raceList) {
  fetch('data/races.json')
    .then((response) => response.json())
    .then((races) => {
      raceList.replaceChildren(...races.map((race) => {
        const card = document.createElement('article');
        card.className = 'record';
        card.innerHTML = `<p>${race.classification}</p><h3>${race.name}</h3><span>${race.summary}</span><a href="#${race.id}">Consultar registro</a>`;
        return card;
      }));
    })
    .catch(() => { raceList.innerHTML = '<p class="notice">No fue posible cargar el registro de razas.</p>'; });
}
