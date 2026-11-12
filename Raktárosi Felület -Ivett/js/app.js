/* ================= Raktárosi felület =================
   Három nézet:
     #projektek            – melyik projekthez lehet kivételezni
     #kivetelezes/<id>     – mit, honnan és mennyit kell kivenni (pipálható lista)
     #utvonal/<id>         – ugyanez bejárási sorrendben, térképpel

   A kivételezés rögzítésekor a kivett darabszám levonódik a rekeszekből (Api.kivetelez). */

const $ = sel => document.querySelector(sel);

const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- Tárolás (böngészőben) ----------------
   A pipák és a „kivételezve” jelölés csak ezen az eszközön él: az adatbázisban
   nincs hely a kivételezett állapotnak (lásd README). Demo és éles mód külön
   kulcsot használ, hogy ne keveredjenek az azonos azonosítójú projektek. */

const Tar = {
  elotag: () => `raktaros.${CONFIG.USE_MOCK ? 'demo' : 'eles'}.`,
  olvas(kulcs, alap) {
    try {
      const t = localStorage.getItem(this.elotag() + kulcs);
      return t ? JSON.parse(t) : alap;
    } catch { return alap; }
  },
  ir(kulcs, ertek) {
    try { localStorage.setItem(this.elotag() + kulcs, JSON.stringify(ertek)); } catch { /* nem baj */ }
  },
  torol(kulcs) {
    try { localStorage.removeItem(this.elotag() + kulcs); } catch { /* nem baj */ }
  },
};

const kivetelezveMap = () => Tar.olvas('kivetelezve', {});

/* ---------------- Állapot ---------------- */

const allapot = {
  user: null,
  terv: null,           // a megnyitott projekt kivételezési terve
  pipak: new Set(),     // kipipált rekeszek (bin_id)
  nezetSzam: 0,         // elavult, lassan visszaérkező nézetek eldobásához
};

const aktualisId = () => Number(Tar.olvas('aktualis', 0)) || null;

/* ---------------- Kis segédek ---------------- */

function toast(uzenet, hiba = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (hiba ? ' toast-hiba' : '');
  el.textContent = uzenet;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), hiba ? 8000 : 4000);
}

function megerosit({ cim, torzs, gomb }) {
  const dlg = $('#modal');
  dlg.innerHTML = `
    <form method="dialog" class="modal-doboz">
      <h2>${esc(cim)}</h2>
      ${torzs}
      <div class="modal-gombok">
        <button value="cancel" class="btn">Mégse</button>
        <button value="ok" class="btn primary" autofocus>${esc(gomb)}</button>
      </div>
    </form>`;
  dlg.returnValue = '';
  return new Promise(resolve => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
    dlg.showModal();
  });
}

const statuszJelveny = s => `<span class="status status-${esc(String(s).toLowerCase())}">${esc(STATUSZ_NEV[s] ?? s)}</span>`;

const datum = iso => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('hu-HU', { dateStyle: 'medium', timeStyle: 'short' });
};

const hely = l => `${l.sor}. sor, ${l.oszlop}. oszlop, ${l.polc}. polc`;

function fej(cim, alcim = '') {
  $('#page-title').textContent = cim;
  $('#page-sub').textContent = alcim;
  document.title = `${cim} – Raktárosi felület`;
}

function betoltesJelzo() {
  $('#view').innerHTML = '<p class="muted">Betöltés…</p>';
}

function hibaNezet(err, ujra) {
  $('#view').innerHTML = `
    <div class="card pad">
      <p class="uzenet uzenet-hiba" role="alert">${esc(err.message || err)}</p>
      <button type="button" class="btn" id="ujra">Újrapróbálom</button>
    </div>`;
  $('#ujra').addEventListener('click', ujra);
}

/* ---------------- Menü ---------------- */

function frissitMenu(aktivNev) {
  const id = aktualisId();
  const toldalek = id ? `/${id}` : '';
  $('#nav-kivetelezes').href = `#kivetelezes${toldalek}`;
  $('#nav-utvonal').href = `#utvonal${toldalek}`;
  document.querySelectorAll('.nav-item[data-view]').forEach(a =>
    a.classList.toggle('active', a.dataset.view === aktivNev));
}

