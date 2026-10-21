'use strict';

/* ================= Raktárosi felület =================
   C.1  Projektek listája. Kivételezés indításakor a státusz InProgress lesz.
   C.2  A projekthez tartozó alkatrészek és a rekeszük: sor, oszlop, polc, azonosító.
   C.3  A gyalogút a js/route.js-ben számolt legrövidebb körút. */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const szamFormat = new Intl.NumberFormat('hu-HU');
const fmtSzam = n => szamFormat.format(n);
const fmtDb = n => `${fmtSzam(n)} db`;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const RANG = { Scheduled: 0, InProgress: 1, Wait: 2, Draft: 3, New: 4, Completed: 5, Failed: 6 };
const MOD_SZOVEG = {
  sorban: 'ugyanabban a sorban',
  elso: 'az első keresztfolyosón át',
  hatso: 'a hátsó keresztfolyosón át',
};

let projektKereses = '';
let projektSzuro = 'mind';
let projektCache = [];
let aktualisProjektId = null;
let utolsoTerv = null;
let keresszam = 0;

function statusz(s) {
  const [nev, osztaly] = STATUSZ_NEV[s] ?? [String(s), 'new'];
  return `<span class="project-status status-${esc(osztaly)}">${esc(nev)}</span>`;
}

function nevHely(p) {
  return [p.ugyfel, p.helyszin].filter(Boolean).join(' – ') || `#${p.id}`;
}

function fejlec(cim, alcim) {
  $('#page-title').textContent = cim;
  $('#page-sub').textContent = alcim;
}

function muveletek(html) {
  $('#page-actions').innerHTML = html;
}

function stat(cimke, ertek, szin, ikon) {
  return `<div class="stat-card">
    <div class="stat-icon ${szin}" aria-hidden="true">${ikon}</div>
    <div class="stat-info"><span class="stat-title">${esc(cimke)}</span><strong>${esc(ertek)}</strong></div>
  </div>`;
}

function uresAllapot(cim, szoveg, gomb = '') {
  return `<div class="card empty-state"><h2>${esc(cim)}</h2><p class="muted">${esc(szoveg)}</p>${gomb}</div>`;
}

function hibaAllapot(err) {
  return `<div class="card empty-state error-state">
    <h2>Nem sikerült betölteni az adatokat</h2>
    <p>${esc(err.message)}</p>
    ${CONFIG.USE_MOCK ? '' : `<p class="muted small">Az API cím gyökér-relatív (<code>${esc(CONFIG.API_BASE)}</code>).
      Ha a raktárosi végpontok még nincsenek telepítve, a bemutató demo módban megy:
      <a href="?mock=1${esc(location.hash)}">index.html?mock=1</a></p>`}
    <button type="button" class="btn" data-ujra>Újrapróbálás</button>
  </div>`;
}

function tolto() {
  return `<div class="loading"><span class="spinner"></span> Betöltés…</div>`;
}

function toast(uzenet, tipus = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast' + (tipus === 'error' ? ' toast-error' : tipus === 'info' ? ' toast-info' : '');
  el.textContent = uzenet;
  $('#toasts').append(el);
  setTimeout(() => el.classList.add('hide'), 4200);
  setTimeout(() => el.remove(), 4600);
}

function megerosit({ cim, szoveg, gomb = 'Rendben' }) {
  return new Promise(resolve => {
    const dlg = $('#modal');
    dlg.innerHTML = `
      <div class="modal">
        <header class="modal-head">
          <h2>${esc(cim)}</h2>
          <button type="button" class="icon-btn" data-nem aria-label="Bezárás">×</button>
        </header>
        <div class="modal-body"><p>${esc(szoveg)}</p></div>
        <footer class="modal-foot">
          <button type="button" class="btn" data-nem>Mégse</button>
          <button type="button" class="btn primary" data-igen>${esc(gomb)}</button>
        </footer>
      </div>`;
    let valasz = false;
    $$('[data-nem]', dlg).forEach(b => b.addEventListener('click', () => dlg.close()));
    $('[data-igen]', dlg).addEventListener('click', () => { valasz = true; dlg.close(); });
    dlg.addEventListener('close', function egyszer() {
      dlg.removeEventListener('close', egyszer);
      resolve(valasz);
    });
    dlg.showModal();
    $('[data-igen]', dlg).focus();
  });
}

