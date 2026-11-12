/* ================= Demo backend =================
   Backend nélkül, böngészőben (localStorage) futó mása Eszter végpontjainak.
   Ugyanazokat az útvonalakat és mezőneveket adja, mint a valódi PHP
   (parts.php, bins.php, projects.php, project_parts.php, me.php, logout.php),
   így az api.js egyetlen kódúttal működik mindkét módban.

   A kezdőadat Eszter napelemrendszer.sql + napelemrendszer_illesztes.sql
   fájljának tartalma, kiegészítve EGY extra ütemezett projekttel (id: 12),
   hogy a demóban több rekeszes útvonal is látszódjon. A valódi
   adatbázisban ez a projekt nincs meg. */

const MockBackend = (() => {
  const KULCS = 'raktaros.mock.v1';

  const DEMO_FELHASZNALO = { id: 3, username: 'raktaros1', role: 'warehouse_worker' };

  const kezdoAdat = () => ({
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
    // [id, sor, oszlop, polc, azonosító, alkatrész, darab, max]
    bins: [
      [1, 1, 1, 1, 'A1-1', 1, 10, 10], [2, 1, 2, 1, 'A1-2', 2, 3, 5], [3, 2, 1, 1, 'B1-1', 3, 15, 20],
      [4, 2, 2, 1, 'B1-2', 4, 10, 15], [10, 1, 3, 1, 'A1-3', 10, 6, 20], [11, 1, 1, 2, 'A2-1', 1, 4, 10],
      [12, 1, 2, 2, 'A2-2', null, 0, 15], [13, 1, 3, 2, 'A2-3', null, 0, 20], [14, 2, 3, 1, 'B1-3', 11, 10, 25],
      [15, 2, 1, 2, 'B2-1', null, 0, 20], [16, 2, 2, 2, 'B2-2', null, 0, 15], [17, 2, 3, 2, 'B2-3', 12, 3, 12],
      [18, 3, 1, 1, 'C1-1', 13, 2, 8], [19, 3, 2, 1, 'C1-2', null, 0, 15], [20, 3, 3, 1, 'C1-3', null, 0, 20],
      [21, 3, 1, 2, 'C2-1', null, 0, 10], [22, 3, 2, 2, 'C2-2', null, 0, 15], [23, 3, 3, 2, 'C2-3', null, 0, 20],
    ].map(([id, row_num, col_num, level_num, identifier, part_id, quantity, max_capacity]) =>
      ({ id, row_num, col_num, level_num, identifier, part_id, quantity, max_capacity })),
    projects: [
      { id: 1, location: 'Budapest, Kossuth u. 15', description: 'Családi ház napelem rendszer', customer_name: 'Kiss Péter', status: 'Draft', created_at: '2026-09-15 11:15:42' },
      { id: 3, location: 'Győr, Baross u. 7', description: 'Iskola napelem', customer_name: 'Győri Iskola', status: 'New', created_at: '2026-09-16 09:18:19' },
      { id: 4, location: 'Teszt utca 1', description: 'Teszt projekt', customer_name: 'Teszt Elek', status: 'Draft', created_at: '2026-09-16 10:32:52' },
      { id: 10, location: 'Budaörs, Ipari park 4.', description: 'Csarnoktető, 24 panel', customer_name: 'Nagy és Társa Kft.', status: 'Wait', created_at: '2026-09-20 09:00:00' },
      { id: 11, location: 'Szeged, Napfény sor 12.', description: 'Családi ház, 10 panel', customer_name: 'Szabó Anna', status: 'Scheduled', created_at: '2026-09-22 14:30:00' },
      // csak a demóban:
      { id: 12, location: 'Érd, Fenyő u. 3.', description: 'Családi ház, 14 panel + inverter', customer_name: 'Kovács család', status: 'Scheduled', created_at: '2026-09-24 08:00:00' },
    ],
    project_parts: [
      [1, 1, 12, 0], [1, 2, 1, 0], [1, 11, 8, 0], [3, 3, 20, 0], [3, 10, 4, 0], [4, 4, 5, 0],
      [10, 1, 8, 0], [10, 2, 2, 0],
      [11, 3, 10, 1], [11, 4, 4, 1], [11, 12, 2, 1],
      [12, 1, 14, 1], [12, 2, 2, 1], [12, 10, 5, 1],
    ].map(([project_id, part_id, quantity, reserved]) => ({ project_id, part_id, quantity, reserved })),
  });

  function betolt() {
    try {
      const t = localStorage.getItem(KULCS);
      if (t) return JSON.parse(t);
    } catch { /* nincs localStorage: marad a kezdőadat */ }
    return kezdoAdat();
  }

  let db = betolt();

  function ment() {
    try { localStorage.setItem(KULCS, JSON.stringify(db)); } catch { /* nem baj */ }
  }

  // A PHP (mysqli, szöveges protokoll) a számokat stringként adja – ezt utánozzuk,
  // hogy a frontend számkonverziós hibái a demóban is kiderüljenek.
  const phpSzeru = sorok => sorok.map(r =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null ? null : String(v)])));

  const sorToJson = sorok => phpSzeru(sorok);

  // A project_parts GET a valódi API-ban összekapcsolja az alkatrész nevét és árát.
  function projectPartsNezet() {
    return db.project_parts.map(pp => {
      const part = db.parts.find(p => p.id === pp.part_id);
      return { ...pp, reserved_at: pp.reserved ? '2026-09-23 10:05:00' : null,
               part_name: part?.name ?? '', part_price: part?.price ?? 0 };
    });
  }

  async function handle(method, fajl, body) {
    const u = new URL(fajl, 'http://mock');
    const ut = u.pathname.replace(/^\//, '');

    if (ut === 'me.php' && method === 'GET') return { user: { ...DEMO_FELHASZNALO } };
    if (ut === 'logout.php' && method === 'POST') return { ok: true };
    if (ut === 'login.php' && method === 'POST') return { success: true, user: { ...DEMO_FELHASZNALO } };

    if (ut === 'parts.php' && method === 'GET') return sorToJson(db.parts);
    if (ut === 'projects.php' && method === 'GET') return sorToJson(db.projects);
    if (ut === 'project_parts.php' && method === 'GET') return sorToJson(projectPartsNezet());
    if (ut === 'bins.php' && method === 'GET') return sorToJson(db.bins);

    if (ut === 'bins.php' && method === 'PUT') {
      const id = Number(u.searchParams.get('id'));
      const bin = db.bins.find(b => b.id === id);
      if (!bin) throw new ApiError('Nincs ilyen rekesz!', 404);
      if (body?.quantity === undefined) throw new ApiError('Nincs módosítandó mező!', 400);
      const q = Number(body.quantity);
      if (!Number.isInteger(q) || q < 0) throw new ApiError('Érvénytelen mennyiség.', 400);
      bin.quantity = q;
      ment();
      return { success: true, message: 'Rekesz sikeresen módosítva!', id };
    }

    throw new ApiError(`Demo módban nem támogatott hívás: ${method} ${ut}`, 404);
  }

  function visszaallit() {
    db = kezdoAdat();
    ment();
  }

  return { handle, visszaallit };
})();
