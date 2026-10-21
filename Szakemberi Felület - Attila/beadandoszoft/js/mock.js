/* ================= Demo backend =================
   Csak CONFIG.USE_MOCK mellett fut. Ugyanazokat a szabályokat követi, mint
   a PHP (foglalás mindent-vagy-semmit, Új → Tervezet az első tételnél,
   árkalkuláció → Várakozik vagy Ütemezett, lezárás csak Folyamatbanból),
   és minden állapotváltást beír a project_history másolatába.
   Az adat a böngésző localStorage-ában marad. */

const MockBackend = (() => {
  const KULCS = 'szakember_demo_v1';
  const SESSION_KULCS = 'szakember_demo_session';
  const AKTIV = ['New', 'Draft', 'Wait', 'Scheduled', 'InProgress'];
  const ALKATRESZ_ALLAPOT = ['New', 'Draft', 'Wait'];
  const KALKULACIO_ALLAPOT = ['New', 'Draft', 'Wait'];

  const FELHASZNALOK = [
    { id: 1, username: 'szakember', password: 'szakember123', role: 'specialist' },
    { id: 2, username: 'raktarvezeto', password: 'raktar123', role: 'warehouse_manager' },
    { id: 3, username: 'raktaros', password: 'raktaros123', role: 'warehouse_worker' },
  ];

  function most() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function kezdoAdatok() {
    return {
      nextId: { project: 8, history: 20, part: 14 },
      parts: [
        { id: 1, name: 'Napelem 400W', price: 135000, max_per_bin: 10 },
        { id: 2, name: 'Inverter 5kW', price: 250000, max_per_bin: 5 },
        { id: 3, name: 'DC kábel 5m', price: 8000, max_per_bin: 20 },
        { id: 4, name: 'Konzol csomag', price: 35000, max_per_bin: 15 },
        { id: 10, name: 'AC kábel 10m', price: 12000, max_per_bin: 20 },
        { id: 11, name: 'Rögzítő sín 2m', price: 9500, max_per_bin: 25 },
        { id: 12, name: 'Teljesítményoptimalizáló', price: 42000, max_per_bin: 12 },
        { id: 13, name: 'Villámvédelmi készlet', price: 28000, max_per_bin: 8 },
      ],
      bins: [
        { id: 1, part_id: 1, quantity: 20 },
        { id: 2, part_id: 2, quantity: 3 },
        { id: 3, part_id: 3, quantity: 15 },
        { id: 4, part_id: 4, quantity: 10 },
        { id: 5, part_id: 10, quantity: 6 },
        { id: 6, part_id: 11, quantity: 10 },
        { id: 7, part_id: 12, quantity: 3 },
        { id: 8, part_id: 13, quantity: 2 },
      ],
      projects: [
        sorProjekt(1, 'Pécs, Napfény utca 3.', 'Családi ház, felmérés előtt', 'Varga Zoltán', 'varga.zoltan@example.hu', '+36 30 111 2200', 'New', null, null, '2026-10-01 09:00:00'),
        sorProjekt(2, 'Budapest, Kossuth u. 15.', 'Családi ház napelem rendszer', 'Kiss Péter', 'kiss.peter@example.hu', '+36 20 555 0101', 'Draft', 8.5, 85000, '2026-09-15 11:15:42'),
        sorProjekt(3, 'Budaörs, Ipari park 4.', 'Csarnoktető, hiányzik a kábel', 'Nagy és Társa Kft.', 'info@nagyestarsa.hu', '+36 23 555 100', 'Wait', 24, 240000, '2026-09-20 09:00:00'),
        sorProjekt(4, 'Szeged, Napfény sor 12.', 'Családi ház, árkalkuláció kész', 'Szabó Anna', 'szabo.anna@example.hu', '+36 30 555 2200', 'Scheduled', 10.5, 105000, '2026-09-22 14:30:00'),
        sorProjekt(5, 'Vác, Köztársaság út 8.', 'Kivételezés alatt', 'Tóth Anna', 'toth.anna@example.hu', '+36 70 200 3344', 'InProgress', 6, 60000, '2026-09-25 08:10:00'),
        sorProjekt(6, 'Érd, Diófa utca 2.', 'Lezárt telepítés', 'Kovács család', 'kovacs@example.hu', '+36 30 400 5566', 'Completed', 12, 120000, '2026-08-02 10:00:00'),
        sorProjekt(7, 'Győr, Teszt utca 1.', 'A tető statikája nem bírta', 'Teszt Elek', null, null, 'Failed', 2, 20000, '2026-08-18 13:20:00'),
      ],
      project_parts: [
        tetel(2, 2, 1, 1, '2026-09-16 09:00:00'),
        tetel(2, 1, 30, 0, null),
        tetel(3, 1, 12, 1, '2026-09-21 08:40:00'),
        tetel(3, 3, 40, 0, null),
        tetel(4, 2, 1, 1, '2026-09-23 10:05:00'),
        tetel(4, 4, 4, 1, '2026-09-23 10:05:00'),
        tetel(5, 4, 2, 1, '2026-09-26 07:30:00'),
        tetel(5, 3, 5, 1, '2026-09-26 07:30:00'),
        tetel(6, 1, 4, 1, '2026-08-03 09:00:00'),
        tetel(7, 2, 1, 1, '2026-08-18 15:00:00'),
      ],
      history: [
        naplo(1, 1, 'New', '2026-10-01 09:00:00'),
        naplo(2, 2, 'New', '2026-09-15 11:15:42'),
        naplo(3, 2, 'Draft', '2026-09-16 09:00:00'),
        naplo(4, 3, 'New', '2026-09-20 09:00:00'),
        naplo(5, 3, 'Draft', '2026-09-20 11:15:00'),
        naplo(6, 3, 'Wait', '2026-09-21 08:40:00'),
        naplo(7, 4, 'New', '2026-09-22 14:30:00'),
        naplo(8, 4, 'Draft', '2026-09-22 16:00:00'),
        naplo(9, 4, 'Scheduled', '2026-09-23 10:05:00'),
        naplo(10, 5, 'New', '2026-09-25 08:10:00'),
        naplo(11, 5, 'Draft', '2026-09-25 09:00:00'),
        naplo(12, 5, 'Scheduled', '2026-09-25 12:00:00'),
        naplo(13, 5, 'InProgress', '2026-09-26 07:30:00'),
        naplo(14, 6, 'New', '2026-08-02 10:00:00'),
        naplo(15, 6, 'Scheduled', '2026-08-04 10:00:00'),
        naplo(16, 6, 'InProgress', '2026-08-05 08:00:00'),
        naplo(17, 6, 'Completed', '2026-08-06 16:00:00'),
        naplo(18, 7, 'New', '2026-08-18 13:20:00'),
        naplo(19, 7, 'InProgress', '2026-08-19 08:00:00'),
        naplo(20, 7, 'Failed', '2026-08-19 15:10:00'),
      ],
    };
  }

  function sorProjekt(id, location, description, customerName, email, phone, status, hours, labor, created) {
    return {
      id, location, description,
      customer_name: customerName,
      customer_email: email,
      customer_phone: phone,
      status,
      work_hours: hours,
      labor_cost: labor,
      created_at: created,
      updated_at: created,
    };
  }

  function tetel(projectId, partId, quantity, reserved, reservedAt) {
    return { project_id: projectId, part_id: partId, quantity, reserved, reserved_at: reservedAt };
  }

  function naplo(id, projectId, status, changedAt) {
    return { id, project_id: projectId, status, changed_at: changedAt };
  }

  let db = betolt();

  function betolt() {
    try {
      const nyers = localStorage.getItem(KULCS);
      if (nyers) return JSON.parse(nyers);
    } catch (e) { /* memóriában dolgozunk */ }
    return kezdoAdatok();
  }

  function ment() {
    try { localStorage.setItem(KULCS, JSON.stringify(db)); } catch (e) { /* nem kritikus */ }
  }

  function visszaallit() {
    db = kezdoAdatok();
    ment();
  }

  function session() {
    try { return JSON.parse(localStorage.getItem(SESSION_KULCS) || 'null'); } catch (e) { return null; }
  }

  function kellSession() {
    const user = session();
    if (!user) throw new ApiError('Nincs bejelentkezve.', 401);
    return user;
  }

  function kellSzakember() {
    const user = kellSession();
    if (user.role !== 'specialist' && user.role !== 'admin') {
      throw new ApiError('Ehhez a művelethez nincs jogosultságod.', 403);
    }
    return user;
  }

  const projekt = id => db.projects.find(p => p.id === Number(id));
  const alkatresz = id => db.parts.find(a => a.id === Number(id));

  function szabad(partId) {
    const keszlet = db.bins
      .filter(b => b.part_id === partId)
      .reduce((s, b) => s + Number(b.quantity), 0);
    const foglalt = db.project_parts
      .filter(t => t.part_id === partId && Number(t.reserved) === 1 && AKTIV.includes(projekt(t.project_id)?.status))
      .reduce((s, t) => s + Number(t.quantity), 0);
    return keszlet - foglalt;
  }

  function statusz(projectId, uj, regi) {
    if (uj === regi) return;
    const p = projekt(projectId);
    p.status = uj;
    p.updated_at = most();
    db.history.push(naplo(++db.nextId.history, projectId, uj, most()));
  }

  function munkaMegvan(p) {
    return p.work_hours !== null && p.work_hours !== '' && Number(p.work_hours) > 0
      && p.labor_cost !== null && p.labor_cost !== '' && Number(p.labor_cost) >= 0;
  }

  function darab(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 100000) {
      throw new ApiError('A mennyiség 1 és 100000 db között lehet.', 400);
    }
    return n;
  }

  function emailTelefon(email, phone) {
    const tisztit = (ertek, max, nev) => {
      if (ertek === null || ertek === undefined) return null;
      const szoveg = String(ertek).trim();
      if (szoveg === '') return null;
      if (szoveg.length > max) throw new ApiError(nev + ' legfeljebb ' + max + ' karakter lehet.', 400);
      return szoveg;
    };
    const cim = tisztit(email, 100, 'Az e-mail cím');
    const tel = tisztit(phone, 20, 'A telefonszám');
    if (cim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cim)) {
      throw new ApiError('Az e-mail cím formátuma érvénytelen.', 400);
    }
    if (tel && !/^[+0-9][0-9 +\-/()]{4,19}$/.test(tel)) {
      throw new ApiError('A telefonszám formátuma érvénytelen.', 400);
    }
    return [cim, tel];
  }

  function tetelNezettel(t) {
    const a = alkatresz(t.part_id);
    return {
      project_id: t.project_id,
      part_id: t.part_id,
      quantity: t.quantity,
      reserved: t.reserved,
      reserved_at: t.reserved_at,
      part_name: a ? a.name : '',
      part_price: a ? a.price : 0,
    };
  }

  function assignPart(body) {
    kellSzakember();
    const projectId = Number(body?.project_id);
    const partId = Number(body?.part_id);
    const mennyiseg = darab(body?.quantity);
    const p = projekt(projectId);
    if (!p) throw new ApiError('Nincs ilyen projekt.', 404);
    if (!ALKATRESZ_ALLAPOT.includes(p.status)) {
      throw new ApiError('Ebben az állapotban már nem módosítható az alkatrészlista.', 409);
    }
    if (!alkatresz(partId)) throw new ApiError('Nincs ilyen alkatrész.', 404);
    if (db.project_parts.some(t => t.project_id === projectId && t.part_id === partId)) {
      throw new ApiError('Ez az alkatrész már szerepel a projekt listáján – a mennyiséget a táblázatban módosítsd.', 409);
    }
    const sor = tetel(projectId, partId, mennyiseg, 0, null);
    db.project_parts.push(sor);
    const eleg = szabad(partId) >= mennyiseg;
    if (eleg) {
      sor.reserved = 1;
      sor.reserved_at = most();
    }
    const regi = p.status;
    if (regi === 'New') statusz(projectId, 'Draft', 'New');
    ment();
    let message = eleg
      ? 'Az alkatrész lefoglalva a szabad készletből (' + mennyiseg + ' db).'
      : 'Nincs elég szabad készlet (' + Math.max(szabad(partId), 0) + ' db). Az igény előfoglalásként került rögzítésre; a bevételezés később automatikusan lefoglalja.';
    if (regi === 'New') message += ' A projekt Tervezet állapotba lépett.';
    return { success: true, message, project_id: projectId, part_id: partId, quantity: mennyiseg, reserved: eleg, status: p.status };
  }

  function calculateQuote(body) {
    kellSzakember();
    const projectId = Number(body?.project_id);
    const p = projekt(projectId);
    if (!p) throw new ApiError('Nincs ilyen projekt.', 404);
    if (!KALKULACIO_ALLAPOT.includes(p.status)) {
      throw new ApiError('Árkalkuláció Új, Tervezet vagy Várakozik állapotban készíthető.', 409);
    }
    const sorok = db.project_parts.filter(t => t.project_id === projectId);
    if (sorok.length === 0) throw new ApiError('Előbb vegyél fel legalább egy alkatrészt.', 400);
    if (p.status === 'New') statusz(projectId, 'Draft', 'New');
    sorok.forEach(sor => {
      if (Number(sor.reserved) === 1) return;
      if (szabad(sor.part_id) >= sor.quantity) {
        sor.reserved = 1;
        sor.reserved_at = most();
      }
    });
    const hiany = sorok.filter(sor => Number(sor.reserved) !== 1).map(sor => ({
      part_id: sor.part_id,
      name: alkatresz(sor.part_id)?.name || '',
      quantity: sor.quantity,
      free: Math.max(szabad(sor.part_id), 0),
    }));
    const anyag = sorok.reduce((s, sor) => s + (alkatresz(sor.part_id)?.price || 0) * sor.quantity, 0);
    const munkadij = p.labor_cost === null || p.labor_cost === '' ? null : Number(p.labor_cost);
    if (hiany.length) {
      statusz(projectId, 'Wait', p.status);
      ment();
      const lista = hiany.map(m => m.name + ' (' + m.quantity + ' db kell, szabad ' + m.free + ')').join('; ');
      return {
        success: true, outcome: 'wait', status: 'Wait', missing: hiany,
        material_cost: null, labor_cost: munkadij, total: null,
        message: 'Az árkalkuláció nem fejezhető be, mert nincs minden alkatrész raktáron: ' + lista
          + '. A projekt Várakozik állapotban van, a hiányzó tételek előfoglalva maradnak.',
      };
    }
    if (!munkaMegvan(p)) {
      ment();
      return {
        success: true, outcome: 'needs_labor', status: p.status, missing: [],
        material_cost: anyag, labor_cost: munkadij, total: null,
        message: 'Minden alkatrész lefoglalva, az áruk ismert. Az árkalkulációhoz rögzítsd a becsült munkaórát és a munkadíjat is.',
      };
    }
    statusz(projectId, 'Scheduled', p.status);
    ment();
    const osszesen = anyag + Number(munkadij);
    return {
      success: true, outcome: 'scheduled', status: 'Scheduled', missing: [],
      material_cost: anyag, labor_cost: munkadij, total: osszesen,
      message: 'Az árkalkuláció elkészült. Anyagköltség: ' + anyag.toLocaleString('hu-HU')
        + ' Ft, munkadíj: ' + Number(munkadij).toLocaleString('hu-HU')
        + ' Ft, összesen: ' + osszesen.toLocaleString('hu-HU')
        + ' Ft. A projekt Ütemezett állapotba került.',
    };
  }

  function closeProject(body) {
    kellSzakember();
    const projectId = Number(body?.project_id);
    const cel = String(body?.status || '');
    const p = projekt(projectId);
    if (!p) throw new ApiError('Nincs ilyen projekt.', 404);
    if (cel !== 'Completed' && cel !== 'Failed') {
      throw new ApiError('A lezárás csak Befejezett vagy Sikertelen állapot lehet.', 400);
    }
    if (p.status !== 'InProgress') {
      throw new ApiError('A projektet csak Folyamatban állapotból lehet lezárni. Folyamatban állapotra a raktáros állítja, amikor a kivételezés elkezdődik.', 409);
    }
    statusz(projectId, cel, 'InProgress');
    ment();
    return {
      success: true,
      message: 'A projekt lezárva: ' + (cel === 'Completed' ? 'Befejezett' : 'Sikertelen') + '.',
      project_id: projectId,
      status: cel,
    };
  }

  function updateContact(id, body) {
    kellSzakember();
    const p = projekt(id);
    if (!p) throw new ApiError('Nincs ilyen projekt.', 404);
    if (p.status === 'Completed' || p.status === 'Failed') {
      throw new ApiError('A lezárt projekt adatai már nem módosíthatók.', 409);
    }
    if (!body || !('customer_email' in body) || !('customer_phone' in body)) {
      throw new ApiError('A customer_email és a customer_phone mező is kell (üresen is hagyható).', 400);
    }
    const [email, phone] = emailTelefon(body.customer_email, body.customer_phone);
    p.customer_email = email;
    p.customer_phone = phone;
    p.updated_at = most();
    ment();
    return { success: true, message: 'Az ügyfél elérhetősége mentve.', project_id: p.id, customer_email: email, customer_phone: phone };
  }

  function keres(method, ut, body) {
    const vagas = ut.indexOf('?');
    const path = vagas === -1 ? ut : ut.slice(0, vagas);
    const params = new URLSearchParams(vagas === -1 ? '' : ut.slice(vagas + 1));

    if (path === '/auth/login' && method === 'POST') {
      const username = String(body?.username || '').trim();
      const password = String(body?.password || '');
      if (!username || !password) throw new ApiError('Add meg a felhasználónevet és a jelszót.', 400);
      const user = FELHASZNALOK.find(f => f.username === username && f.password === password);
      if (!user) throw new ApiError('Hibás felhasználónév vagy jelszó.', 401);
      const publikus = { id: user.id, username: user.username, role: user.role };
      localStorage.setItem(SESSION_KULCS, JSON.stringify(publikus));
      return { success: true, user: publikus };
    }
    if (path === '/auth/me' && method === 'GET') {
      const user = session();
      if (!user) throw new ApiError('Nincs bejelentkezve.', 401);
      return { user };
    }
    if (path === '/auth/logout' && method === 'POST') {
      localStorage.removeItem(SESSION_KULCS);
      return { ok: true };
    }

    kellSession();

    if (path === '/projects.php' && method === 'GET') {
      return db.projects.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    }
    if (path === '/projects.php' && method === 'POST') {
      const location = String(body?.location || '').trim();
      const customer = String(body?.customer_name || '').trim();
      if (!location || !customer) throw new ApiError('Hiányzó kötelező mező: location vagy customer_name', 400);
      const id = ++db.nextId.project;
      const ido = most();
      db.projects.push(sorProjekt(
        id, location, String(body?.description || ''), customer,
        body?.customer_email || null, body?.customer_phone || null,
        'New', null, null, ido
      ));
      db.history.push(naplo(++db.nextId.history, id, 'New', ido));
      ment();
      return { success: true, message: 'Projekt sikeresen létrehozva!', id };
    }
    if (path === '/projects.php' && method === 'PUT') {
      const p = projekt(params.get('id'));
      if (!p) throw new ApiError('Nincs ilyen projekt!', 404);
      ['location', 'description', 'customer_name'].forEach(mezo => {
        if (body && mezo in body) p[mezo] = body[mezo];
      });
      if (body && 'work_hours' in body) p.work_hours = body.work_hours === '' ? null : Number(body.work_hours);
      if (body && 'labor_cost' in body) p.labor_cost = body.labor_cost === '' ? null : Number(body.labor_cost);
      if (body && 'status' in body && body.status !== p.status) statusz(p.id, String(body.status), p.status);
      p.updated_at = most();
      ment();
      return { success: true, message: 'Projekt sikeresen módosítva!', id: p.id };
    }

    if (path === '/project_parts.php' && method === 'GET') {
      return db.project_parts.map(tetelNezettel);
    }
    if (path === '/project_parts.php' && method === 'PUT') {
      const sor = db.project_parts.find(t => t.project_id === Number(params.get('project_id')) && t.part_id === Number(params.get('part_id')));
      if (!sor) throw new ApiError('Nincs ilyen projekt-alkatrész kapcsolat.', 404);
      if (body && 'quantity' in body) sor.quantity = darab(body.quantity);
      ment();
      return { success: true, message: 'Projekt-alkatrész kapcsolat módosítva!' };
    }
    if (path === '/project_parts.php' && method === 'DELETE') {
      const projectId = Number(params.get('project_id'));
      const partId = Number(params.get('part_id'));
      const elotte = db.project_parts.length;
      db.project_parts = db.project_parts.filter(t => !(t.project_id === projectId && t.part_id === partId));
      if (db.project_parts.length === elotte) throw new ApiError('Nincs ilyen projekt-alkatrész kapcsolat.', 404);
      ment();
      return { success: true, message: 'Projekt-alkatrész kapcsolat törölve!' };
    }

    if (path === '/project_history.php' && method === 'GET') {
      return db.history.slice().sort((a, b) => String(b.changed_at).localeCompare(String(a.changed_at)));
    }
    if (path === '/parts.php' && method === 'GET') return db.parts.slice();
    if (path === '/bins.php' && method === 'GET') return db.bins.slice();

    if (path === '/project_assign.php' && method === 'POST') return assignPart(body);
    if (path === '/project_quote.php' && method === 'POST') return calculateQuote(body);
    if (path === '/project_close.php' && method === 'POST') return closeProject(body);
    if (path === '/project_contact.php' && method === 'PUT') return updateContact(params.get('id'), body);

    throw new ApiError('Nem támogatott metódus!', 405);
  }

  return { keres, visszaallit };
})();