function projektRendez(lista) {
  return [...lista].sort((a, b) =>
    (RANG[a.statusz] ?? 9) - (RANG[b.statusz] ?? 9)
    || String(a.letrehozva).localeCompare(String(b.letrehozva))
    || a.id - b.id);
}

function szurtProjektek() {
  const keres = projektKereses.trim().toLocaleLowerCase('hu');
  return projektRendez(projektCache).filter(p => {
    if (projektSzuro === 'Scheduled' || projektSzuro === 'InProgress') {
      if (p.statusz !== projektSzuro) return false;
    } else if (projektSzuro === 'egyeb' && (p.statusz === 'Scheduled' || p.statusz === 'InProgress')) {
      return false;
    }
    if (!keres) return true;
    return `${p.ugyfel} ${p.helyszin} ${p.leiras} ${p.id}`.toLocaleLowerCase('hu').includes(keres);
  });
}

function foglalasCella(p) {
  if (!p.tetelszam) return '<span class="muted">nincs tétel</span>';
  const kesz = p.lefoglaltTetel === p.tetelszam;
  const osztaly = kesz ? 'text-ok' : 'text-warn';
  return `<span class="${osztaly}">${fmtSzam(p.lefoglaltTetel)} / ${fmtSzam(p.tetelszam)}</span>`;
}

function muveletGomb(p) {
  const nev = esc(p.ugyfel);
  const hely = esc(p.helyszin);
  if (p.statusz === 'Scheduled') {
    return `<button type="button" class="btn primary small" data-indit="${p.id}" data-nev="${nev}" data-hely="${hely}">Kivételezés</button>`;
  }
  if (p.statusz === 'InProgress') {
    return `<a class="btn primary-soft" href="#kivetelezes/${p.id}">Folytatás</a>`;
  }
  return `<a class="btn small" href="#kivetelezes/${p.id}">Részletek</a>`;
}

function projektSor(p) {
  return `<tr>
    <td>
      <div class="cell-main">${esc(nevHely(p))}</div>
      <div class="cell-sub">${esc(p.leiras || 'Nincs leírás')}</div>
    </td>
    <td>${statusz(p.statusz)}</td>
    <td class="num">${fmtSzam(p.tetelszam)}</td>
    <td class="num">${foglalasCella(p)}</td>
    <td>${muveletGomb(p)}</td>
  </tr>`;
}

function projektTablaFrissit() {
  const tb = $('#projekt-sorok');
  if (!tb) return;
  const sorok = szurtProjektek();
  tb.innerHTML = sorok.length
    ? sorok.map(projektSor).join('')
    : '<tr><td class="empty-row" colspan="5">Nincs a szűrésnek megfelelő projekt.</td></tr>';
}

function jelveny(lista) {
  const n = lista.filter(p => p.statusz === 'Scheduled').length;
  const el = $('#badge-projektek');
  el.textContent = String(n);
  el.hidden = n === 0;
}

async function frissitJelveny() {
  try {
    jelveny(await Api.projektek());
  } catch {
    $('#badge-projektek').hidden = true;
  }
}

/* ---------- nézetek ---------- */

