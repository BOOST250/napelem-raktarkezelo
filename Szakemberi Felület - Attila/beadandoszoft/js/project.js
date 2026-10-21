/* ================= Projekt részletező oldal =================
   A szakember munkafolyamata a feladatkiírás A.4–A.7 pontja szerint:

     alkatrész felvétele  →  ha van szabad készlet, reserved = 1
                           →  ha nincs, előfoglalás (reserved = 0)
                           →  az első tétel Új projekten Tervezetre lép
     munkaóra + munkadíj  →  projects.work_hours, labor_cost
     árkalkuláció         →  minden tétel foglalt: Ütemezett
                           →  valami hiányzik: Várakozik
     lezárás              →  csak Folyamatbanból, Befejezett vagy Sikertelen

   Folyamatban állapotra a raktáros állítja a kivételezéskor (C.1).
   Minden állapotváltást a szerver ír a project_history táblába. */

const projektId = Number(new URLSearchParams(window.location.search).get('id'));

let projekt = null;
let tetelek = [];
let alkatreszek = [];

const SZERKESZTHETO = ['New', 'Draft', 'Wait'];
const MUNKA_SZERKESZTHETO = ['New', 'Draft', 'Wait', 'Scheduled', 'InProgress'];

const ALLAPOT_SUGO = {
  New: 'Új projekt, a helyszíni felmérés még nem történt meg. Vedd fel az alkatrészeket: ami raktáron van, lefoglaljuk, ami nincs, előfoglalás lesz.',
  Draft: 'A felmérés folyamatban van. Rögzítsd a becsült munkaórát és a munkadíjat, majd készítsd el az árkalkulációt.',
  Wait: 'Az árkalkuláció nem fejezhető be, mert nincs minden alkatrész raktáron. A hiányzó tételek előfoglalva várják a bevételezést.',
  Scheduled: 'Az árkalkuláció elkészült, minden alkatrész le van foglalva. A raktáros a kivételezéskor Folyamatban állapotra állítja.',
  InProgress: 'A kivitelezés elkezdődött. Ha a munka véget ért, zárd le a projektet.',
  Completed: 'A projekt sikeresen megvalósult, már nem módosítható.',
  Failed: 'A projekt megvalósítása nem sikerült, már nem módosítható.',
};

