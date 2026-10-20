'use strict';

/* ================= Segédfüggvények ================= */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const szamFormat = new Intl.NumberFormat('hu-HU');
const fmtSzam = n => szamFormat.format(n);
const fmtFt = n => `${fmtSzam(n)} Ft`;
const fmtDb = n => `${fmtSzam(n)} db`;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const huRendez = (a, b) => a.localeCompare(b, 'hu');
const helyRendez = (a, b) => a.sor - b.sor || a.oszlop - b.oszlop || a.polc - b.polc || a.rekesz - b.rekesz;
const helyKod = r => `S${r.sor} · O${r.oszlop} · P${r.polc} · R${r.rekesz}`;
const uresRekesz = r => r.alkatresz_id === null || r.darab === 0;
// Egy rekeszbe ennyi db férhet ebből az alkatrészből. Két korlát van, és a
// szigorúbb érvényes: az alkatrész max. darab/rekesz értéke és a rekesz saját
// kapacitása. (Demo módban nincs rekesz-kapacitás, ott max_kapacitas = Infinity.)
const korlat = (r, a) => Math.min(a.max_darab, r.max_kapacitas ?? Infinity);
const osszeg = (lista, fn) => lista.reduce((s, x) => s + fn(x), 0);

function csoportosit(lista, kulcs) {
  const csoportok = new Map();
  for (const x of lista) {
    const k = kulcs(x);
    if (!csoportok.has(k)) csoportok.set(k, []);
    csoportok.get(k).push(x);
  }
  return [...csoportok.values()];
}

// Projektstátuszok magyar címkéje és színe (a szakemberi felülettel egyezően)
const STATUSZ_NEV = {
  New: ['Új', 'new'],
  Draft: ['Tervezet', 'draft'],
  Wait: ['Várakozik', 'wait'],
  Scheduled: ['Ütemezett', 'scheduled'],
  InProgress: ['Folyamatban', 'progress'],
  Completed: ['Befejezett', 'completed'],
  Failed: ['Sikertelen', 'failed'],
};
const statuszAdat = s => STATUSZ_NEV[s] ?? [String(s), String(s).toLowerCase()];

function statusz(s) {
  const [nev, osztaly] = statuszAdat(s);
  return `<span class="project-status status-${esc(osztaly)}">${esc(nev)}</span>`;
}

function csik(ertek, max) {
  const pct = max > 0 ? Math.min(100, Math.round((ertek / max) * 100)) : 0;
  return `<div class="bar${pct >= 100 ? ' full' : ''}" title="${pct}%"><span style="width:${pct}%"></span></div>`;
}

// szin: blue | orange | green | red
function stat(cimke, ertek, szin = 'blue', ikon = '▤') {
  return `<div class="stat-card">
    <div class="stat-icon ${szin}" aria-hidden="true">${ikon}</div>
    <div class="stat-info"><span class="stat-title">${esc(cimke)}</span><strong>${esc(ertek)}</strong></div>
  </div>`;
}

// Kártya fejléc (cím + alcím); az alcím span-je azonosítót kaphat, ha később töltjük ki
function tablaFejlec(cim, alcim, { jobb = '', alcimId = '' } = {}) {
  return `<div class="table-header">
    <div><h3>${esc(cim)}</h3><span${alcimId ? ` id="${alcimId}"` : ''}>${esc(alcim)}</span></div>
    ${jobb}
  </div>`;
}

function kartyaFejlec(cim, alcim, jobb = '') {
  return `<div class="card-header${jobb ? ' card-header-row' : ''}">
    <div><h3>${esc(cim)}</h3>${alcim ? `<p>${esc(alcim)}</p>` : ''}</div>
    ${jobb}
  </div>`;
}

function uresAllapot(cim, szoveg) {
  return `<div class="card empty-state"><h2>${esc(cim)}</h2><p class="muted">${esc(szoveg)}</p></div>`;
}

function hibaAllapot(err) {
  return `<div class="card empty-state error-state">
    <h2>Nem sikerült betölteni az adatokat</h2>
    <p>${esc(err.message)}</p>
    ${CONFIG.USE_MOCK ? '' : `<p class="muted small">Ellenőrizd a <code>js/config.js</code> fájlban az <code>API_BASE</code> címet,
      vagy próbáld ki demo módban: <a href="?mock=1${location.hash}">index.html?mock=1</a></p>`}
    <button type="button" class="btn" data-ujra>Újrapróbálás</button>
  </div>`;
}

function toast(uzenet, tipus = 'ok') {
  const el = document.createElement('div');
  el.className = `toast toast-${tipus}`;
  el.textContent = uzenet;
  $('#toasts').append(el);
  setTimeout(() => el.classList.add('hide'), 4200);
  setTimeout(() => el.remove(), 4600);
}

function muveletek(html) {
  $('#page-actions').innerHTML = html;
}

// Űrlapmező beolvasása egész számként; hibás érték esetén a modal kiírja az üzenetet.
function egeszSzam(form, mezo, cimke, min) {
  const input = form.elements[mezo];
  const nyers = input.value.trim();
  const n = Number(nyers);
  if (nyers === '' || !Number.isInteger(n) || n < min) {
    input.focus();
    throw new Error(`${cimke}: legalább ${fmtSzam(min)} értékű egész számot adj meg.`);
  }
  return n;
}

function modal({ cim, tartalom, gomb = 'Mentés', kuldes }) {
  const dlg = $('#modal');
  dlg.innerHTML = `
    <form class="modal" novalidate>
      <header class="modal-head">
        <h2>${esc(cim)}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Bezárás">×</button>
      </header>
      <div class="modal-body">
        ${tartalom}
        <div class="form-error" hidden></div>
      </div>
      <footer class="modal-foot">
        <button type="button" class="btn" data-close>Mégse</button>
        <button type="submit" class="btn primary">${esc(gomb)}</button>
      </footer>
    </form>`;

  const form = $('form', dlg);
  const hibaEl = $('.form-error', form);
  $$('[data-close]', dlg).forEach(b => b.addEventListener('click', () => dlg.close()));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    hibaEl.hidden = true;
    const btn = $('[type=submit]', form);
    btn.disabled = true;
    try {
      await kuldes(form);
      dlg.close();
    } catch (err) {
      hibaEl.textContent = err.message;
      hibaEl.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  dlg.showModal();
  $('input:not([readonly]), select', form)?.focus();
}

/* Megerősítő kérdés. Promise-t ad vissza: true, ha a felhasználó jóváhagyta.
   Szándékosan NEM a beépített confirm(), mert azt a beágyazott böngészők
   (pl. a Claude előnézeti panelje) azonnal elutasítják: ott a confirm()
   mindig false-t ad, és a művelet látszólag „nem csinál semmit”.
   A meglévő #modal dialógust és CSS-osztályokat használja újra. */
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

    // A háttérre kattintás és a hashchange is zárja a dialógust → „mégse”.
    dlg.addEventListener('close', function egyszer() {
      dlg.removeEventListener('close', egyszer);
      resolve(valasz);
    });

    dlg.showModal();
    $('[data-igen]', dlg).focus();
  });
}