function kezdolapMegjelenit(el, lista) {
  jelveny(lista);
  const rendezett = projektRendez(lista);
  const utemezett = rendezett.filter(p => p.statusz === 'Scheduled');
  const folyamatban = rendezett.filter(p => p.statusz === 'InProgress');
  const varakozo = lista.filter(p => p.statusz === 'Wait').length;
  const lezart = lista.filter(p => p.statusz === 'Completed' || p.statusz === 'Failed').length;

  const sor = p => `<a class="quick-action" href="#kivetelezes/${p.id}">
      <span class="quick-action-icon" aria-hidden="true">${p.statusz === 'Scheduled' ? '▣' : '↝'}</span>
      <span><strong>${esc(nevHely(p))}</strong><span>${p.statusz === 'Scheduled' ? 'Ütemezett, kivételezés indítható' : 'Kivételezés folyamatban'}</span></span>
    </a>`;

  el.innerHTML = `
    <div class="welcome-card">
      <div>
        <span class="welcome-label">RAKTÁROSI FELÜLET</span>
        <h2>Üdvözlünk a raktárban!</h2>
        <p>Itt látod a kigyűjtésre váró projekteket. A kivételezés indításakor a projekt állapota
          automatikusan Folyamatban lesz. A lefoglalt alkatrészek rekeszét sor, oszlop és polc
          szerint mutatjuk, a gyalogutat pedig a polcrendszer legrövidebb körútjára fűzzük.</p>
        <a href="#projektek" class="primary-button">Projektek megnyitása</a>
      </div>
      <div class="welcome-icon" aria-hidden="true">▣</div>
    </div>
    <div class="stats-grid">
      ${stat('Kigyűjtésre vár', fmtSzam(utemezett.length), 'orange', '▣')}
      ${stat('Kivételezés alatt', fmtSzam(folyamatban.length), 'blue', '↝')}
      ${stat('Készletre vár', fmtSzam(varakozo), 'red', '⚠')}
      ${stat('Lezárt projekt', fmtSzam(lezart), 'green', '✓')}
    </div>
    <div class="dashboard-grid">
      <div class="content-card">
        <div class="card-header"><h3>Következő kivételezések</h3><p>Ütemezett projektek, a régebbi elöl</p></div>
        <div class="quick-actions">
          ${utemezett.length ? utemezett.slice(0, 4).map(p => `
            <div class="quick-action" style="cursor:default">
              <span class="quick-action-icon" aria-hidden="true">▣</span>
              <span style="flex:1"><strong>${esc(nevHely(p))}</strong><span>${fmtSzam(p.lefoglaltTetel)} lefoglalt tétel</span></span>
              ${muveletGomb(p)}
            </div>`).join('') : '<p class="muted">Nincs kigyűjtésre váró projekt.</p>'}
        </div>
      </div>
      <div class="content-card">
        <div class="card-header"><h3>Folyamatban lévő kigyűjtések</h3><p>Ezeknél a státusz már InProgress</p></div>
        <div class="quick-actions">
          ${folyamatban.length ? folyamatban.slice(0, 4).map(sor).join('') : '<p class="muted">Jelenleg nincs megkezdett kivételezés.</p>'}
        </div>
      </div>
    </div>`;
}

function projektekMegjelenit(el, lista) {
  projektCache = lista;
  jelveny(lista);
  el.innerHTML = `
    <div class="filter-card">
      <div class="filter-field grow">
        <label for="projekt-kereso">Keresés</label>
        <input class="input" id="projekt-kereso" type="search" placeholder="Ügyfél, helyszín, leírás…" value="${esc(projektKereses)}">
      </div>
      <div class="filter-field fixed">
        <label for="projekt-szuro">Állapot</label>
        <select class="input" id="projekt-szuro">
          <option value="mind"${projektSzuro === 'mind' ? ' selected' : ''}>Minden projekt</option>
          <option value="Scheduled"${projektSzuro === 'Scheduled' ? ' selected' : ''}>Kigyűjthető (ütemezett)</option>
          <option value="InProgress"${projektSzuro === 'InProgress' ? ' selected' : ''}>Folyamatban</option>
          <option value="egyeb"${projektSzuro === 'egyeb' ? ' selected' : ''}>Egyéb állapot</option>
        </select>
      </div>
    </div>
    <div class="card">
      <div class="table-header">
        <div><h3>Projektek</h3><span>A kivételezés csak ütemezett projekten indul, és az állapotát Folyamatbanra állítja.</span></div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>Projekt</th><th>Állapot</th><th class="num">Tételek</th><th class="num">Lefoglalva</th><th></th>
          </tr></thead>
          <tbody id="projekt-sorok"></tbody>
        </table>
      </div>
    </div>`;
  projektTablaFrissit();
}

