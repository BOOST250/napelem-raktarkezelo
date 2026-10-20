/* ================= Demo backend (mock) =================
   Csak demo módban (CONFIG.USE_MOCK = true) használjuk. Ugyanazokat a végpontokat
   szimulálja, mint a PHP API (README.md → "API-szerződés"), ugyanazokkal az üzleti
   szabályokkal. Az adatok a böngésző localStorage-ában maradnak meg. */

const MockBackend = (() => {
  const KULCS = 'raktarvezeto_demo_v1';
  // A bejelentkezés külön kulcson van, így a demo adatok visszaállítása nem jelentkeztet ki.
  const SESSION_KULCS = 'raktarvezeto_demo_session';
  // Demo felhasználók (a valódi rendszerben a users táblában vannak, az admin veszi fel őket).
  // Mindhárom szerepkör szerepel, hogy a jogosultság-ellenőrzés is kipróbálható legyen.
  const FELHASZNALOK = [
    { id: 1, username: 'raktarvezeto', password: 'raktar123', role: 'warehouse_manager' },
    { id: 2, username: 'szakember', password: 'szakember123', role: 'specialist' },
    { id: 3, username: 'raktaros', password: 'raktaros123', role: 'warehouse_worker' },
  ];
  // Ezekben a státuszokban számít a projekt foglalása / hiánya
  const AKTIV_STATUSZOK = ['New', 'Draft', 'Wait', 'Scheduled', 'InProgress'];

  function kezdoAdatok() {
    const alkatreszek = [
      { id: 1, nev: 'Napelem panel 410W', ar: 52000, max_darab: 10 },
      { id: 2, nev: 'Inverter 5 kW', ar: 389000, max_darab: 2 },
      { id: 3, nev: 'Inverter 10 kW', ar: 612000, max_darab: 1 },
      { id: 4, nev: 'Tartószerkezet (panelenként)', ar: 14500, max_darab: 20 },
      { id: 5, nev: 'Szolárkábel 6 mm² (10 m)', ar: 6900, max_darab: 30 },
      { id: 6, nev: 'MC4 csatlakozópár', ar: 890, max_darab: 100 },
      { id: 7, nev: 'DC túlfeszültség-védő', ar: 18400, max_darab: 15 },
      { id: 8, nev: 'Akkumulátor 5 kWh', ar: 745000, max_darab: 1 },
    ];

    // 2 sor × 3 oszlop × 2 polc × 2 rekesz = 24 rekesz
    const rekeszek = [];
    let id = 1;
    for (let sor = 1; sor <= 2; sor++)
      for (let oszlop = 1; oszlop <= 3; oszlop++)
        for (let polc = 1; polc <= 2; polc++)
          for (let rekesz = 1; rekesz <= 2; rekesz++)
            rekeszek.push({ id: id++, sor, oszlop, polc, rekesz, alkatresz_id: null, darab: 0 });

    // [rekesz_id, alkatresz_id, darab]
    [[1, 1, 10], [2, 1, 10], [3, 1, 6], [5, 2, 2], [6, 2, 1], [7, 3, 1],
     [9, 4, 20], [10, 4, 14], [13, 5, 25], [14, 6, 60], [17, 7, 4]]
      .forEach(([rid, aid, db]) => Object.assign(rekeszek[rid - 1], { alkatresz_id: aid, darab: db }));

    const projektek = [
      { id: 1, nev: 'Kovács család – Érd', statusz: 'Scheduled' },
      { id: 2, nev: 'Nagy és Társa Kft. – Budaörs', statusz: 'Wait' },
      { id: 3, nev: 'Tóth Anna – Vác', statusz: 'Draft' },
      { id: 4, nev: 'Horváth Bt. – Szeged', statusz: 'Completed' },
      { id: 5, nev: 'Varga Zoltán – Pécs', statusz: 'New' },
    ];

    // [projekt_id, alkatresz_id, igényelt darab, lefoglalt darab]
    const projekt_alkatreszek = [
      [1, 1, 12, 12], [1, 2, 1, 1], [1, 4, 12, 12], [1, 5, 4, 4], [1, 6, 12, 12], [1, 7, 1, 1],
      [2, 1, 20, 14], [2, 3, 2, 1], [2, 4, 20, 20], [2, 5, 6, 6], [2, 6, 20, 20], [2, 7, 2, 2], [2, 8, 1, 0],
      [3, 1, 8, 0], [3, 2, 1, 1], [3, 7, 1, 1],
      [4, 1, 10, 0], [4, 2, 1, 0], [4, 4, 10, 0],
    ].map(([projekt_id, alkatresz_id, darab, lefoglalt]) => ({ projekt_id, alkatresz_id, darab, lefoglalt }));

    return { alkatreszek, rekeszek, projektek, projekt_alkatreszek };
  }

  let db = betolt();

  function betolt() {
    try {
      const nyers = localStorage.getItem(KULCS);
      if (nyers) return JSON.parse(nyers);
    } catch { /* nincs localStorage – memóriában dolgozunk */ }
    return kezdoAdatok();
  }

  function ment() {
    try { localStorage.setItem(KULCS, JSON.stringify(db)); } catch { /* nem kritikus */ }
  }

  const hiba = (status, uzenet) => new ApiError(uzenet, status);
  const masol = x => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
  const kovetkezoId = lista => lista.reduce((m, x) => Math.max(m, x.id), 0) + 1;
  const helyKod = r => `S${r.sor}·O${r.oszlop}·P${r.polc}·R${r.rekesz}`;
  const egesz = (v, min) => Number.isInteger(v) && v >= min;

  const alkatresz = id => db.alkatreszek.find(a => a.id === id);
  const projekt = id => db.projektek.find(p => p.id === id);
  const aktivTetelek = () => db.projekt_alkatreszek.filter(pa => AKTIV_STATUSZOK.includes(projekt(pa.projekt_id)?.statusz));
  const keszlet = aid => db.rekeszek.filter(r => r.alkatresz_id === aid).reduce((s, r) => s + r.darab, 0);
  const lefoglalt = aid => aktivTetelek().filter(pa => pa.alkatresz_id === aid).reduce((s, pa) => s + pa.lefoglalt, 0);

  /* ---------- Végpontok ---------- */

  function alkatreszLista() {
    return db.alkatreszek.map(a => ({ ...a, keszlet: keszlet(a.id), lefoglalt: lefoglalt(a.id) }));
  }

  function ujAlkatresz(body) {
    const nev = String(body?.nev ?? '').trim();
    const ar = Number(body?.ar);
    const max = Number(body?.max_darab);
    if (!nev) throw hiba(400, 'Az alkatrész neve kötelező.');
    if (db.alkatreszek.some(a => a.nev.toLowerCase() === nev.toLowerCase())) throw hiba(409, 'Már létezik ilyen nevű alkatrész.');
    if (!egesz(ar, 0)) throw hiba(400, 'Az ár nem negatív egész szám kell legyen.');
    if (!egesz(max, 1)) throw hiba(400, 'A rekeszenkénti maximum legalább 1.');
    const uj = { id: kovetkezoId(db.alkatreszek), nev, ar, max_darab: max };
    db.alkatreszek.push(uj);
    ment();
    return uj;
  }

  function modositAlkatresz(id, body) {
    const a = alkatresz(id);
    if (!a) throw hiba(404, 'Nincs ilyen alkatrész.');
    const ar = Number(body?.ar);
    const max = Number(body?.max_darab);
    if (!egesz(ar, 0)) throw hiba(400, 'Az ár nem negatív egész szám kell legyen.');
    if (!egesz(max, 1)) throw hiba(400, 'A rekeszenkénti maximum legalább 1.');
    const legtobb = db.rekeszek.filter(r => r.alkatresz_id === id).reduce((m, r) => Math.max(m, r.darab), 0);
    if (max < legtobb) throw hiba(409, `Van olyan rekesz, amelyben ${legtobb} db van ebből – a maximum ennél nem lehet kisebb.`);
    a.ar = ar;
    a.max_darab = max;
    ment();
    return a;
  }

  function ujRekesz(body) {
    const r = { sor: Number(body?.sor), oszlop: Number(body?.oszlop), polc: Number(body?.polc), rekesz: Number(body?.rekesz) };
    if (![r.sor, r.oszlop, r.polc, r.rekesz].every(v => egesz(v, 1))) throw hiba(400, 'A sor, oszlop, polc és rekesz legalább 1 legyen.');
    if (db.rekeszek.some(x => x.sor === r.sor && x.oszlop === r.oszlop && x.polc === r.polc && x.rekesz === r.rekesz)) {
      throw hiba(409, `A(z) ${helyKod(r)} hely már létezik.`);
    }
    const uj = { id: kovetkezoId(db.rekeszek), ...r, alkatresz_id: null, darab: 0 };
    db.rekeszek.push(uj);
    ment();
    return uj;
  }

  function bevetelezes(body) {
    const a = alkatresz(Number(body?.alkatresz_id));
    if (!a) throw hiba(404, 'Nincs ilyen alkatrész.');
    const tetelek = Array.isArray(body?.tetelek) ? body.tetelek : [];
    if (!tetelek.length) throw hiba(400, 'Nincs elhelyezendő tétel.');

    // Először minden tételt ellenőrzünk, csak utána módosítunk (mindent vagy semmit).
    const lepesek = [];
    const latott = new Set();
    for (const t of tetelek) {
      const r = db.rekeszek.find(x => x.id === Number(t.rekesz_id));
      const darab = Number(t.darab);
      if (!r) throw hiba(404, 'Nem létező rekesz.');
      if (latott.has(r.id)) throw hiba(400, `A(z) ${helyKod(r)} rekesz többször szerepel.`);
      latott.add(r.id);
      if (!egesz(darab, 1)) throw hiba(400, 'A darabszám legalább 1 egész szám legyen.');
      if (r.alkatresz_id !== null && r.alkatresz_id !== a.id && r.darab > 0) {
        throw hiba(409, `A(z) ${helyKod(r)} rekeszben más alkatrész van.`);
      }
      const jelenleg = r.alkatresz_id === a.id ? r.darab : 0;
      if (jelenleg + darab > a.max_darab) {
        throw hiba(409, `A(z) ${helyKod(r)} rekeszbe legfeljebb ${a.max_darab - jelenleg} db fér még.`);
      }
      lepesek.push({ r, uj: jelenleg + darab });
    }
    lepesek.forEach(({ r, uj }) => Object.assign(r, { alkatresz_id: a.id, darab: uj }));

    // Szabad készlet lefoglalása a várakozó projektekhez (előbb Wait, aztán Draft, azonosító szerint).
    const sorrend = ['Wait', 'Draft'];
    let szabad = keszlet(a.id) - lefoglalt(a.id);
    let lefoglalva = 0;
    const igenyek = db.projekt_alkatreszek
      .filter(pa => pa.alkatresz_id === a.id && pa.lefoglalt < pa.darab && sorrend.includes(projekt(pa.projekt_id)?.statusz))
      .sort((x, y) => sorrend.indexOf(projekt(x.projekt_id).statusz) - sorrend.indexOf(projekt(y.projekt_id).statusz) || x.projekt_id - y.projekt_id);
    for (const pa of igenyek) {
      if (szabad <= 0) break;
      const d = Math.min(szabad, pa.darab - pa.lefoglalt);
      pa.lefoglalt += d;
      szabad -= d;
      lefoglalva += d;
    }

    // Ha egy Wait projekt minden alkatrésze le van foglalva → Scheduled
    const utemezett = [];
    for (const p of db.projektek.filter(p => p.statusz === 'Wait')) {
      const tetelei = db.projekt_alkatreszek.filter(pa => pa.projekt_id === p.id);
      if (tetelei.length && tetelei.every(pa => pa.lefoglalt >= pa.darab)) {
        p.statusz = 'Scheduled';
        utemezett.push({ id: p.id, nev: p.nev });
      }
    }

    ment();
    return { ok: true, lefoglalva, utemezett_projektek: utemezett };
  }

  function hianyzoLista() {
    const csoport = new Map();
    for (const pa of aktivTetelek()) {
      const hiany = pa.darab - pa.lefoglalt;
      if (hiany <= 0) continue;
      const a = alkatresz(pa.alkatresz_id);
      const p = projekt(pa.projekt_id);
      if (!csoport.has(a.id)) csoport.set(a.id, { alkatresz_id: a.id, nev: a.nev, hianyzo_darab: 0, projektek: [] });
      const sor = csoport.get(a.id);
      sor.hianyzo_darab += hiany;
      sor.projektek.push({ id: p.id, nev: p.nev, statusz: p.statusz, darab: hiany });
    }
    return [...csoport.values()];
  }

  function lefoglaltLista() {
    return aktivTetelek()
      .filter(pa => pa.lefoglalt > 0)
      .map(pa => {
        const p = projekt(pa.projekt_id);
        const a = alkatresz(pa.alkatresz_id);
        return {
          projekt_id: p.id, projekt_nev: p.nev, statusz: p.statusz,
          alkatresz_id: a.id, nev: a.nev, darab: pa.lefoglalt, igenyelt: pa.darab,
        };
      });
  }

  /* ---------- Bejelentkezés (login.php / me.php / logout.php megfelelője) ---------- */

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

  /* ---------- Útválasztás ---------- */

  function utvonal(method, path, body) {
    const [eroforras, id] = path.replace(/^\/+|\/+$/g, '').split('/');
    // az adat-végpontok csak bejelentkezve érhetők el (mint egy védett API-nál)
    if (eroforras !== 'auth' && !aktualisFelhasznalo()) throw hiba(401, 'Nincs bejelentkezve.');
    switch (`${method} ${eroforras}${id !== undefined ? '/:id' : ''}`) {
      case 'POST auth/:id':
        if (id === 'login') return login(body);
        if (id === 'logout') return logout();
        break;
      case 'GET auth/:id':
        if (id === 'me') return me();
        break;
      case 'GET alkatreszek': return alkatreszLista();
      case 'POST alkatreszek': return ujAlkatresz(body);
      case 'PUT alkatreszek/:id': return modositAlkatresz(Number(id), body);
      case 'GET rekeszek': return db.rekeszek;
      case 'POST rekeszek': return ujRekesz(body);
      case 'POST bevetelezes': return bevetelezes(body);
      case 'GET hianyzo': return hianyzoLista();
      case 'GET lefoglalt': return lefoglaltLista();
    }
    throw hiba(404, `Ismeretlen végpont: ${method} ${path}`);
  }

  function handle(method, path, body) {
    return new Promise((resolve, reject) => {
      // kis késleltetés, hogy a betöltési állapotok is látszódjanak
      setTimeout(() => {
        try {
          resolve(masol(utvonal(method, path, masol(body))));
        } catch (e) {
          reject(e instanceof ApiError ? e : hiba(500, e.message));
        }
      }, 120 + Math.random() * 180);
    });
  }

  function reset() {
    db = kezdoAdatok();
    ment();
  }

  return { handle, reset };
})();