/* ================= Nézetek ================= */

let alkatreszKereses = '';
let bevetelezesElotoltes = null;      // Hiányzó → „Bevételezés →” gomb tölti ki
let lefoglaltCsoportositas = 'projekt';

const NEZETEK = {
  kezdolap: {
    cim: 'Kezdőlap',
    alcim: 'A raktár készletének és a projektek alkatrész-ellátottságának áttekintése',
    betolt: async () => {
      const [alkatreszek, rekeszek, hianyzo, lefoglalt] = await Promise.all([
        Api.alkatreszek(), Api.rekeszek(), Api.hianyzoAlkatreszek(), Api.lefoglaltAlkatreszek(),
      ]);
      return { alkatreszek, rekeszek, hianyzo, lefoglalt };
    },
    megjelenit: kezdolapNezet,
  },
  alkatreszek: {
    cim: 'Alkatrészek',
    alcim: 'Új alkatrész felvétele, árak és rekeszenkénti maximális kapacitás módosítása',
    betolt: async () => {
      const [alkatreszek, rekeszek] = await Promise.all([Api.alkatreszek(), Api.rekeszek()]);
      return { alkatreszek, rekeszek };
    },
    megjelenit: alkatreszekNezet,
  },
  bevetelezes: {
    cim: 'Bevételezés',
    alcim: 'Beérkezett alkatrészek elhelyezése a rekeszekben',
    betolt: async () => {
      const [alkatreszek, rekeszek] = await Promise.all([Api.alkatreszek(), Api.rekeszek()]);
      return { alkatreszek, rekeszek };
    },
    megjelenit: bevetelezesNezet,
  },
  rekeszek: {
    cim: 'Rekeszek',
    alcim: 'A raktár rekeszei és telítettségük',
    betolt: async () => {
      const [rekeszek, alkatreszek] = await Promise.all([Api.rekeszek(), Api.alkatreszek()]);
      return { rekeszek, alkatreszek };
    },
    megjelenit: rekeszekNezet,
  },
  hianyzo: {
    cim: 'Hiányzó alkatrészek',
    alcim: 'Projektekhez igényelt, de készlet hiányában le nem foglalt alkatrészek',
    betolt: async () => {
      const [hianyzo, alkatreszek] = await Promise.all([Api.hianyzoAlkatreszek(), Api.alkatreszek()]);
      return { hianyzo, alkatreszek };
    },
    megjelenit: hianyzoNezet,
  },
  lefoglalt: {
    cim: 'Lefoglalt alkatrészek',
    alcim: 'Projektekhez lefoglalt készlet',
    betolt: async () => {
      const [lefoglalt, alkatreszek] = await Promise.all([Api.lefoglaltAlkatreszek(), Api.alkatreszek()]);
      return { lefoglalt, alkatreszek };
    },
    megjelenit: lefoglaltNezet,
  },
};

/* ---------- 0. Kezdőlap ---------- */