function allapotDoboz(projekt) {
  const szoveg = {
    New: 'Új projekt: a helyszíni felmérés még nem készült el. Kivételezés nem indítható.',
    Draft: 'Tervezet: az alkatrészigény még nincs leadva. Kivételezés nem indítható.',
    Wait: 'A projekt a raktárkészletre vár. Kivételezni csak ütemezett (Scheduled) projekten lehet.',
    Scheduled: 'Ütemezett projekt. A kivételezés indításakor az állapot automatikusan Folyamatban (InProgress) lesz.',
    InProgress: 'A kivételezés folyamatban van. Szedd össze a lefoglalt alkatrészeket az útvonal szerint.',
    Completed: 'A projekt lezárult, a kivételezés már nem indítható.',
    Failed: 'A projekt meghiúsult, a kivételezés már nem indítható.',
  }[projekt.statusz] || '';
  const osztaly = projekt.statusz === 'InProgress' ? 'ok' : (projekt.statusz === 'Scheduled' ? '' : 'warn');
  const gomb = projekt.statusz === 'Scheduled'
    ? `<button type="button" class="btn primary" data-indit="${projekt.id}" data-nev="${esc(projekt.ugyfel)}" data-hely="${esc(projekt.helyszin)}">Kivételezés indítása</button>`
    : '';
  return `<div class="note ${osztaly}">${statusz(projekt.statusz)}<p>${esc(szoveg)}</p>${gomb}</div>`;
}

function rekeszTabla(alkatresz) {
  if (!alkatresz.rekeszek.length) {
    return '<p class="muted">Ehhez az alkatrészhez most egy rekeszben sincs készlet.</p>';
  }
  const sorok = alkatresz.rekeszek.map(r => {
    const rajta = r.kivenni > 0;
    return `<tr class="${rajta ? 'on-route' : 'off-route'}">
      <td><span class="cell-main">${esc(r.azonosito)}</span>${rajta ? '<span class="pick-flag">útvonalon</span>' : ''}</td>
      <td class="num">${fmtSzam(r.sor)}</td>
      <td class="num">${fmtSzam(r.oszlop)}</td>
      <td class="num">${fmtSzam(r.polc)}</td>
      <td class="num">${fmtDb(r.darab)}</td>
      <td class="num">${rajta ? fmtDb(r.kivenni) : '–'}</td>
    </tr>`;
  }).join('');
  const tobbRekesz = alkatresz.rekeszek.some(r => r.kivenni > 0) && alkatresz.rekeszek.some(r => !r.kivenni);
  const megjegyzes = tobbRekesz
    ? '<p class="hint" style="margin-top:10px">A rekesz oszlop az egyedi, olvasható azonosító. A Kivenni oszlop a legrövidebb úthoz választott mennyiség; a többi rekeszben is ott van az alkatrész, de oda nem kell menni.</p>'
    : '<p class="hint" style="margin-top:10px">A rekesz oszlop az egyedi, olvasható azonosító. A sor, az oszlop és a polc együtt határozza meg a helyét.</p>';
  return `<div class="table-wrap"><table class="table">
    <thead><tr>
      <th>Rekesz</th><th class="num">Sor</th><th class="num">Oszlop</th><th class="num">Polc</th>
      <th class="num">Készlet</th><th class="num">Kivenni</th>
    </tr></thead>
    <tbody>${sorok}</tbody>
  </table></div>
  ${megjegyzes}`;
}