/* ---------------- Terv betöltése ---------------- */

async function tervBetolt(id) {
  const terv = await Api.terv(id);
  allapot.terv = terv;
  const mentett = new Set(Tar.olvas(`pipa.${id}`, []));
  // csak olyan pipa maradjon, ami a mostani tervben még szerepel
  allapot.pipak = new Set(terv.lepesek.map(l => l.bin_id).filter(b => mentett.has(b)));
  Tar.ir('aktualis', id);
  return terv;
}

/* Ha valaki kézzel beírja egy nem kivételezhető projekt címét, ne lehessen rögzíteni. */
function tervAkadaly(terv) {
  if (!KIVETELEZHETO_STATUSZOK.includes(terv.projekt.statusz)) {
    return 'Ez a projekt még nincs ütemezve: a kivételezés az alkatrészek lefoglalása után indulhat.';
  }
  if (terv.tetelek.length === 0) return 'Nincs alkatrész a projekthez rendelve.';
  if (terv.tetelek.some(t => !t.lefoglalt)) return 'Nincs minden alkatrész lefoglalva ehhez a projekthez.';
  return null;
}

function akadalyNezet(terv, akadaly) {
  $('#view').innerHTML = `
    ${projektFej(terv)}
    <div class="card pad">
      <p class="uzenet uzenet-hiba" role="alert">${esc(akadaly)}</p>
      <a class="btn" href="#projektek">Vissza a projektekhez</a>
    </div>`;
}

function pipaMent() {
  Tar.ir(`pipa.${allapot.terv.projekt.id}`, [...allapot.pipak]);
}

/* ================= 1. Projektek ================= */

