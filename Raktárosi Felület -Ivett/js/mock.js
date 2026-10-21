/* ================= Demo backend =================
   CONFIG.USE_MOCK esetén ez válaszol a raktárosi végpontok helyett
   (README.md → „Végpontok, amiket a felület vár”). Az adatok a
   localStorage-ban maradnak. A készlet a napelemrendszer.sql +
   napelemrendszer_illesztes.sql tartalmát követi, egy plusz rekesz-készlettel:
   az AC kábel a C1-3 rekeszben is ott van, hogy az útvonalválasztás
   (A1-3 vagy C1-3) bemutatható legyen. */

const MockBackend = (() => {
  const KULCS = 'raktaros_demo_v1';
  const SESSION_KULCS = 'raktaros_demo_session';

  const FELHASZNALOK = [
    { id: 1, username: 'szakember', password: 'szakember123', role: 'specialist' },
    { id: 2, username: 'raktarvezeto', password: 'raktar123', role: 'warehouse_manager' },
    { id: 3, username: 'raktaros', password: 'raktaros123', role: 'warehouse_worker' },
  ];

  function kezdoAdatok() {
    const alkatreszek = [
      { id: 1, name: 'Napelem 400W' },
      { id: 2, name: 'Inverter 5kW' },
      { id: 3, name: 'DC kábel 5m' },
      { id: 4, name: 'Konzol csomag' },
      { id: 10, name: 'AC kábel 10m' },
      { id: 11, name: 'Rögzítő sín 2m' },
      { id: 12, name: 'Teljesítményoptimalizáló' },
      { id: 13, name: 'Villámvédelmi készlet' },
    ];

    // sor, oszlop, szint, azonosító – az illesztes.sql A1-1 / B2-3 konvenciója.
    // Azonosító: sor betűje + szint + "-" + oszlop. Pl. B2-3 = 2. sor, 3. oszlop, 2. polc.
    const rekeszek = [
      { id: 1, row_num: 1, col_num: 1, level_num: 1, identifier: 'A1-1', part_id: 1, quantity: 10, max_capacity: 10 },
      { id: 2, row_num: 1, col_num: 2, level_num: 1, identifier: 'A1-2', part_id: 2, quantity: 3, max_capacity: 5 },
      { id: 3, row_num: 2, col_num: 1, level_num: 1, identifier: 'B1-1', part_id: 3, quantity: 15, max_capacity: 20 },
      { id: 4, row_num: 2, col_num: 2, level_num: 1, identifier: 'B1-2', part_id: 4, quantity: 10, max_capacity: 15 },
      { id: 10, row_num: 1, col_num: 3, level_num: 1, identifier: 'A1-3', part_id: 10, quantity: 6, max_capacity: 20 },
      { id: 11, row_num: 1, col_num: 1, level_num: 2, identifier: 'A2-1', part_id: 1, quantity: 4, max_capacity: 10 },
      { id: 12, row_num: 1, col_num: 2, level_num: 2, identifier: 'A2-2', part_id: null, quantity: 0, max_capacity: 15 },
      { id: 13, row_num: 1, col_num: 3, level_num: 2, identifier: 'A2-3', part_id: null, quantity: 0, max_capacity: 20 },
      { id: 14, row_num: 2, col_num: 3, level_num: 1, identifier: 'B1-3', part_id: 11, quantity: 10, max_capacity: 25 },
      { id: 15, row_num: 2, col_num: 1, level_num: 2, identifier: 'B2-1', part_id: null, quantity: 0, max_capacity: 20 },
      { id: 16, row_num: 2, col_num: 2, level_num: 2, identifier: 'B2-2', part_id: null, quantity: 0, max_capacity: 15 },
      { id: 17, row_num: 2, col_num: 3, level_num: 2, identifier: 'B2-3', part_id: 12, quantity: 3, max_capacity: 12 },
      { id: 18, row_num: 3, col_num: 1, level_num: 1, identifier: 'C1-1', part_id: 13, quantity: 2, max_capacity: 8 },
      { id: 19, row_num: 3, col_num: 2, level_num: 1, identifier: 'C1-2', part_id: null, quantity: 0, max_capacity: 15 },
      // A seedben üres. Itt van benne AC kábel is, hogy két rekesz közül lehessen választani.
      { id: 20, row_num: 3, col_num: 3, level_num: 1, identifier: 'C1-3', part_id: 10, quantity: 8, max_capacity: 20 },
      { id: 21, row_num: 3, col_num: 1, level_num: 2, identifier: 'C2-1', part_id: null, quantity: 0, max_capacity: 10 },
      { id: 22, row_num: 3, col_num: 2, level_num: 2, identifier: 'C2-2', part_id: null, quantity: 0, max_capacity: 15 },
      { id: 23, row_num: 3, col_num: 3, level_num: 2, identifier: 'C2-3', part_id: null, quantity: 0, max_capacity: 20 },
    ];

    const projektek = [
      { id: 1, customer_name: 'Kiss Péter', location: 'Budapest, Kossuth u. 15', description: 'Családi ház napelem rendszer', status: 'Draft', created_at: '2026-09-15 11:15:42' },
      { id: 3, customer_name: 'Győri Iskola', location: 'Győr, Baross u. 7', description: 'Iskola napelem', status: 'New', created_at: '2026-09-16 09:18:19' },
      { id: 4, customer_name: 'Teszt Elek', location: 'Teszt utca 1', description: 'Teszt projekt', status: 'Draft', created_at: '2026-09-16 10:32:52' },
      { id: 10, customer_name: 'Nagy és Társa Kft.', location: 'Budaörs, Ipari park 4.', description: 'Csarnoktető, 24 panel', status: 'Wait', created_at: '2026-09-20 09:00:00' },
      { id: 11, customer_name: 'Szabó Anna', location: 'Szeged, Napfény sor 12.', description: 'Családi ház, 10 panel', status: 'Scheduled', created_at: '2026-09-22 14:30:00' },
      { id: 12, customer_name: 'Horváth család', location: 'Pécs, Mecsek alja 3.', description: 'Családi ház, 8 panel', status: 'Scheduled', created_at: '2026-09-25 08:00:00' },
      { id: 13, customer_name: 'Kovács Bt.', location: 'Veszprém, Balaton part 2.', description: 'Nyaraló, 6 panel', status: 'InProgress', created_at: '2026-09-18 10:00:00' },
      { id: 14, customer_name: 'Tóth Géza', location: 'Debrecen, Piac utca 9.', description: 'Garázsos ház', status: 'Completed', created_at: '2026-09-01 09:00:00' },
    ];

    // [projekt, alkatrész, igény, lefoglalva 0/1]
    const projekt_alkatreszek = [
      [1, 1, 12, 0], [1, 2, 1, 0], [1, 11, 8, 0],
      [3, 3, 20, 0], [3, 10, 4, 0],
      [4, 4, 5, 0],
      [10, 1, 8, 0], [10, 2, 2, 0],
      [11, 3, 10, 1], [11, 4, 4, 1], [11, 12, 2, 1],
      [12, 1, 6, 1], [12, 2, 1, 1], [12, 3, 2, 1], [12, 10, 4, 1], [12, 11, 4, 1], [12, 13, 1, 1],
      [13, 3, 5, 1], [13, 4, 2, 1],
      [14, 1, 4, 1], [14, 4, 2, 1],
    ].map(([project_id, part_id, quantity, reserved]) => ({ project_id, part_id, quantity, reserved }));

    return { alkatreszek, rekeszek, projektek, projekt_alkatreszek };
  }

  let db = betolt();

  function betolt() {
    try {
      const nyers = localStorage.getItem(KULCS);
      if (nyers) {
        const adat = JSON.parse(nyers);
        if (adat && Array.isArray(adat.projektek) && Array.isArray(adat.rekeszek) && Array.isArray(adat.projekt_alkatreszek)) {
          return adat;
        }
      }
    } catch { /* sérült tároló: kezdőadat */ }
    return kezdoAdatok();
  }

  function ment() {
    try { localStorage.setItem(KULCS, JSON.stringify(db)); } catch { /* nem kritikus */ }
  }

  const hiba = (status, uzenet) => new ApiError(uzenet, status);
  const masol = x => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
  const projekt = id => db.projektek.find(p => p.id === Number(id));
  const alkatresz = id => db.alkatreszek.find(a => a.id === Number(id));

  function projektValasz(p, extra = {}) {
    const tetelek = db.projekt_alkatreszek.filter(t => t.project_id === p.id);
    return {
      id: p.id,
      customer_name: p.customer_name,
      location: p.location,
      description: p.description,
      status: p.status,
      created_at: p.created_at,
      part_lines: tetelek.length,
      reserved_lines: tetelek.filter(t => t.reserved).length,
      ...extra,
    };
  }

  function projektek() {
    return db.projektek.map(p => projektValasz(p));
  }

  function raktarMeret() {
    return {
      rows: Math.max(1, ...db.rekeszek.map(r => r.row_num)),
      columns: Math.max(1, ...db.rekeszek.map(r => r.col_num)),
      levels: Math.max(1, ...db.rekeszek.map(r => r.level_num)),
    };
  }

  function helyek(projectId) {
    const p = projekt(projectId);
    if (!p) throw hiba(404, 'Nincs ilyen projekt!');
    const parts = db.projekt_alkatreszek
      .filter(t => t.project_id === p.id)
      .sort((a, b) => a.part_id - b.part_id)
      .map(t => ({
        part_id: t.part_id,
        name: alkatresz(t.part_id)?.name ?? '',
        quantity: t.quantity,
        reserved: t.reserved ? 1 : 0,
        bins: db.rekeszek
          .filter(r => r.part_id === t.part_id && r.quantity > 0)
          .sort((a, b) => a.row_num - b.row_num || a.col_num - b.col_num || a.level_num - b.level_num)
          .map(r => ({
            id: r.id,
            identifier: r.identifier,
            row_num: r.row_num,
            col_num: r.col_num,
            level_num: r.level_num,
            quantity: r.quantity,
            max_capacity: r.max_capacity,
          })),
      }));
    return {
      project_id: p.id,
      customer_name: p.customer_name,
      location: p.location,
      description: p.description,
      status: p.status,
      warehouse: raktarMeret(),
      parts,
    };
  }

  function kivetelezes(body) {
    const id = Number(body?.project_id);
    if (!Number.isInteger(id) || id <= 0) throw hiba(400, 'Hiányzó project_id.');
    const p = projekt(id);
    if (!p) throw hiba(404, 'Nincs ilyen projekt!');
    if (p.status === 'InProgress') {
      return { success: true, message: 'A kivételezés már folyamatban van.', ...projektValasz(p) };
    }
    if (p.status !== 'Scheduled') {
      throw hiba(409, 'Csak ütemezett (Scheduled) projekt kivételezése indítható.');
    }
    p.status = 'InProgress';
    ment();
    return { success: true, message: 'A projekt kivételezése elindult.', ...projektValasz(p) };
  }

  function aktualisFelhasznalo() {
    try { return JSON.parse(localStorage.getItem(SESSION_KULCS)); } catch { return null; }
  }

  function login(body) {
    const username = String(body?.username ?? '').trim();
    const password = String(body?.password ?? '');
    if (!username || !password) throw hiba(400, 'Add meg a felhasználónevet és a jelszót.');
    const f = FELHASZNALOK.find(x => x.username === username && x.password === password);
    if (!f) throw hiba(401, 'Hibás felhasználónév vagy jelszó.');
    const user = { id: f.id, username: f.username, role: f.role };
    try { localStorage.setItem(SESSION_KULCS, JSON.stringify(user)); } catch { /* nem kritikus */ }
    return { user };
  }

  function me() {
    const user = aktualisFelhasznalo();
    if (!user) throw hiba(401, 'Nincs bejelentkezve.');
    return { user };
  }

  function logout() {
    try { localStorage.removeItem(SESSION_KULCS); } catch { /* nem kritikus */ }
    return { ok: true };
  }

  function dispatch(method, path, body) {
    const [ut, query] = path.split('?');
    const params = new URLSearchParams(query || '');
    const reszek = ut.replace(/^\/+|\/+$/g, '').split('/');
    const [gyoker, eroforras] = reszek;

    if (gyoker === 'auth') {
      if (method === 'POST' && eroforras === 'login') return login(body);
      if (method === 'POST' && eroforras === 'logout') return logout();
      if (method === 'GET' && eroforras === 'me') return me();
      throw hiba(404, `Ismeretlen végpont: ${method} ${path}`);
    }

    if (!aktualisFelhasznalo()) throw hiba(401, 'Nincs bejelentkezve.');

    if (gyoker === 'raktaros' && method === 'GET' && eroforras === 'projektek') return projektek();
    if (gyoker === 'raktaros' && method === 'POST' && eroforras === 'kivetelezes') return kivetelezes(body);
    if (gyoker === 'raktaros' && method === 'GET' && eroforras === 'helyek') return helyek(params.get('project_id'));
    throw hiba(404, `Ismeretlen végpont: ${method} ${path}`);
  }

  function handle(method, path, body) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(masol(dispatch(method, path, masol(body))));
        } catch (e) {
          reject(e instanceof ApiError ? e : hiba(500, e.message));
        }
      }, 70 + Math.random() * 50);
    });
  }

  function reset() {
    db = kezdoAdatok();
    ment();
  }

  return { handle, reset };
})();