function kivetelezesMegjelenit(el, hely) {
  const terv = Utvonal.utvonalTerv(hely);
  utolsoTerv = { hely, terv };
  const p = hely.projekt;
  aktualisProjektId = p.id;
  navCimek(p.id);
  fejlec(nevHely(p), p.leiras || 'Kivételezés');
  muveletek(`<a class="btn primary" href="#utvonal/${p.id}">Útvonal</a>`);

  const hiany = terv.alkatreszek.filter(a => a.hiany > 0);
  const hianySav = hiany.length
    ? `<div class="note warn"><strong>Nincs elég a rekeszekben</strong> ${hiany.map(a => `${esc(a.nev)}: ${fmtDb(a.hiany)} hiányzik`).join('; ')}. Szólj a raktárvezetőnek, ezek a tételek nem férnek rá az útvonalra.</div>`
    : '';

  const kartyak = terv.alkatreszek.map(a => {
    const cimke = a.lefoglalva
      ? `<span class="pick-flag">lefoglalva</span>`
      : `<span class="project-status">nincs lefoglalva</span>`;
    return `<article class="content-card part-card">
      <div class="card-header card-header-row">
        <div>
          <h3>${esc(a.nev)} ${cimke}</h3>
          <p>${a.lefoglalva ? `${fmtDb(a.igenyelt)} kell a projekthez` : `${fmtDb(a.igenyelt)} szerepel az igényben, de nincs lefoglalva, ezért nem kerül az útvonalra`}</p>
        </div>
      </div>
      ${rekeszTabla(a)}
      ${a.hiany ? `<p class="text-danger" style="margin-top:8px">${fmtDb(a.hiany)} hiányzik a lefoglalt mennyiségből.</p>` : ''}
    </article>`;
  }).join('');

  el.innerHTML = `
    ${allapotDoboz(p)}
    ${hianySav}
    ${kartyak || uresAllapot('Nincs alkatrész', 'Ehhez a projekthez még nincs felvéve alkatrészigény.')}`;
}

function megalloKulcs(id) {
  return `raktaros-megallok-${id}`;
}

function keszMegallok(id) {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(megalloKulcs(id)) || '[]'));
  } catch {
    return new Set();
  }
}

function mentMegallok(id, halmaz) {
  try { sessionStorage.setItem(megalloKulcs(id), JSON.stringify([...halmaz])); } catch { /* a böngésző letilthatja */ }
}

function terkep(terv) {
  const sorok = terv.raktar.sorok;
  const oszlopok = terv.raktar.oszlopok;
  const cella = new Map(terv.megallok.map(m => [m.kulcs, m]));
  const fej = `<div></div>${Array.from({ length: oszlopok }, (_, i) => `<div class="wh-head">${i + 1}. oszlop</div>`).join('')}`;
  const test = [];
  for (let sor = 1; sor <= sorok; sor++) {
    test.push(`<div class="wh-label">${sor}. sor</div>`);
    for (let oszlop = 1; oszlop <= oszlopok; oszlop++) {
      const m = cella.get(`${sor}:${oszlop}`);
      if (!m) {
        test.push('<div class="wh-cell"></div>');
      } else {
        const azon = m.tetelek.map(t => `${esc(t.azonosito)} · ${fmtSzam(t.polc)}. polc`).join('<br>');
        test.push(`<div class="wh-cell stop"><span class="wh-no">${m.sorszam}</span><div class="wh-id">${azon}</div></div>`);
      }
    }
  }
  return `<div class="wh-scroll"><div class="wh-cross">Bejárat · első keresztfolyosó</div>
    <div class="wh-grid" style="--cols:${oszlopok}">${fej}${test.join('')}</div>
    <div class="wh-cross">Hátsó keresztfolyosó</div></div>`;
}