async function projektekNezet(token) {
  fej('Projektek', 'Válaszd ki a projektet, amelyhez alkatrészeket kell kivételezni.');
  betoltesJelzo();
  const lista = await Api.projektek();
  if (token !== allapot.nezetSzam) return;

  const kesz = kivetelezveMap();

  if (lista.length === 0) {
    $('#view').innerHTML = '<div class="card pad"><p class="muted">Nincs aktív projekt.</p></div>';
    return;
  }

  $('#view').innerHTML = `
    <div class="card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Projekt</th><th>Státusz</th><th>Alkatrészek</th><th>Kivételezés</th></tr>
          </thead>
          <tbody>
            ${lista.map(p => {
              const k = kesz[p.id];
              let akcio;
              if (k) {
                akcio = `<span class="text-ok strong">Kivételezve</span><br><small class="muted">${esc(datum(k.ido))}</small>
                         <br><a class="btn kicsi" href="#kivetelezes/${p.id}">Megnyitás</a>`;
              } else if (p.akadaly) {
                akcio = `<small class="muted">${esc(p.akadaly)}</small>`;
              } else {
                akcio = `<a class="btn primary" href="#kivetelezes/${p.id}">Kivételezés</a>`;
              }
              return `
                <tr>
                  <td><strong>${esc(p.nev)}</strong></td>
                  <td>${statuszJelveny(p.statusz)}</td>
                  <td>${p.tetelek} tétel · ${p.darab} db</td>
                  <td>${akcio}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ================= 2. Kivételezés ================= */

function projektFej(t) {
  const p = t.projekt;
  return `
    <div class="card pad projekt-fej">
      <div>
        <h2>${esc(p.nev)}</h2>
        ${p.leiras ? `<p class="muted">${esc(p.leiras)}</p>` : ''}
      </div>
      ${statuszJelveny(p.statusz)}
    </div>`;
}

function keszNezet(id, k) {
  fej('Kivételezés', `Ez a projekt már kivételezve: ${datum(k.ido)}`);
  $('#view').innerHTML = `
    <div class="card pad">
      <p class="uzenet uzenet-ok">A kivételezés rögzítve, a készlet levonása megtörtént.</p>
      <ul class="kesz-lista">
        ${(k.tetelek || []).map(l => `<li>${esc(l.azonosito)} – ${esc(l.nev)}: <strong>${l.darab} db</strong></li>`).join('')}
      </ul>
      <a class="btn" href="#projektek">Vissza a projektekhez</a>
    </div>`;
}

async function kivetelezesNezet(id, token) {
  fej('Kivételezés', 'Pipáld ki, amit kivettél a rekeszből.');
  const k = kivetelezveMap()[id];
  if (k) { Tar.ir('aktualis', id); keszNezet(id, k); return; }

  betoltesJelzo();
  const terv = await tervBetolt(id);
  if (token !== allapot.nezetSzam) return;
  const akadaly = tervAkadaly(terv);
  if (akadaly) { akadalyNezet(terv, akadaly); return; }
  rajzolKivetelezes(terv);
}

function rajzolKivetelezes(terv) {
  const figyelmeztetes = terv.hianyzik ? `
    <p class="uzenet uzenet-hiba" role="alert">
      A raktárban most nincs elég készlet a projekt darabszámaihoz – vagy ezt a projektet már kivételezte valaki.
      Egyeztess a raktárvezetővel, mielőtt rögzítenél.
    </p>` : '';

  $('#view').innerHTML = `
    ${projektFej(terv)}
    ${figyelmeztetes}
    ${terv.tetelek.map(t => `
      <section class="card pad tetel">
        <header class="tetel-fej">
          <h3>${esc(t.nev)}</h3>
          <span class="strong">${t.kell} db</span>
        </header>
        ${t.helyek.map(h => `
          <label class="pick">
            <input type="checkbox" data-bin="${h.bin_id}" ${allapot.pipak.has(h.bin_id) ? 'checked' : ''}>
            <span class="pick-szoveg">
              <strong>${esc(h.azonosito)}</strong> <span class="muted">(${esc(hely(h))})</span>
            </span>
            <span class="pick-db">${h.darab} db</span>
          </label>`).join('')}
        ${t.hianyzik > 0 ? `<p class="uzenet uzenet-hiba">Hiányzik: ${t.hianyzik} db</p>` : ''}
      </section>`).join('')}
    <div class="muvelet-sor">
      <a class="btn" href="#utvonal/${terv.projekt.id}">Útvonal megnyitása</a>
      <span class="haladas muted" id="haladas"></span>
      <button type="button" class="btn primary" id="rogzit-gomb">Kivételezés rögzítése</button>
    </div>`;

  $('#rogzit-gomb').addEventListener('click', rogzit);
  frissitKijelzo();
}

/* Pipák, számláló és a rögzítés gomb frissítése újrarajzolás nélkül (a fókusz megmarad). */
function frissitKijelzo() {
  const t = allapot.terv;
  if (!t) return;
  const ossz = t.lepesek.length;
  const kesz = allapot.pipak.size;

  const haladas = $('#haladas');
  if (haladas) haladas.textContent = `${kesz} / ${ossz} rekesz kipipálva`;

  const gomb = $('#rogzit-gomb');
  if (gomb) gomb.disabled = t.hianyzik || ossz === 0 || kesz < ossz;

  document.querySelectorAll('input[data-bin]').forEach(cb => {
    const be = allapot.pipak.has(Number(cb.dataset.bin));
    cb.checked = be;
    cb.closest('label, li')?.classList.toggle('kesz', be);
  });
}

async function rogzit() {
  const t = allapot.terv;
  if (!t || t.hianyzik || allapot.pipak.size < t.lepesek.length) return;

  const igen = await megerosit({
    cim: 'Kivételezés rögzítése',
    gomb: 'Rögzítés',
    torzs: `
      <p>Ezek a darabszámok kerülnek levonásra a raktárkészletből (${esc(t.projekt.nev)}):</p>
      <ul class="kesz-lista">
        ${t.lepesek.map(l => `
          <li>${esc(l.azonosito)} – ${esc(l.nev)}: <strong>−${l.darab} db</strong>
              <span class="muted">(${l.raktaron} → ${l.raktaron - l.darab})</span></li>`).join('')}
      </ul>
      <p class="muted small">A művelet nem vonható vissza ezen a felületen.</p>`,
  });
  if (!igen) return;

  const gomb = $('#rogzit-gomb');
  gomb.disabled = true;
  gomb.textContent = 'Rögzítés…';

  try {
    await Api.kivetelez(t);
  } catch (err) {
    toast(err.message, true);
    gomb.textContent = 'Kivételezés rögzítése';
    frissitKijelzo();
    return;
  }

  const k = { ido: new Date().toISOString(), tetelek: t.lepesek.map(l => ({ azonosito: l.azonosito, nev: l.nev, darab: l.darab })) };
  const map = kivetelezveMap();
  map[t.projekt.id] = k;
  Tar.ir('kivetelezve', map);
  Tar.torol(`pipa.${t.projekt.id}`);

  toast('A kivételezés rögzítve.');
  keszNezet(t.projekt.id, k);
}

/* ================= 3. Útvonal ================= */

async function utvonalNezet(id, token) {
  fej('Útvonal', 'A rekeszek bejárási sorrendje.');
  const k = kivetelezveMap()[id];
  if (k) { Tar.ir('aktualis', id); keszNezet(id, k); return; }

  betoltesJelzo();
  const terv = await tervBetolt(id);
  if (token !== allapot.nezetSzam) return;
  const akadaly = tervAkadaly(terv);
  if (akadaly) { akadalyNezet(terv, akadaly); return; }
  rajzolUtvonal(terv);
}

function terkep(terv) {
  const { sorok, oszlopok } = terv.racs;
  if (!sorok || !oszlopok) return '';

  // melyik soron milyen irányban haladunk (az első érintett sor balról jobbra)
  const erintettSorok = [...new Set(terv.lepesek.map(l => l.sor))].sort((a, b) => a - b);
  const irany = sor => {
    const i = erintettSorok.indexOf(sor);
    return i < 0 ? '' : (i % 2 === 0 ? '→' : '←');
  };

  let html = `<div class="terkep" style="--oszlopok:${oszlopok}" role="img" aria-label="A raktár térképe a bejárási sorrenddel">`;
  html += '<span></span>';
  for (let o = 1; o <= oszlopok; o++) html += `<span class="terkep-fej">${o}. oszlop</span>`;

  for (let s = 1; s <= sorok; s++) {
    html += `<span class="terkep-sor">${s}. sor ${irany(s)}</span>`;
    for (let o = 1; o <= oszlopok; o++) {
      const itt = terv.lepesek.filter(l => l.sor === s && l.oszlop === o);
      html += `<span class="cella ${itt.length ? 'erintett' : ''}">${
        itt.map(l => `<b class="jelolo" title="${esc(l.azonosito)} – ${esc(l.polc + '. polc')}">${l.sorszam}</b>`).join('')
      }</span>`;
    }
  }
  return html + '</div>';
}

function rajzolUtvonal(terv) {
  const nincs = terv.lepesek.length === 0;

  $('#view').innerHTML = `
    ${projektFej(terv)}
    ${nincs ? '<div class="card pad"><p class="muted">Ehhez a projekthez nincs kivehető alkatrész a raktárban.</p></div>' : `
      <div class="card pad">
        <h2>Ajánlott sorrend</h2>
        <p class="muted small">Soronként haladunk, és minden második sort visszafelé járunk be, így nincs felesleges oda-vissza séta.
          A bejáratot az 1. sor 1. oszlopánál feltételezzük.</p>
        <ol class="lepesek">
          ${terv.lepesek.map(l => `
            <li class="lepes">
              <label class="pick">
                <span class="sorszam">${l.sorszam}</span>
                <input type="checkbox" data-bin="${l.bin_id}" ${allapot.pipak.has(l.bin_id) ? 'checked' : ''}>
                <span class="pick-szoveg">
                  <strong>${esc(l.azonosito)}</strong> <span class="muted">(${esc(hely(l))})</span><br>
                  ${esc(l.nev)}
                </span>
                <span class="pick-db">${l.darab} db</span>
              </label>
            </li>`).join('')}
        </ol>
      </div>
      <div class="card pad">
        <h2>Raktártérkép</h2>
        ${terkep(terv)}
        <p class="muted small">A számok a megállók sorrendjét jelölik; ha egy oszlopban több polc is érintett, mindkét szám ott áll.</p>
      </div>`}
    <div class="muvelet-sor">
      <span class="haladas muted" id="haladas"></span>
      <a class="btn primary" href="#kivetelezes/${terv.projekt.id}">Tovább a kivételezéshez</a>
    </div>`;

  frissitKijelzo();
}

/* ---------------- Pipák kezelése (mindkét nézetben) ---------------- */

$('#view').addEventListener('change', e => {
  const cb = e.target.closest('input[data-bin]');
  if (!cb || !allapot.terv) return;
  const bin = Number(cb.dataset.bin);
  if (cb.checked) allapot.pipak.add(bin); else allapot.pipak.delete(bin);
  pipaMent();
  frissitKijelzo();
});

/* ================= Útválasztás ================= */

async function router() {
  const [nev, idSzoveg] = location.hash.replace(/^#/, '').split('/');
  const id = Number(idSzoveg) || null;
  const token = ++allapot.nezetSzam;

  const nezet = nev === 'kivetelezes' || nev === 'utvonal' ? nev : 'projektek';
  frissitMenu(nezet);
  allapot.terv = nezet === 'projektek' ? null : allapot.terv;

  try {
    if (nezet === 'projektek') {
      await projektekNezet(token);
    } else if (!id) {
      fej(nezet === 'utvonal' ? 'Útvonal' : 'Kivételezés');
      $('#view').innerHTML = `
        <div class="card pad">
          <p>Válassz először projektet.</p>
          <a class="btn primary" href="#projektek">Projektek megnyitása</a>
        </div>`;
    } else if (nezet === 'kivetelezes') {
      await kivetelezesNezet(id, token);
    } else {
      await utvonalNezet(id, token);
    }
  } catch (err) {
    if (token === allapot.nezetSzam) hibaNezet(err, router);
  }
  if (token === allapot.nezetSzam) frissitMenu(nezet);
}

window.addEventListener('hashchange', router);

/* ================= Indulás, belépés-ellenőrzés ================= */

function nincsJogOldal(uzenet, gombFelirat) {
  document.body.classList.remove('auth-pending');
  $('.app').innerHTML = `
    <main class="main-content nincs-jog">
      <div class="card pad">
        <h1>Nincs hozzáférés</h1>
        <p class="uzenet uzenet-hiba" role="alert">${esc(uzenet)}</p>
        <button type="button" class="btn primary" id="vissza-belepo">${esc(gombFelirat)}</button>
      </div>
    </main>`;
  $('#vissza-belepo').addEventListener('click', async () => {
    await Api.logout();
    location.replace(CONFIG.BELEPO_OLDAL + '#kijelentkezve');
  });
}

async function inditas() {
  let user;
  try {
    user = await Api.me();
  } catch (err) {
    if (err.status === 401) { Api.belepoOldalra(); return; }
    nincsJogOldal(err.message, 'Vissza a belépéshez');
    return;
  }

  if (user.role !== CONFIG.ENGEDETT_SZEREPKOR) {
    nincsJogOldal(
      `Ehhez a felülethez raktárosi jogosultság kell (a te szerepköröd: ${SZEREPKOR_NEV[user.role] ?? user.role}).`,
      'Vissza a belépéshez');
    return;
  }

  allapot.user = user;
  $('#user-name').textContent = user.username;
  $('#user-role').textContent = SZEREPKOR_NEV[user.role] ?? user.role;
  $('#user-avatar').textContent = (user.username[0] || '?').toUpperCase();

  if (CONFIG.USE_MOCK) {
    $('#mode-badge').textContent = 'Demo mód – tesztadatok';
    $('#mode-badge').hidden = false;
    $('#reset-demo').hidden = false;
    $('#logoutButton').hidden = true;
  }

  document.body.classList.remove('auth-pending');
  router();
}

$('#logoutButton').addEventListener('click', async () => {
  await Api.logout();
  location.replace(CONFIG.BELEPO_OLDAL + '#kijelentkezve');
});

$('#reset-demo').addEventListener('click', () => {
  MockBackend.visszaallit();
  ['kivetelezve', 'aktualis'].forEach(k => Tar.torol(k));
  Object.keys(localStorage).filter(k => k.startsWith(Tar.elotag() + 'pipa.')).forEach(k => localStorage.removeItem(k));
  location.hash = '#projektek';
  location.reload();
});

inditas();