function kezdolapNezet(el, { alkatreszek, rekeszek, hianyzo, lefoglalt }) {
  const alk = new Map(alkatreszek.map(a => [a.id, a]));
  const szabadRekesz = rekeszek.filter(uresRekesz).length;
  const keszletErtek = osszeg(alkatreszek, a => a.keszlet * a.ar);

  // Projektek állapota a hiányzó és a lefoglalt tételek alapján (projektenként egyszer számolva)
  const projektek = new Map();
  for (const h of hianyzo) for (const p of h.projektek) projektek.set(p.id, p.statusz);
  for (const f of lefoglalt) projektek.set(f.projekt_id, f.statusz);
  const statuszDb = {};
  for (const s of projektek.values()) statuszDb[s] = (statuszDb[s] ?? 0) + 1;

  const surgos = [...hianyzo].sort((x, y) => y.hianyzo_darab - x.hianyzo_darab).slice(0, 5);

  el.innerHTML = `
    <div class="welcome-card">
      <div>
        <span class="welcome-label">RAKTÁRVEZETŐI FELÜLET</span>
        <h2>Üdvözlünk a raktárban!</h2>
        <p>Itt veheted fel az új alkatrészeket, módosíthatod az árakat, rögzítheted a beérkezett szállítmányokat,
          és áttekintheted a projektekhez hiányzó, illetve lefoglalt alkatrészeket.</p>
        <a href="#bevetelezes" class="primary-button">+ Új bevételezés</a>
      </div>
      <div class="welcome-icon" aria-hidden="true">▦</div>
    </div>

    <div class="stats-grid">
      ${stat('Alkatrésztípusok', fmtSzam(alkatreszek.length), 'blue', '▤')}
      ${stat('Szabad rekeszek', `${fmtSzam(szabadRekesz)} / ${fmtSzam(rekeszek.length)}`, 'green', '▦')}
      ${stat('Hiányzó tételek', fmtSzam(hianyzo.length), 'red', '⚠')}
      ${stat('Lefoglalt darab', fmtDb(osszeg(lefoglalt, f => f.darab)), 'orange', '⚑')}
    </div>

    <div class="dashboard-grid">
      <div class="content-card">
        ${kartyaFejlec('Gyors műveletek', 'A leggyakrabban használt raktári funkciók')}
        <div class="quick-actions">
          <button type="button" class="quick-action" data-gyors="alkatresz">
            <div class="quick-action-icon">+</div>
            <div><strong>Új alkatrész felvétele</strong><span>Név, egységár és rekeszenkénti maximum megadása</span></div>
          </button>
          <a href="#bevetelezes" class="quick-action">
            <div class="quick-action-icon">⇩</div>
            <div><strong>Bevételezés</strong><span>Beérkezett alkatrészek elhelyezése a rekeszekben</span></div>
          </a>
          <button type="button" class="quick-action" data-gyors="rekesz">
            <div class="quick-action-icon">▦</div>
            <div><strong>Új rekesz</strong><span>Új tárolóhely felvétele a raktárban</span></div>
          </button>
          <a href="#hianyzo" class="quick-action">
            <div class="quick-action-icon">⚠</div>
            <div><strong>Hiányzó alkatrészek</strong><span>Mit kell beszerezni a projektekhez?</span></div>
          </a>
        </div>
      </div>

      <div class="content-card">
        ${kartyaFejlec('Projektek állapota', 'Alkatrészt igénylő projektek státusz szerint')}
        <div class="status-list">
          ${Object.keys(STATUSZ_NEV).filter(s => statuszDb[s]).map(s => {
            const [nev, osztaly] = statuszAdat(s);
            return `<div class="status-row"><span><i class="status-dot ${osztaly}"></i>${esc(nev)}</span><strong>${statuszDb[s]}</strong></div>`;
          }).join('') || '<p class="muted">Jelenleg nincs alkatrészt igénylő projekt.</p>'}
          <hr class="status-sep">
          <div class="status-row"><span>Raktárkészlet értéke</span><strong>${fmtFt(keszletErtek)}</strong></div>
        </div>
      </div>
    </div>

    <div class="card">
      ${tablaFejlec('Sürgős hiányok', 'A legnagyobb mennyiségben hiányzó alkatrészek',
        { jobb: '<a href="#hianyzo" class="row-action">Összes megtekintése</a>' })}
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Alkatrész</th><th class="num">Hiányzik</th><th class="num">Szabad készlet</th><th>Érintett projektek</th><th></th></tr></thead>
          <tbody id="surgos-sorok">${surgos.length ? surgos.map(h => {
            const a = alk.get(h.alkatresz_id);
            return `<tr>
              <td class="strong">${esc(h.nev)}</td>
              <td class="num strong text-danger">${fmtDb(h.hianyzo_darab)}</td>
              <td class="num">${a ? fmtDb(Math.max(0, a.keszlet - a.lefoglalt)) : '–'}</td>
              <td>${h.projektek.map(p => statusz(p.statusz)).join(' ') || '–'} <span class="muted small">${h.projektek.length} projekt</span></td>
              <td class="num"><button type="button" class="row-action" data-bevetelez="${h.alkatresz_id}" data-darab="${h.hianyzo_darab}">Bevételezés →</button></td>
            </tr>`;
          }).join('') : '<tr><td colspan="5" class="empty-row">Nincs hiányzó alkatrész – minden igény le van foglalva.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;

  $('[data-gyors="alkatresz"]', el).addEventListener('click', () => ujAlkatreszModal(alkatreszek));
  $('[data-gyors="rekesz"]', el).addEventListener('click', () => ujRekeszModal(rekeszek));
  $('#surgos-sorok').addEventListener('click', bevetelezesGomb);
}

// „Bevételezés →” gomb: előtölti a bevételezés űrlapot a hiányzó mennyiséggel
function bevetelezesGomb(e) {
  const gomb = e.target.closest('[data-bevetelez]');
  if (!gomb) return;
  bevetelezesElotoltes = { alkatresz_id: Number(gomb.dataset.bevetelez), darab: Number(gomb.dataset.darab) };
  location.hash = 'bevetelezes';
}

/* ---------- 1. Alkatrészek ---------- */

function alkatreszekNezet(el, { alkatreszek, rekeszek }) {
  muveletek('<button type="button" class="btn primary" id="uj-alkatresz">+ Új alkatrész</button>');
  $('#uj-alkatresz').addEventListener('click', () => ujAlkatreszModal(alkatreszek));

  if (!alkatreszek.length) {
    el.innerHTML = uresAllapot('Még nincs alkatrész', 'Vegyél fel egy új alkatrészt a jobb felső gombbal.');
    return;
  }

  const rekeszSzam = id => rekeszek.filter(r => r.alkatresz_id === id && r.darab > 0).length;

  const keszletErtek = osszeg(alkatreszek, a => a.keszlet * a.ar);
  const elfogyott = alkatreszek.filter(a => a.keszlet - a.lefoglalt <= 0).length;

  el.innerHTML = `
    <div class="stats-grid">
      ${stat('Alkatrésztípusok', fmtSzam(alkatreszek.length), 'blue', '▤')}
      ${stat('Készlet összesen', fmtDb(osszeg(alkatreszek, a => a.keszlet)), 'green', '▦')}
      ${stat('Készlet értéke', fmtFt(keszletErtek), 'orange', 'Ft')}
      ${stat('Nincs szabad készlet', fmtSzam(elfogyott), 'red', '⚠')}
    </div>
    <div class="filter-card">
      <div class="filter-field grow">
        <label for="kereses">Keresés</label>
        <input type="search" id="kereses" class="input" placeholder="Alkatrész neve…" autocomplete="off">
      </div>
      <span class="filter-note">Az ár és a rekeszenkénti maximum a „Módosítás” gombbal változtatható.</span>
    </div>
    <div class="card">
      ${tablaFejlec('Alkatrészlista', '', { alcimId: 'talalatok' })}
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>Megnevezés</th>
            <th class="num">Egységár</th>
            <th class="num">Max. db / rekesz</th>
            <th class="num">Készlet</th>
            <th class="num">Lefoglalt</th>
            <th class="num">Szabad</th>
            <th class="num">Rekeszek</th>
            <th></th>
          </tr></thead>
          <tbody id="alkatresz-sorok"></tbody>
        </table>
      </div>
    </div>`;

  const kereso = $('#kereses');
  const tbody = $('#alkatresz-sorok');
  kereso.value = alkatreszKereses;

  const rajzol = () => {
    const q = kereso.value.trim().toLowerCase();
    const lista = alkatreszek.filter(a => a.nev.toLowerCase().includes(q));
    $('#talalatok').textContent = `${lista.length} / ${alkatreszek.length} alkatrész megjelenítve`;
    tbody.innerHTML = lista.length ? lista.map(a => {
      const szabad = a.keszlet - a.lefoglalt;
      return `<tr>
        <td class="strong">${esc(a.nev)}</td>
        <td class="num">${fmtFt(a.ar)}</td>
        <td class="num">${fmtDb(a.max_darab)}</td>
        <td class="num">${fmtDb(a.keszlet)}</td>
        <td class="num">${fmtDb(a.lefoglalt)}</td>
        <td class="num strong ${szabad > 0 ? 'text-ok' : 'text-warn'}">${fmtDb(szabad)}</td>
        <td class="num">${rekeszSzam(a.id)}</td>
        <td class="num"><button type="button" class="row-action" data-modosit="${a.id}">Módosítás</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="8" class="empty-row">Nincs a keresésnek megfelelő alkatrész.</td></tr>';
  };

  kereso.addEventListener('input', () => {
    alkatreszKereses = kereso.value;
    rajzol();
  });
  tbody.addEventListener('click', e => {
    const gomb = e.target.closest('[data-modosit]');
    if (gomb) modositasModal(alkatreszek.find(a => a.id === Number(gomb.dataset.modosit)), rekeszek);
  });
  rajzol();
}