function utvonalMegjelenit(el, csomag) {
  const { hely, terv } = csomag;
  utolsoTerv = csomag;
  const p = hely.projekt;
  aktualisProjektId = p.id;
  navCimek(p.id);
  fejlec(`Útvonal · ${nevHely(p)}`, 'Legrövidebb körút a polcsorok között');
  muveletek(`<a class="btn" href="#kivetelezes/${p.id}">Alkatrészek</a>`);

  if (!terv.megallok.length) {
    el.innerHTML = allapotDoboz(p) + uresAllapot(
      'Nincs mit összegyűjteni',
      'A projekthez nincs olyan lefoglalt alkatrész, ami a rekeszekből kivehető.'
    );
    return;
  }

  const kesz = keszMegallok(p.id);
  const mindKesz = terv.megallok.every(m => kesz.has(m.kulcs));
  const megtakaritas = terv.ut.megtakaritas > 0
    ? `<span class="plan-sum ok">${fmtSzam(terv.ut.megtakaritas)} lépéssel rövidebb, mint a sor–oszlop szerinti bejárás (${fmtSzam(terv.ut.naiv)} lépés).</span>`
    : `<span class="plan-sum">A sor–oszlop szerinti sorrend ennél a kigyűjtésnél már a legrövidebb.</span>`;

  const lepesek = terv.ut.szakaszok.map(sz => {
    if (sz.vissza) {
      return `<li class="route-stop back">
        <div class="route-no" aria-hidden="true">↩</div>
        <div>
          <div class="route-title">Vissza a kiadóhoz</div>
          <div class="route-meta">${esc(sz.innen)} után, ${esc(MOD_SZOVEG[sz.mod] || sz.mod)}, ${fmtSzam(sz.tav)} lépés</div>
        </div>
      </li>`;
    }
    const m = sz.megallo;
    const keszen = kesz.has(m.kulcs);
    const tetelek = m.tetelek.map(t =>
      `<li><strong>${esc(t.azonosito)}</strong> · ${fmtSzam(m.sor)}. sor, ${fmtSzam(m.oszlop)}. oszlop, ${fmtSzam(t.polc)}. polc · ${esc(t.nev)} · ${fmtDb(t.kivenni)}</li>`
    ).join('');
    return `<li class="route-stop${keszen ? ' done' : ''}">
      <div class="route-no">${m.sorszam}</div>
      <div>
        <div class="route-title">${esc(sz.ide)}</div>
        <div class="route-meta">${esc(sz.innen)} felől, ${esc(MOD_SZOVEG[sz.mod] || sz.mod)}, ${fmtSzam(sz.tav)} lépés</div>
        <ul class="route-lines">${tetelek}</ul>
      </div>
      <button type="button" class="btn small" data-megall="${esc(m.kulcs)}">${keszen ? 'Visszavonás' : 'Megvan'}</button>
    </li>`;
  }).join('');

  el.innerHTML = `
    ${allapotDoboz(p)}
    <div class="sum-row">
      <span class="plan-sum ok">${fmtSzam(terv.megallok.length)} megálló · ${fmtSzam(terv.ut.osszesen)} lépés a körúton</span>
      ${megtakaritas}
    </div>
    <p class="muted small" style="margin:-6px 0 16px">A körút a bejárattól indul, minden megállót egyszer érint, és a kiadóhoz tér vissza.
      Soron belül oszlopról oszlopra lépünk; másik sorba az első vagy a hátsó keresztfolyosón megyünk, amelyik rövidebb.
      A polc nem külön gyaloglás: egy oszlopnál a rekeszeket szintszám szerint, növekvő sorrendben szedjük.</p>
    ${mindKesz ? '<div class="note ok"><strong>Minden megálló kipipálva.</strong> A projekt Folyamatban marad, amíg a szakember le nem zárja.</div>' : ''}
    <div class="dashboard-grid">
      <div class="content-card">
        <div class="card-header"><h3>Megállók</h3><p>A szám a sorrend. A pipa csak ezen a gépen jegyződik meg.</p></div>
        <ol class="route">${lepesek}</ol>
      </div>
      <div class="content-card">
        <div class="card-header"><h3>Polcrendszer</h3><p>A számok a megállók sorrendje. Az üres cellákba nem kell bemenni.</p></div>
        ${terkep(terv)}
      </div>
    </div>`;
}