function esc(szoveg) {
  return String(szoveg ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFt(szam) {
  if (szam === null || szam === undefined || Number.isNaN(Number(szam))) return '–';
  return Number(szam).toLocaleString('hu-HU') + ' Ft';
}

function formatDatum(ertek) {
  if (!ertek) return '–';
  const datum = new Date(String(ertek).replace(' ', 'T'));
  if (Number.isNaN(datum.getTime())) return '–';
  return datum.toLocaleString('hu-HU', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function uzenet(elemId, szoveg, hiba) {
  const elem = document.getElementById(elemId);
  if (!elem) return;
  if (!szoveg) {
    elem.style.display = 'none';
    elem.textContent = '';
    return;
  }
  elem.textContent = szoveg;
  elem.className = 'form-message ' + (hiba ? 'error-message' : 'success-message');
  elem.style.display = 'block';
}

function szerkesztheto() {
  return SZERKESZTHETO.includes(projekt.status);
}

function lezart() {
  return projekt.status === 'Completed' || projekt.status === 'Failed';
}

function renderProjekt() {
  document.getElementById('projectTitle').textContent = projekt.location || 'Névtelen projekt';
  document.getElementById('projectSubtitle').textContent =
    projekt.customer_name ? 'Ügyfél: ' + projekt.customer_name : '–';

  const statuszElem = document.getElementById('projectStatus');
  statuszElem.textContent = STATUSZ_NEV[projekt.status] || projekt.status;
  statuszElem.className = 'project-status ' + (STATUSZ_OSZTALY[projekt.status] || '');

  document.getElementById('detailCustomer').textContent = projekt.customer_name || '–';
  document.getElementById('detailEmail').textContent = projekt.customer_email || '–';
  document.getElementById('detailPhone').textContent = projekt.customer_phone || '–';
  document.getElementById('detailLocation').textContent = projekt.location || '–';
  document.getElementById('detailCreated').textContent = formatDatum(projekt.created_at);
  document.getElementById('detailDescription').textContent = projekt.description || '–';

  document.getElementById('workHours').value = projekt.work_hours ?? '';
  document.getElementById('laborCost').value = projekt.labor_cost ?? '';

  document.getElementById('editProjectButton').hidden = lezart();
}

function renderTetelek() {
  const tbody = document.getElementById('partsTableBody');

  if (tetelek.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6"><div class="empty-projects">Még nincs felvett alkatrészigény ehhez a projekthez.</div></td></tr>';
    document.getElementById('partsSummary').textContent = '0 tétel';
    return;
  }

  tbody.innerHTML = tetelek.map(tetel => {
    const alkatresz = alkatreszek.find(a => a.id === tetel.part_id);
    const ertek = tetel.part_price * tetel.quantity;
    const zarolt = tetel.reserved || !szerkesztheto();

    const mennyisegCella = zarolt
      ? esc(tetel.quantity) + ' db'
      : '<input type="number" class="qty-input" min="1" step="1" value="' + esc(tetel.quantity) + '" data-part="' + esc(tetel.part_id) + '">';

    let raktarCella;
    if (tetel.reserved) {
      raktarCella = '<span class="project-status status-scheduled">Lefoglalva</span>';
    } else if (!alkatresz) {
      raktarCella = '–';
    } else if (alkatresz.szabad >= tetel.quantity) {
      raktarCella = '<span class="project-status status-draft">Előfoglalva, ' + esc(alkatresz.szabad) + ' db szabad</span>';
    } else {
      const hiany = Math.max(tetel.quantity - alkatresz.szabad, 0);
      raktarCella = '<span class="project-status status-failed">Előfoglalva, hiányzik ' + esc(hiany) + ' db</span>';
    }

    const muveletCella = szerkesztheto()
      ? '<button type="button" class="secondary-button" data-torol="' + esc(tetel.part_id) + '">Törlés</button>'
      : '–';

    return '<tr>' +
      '<td><strong>' + esc(tetel.part_name) + '</strong></td>' +
      '<td>' + formatFt(tetel.part_price) + '</td>' +
      '<td>' + mennyisegCella + '</td>' +
      '<td>' + formatFt(ertek) + '</td>' +
      '<td>' + raktarCella + '</td>' +
      '<td>' + muveletCella + '</td>' +
      '</tr>';
  }).join('');

  const foglalt = tetelek.filter(t => t.reserved).length;
  const anyag = tetelek.reduce((s, t) => s + t.part_price * t.quantity, 0);
  document.getElementById('partsSummary').textContent =
    tetelek.length + ' tétel, katalógusár ' + formatFt(anyag) +
    (foglalt > 0 ? ' – ' + foglalt + ' tétel lefoglalva' : '');
}

function renderAlkatreszValaszto() {
  const valaszto = document.getElementById('partSelect');
  const szakasz = document.getElementById('addPartSection');
  szakasz.hidden = !szerkesztheto();
  if (!szerkesztheto()) return;

  const felvettek = new Set(tetelek.map(t => t.part_id));
  const valaszthatok = alkatreszek.filter(a => !felvettek.has(a.id));
  const gomb = document.getElementById('addPartButton');

  if (valaszthatok.length === 0) {
    valaszto.innerHTML = '<option value="">Minden alkatrész szerepel már a listán</option>';
    valaszto.disabled = true;
    gomb.disabled = true;
    return;
  }

  valaszto.disabled = false;
  gomb.disabled = false;
  valaszto.innerHTML =
    '<option value="">Válassz alkatrészt…</option>' +
    valaszthatok.map(a =>
      '<option value="' + esc(a.id) + '">' +
      esc(a.name) + ' – ' + formatFt(a.price) +
      ' (' + a.szabad + ' db szabad)' +
      '</option>'
    ).join('');
}

function renderKoltseg() {
  const anyag = tetelek.reduce((s, t) => s + t.part_price * t.quantity, 0);
  const hiany = tetelek.filter(t => !t.reserved);
  const dij = projekt.labor_cost;
  const veglegesAllapot = ['Scheduled', 'InProgress', 'Completed', 'Failed'].includes(projekt.status);
  const vegleges = tetelek.length > 0 && hiany.length === 0 && dij !== null && veglegesAllapot;

  document.getElementById('costMaterial').textContent = tetelek.length ? formatFt(anyag) : '–';
  document.getElementById('costLabor').textContent = dij === null ? 'nincs rögzítve' : formatFt(dij);
  document.getElementById('costHours').textContent =
    projekt.work_hours === null || projekt.work_hours === ''
      ? 'nincs rögzítve'
      : String(projekt.work_hours).replace('.', ',') + ' óra';
  document.getElementById('costTotal').textContent = vegleges ? formatFt(anyag + dij) : 'nem végleges';
  document.getElementById('costTotal').classList.toggle('cost-final', vegleges);

  const megjegyzes = document.getElementById('costMissing');
  if (tetelek.length === 0) {
    megjegyzes.textContent = 'Még nincs alkatrész a kalkulációhoz.';
  } else if (hiany.length > 0) {
    megjegyzes.textContent = 'Előfoglalva, nincs elég készlet: ' +
      hiany.map(t => t.part_name + ' (' + t.quantity + ' db)').join(', ') +
      '. Ezek nélkül az árkalkuláció nem fejezhető be, a projekt Várakozik állapotba kerül.';
  } else if (dij === null) {
    megjegyzes.textContent = 'Minden tétel le van foglalva, az áruk ismert. A végleges árhoz rögzítsd a munkaórát és a munkadíjat.';
  } else if (vegleges) {
    megjegyzes.textContent = 'Végleges ár: lefoglalt anyagköltség + munkadíj.';
  } else {
    megjegyzes.textContent = 'Az alkatrészek és a munkadíj megvannak. Az árkalkuláció gombbal válik véglegessé a projekt.';
  }

  const gomb = document.getElementById('quoteButton');
  gomb.hidden = !['New', 'Draft', 'Wait'].includes(projekt.status);
  gomb.disabled = tetelek.length === 0;
}

function renderStatusz() {
  document.getElementById('statusHint').textContent = ALLAPOT_SUGO[projekt.status] || '';
  const hely = document.getElementById('statusActions');

  if (projekt.status === 'InProgress') {
    hely.innerHTML =
      '<button type="button" class="primary-button" data-statusz="Completed">Sikeres lezárás</button>' +
      '<button type="button" class="secondary-button danger-button" data-statusz="Failed">Sikertelen lezárás</button>';
  } else if (lezart()) {
    hely.innerHTML = '<span class="input-hint">A projekt lezárva, már nem módosítható.</span>';
  } else if (projekt.status === 'Scheduled') {
    hely.innerHTML = '<span class="input-hint">A raktáros a kivételezés megkezdésekor Folyamatban állapotra állítja. Utána itt tudod lezárni.</span>';
  } else {
    hely.innerHTML = '<span class="input-hint">A lezárás a kivitelezés (Folyamatban állapot) után érhető el.</span>';
  }

  const munkaMehet = MUNKA_SZERKESZTHETO.includes(projekt.status);
  document.getElementById('workHours').disabled = !munkaMehet;
  document.getElementById('laborCost').disabled = !munkaMehet;
  document.getElementById('saveWorkButton').disabled = !munkaMehet;
}

function renderTortenet(tortenet) {
  const tbody = document.getElementById('historyTableBody');
  if (!tortenet || tortenet.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2"><div class="empty-projects">Nincs előzmény.</div></td></tr>';
    return;
  }
  tbody.innerHTML = tortenet.map(sor =>
    '<tr>' +
    '<td><span class="project-status ' + (STATUSZ_OSZTALY[sor.status] || '') + '">' +
    esc(STATUSZ_NEV[sor.status] || sor.status) + '</span></td>' +
    '<td>' + formatDatum(sor.changed_at) + '</td>' +
    '</tr>'
  ).join('');
}

async function ujratolt() {
  const [p, t, a, h] = await Promise.all([
    Api.projekt(projektId),
    Api.projektAlkatreszek(projektId),
    Api.alkatreszek(),
    Api.projektTortenet(projektId),
  ]);
  projekt = p;
  tetelek = t;
  alkatreszek = a;
  renderProjekt();
  renderTetelek();
  renderAlkatreszValaszto();
  renderKoltseg();
  renderStatusz();
  renderTortenet(h);
}

async function betolt() {
  if (!projektId) {
    uzenet('pageMessage', 'Hiányzik a projekt azonosítója. Nyisd meg a projektet a listából.', true);
    return;
  }
  const sav = document.getElementById('pageMessage');
  sav.className = 'form-message';
  sav.textContent = 'Projekt betöltése…';
  sav.style.display = 'block';
  try {
    await ujratolt();
    sav.style.display = 'none';
    document.getElementById('pageContent').hidden = false;
  } catch (hiba) {
    uzenet('pageMessage', hiba.message, true);
  }
}

async function alkatreszHozzaadas() {
  const valaszto = document.getElementById('partSelect');
  const darabElem = document.getElementById('partQuantity');
  const alkatreszId = Number(valaszto.value);
  const darab = Number(darabElem.value);

  if (!alkatreszId) {
    uzenet('partsMessage', 'Válassz alkatrészt a listából.', true);
    return;
  }
  if (!Number.isInteger(darab) || darab < 1 || darab > 100000) {
    uzenet('partsMessage', 'A mennyiség 1 és 100000 db között legyen.', true);
    return;
  }

  const gomb = document.getElementById('addPartButton');
  gomb.disabled = true;
  uzenet('partsMessage', '', false);
  try {
    const valasz = await Api.hozzarendel(projektId, alkatreszId, darab);
    darabElem.value = 1;
    await ujratolt();
    uzenet('partsMessage', valasz.message || 'Az alkatrészigény rögzítve.', false);
  } catch (hiba) {
    uzenet('partsMessage', hiba.message, true);
    gomb.disabled = false;
  }
}

async function darabMentes(alkatreszId, input) {
  const darab = Number(input.value);
  if (!Number.isInteger(darab) || darab < 1 || darab > 100000) {
    uzenet('partsMessage', 'A mennyiség 1 és 100000 db között legyen.', true);
    renderTetelek();
    return;
  }
  input.disabled = true;
  try {
    await Api.modositProjektAlkatresz(projektId, alkatreszId, { quantity: darab });
    await ujratolt();
    uzenet('partsMessage', 'A mennyiség módosítva. Az árkalkuláció foglalja le, ha már van rá elég készlet.', false);
  } catch (hiba) {
    uzenet('partsMessage', hiba.message, true);
    renderTetelek();
  }
}

async function tetelTorles(alkatreszId) {
  const tetel = tetelek.find(t => t.part_id === alkatreszId);
  const nev = tetel ? tetel.part_name : 'alkatrész';
  const extra = tetel && tetel.reserved ? ' A foglalás feloldódik, a készlet újra szabad lesz.' : '';
  const rendben = await megerosit('Tétel törlése', 'Biztosan törlöd a listáról: ' + nev + '?' + extra, 'Törlés');
  if (!rendben) return;
  try {
    await Api.torolProjektAlkatresz(projektId, alkatreszId);
    await ujratolt();
    uzenet('partsMessage', 'A tétel törölve a listáról.', false);
  } catch (hiba) {
    uzenet('partsMessage', hiba.message, true);
  }
}

async function arkalkulacio() {
  const gomb = document.getElementById('quoteButton');
  gomb.disabled = true;
  uzenet('quoteMessage', '', false);
  try {
    const valasz = await Api.arkalkulacio(projektId);
    await ujratolt();
    uzenet('quoteMessage', valasz.message, valasz.outcome !== 'scheduled');
  } catch (hiba) {
    uzenet('quoteMessage', hiba.message, true);
    gomb.disabled = tetelek.length === 0;
  }
}

async function munkaMentes() {
  const ora = document.getElementById('workHours').value.trim();
  const dij = document.getElementById('laborCost').value.trim();
  const hiba = munkaAdatHiba(ora, dij);
  if (hiba) {
    uzenet('workMessage', hiba, true);
    return;
  }
  const gomb = document.getElementById('saveWorkButton');
  gomb.disabled = true;
  try {
    await Api.modositProjekt(projektId, {
      work_hours: Number(ora.replace(',', '.')),
      labor_cost: Number(dij.replace(',', '.')),
    });
    await ujratolt();
    uzenet('workMessage', 'A becsült munkaóra és a munkadíj mentve.', false);
  } catch (err) {
    uzenet('workMessage', err.message, true);
    gomb.disabled = false;
  }
}

async function lezaras(cel) {
  const sikeres = cel === 'Completed';
  const rendben = await megerosit(
    'Projekt lezárása',
    sikeres
      ? 'Sikeresen lezárod a projektet? Utána már nem módosítható.'
      : 'Sikertelenként lezárod a projektet? Utána már nem módosítható.',
    sikeres ? 'Befejezés' : 'Sikertelen'
  );
  if (!rendben) return;
  try {
    const valasz = await Api.lezaras(projektId, cel);
    await ujratolt();
    uzenet('statusMessage', valasz.message, false);
  } catch (hiba) {
    uzenet('statusMessage', hiba.message, true);
  }
}

function szerkesztesMegnyit() {
  document.getElementById('editLocation').value = projekt.location;
  document.getElementById('editDescription').value = projekt.description;
  document.getElementById('editCustomerName').value = projekt.customer_name;
  document.getElementById('editEmail').value = projekt.customer_email;
  document.getElementById('editPhone').value = projekt.customer_phone;
  document.getElementById('detailsView').hidden = true;
  document.getElementById('editProjectForm').hidden = false;
  uzenet('editMessage', '', false);
  document.getElementById('editLocation').focus();
}

function szerkesztesBezar() {
  document.getElementById('detailsView').hidden = false;
  document.getElementById('editProjectForm').hidden = true;
  uzenet('editMessage', '', false);
}

async function projektMentes(event) {
  event.preventDefault();
  const adat = {
    location: document.getElementById('editLocation').value.trim(),
    description: document.getElementById('editDescription').value.trim(),
    customer_name: document.getElementById('editCustomerName').value.trim(),
    customer_email: document.getElementById('editEmail').value.trim(),
    customer_phone: document.getElementById('editPhone').value.trim(),
  };
  const hiba = projektAdatHiba(adat);
  if (hiba) {
    uzenet('editMessage', hiba, true);
    return;
  }
  const gomb = document.getElementById('saveProjectButton');
  gomb.disabled = true;
  try {
    await Api.modositProjekt(projektId, {
      location: adat.location,
      description: adat.description,
      customer_name: adat.customer_name,
    });
    await Api.modositElerhetoseg(projektId, {
      customer_email: adat.customer_email || null,
      customer_phone: adat.customer_phone || null,
    });
    szerkesztesBezar();
    await ujratolt();
    uzenet('detailsMessage', 'A projekt adatai mentve.', false);
  } catch (err) {
    uzenet('editMessage', err.message, true);
  } finally {
    gomb.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  betolt();

  document.getElementById('addPartButton').addEventListener('click', alkatreszHozzaadas);
  document.getElementById('partQuantity').addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      alkatreszHozzaadas();
    }
  });
  document.getElementById('saveWorkButton').addEventListener('click', munkaMentes);
  document.getElementById('quoteButton').addEventListener('click', arkalkulacio);
  document.getElementById('editProjectButton').addEventListener('click', szerkesztesMegnyit);
  document.getElementById('cancelEditButton').addEventListener('click', szerkesztesBezar);
  document.getElementById('editProjectForm').addEventListener('submit', projektMentes);

  const tbody = document.getElementById('partsTableBody');
  tbody.addEventListener('change', event => {
    if (event.target.classList.contains('qty-input')) {
      darabMentes(Number(event.target.dataset.part), event.target);
    }
  });
  tbody.addEventListener('click', event => {
    const gomb = event.target.closest('[data-torol]');
    if (gomb) tetelTorles(Number(gomb.dataset.torol));
  });
  document.getElementById('statusActions').addEventListener('click', event => {
    const gomb = event.target.closest('[data-statusz]');
    if (gomb && !gomb.disabled) lezaras(gomb.dataset.statusz);
  });
});