function ujAlkatreszModal(alkatreszek) {
  modal({
    cim: 'Új alkatrész felvétele',
    gomb: 'Alkatrész felvétele',
    tartalom: `
      <label class="field"><span>Megnevezés</span>
        <input name="nev" class="input" maxlength="100" autocomplete="off" required>
      </label>
      <div class="field-row">
        <label class="field"><span>Egységár (Ft)</span>
          <input name="ar" type="number" min="0" step="1" class="input" required>
        </label>
        <label class="field"><span>Max. darab / rekesz</span>
          <input name="max_darab" type="number" min="1" step="1" class="input" required>
        </label>
      </div>
      <p class="hint">A max. darab azt adja meg, hogy egy rekeszbe legfeljebb hány darab fér el ebből az alkatrészből.</p>`,
    kuldes: async form => {
      const nev = form.elements.nev.value.trim();
      if (!nev) {
        form.elements.nev.focus();
        throw new Error('Add meg az alkatrész nevét.');
      }
      if (alkatreszek.some(a => a.nev.toLowerCase() === nev.toLowerCase())) {
        throw new Error('Már létezik ilyen nevű alkatrész.');
      }
      const ar = egeszSzam(form, 'ar', 'Egységár', 0);
      const max_darab = egeszSzam(form, 'max_darab', 'Max. darab / rekesz', 1);
      await Api.ujAlkatresz({ nev, ar, max_darab });
      toast(`„${nev}” felvéve.`);
      frissit();
    },
  });
}

function modositasModal(a, rekeszek) {
  const legtobb = rekeszek.filter(r => r.alkatresz_id === a.id).reduce((m, r) => Math.max(m, r.darab), 0);
  modal({
    cim: 'Alkatrész módosítása',
    gomb: 'Módosítások mentése',
    tartalom: `
      <p class="modal-subject">${esc(a.nev)}</p>
      <div class="field-row">
        <label class="field"><span>Egységár (Ft)</span>
          <input name="ar" type="number" min="0" step="1" class="input" value="${a.ar}" required>
        </label>
        <label class="field"><span>Max. darab / rekesz</span>
          <input name="max_darab" type="number" min="${Math.max(1, legtobb)}" step="1" class="input" value="${a.max_darab}" required>
        </label>
      </div>
      <p class="hint">Jelenlegi ár: <b>${fmtFt(a.ar)}</b>.
        ${legtobb > 0
          ? `A legtelibb rekeszben <b>${fmtDb(legtobb)}</b> van ebből, a maximum ennél nem lehet kisebb.`
          : 'Jelenleg egyik rekeszben sincs ebből az alkatrészből.'}</p>`,
    kuldes: async form => {
      const ar = egeszSzam(form, 'ar', 'Egységár', 0);
      const max_darab = egeszSzam(form, 'max_darab', 'Max. darab / rekesz', 1);
      if (max_darab < legtobb) {
        throw new Error(`A max. darab legalább ${legtobb} legyen, mert egy rekeszben már ennyi van ebből.`);
      }
      if (ar === a.ar && max_darab === a.max_darab) return;   // nincs változás

      await Api.modositAlkatresz(a.id, { ar, max_darab });
      const valtozasok = [];
      if (ar !== a.ar) valtozasok.push(`ár: ${fmtFt(a.ar)} → ${fmtFt(ar)}`);
      if (max_darab !== a.max_darab) valtozasok.push(`max. / rekesz: ${a.max_darab} → ${max_darab} db`);
      toast(`${a.nev} – ${valtozasok.join(', ')}`);
      frissit();
    },
  });
}

/* ---------- 2. Bevételezés ---------- */