function hibaProjekt(el, id) {
  el.innerHTML = uresAllapot('Nincs ilyen projekt', id ? `A(z) ${id} azonosítójú projekt nem nyitható.` : 'Válassz projektet a listából.', '<a class="btn primary" href="#projektek">Projektek</a>');
}

const NEZETEK = {
  kezdolap: {
    cim: 'Kezdőlap',
    alcim: 'Kigyűjtésre váró projektek és a folyamatban lévő kivételezések',
    betolt: () => Api.projektek(),
    megjelenit: kezdolapMegjelenit,
  },
  projektek: {
    cim: 'Projektek',
    alcim: 'Válassz ütemezett projektet a kivételezéshez',
    betolt: () => Api.projektek(),
    megjelenit: projektekMegjelenit,
  },
  kivetelezes: {
    cim: 'Kivételezés',
    alcim: 'Lefoglalt alkatrészek és a rekeszük',
    megjelenit: kivetelezesMegjelenit,
  },
  utvonal: {
    cim: 'Útvonal',
    alcim: 'Legrövidebb körút a polcrendszerben',
    megjelenit: utvonalMegjelenit,
  },
};

function hashBont() {
  const [nev, idNyers] = location.hash.replace(/^#/, '').split('/');
  const id = Number(idNyers);
  const ismert = ['kezdolap', 'projektek', 'kivetelezes', 'utvonal'];
  return {
    nev: ismert.includes(nev) ? nev : 'kezdolap',
    id: Number.isInteger(id) && id > 0 ? id : null,
  };
}

function navCimek(id) {
  if (id) aktualisProjektId = id;
  const told = aktualisProjektId ? `/${aktualisProjektId}` : '';
  const kiv = $('a[data-view="kivetelezes"]');
  const ut = $('a[data-view="utvonal"]');
  if (kiv) kiv.href = `#kivetelezes${told}`;
  if (ut) ut.href = `#utvonal${told}`;
}

function navAktiv(nev) {
  $$('.nav-item[data-view]').forEach(a => a.classList.toggle('active', a.dataset.view === nev));
}

async function router() {
  const my = ++keresszam;
  const { nev, id } = hashBont();
  if (id) aktualisProjektId = id;
  navCimek(id);
  navAktiv(nev);
  const nezet = NEZETEK[nev];
  fejlec(nezet.cim, nezet.alcim);
  muveletek('');
  const el = $('#view');
  el.innerHTML = tolto();
  window.scrollTo(0, 0);

  try {
    if (nev === 'kivetelezes' || nev === 'utvonal') {
      if (!id) {
        if (my !== keresszam) return;
        hibaProjekt(el, null);
        return;
      }
      const hely = await Api.helyek(id);
      if (my !== keresszam) return;
      if (nev === 'utvonal') utvonalMegjelenit(el, { hely, terv: Utvonal.utvonalTerv(hely) });
      else kivetelezesMegjelenit(el, hely);
    } else {
      const adat = await nezet.betolt();
      if (my !== keresszam) return;
      nezet.megjelenit(el, adat);
    }
  } catch (err) {
    if (my !== keresszam) return;
    if (err instanceof ApiError && err.status === 401) return;
    el.innerHTML = hibaAllapot(err);
  }

  if (nev !== 'kezdolap' && nev !== 'projektek') frissitJelveny();
}

async function inditKivetelezes(gomb) {
  const id = Number(gomb.dataset.indit);
  const rendben = await megerosit({
    cim: 'Kivételezés indítása',
    szoveg: `${gomb.dataset.nev} – ${gomb.dataset.hely}. A projekt állapota automatikusan Folyamatban (InProgress) lesz.`,
    gomb: 'Indítás',
  });
  if (!rendben) return;
  gomb.disabled = true;
  try {
    await Api.inditKivetelezes(id);
    toast('A projekt állapota Folyamatban lett.');
    const cel = `#kivetelezes/${id}`;
    if (location.hash === cel) router();
    else location.hash = cel;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) toast(err.message, 'error');
    gomb.disabled = false;
  }
}

