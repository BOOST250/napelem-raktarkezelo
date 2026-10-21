/* Kezdőlap: a beégetett számok helyett a projektek valós állapota. */

function escDash(szoveg) {
  return String(szoveg ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dashUzenet(szoveg) {
  const doboz = document.getElementById('dashboardMessage');
  if (!doboz) return;
  doboz.hidden = !szoveg;
  doboz.textContent = szoveg || '';
}

function rajzol(projektek) {
  const szam = statusz => projektek.filter(p => p.status === statusz).length;
  document.getElementById('totalProjects').textContent = String(projektek.length);
  document.getElementById('activeProjects').textContent = String(szam('InProgress'));
  document.getElementById('completedProjects').textContent = String(szam('Completed'));
  document.getElementById('failedProjects').textContent = String(szam('Failed'));

  const lista = document.getElementById('statusList');
  lista.innerHTML = STATUSZ_SORREND.map(statusz =>
    '<div class="status-row"><span><span class="status-dot ' + STATUSZ_PONT[statusz] + '"></span>' +
    escDash(STATUSZ_NEV[statusz]) + '</span><strong>' + szam(statusz) + '</strong></div>'
  ).join('');

  const friss = document.getElementById('recentProjects');
  if (projektek.length === 0) {
    friss.innerHTML = '<p class="dashboard-empty">Még nincs projekt. Hozz létre egy újat a felméréshez.</p>';
    return;
  }
  friss.innerHTML = projektek.slice(0, 5).map(p =>
    '<a class="recent-row" href="pages/project.html?id=' + encodeURIComponent(p.id) + '">' +
    '<span><strong>' + escDash(p.customer_name || 'Névtelen') + '</strong>' +
    '<span class="recent-place">' + escDash(p.location) + '</span></span>' +
    '<span class="project-status ' + (STATUSZ_OSZTALY[p.status] || '') + '">' +
    escDash(STATUSZ_NEV[p.status] || p.status) + '</span></a>'
  ).join('');
}

async function betoltKezdolap() {
  dashUzenet('');
  try {
    const projektek = await Api.projektek();
    rajzol(projektek);
  } catch (err) {
    document.getElementById('totalProjects').textContent = '–';
    document.getElementById('activeProjects').textContent = '–';
    document.getElementById('completedProjects').textContent = '–';
    document.getElementById('failedProjects').textContent = '–';
    document.getElementById('statusList').innerHTML =
      '<p class="dashboard-empty">Az állapotok most nem tölthetők be.</p>';
    document.getElementById('recentProjects').innerHTML = '';
    let szoveg = err.message || 'A projektek betöltése nem sikerült.';
    if (!CONFIG.USE_MOCK && err.status === 0) {
      szoveg += ' Backend nélkül a demo mód a cím végére írt ?mock=1 paraméterrel indul.';
    }
    dashUzenet(szoveg);
  }
}

document.addEventListener('szakember-kesz', event => {
  const cim = document.getElementById('welcomeHeading');
  if (cim && event.detail?.username) {
    cim.textContent = 'Üdvözöllek, ' + event.detail.username + '!';
  }
  betoltKezdolap();
});