function bevetelezesNezet(el, { alkatreszek, rekeszek }) {
  if (!alkatreszek.length) {
    el.innerHTML = uresAllapot('Nincs alkatrész', 'Bevételezés előtt vegyél fel alkatrészt az Alkatrészek menüben.');
    return;
  }

  const elotoltes = bevetelezesElotoltes;
  bevetelezesElotoltes = null;
  let terv = [];   // [{ rekesz_id, darab }] – melyik rekeszbe mennyi kerül

  el.innerHTML = `
    <div class="content-card">
      ${kartyaFejlec('1. Beérkezett tétel', 'Melyik alkatrészből mennyi érkezett?')}
      <div class="field-row wide-first">
        <label class="field"><span>Alkatrész</span>
          <select id="bev-alkatresz" class="input">
            <option value="">– Válassz alkatrészt –</option>
            ${[...alkatreszek].sort((a, b) => huRendez(a.nev, b.nev))
              .map(a => `<option value="${a.id}">${esc(a.nev)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Beérkezett mennyiség (db)</span>
          <input id="bev-darab" type="number" min="1" step="1" class="input" placeholder="pl. 20">
        </label>
      </div>
      <div id="bev-info" class="chips" hidden></div>
    </div>
    <div class="content-card">
      ${kartyaFejlec('2. Elhelyezés a rekeszekben', 'A rekeszek maximális kapacitása nem léphető túl',
        '<button type="button" class="btn small" id="bev-auto" disabled>Automatikus javaslat</button>')}
      <div id="bev-terv"></div>
    </div>`;

  const selAlk = $('#bev-alkatresz');
  const inpDarab = $('#bev-darab');
  const tervEl = $('#bev-terv');

  const valasztott = () => alkatreszek.find(a => a.id === Number(selAlk.value));
  const beerkezett = () => {
    const n = Number(inpDarab.value);
    return Number.isInteger(n) && n > 0 ? n : 0;
  };
  const rekesz = id => rekeszek.find(r => r.id === id);
  const jelenleg = (r, a) => (r.alkatresz_id === a.id ? r.darab : 0);
  const szabadHely = (r, a) => korlat(r, a) - jelenleg(r, a);
  const ervenyesDarab = d => (Number.isInteger(d) && d > 0 ? d : 0);

  // Ahová ez az alkatrész kerülhet: üres rekesz vagy ugyanilyen alkatrészt tartalmazó, nem teli rekesz.
  // Előbb a részben teli saját rekeszek, utána az üresek – mindkettő hely szerint rendezve.
  const alkalmasRekeszek = a => rekeszek
    .filter(r => (uresRekesz(r) || r.alkatresz_id === a.id) && szabadHely(r, a) > 0)
    .sort((x, y) => uresRekesz(x) - uresRekesz(y) || helyRendez(x, y));

  function javaslat() {
    const a = valasztott();
    let marad = beerkezett();
    terv = [];
    if (!a) return;
    for (const r of alkalmasRekeszek(a)) {
      if (marad <= 0) break;
      const d = Math.min(marad, szabadHely(r, a));
      terv.push({ rekesz_id: r.id, darab: d });
      marad -= d;
    }
  }

  function info(a) {
    const box = $('#bev-info');
    if (!a) {
      box.hidden = true;
      return;
    }
    const sajat = rekeszek.filter(r => r.alkatresz_id === a.id && r.darab > 0);
    const reszben = osszeg(sajat, r => szabadHely(r, a));
    const uresek = rekeszek.filter(uresRekesz);
    const ures = uresek.length;
    box.hidden = false;
    box.innerHTML = [
      `Max. <b>${fmtDb(a.max_darab)}</b> / rekesz`,
      `Készleten: <b>${fmtDb(a.keszlet)}</b> (${sajat.length} rekeszben)`,
      `Szabad hely a meglévő rekeszeiben: <b>${fmtDb(reszben)}</b>`,
      `Üres rekeszek: <b>${ures}</b>`,
      `Összesen elhelyezhető: <b>${fmtDb(reszben + osszeg(uresek, r => korlat(r, a)))}</b>`,
    ].map(t => `<span class="chip">${t}</span>`).join('');
  }

  function tervRajzol() {
    const a = valasztott();
    info(a);
    $('#bev-auto').disabled = !a || !beerkezett();
    if (!a) {
      tervEl.innerHTML = '<p class="muted">Válaszd ki a beérkezett alkatrészt és add meg a mennyiséget – a rendszer javaslatot tesz az elhelyezésre, amit módosíthatsz.</p>';
      return;
    }

    const alkalmas = alkalmasRekeszek(a);
    const foglalt = new Set(terv.map(t => t.rekesz_id));
    const sorok = terv.map((t, i) => {
      const r = rekesz(t.rekesz_id);
      const most = jelenleg(r, a);
      const opciok = alkalmas
        .filter(x => x.id === t.rekesz_id || !foglalt.has(x.id))
        .map(x => `<option value="${x.id}"${x.id === t.rekesz_id ? ' selected' : ''}>${helyKod(x)} (${
          uresRekesz(x) ? 'üres' : `${x.darab}/${korlat(x, a)} db`})</option>`)
        .join('');
      return `<tr data-i="${i}">
        <td><select class="input compact" data-rekesz aria-label="Rekesz">${opciok}</select></td>
        <td class="num">${fmtDb(most)}</td>
        <td class="num"><input type="number" class="input compact qty" min="1" max="${korlat(r, a) - most}" step="1"
          value="${Number.isNaN(t.darab) ? '' : t.darab}" data-darab aria-label="Beérkező darab"></td>
        <td class="num" data-utana></td>
        <td class="bar-cell" data-csik></td>
        <td class="num"><button type="button" class="icon-btn" data-torol aria-label="Sor törlése" title="Sor törlése">×</button></td>
      </tr>`;
    }).join('');

    tervEl.innerHTML = `
      <div class="table-wrap">
        <table class="table plan">
          <thead><tr>
            <th>Rekesz</th><th class="num">Jelenleg</th><th class="num">Beérkező</th>
            <th class="num">Utána</th><th>Telítettség</th><th></th>
          </tr></thead>
          <tbody>${sorok || '<tr><td colspan="6" class="empty-row">Még nincs kiválasztott rekesz.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="plan-foot">
        <button type="button" class="btn small" data-uj-sor${alkalmas.length > terv.length ? '' : ' disabled'}>+ Rekesz hozzáadása</button>
        <div id="bev-osszegzes" class="plan-sum"></div>
      </div>
      <div class="form-error" id="bev-hiba" hidden></div>
      <div class="actions-end">
        <button type="button" class="btn primary" id="bev-rogzit">Bevételezés rögzítése</button>
      </div>`;
    frissitSorok();
  }

  // Soronkénti számítás + validáció + összegzés (gépelés közben is, újrarajzolás nélkül)
  function frissitSorok() {
    const a = valasztott();
    if (!a) return;
    let hibas = false;

    $$('tr[data-i]', tervEl).forEach(tr => {
      const t = terv[Number(tr.dataset.i)];
      const r = rekesz(t.rekesz_id);
      const most = jelenleg(r, a);
      const hatar = korlat(r, a);
      const ok = ervenyesDarab(t.darab) > 0 && most + t.darab <= hatar;
      if (!ok) hibas = true;
      tr.classList.toggle('invalid', !ok);
      const utana = most + ervenyesDarab(t.darab);
      $('[data-utana]', tr).textContent = `${fmtSzam(utana)} / ${fmtSzam(hatar)}`;
      $('[data-csik]', tr).innerHTML = csik(utana, hatar);
    });

    const kert = beerkezett();
    const elhelyezve = osszeg(terv, t => ervenyesDarab(t.darab));
    let uzenet = `Elhelyezve: <b>${fmtDb(elhelyezve)}</b> / ${fmtDb(kert)}`;
    let tipus = 'ok';

    if (!kert) {
      uzenet = 'Add meg a beérkezett mennyiséget.';
      tipus = 'warn';
    } else if (hibas) {
      uzenet += ' – javítsd a pirossal jelölt sorokat (a rekesz kapacitása nem léphető túl).';
      tipus = 'danger';
    } else if (elhelyezve > kert) {
      uzenet += ' – több van beosztva, mint amennyi beérkezett.';
      tipus = 'danger';
    } else if (elhelyezve < kert) {
      uzenet += ` – még ${fmtDb(kert - elhelyezve)} nincs elhelyezve.`;
      const kapacitas = osszeg(alkalmasRekeszek(a), r => szabadHely(r, a));
      if (kapacitas < kert) uzenet += ' Nincs elég hely: vegyél fel új rekeszt a <a href="#rekeszek">Rekeszek</a> menüben.';
      tipus = 'warn';
    }

    const osszegzes = $('#bev-osszegzes');
    osszegzes.className = `plan-sum ${tipus}`;
    osszegzes.innerHTML = uzenet;

    const gomb = $('#bev-rogzit');
    gomb.disabled = !kert || hibas || elhelyezve === 0 || elhelyezve > kert;
    gomb.textContent = elhelyezve > 0 ? `Bevételezés rögzítése (${fmtDb(elhelyezve)})` : 'Bevételezés rögzítése';
  }

  async function rogzit() {
    const a = valasztott();
    const gomb = $('#bev-rogzit');
    const hibaEl = $('#bev-hiba');
    const tetelek = terv.map(t => ({ rekesz_id: t.rekesz_id, darab: t.darab }));
    const elhelyezve = osszeg(tetelek, t => t.darab);

    gomb.disabled = true;
    hibaEl.hidden = true;
    try {
      const valasz = await Api.bevetelezes({ alkatresz_id: a.id, tetelek });
      toast(`${fmtDb(elhelyezve)} „${a.nev}” bevételezve.`);
      const lefoglalva = Number(valasz?.lefoglalva) || 0;
      if (lefoglalva > 0) toast(`${fmtDb(lefoglalva)} automatikusan lefoglalva várakozó projekt(ek)hez.`, 'info');
      for (const p of valasz?.utemezett_projektek ?? []) {
        toast(`„${p.nev}” minden alkatrésze megvan → Ütemezett státusz.`, 'info');
      }
      frissit();
    } catch (err) {
      hibaEl.textContent = err.message;
      hibaEl.hidden = false;
      gomb.disabled = false;
    }
  }

  selAlk.addEventListener('change', () => { javaslat(); tervRajzol(); });
  inpDarab.addEventListener('input', () => { javaslat(); tervRajzol(); });
  $('#bev-auto').addEventListener('click', () => { javaslat(); tervRajzol(); });

  tervEl.addEventListener('change', e => {
    if (!e.target.matches('[data-rekesz]')) return;
    const t = terv[Number(e.target.closest('tr').dataset.i)];
    t.rekesz_id = Number(e.target.value);
    // az új rekesz kapacitásához igazítjuk a mennyiséget
    t.darab = Math.min(ervenyesDarab(t.darab), szabadHely(rekesz(t.rekesz_id), valasztott())) || 1;
    tervRajzol();
  });

  tervEl.addEventListener('input', e => {
    if (!e.target.matches('[data-darab]')) return;
    const v = e.target.value.trim();
    terv[Number(e.target.closest('tr').dataset.i)].darab = v === '' ? NaN : Number(v);
    frissitSorok();
  });

  tervEl.addEventListener('click', e => {
    if (e.target.closest('[data-torol]')) {
      terv.splice(Number(e.target.closest('tr').dataset.i), 1);
      tervRajzol();
    } else if (e.target.closest('[data-uj-sor]')) {
      const a = valasztott();
      const foglalt = new Set(terv.map(t => t.rekesz_id));
      const r = alkalmasRekeszek(a).find(x => !foglalt.has(x.id));
      if (!r) return;
      const marad = beerkezett() - osszeg(terv, t => ervenyesDarab(t.darab));
      terv.push({ rekesz_id: r.id, darab: Math.max(1, Math.min(szabadHely(r, a), marad)) });
      tervRajzol();
    } else if (e.target.closest('#bev-rogzit')) {
      rogzit();
    }
  });

  if (elotoltes) {
    selAlk.value = String(elotoltes.alkatresz_id);
    inpDarab.value = elotoltes.darab;
    javaslat();
  }
  tervRajzol();
}

/* ---------- 3. Rekeszek ---------- */

function rekeszekNezet(el, { rekeszek, alkatreszek }) {
  muveletek('<button type="button" class="btn primary" id="uj-rekesz">+ Új rekesz</button>');
  $('#uj-rekesz').addEventListener('click', () => ujRekeszModal(rekeszek));

  if (!rekeszek.length) {
    el.innerHTML = uresAllapot('Még nincs rekesz', 'Vegyél fel rekeszeket a jobb felső gombbal.');
    return;
  }

  const alk = new Map(alkatreszek.map(a => [a.id, a]));
  const tele = r => !uresRekesz(r) && alk.has(r.alkatresz_id) && r.darab >= korlat(r, alk.get(r.alkatresz_id));
  const hasznalt = rekeszek.filter(r => !uresRekesz(r)).length;

  el.innerHTML = `
    <div class="stats-grid">
      ${stat('Összes rekesz', fmtSzam(rekeszek.length), 'blue', '▦')}
      ${stat('Használt', fmtSzam(hasznalt), 'orange', '▤')}
      ${stat('Üres', fmtSzam(rekeszek.length - hasznalt), 'green', '□')}
      ${stat('Tele', fmtSzam(rekeszek.filter(tele).length), 'red', '■')}
    </div>
    <div class="filter-card">
      <div class="filter-field fixed">
        <label for="rekesz-szuro">Szűrés</label>
        <select id="rekesz-szuro" class="input">
          <option value="osszes">Minden rekesz</option>
          <option value="ures">Csak üres rekeszek</option>
          <option value="tele">Csak tele rekeszek</option>
          <optgroup label="Alkatrész szerint">
            ${[...alkatreszek].sort((a, b) => huRendez(a.nev, b.nev))
              .map(a => `<option value="a${a.id}">${esc(a.nev)}</option>`).join('')}
          </optgroup>
        </select>
      </div>
      <span class="filter-note">Hely: S = sor, O = oszlop, P = polc, R = rekesz</span>
    </div>
    <div class="card">
      ${tablaFejlec('Rekeszek', '', { alcimId: 'rekesz-db' })}
      <div id="rekesz-racs" class="pad"></div>
    </div>`;

  const szuro = $('#rekesz-szuro');
  const racs = $('#rekesz-racs');

  const kartya = r => {
    if (uresRekesz(r)) {
      return `<div class="bin empty"><div class="bin-loc">${helyKod(r)}</div><div class="bin-name muted">Üres</div></div>`;
    }
    const a = alk.get(r.alkatresz_id);
    const max = a ? korlat(r, a) : r.darab;
    const nev = a ? a.nev : 'Ismeretlen alkatrész';
    return `<div class="bin${r.darab >= max ? ' is-full' : ''}">
      <div class="bin-loc">${helyKod(r)}</div>
      <div class="bin-name" title="${esc(nev)}">${esc(nev)}</div>
      ${csik(r.darab, max)}
      <div class="bin-qty">${fmtSzam(r.darab)} / ${fmtSzam(max)} db</div>
    </div>`;
  };

  const rajzol = () => {
    const f = szuro.value;
    const lista = rekeszek.filter(r =>
      f === 'osszes'
      || (f === 'ures' && uresRekesz(r))
      || (f === 'tele' && tele(r))
      || (f.startsWith('a') && !uresRekesz(r) && r.alkatresz_id === Number(f.slice(1))),
    ).sort(helyRendez);

    $('#rekesz-db').textContent = `${lista.length} / ${rekeszek.length} rekesz megjelenítve`;
    racs.innerHTML = lista.length
      ? csoportosit(lista, r => r.sor).map(sor => `
          <section class="rack">
            <h3 class="rack-title">${sor[0].sor}. sor <span class="muted small">${sor.length} rekesz</span></h3>
            <div class="bins">${sor.map(kartya).join('')}</div>
          </section>`).join('')
      : '<p class="muted">Nincs a szűrésnek megfelelő rekesz.</p>';
  };

  szuro.addEventListener('change', rajzol);
  rajzol();
}

function ujRekeszModal(rekeszek) {
  const utolso = [...rekeszek].sort(helyRendez).pop();
  // Kapacitás: az utoljára felvett rekeszé a minta; ha az korlátlan (demo mód), 20.
  const utolsoKap = utolso && Number.isFinite(utolso.max_kapacitas) ? utolso.max_kapacitas : 20;
  const alap = utolso
    ? { sor: utolso.sor, oszlop: utolso.oszlop, polc: utolso.polc, rekesz: utolso.rekesz + 1, max_kapacitas: utolsoKap }
    : { sor: 1, oszlop: 1, polc: 1, rekesz: 1, max_kapacitas: 20 };
  const mezo = (nev, cimke) => `<label class="field"><span>${cimke}</span>
    <input name="${nev}" type="number" min="1" step="1" class="input" value="${alap[nev]}" required></label>`;

  modal({
    cim: 'Új rekesz',
    gomb: 'Rekesz létrehozása',
    tartalom: `
      <div class="field-grid-4">${mezo('sor', 'Sor')}${mezo('oszlop', 'Oszlop')}${mezo('polc', 'Polc')}${mezo('rekesz', 'Rekesz')}</div>
      ${mezo('max_kapacitas', 'Kapacitás (db)')}
      <p class="hint">Az új rekesz üresen jön létre, bevételezéskor bármely alkatrész elhelyezhető benne.
      A kapacitás a rekesz fizikai korlátja; bevételezéskor ez és az alkatrész „max. darab / rekesz” értéke közül a kisebb érvényes.</p>`,
    kuldes: async form => {
      const uj = {
        sor: egeszSzam(form, 'sor', 'Sor', 1),
        oszlop: egeszSzam(form, 'oszlop', 'Oszlop', 1),
        polc: egeszSzam(form, 'polc', 'Polc', 1),
        rekesz: egeszSzam(form, 'rekesz', 'Rekesz', 1),
        max_kapacitas: egeszSzam(form, 'max_kapacitas', 'Kapacitás', 1),
      };
      if (rekeszek.some(r => helyRendez(r, uj) === 0)) throw new Error(`A(z) ${helyKod(uj)} hely már létezik.`);
      await Api.ujRekesz(uj);
      toast(`Rekesz létrehozva: ${helyKod(uj)}`);
      frissit();
    },
  });
}

/* ---------- 4. Hiányzó alkatrészek ---------- */

function hianyzoNezet(el, { hianyzo, alkatreszek }) {
  if (!hianyzo.length) {
    el.innerHTML = uresAllapot('Nincs hiányzó alkatrész', 'Minden projekthez igényelt alkatrész le van foglalva.');
    return;
  }

  const alk = new Map(alkatreszek.map(a => [a.id, a]));
  const sorok = [...hianyzo].sort((x, y) => y.hianyzo_darab - x.hianyzo_darab || huRendez(x.nev, y.nev));
  const ertek = h => h.hianyzo_darab * (alk.get(h.alkatresz_id)?.ar ?? 0);
  const projektek = new Set(sorok.flatMap(h => h.projektek.map(p => p.id)));

  el.innerHTML = `
    <div class="stats-grid">
      ${stat('Hiányzó alkatrésztípus', fmtSzam(sorok.length), 'red', '⚠')}
      ${stat('Hiányzó darab összesen', fmtDb(osszeg(sorok, h => h.hianyzo_darab)), 'orange', '▤')}
      ${stat('Becsült beszerzési érték', fmtFt(osszeg(sorok, ertek)), 'blue', 'Ft')}
      ${stat('Érintett projekt', fmtSzam(projektek.size), 'green', '☀')}
    </div>
    <div class="card">
      ${tablaFejlec('Hiányzó alkatrészek', 'A hiányzó mennyiség szerint csökkenő sorrendben')}
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>Alkatrész</th>
            <th class="num">Hiányzik</th>
            <th class="num">Szabad készlet</th>
            <th class="num">Érték</th>
            <th>Érintett projektek</th>
            <th></th>
          </tr></thead>
          <tbody id="hianyzo-sorok">
            ${sorok.map(h => {
              const a = alk.get(h.alkatresz_id);
              return `<tr>
                <td class="strong">${esc(h.nev)}</td>
                <td class="num strong text-danger">${fmtDb(h.hianyzo_darab)}</td>
                <td class="num">${a ? fmtDb(Math.max(0, a.keszlet - a.lefoglalt)) : '–'}</td>
                <td class="num">${a ? fmtFt(ertek(h)) : '–'}</td>
                <td>${h.projektek.length ? `<ul class="proj-list">${h.projektek.map(p => `
                  <li>${statusz(p.statusz)} <span>${esc(p.nev)}</span> <span class="muted">– ${fmtDb(p.darab)}</span></li>`).join('')}
                  </ul>` : '<span class="muted">–</span>'}</td>
                <td class="num"><button type="button" class="row-action"
                  data-bevetelez="${h.alkatresz_id}" data-darab="${h.hianyzo_darab}">Bevételezés →</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  $('#hianyzo-sorok').addEventListener('click', bevetelezesGomb);
}

/* ---------- 5. Lefoglalt alkatrészek ---------- */

function lefoglaltNezet(el, { lefoglalt, alkatreszek }) {
  if (!lefoglalt.length) {
    el.innerHTML = uresAllapot('Nincs lefoglalt alkatrész', 'Jelenleg egyetlen projekthez sincs készlet lefoglalva.');
    return;
  }

  const projektSzerint = csoportosit(lefoglalt, f => f.projekt_id)
    .sort((x, y) => huRendez(x[0].projekt_nev, y[0].projekt_nev));
  const alkatreszSzerint = csoportosit(lefoglalt, f => f.alkatresz_id)
    .sort((x, y) => huRendez(x[0].nev, y[0].nev));
  const arak = new Map(alkatreszek.map(a => [a.id, a.ar]));

  el.innerHTML = `
    <div class="stats-grid">
      ${stat('Lefoglalt darab összesen', fmtDb(osszeg(lefoglalt, f => f.darab)), 'orange', '⚑')}
      ${stat('Projektek', fmtSzam(projektSzerint.length), 'blue', '☀')}
      ${stat('Alkatrésztípusok', fmtSzam(alkatreszSzerint.length), 'green', '▤')}
      ${stat('Lefoglalt érték', fmtFt(osszeg(lefoglalt, f => f.darab * (arak.get(f.alkatresz_id) ?? 0))), 'red', 'Ft')}
    </div>
    <div class="segmented" role="group" aria-label="Csoportosítás">
      <button type="button" data-csop="projekt">Projekt szerint</button>
      <button type="button" data-csop="alkatresz">Alkatrész szerint</button>
    </div>
    <div id="lefoglalt-tartalom"></div>`;

  const projektKartyak = () => projektSzerint.map(tetelek => {
    const p = tetelek[0];
    return `<div class="card">
      <div class="project-head">
        <div>
          <h3>${esc(p.projekt_nev)}</h3>
          <span class="muted small">${tetelek.length} tétel · ${fmtDb(osszeg(tetelek, f => f.darab))} lefoglalva</span>
        </div>
        ${statusz(p.statusz)}
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Alkatrész</th><th class="num">Lefoglalt</th><th class="num">Igényelt</th><th>Ellátottság</th></tr></thead>
          <tbody>${[...tetelek].sort((x, y) => huRendez(x.nev, y.nev)).map(f => `<tr>
            <td>${esc(f.nev)}</td>
            <td class="num strong">${fmtDb(f.darab)}</td>
            <td class="num">${f.igenyelt === null ? '–' : fmtDb(f.igenyelt)}</td>
            <td class="bar-cell">${f.igenyelt ? csik(f.darab, f.igenyelt) : ''}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  const alkatreszTabla = () => `<div class="card">
    ${tablaFejlec('Lefoglalt alkatrészek', 'Alkatrészenként összesítve, projektek szerinti bontásban')}
    <div class="table-wrap">
    <table class="table">
      <thead><tr><th>Alkatrész</th><th class="num">Összesen lefoglalt</th><th>Projektek</th></tr></thead>
      <tbody>${alkatreszSzerint.map(tetelek => `<tr>
        <td class="strong">${esc(tetelek[0].nev)}</td>
        <td class="num strong">${fmtDb(osszeg(tetelek, f => f.darab))}</td>
        <td><ul class="proj-list">${tetelek.map(f => `
          <li>${statusz(f.statusz)} <span>${esc(f.projekt_nev)}</span> <span class="muted">– ${fmtDb(f.darab)}</span></li>`).join('')}
        </ul></td>
      </tr>`).join('')}</tbody>
    </table>
  </div></div>`;

  const valto = $('.segmented', el);
  const rajzol = () => {
    $$('[data-csop]', valto).forEach(b => b.classList.toggle('active', b.dataset.csop === lefoglaltCsoportositas));
    $('#lefoglalt-tartalom').innerHTML = lefoglaltCsoportositas === 'projekt' ? projektKartyak() : alkatreszTabla();
  };
  valto.addEventListener('click', e => {
    const gomb = e.target.closest('[data-csop]');
    if (!gomb) return;
    lefoglaltCsoportositas = gomb.dataset.csop;
    rajzol();
  });
  rajzol();
}

/* ================= Útválasztás ================= */

let utvonalToken = 0;

// halk = true: a régi tartalom a helyén marad, amíg az új adat meg nem jön (mentés utáni frissítés)
async function utvonal(halk = false) {
  const token = ++utvonalToken;
  const hash = location.hash.slice(1);
  const nev = NEZETEK[hash] ? hash : 'kezdolap';
  const nezet = NEZETEK[nev];
  const el = $('#view');

  $$('.navigation .nav-item').forEach(a => a.classList.toggle('active', a.dataset.view === nev));
  document.title = `${nezet.cim} – Raktárvezetői felület`;
  $('#page-title').textContent = nezet.cim;
  $('#page-sub').textContent = nezet.alcim;
  if (!halk) {
    muveletek('');
    el.innerHTML = '<div class="loading"><span class="spinner"></span> Betöltés…</div>';
  }

  try {
    const adat = await nezet.betolt();
    if (token !== utvonalToken) return;   // közben másik menüpontra léptek
    muveletek('');
    el.innerHTML = '';
    nezet.megjelenit(el, adat);
  } catch (err) {
    if (token !== utvonalToken) return;
    el.innerHTML = hibaAllapot(err);
  }
  frissitJelvenyek();
}

function frissit() {
  utvonal(true);
}

async function frissitJelvenyek() {
  const jelveny = $('#badge-hianyzo');
  try {
    const hianyzo = await Api.hianyzoAlkatreszek();
    jelveny.textContent = hianyzo.length;
    jelveny.hidden = hianyzo.length === 0;
  } catch {
    jelveny.hidden = true;
  }
}

// A topbar jobb felső sarkában a bejelentkezett felhasználó
function felhasznaloMegjelenites(user) {
  const reszek = user.username.split(/[\s._-]+/).filter(Boolean);
  const monogram = (reszek.length > 1 ? reszek[0][0] + reszek[1][0] : user.username.slice(0, 2)).toUpperCase();
  $('#user-avatar').textContent = monogram;
  $('#user-name').textContent = user.username;
  $('#user-role').textContent = SZEREPKOR_NEV[user.role] ?? user.role;
}

async function inditas() {
  // Bejelentkezés ellenőrzése – addig a felület rejtve marad (body.auth-pending)
  let user;
  try {
    user = await Api.me();
  } catch {
    // nincs bejelentkezve (401) vagy nem érhető el a szerver – a belépő oldal jelzi az okát
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
        szoveg: 'Visszaállítod a demo adatokat a kezdőállapotra?',
        gomb: 'Visszaállítás'
      });
      if (!rendben) return;
      MockBackend.reset();
      toast('Demo adatok visszaállítva.');
      frissit();
    });
  } else {
    mod.textContent = `API: ${CONFIG.API_BASE.replace(/^https?:\/\//, '')}`;
    mod.title = CONFIG.API_BASE;
  }

  $('#logoutButton').addEventListener('click', async () => {
    const rendben = await megerosit({
      cim: 'Kijelentkezés',
      szoveg: 'Biztosan ki szeretnél jelentkezni?',
      gomb: 'Kijelentkezés'
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

  // modal bezárása a háttérre kattintva
  $('#modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.close();
  });
  // „Újrapróbálás” gomb a hibaállapotban
  $('#view').addEventListener('click', e => {
    if (e.target.closest('[data-ujra]')) utvonal();
  });

  // oldalváltáskor a nyitva maradt modal is bezárul
  window.addEventListener('hashchange', () => {
    const dlg = $('#modal');
    if (dlg.open) dlg.close();
    utvonal();
  });
  utvonal();
}

inditas();