function valtMegallo(kulcs) {
  if (!aktualisProjektId || !utolsoTerv) return;
  const kesz = keszMegallok(aktualisProjektId);
  if (kesz.has(kulcs)) kesz.delete(kulcs);
  else kesz.add(kulcs);
  mentMegallok(aktualisProjektId, kesz);
  utvonalMegjelenit($('#view'), utolsoTerv);
}

function felhasznaloMegjelenites(user) {
  const reszek = user.username.split(/[\s._-]+/).filter(Boolean);
  const monogram = (reszek.length > 1 ? reszek[0][0] + reszek[1][0] : user.username.slice(0, 2)).toUpperCase();
  $('#user-avatar').textContent = monogram;
  $('#user-name').textContent = user.username;
  $('#user-role').textContent = SZEREPKOR_NEV[user.role] ?? user.role;
}

function pipakTorlese() {
  if (!aktualisProjektId) return;
  try { sessionStorage.removeItem(megalloKulcs(aktualisProjektId)); } catch { /* ignore */ }
}

async function inditas() {
  let user;
  try {
    user = await Api.me();
  } catch {
    Api.bejelentkezesre();
    return;
  }
  if (user.role !== CONFIG.ENGEDETT_SZEREPKOR) {
    await Api.logout().catch(() => {});
    Api.bejelentkezesre();
    return;
  }
  felhasznaloMegjelenites(user);
  document.body.classList.remove('auth-pending');

  const mod = $('#mode-badge');
  const reset = $('#reset-demo');
  if (CONFIG.USE_MOCK) {
    mod.textContent = 'Demo mód – tesztadatok';
    mod.classList.add('demo');
    reset.hidden = false;
    reset.addEventListener('click', async () => {
      const rendben = await megerosit({
        cim: 'Demo adatok visszaállítása',
        szoveg: 'Visszaállítod a demo adatokat a kezdőállapotra? A bejelentkezés megmarad.',
        gomb: 'Visszaállítás',
      });
      if (!rendben) return;
      MockBackend.reset();
      pipakTorlese();
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('raktaros-megallok-')) sessionStorage.removeItem(k);
      }
      toast('Demo adatok visszaállítva.');
      router();
    });
  } else {
    mod.textContent = `API: ${CONFIG.API_BASE}`;
    mod.title = CONFIG.API_BASE;
  }

  $('#logoutButton').addEventListener('click', async () => {
    const rendben = await megerosit({
      cim: 'Kijelentkezés',
      szoveg: 'Biztosan ki szeretnél jelentkezni?',
      gomb: 'Kijelentkezés',
    });
    if (!rendben) return;
    try {
      await Api.logout();
    } catch (err) {
      toast(`Nem sikerült kijelentkezni: ${err.message}`, 'error');
      return;
    }
    Api.bejelentkezesre('#kijelentkezve');
  });

  $('#modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.close();
  });

  $('#view').addEventListener('click', e => {
    const indit = e.target.closest('[data-indit]');
    if (indit) { inditKivetelezes(indit); return; }
    const megall = e.target.closest('[data-megall]');
    if (megall) { valtMegallo(megall.dataset.megall); return; }
    if (e.target.closest('[data-ujra]')) router();
  });

  $('#view').addEventListener('input', e => {
    if (e.target.id === 'projekt-kereso') {
      projektKereses = e.target.value;
      projektTablaFrissit();
    }
  });
  $('#view').addEventListener('change', e => {
    if (e.target.id === 'projekt-szuro') {
      projektSzuro = e.target.value;
      projektTablaFrissit();
    }
  });

  window.addEventListener('hashchange', () => {
    const dlg = $('#modal');
    if (dlg.open) dlg.close();
    router();
  });

  if (!location.hash) location.hash = 'kezdolap';
  else router();
}

inditas();
