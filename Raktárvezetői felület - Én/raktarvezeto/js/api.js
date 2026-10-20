/* ================= API réteg =================
   Minden szerverhívás ezen a fájlon megy át (fetch).

   A felület kilenc műveletet használ (lásd a return blokkot a fájl alján).
   Ebből kettő megvalósítás létezik, és a CONFIG.USE_MOCK választ köztük:

     Demo  – a MockBackend válaszol localStorage-ból, backend nélkül.
     Eles  – Eszter PHP végpontjai: parts.php, bins.php, projects.php,
             project_parts.php, receiving.php.

   Miért van szükség a két rétegre?
   Eszter API-ja táblánként egy fájl, angol mezőnevekkel és ?id= paraméterrel,
   a felület viszont magyar kulcsú, összesített objektumokkal dolgozik
   (pl. egy alkatrészhez tartozó készlet és lefoglalt darabszám). Ez az
   összesítés itt, kliensoldalon történik – így Eszter backendjéhez nem
   kellett új végpontot írni, egyetlen kivétellel: a bevételezés, mert az
   egy tranzakcióban több táblát ír (receiving.php).

   Az app.js ebből a fájlból semmit nem lát a fentiekből: ugyanazokat a
   magyar kulcsú objektumokat kapja, mint eddig. */

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const Api = (() => {
  /* ---------------- Közös HTTP-réteg ---------------- */

  /* Lejárt / hiányzó bejelentkezés esetén vissza a belépő oldalra.

     Valódi módban a KÖZÖS belépő fogadja (../belepes/): ott a users tábla
     bármelyik fiókjával be lehet lépni, és a szerepkör alapján irányít a
     megfelelő felületre.

     Demo módban marad a felület saját login.html-je, mert a közös belépő a
     valódi PHP API-t hívja – demo módban pedig nincs backend. A ?mock=…
     paraméter ilyenkor megmarad. */
  function bejelentkezesre(hash = '') {
    const ut = CONFIG.USE_MOCK
      ? 'login.html' + location.search
      : '../belepes/';
    location.replace(ut + hash);
  }

  async function kuld(method, alap, url, body) {
    const options = {
      method,
      headers: { Accept: 'application/json' },
      // A PHP session-cookie-t minden kérésnél küldeni kell: a receiving.php
      // bejelentkezést követel. (A cors.php ezért tükrözi vissza az origint
      // "*" helyett – credentials mellett a "*" nem megengedett.)
      credentials: 'include',
    };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(url, options);
    } catch {
      throw new ApiError(`A szerver nem érhető el (${alap}). Fut az Apache és a MySQL a XAMPP-ban?`, 0);
    }

    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new ApiError(`A szerver nem JSON választ adott: ${text.slice(0, 150)}`, res.status);
      }
    }
    if (!res.ok) {
      throw new ApiError(data?.error || data?.message || `Hiba a kérés során (HTTP ${res.status})`, res.status);
    }
    // {"data": [...]} formátumú választ is elfogadunk
    if (data && !Array.isArray(data) && typeof data === 'object' && 'data' in data) return data.data;
    return data;
  }

  // Eszter adatvégpontjai. 401-nél (lejárt session) vissza a belépő oldalra.
  async function eles(method, fajl, body) {
    try {
      return await kuld(method, CONFIG.API_BASE, CONFIG.API_BASE + fajl, body);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) bejelentkezesre();
      throw err;
    }
  }

  // Bejelentkezési végpontok: login.php / me.php / logout.php (demo módban /auth/login stb.).
  function authRequest(method, nev, body) {
    if (CONFIG.USE_MOCK) return MockBackend.handle(method, `/auth/${nev}`, body);
    return kuld(method, CONFIG.AUTH_BASE, `${CONFIG.AUTH_BASE}/${nev}.php`, body);
  }

  /* ---------------- Normalizálás ----------------
     A PHP a számokat gyakran stringként adja vissza – itt egységesítjük. */

  const szam = v => (v === null || v === undefined || v === '' ? 0 : Number(v));
  const szamVagyNull = v => (v === null || v === undefined || v === '' ? null : Number(v));
  const lista = alakit => data => (Array.isArray(data) ? data.map(alakit) : []);

  const alkatresz = a => ({
    id: szam(a.id),
    nev: String(a.nev ?? ''),
    ar: szam(a.ar),
    max_darab: szam(a.max_darab),
    keszlet: szam(a.keszlet),
    lefoglalt: szam(a.lefoglalt),
  });

  const rekesz = r => ({
    id: szam(r.id),
    sor: szam(r.sor),
    oszlop: szam(r.oszlop),
    polc: szam(r.polc),
    rekesz: szam(r.rekesz),
    alkatresz_id: szamVagyNull(r.alkatresz_id),
    darab: szam(r.darab),
    // Rekeszenkénti kapacitás (Eszter bins.max_capacity mezője). Demo módban
    // nincs ilyen korlát, ezért ott Infinity – a számítások MIN()-t vesznek.
    max_kapacitas: r.max_kapacitas === undefined || r.max_kapacitas === null
      ? Infinity
      : Number(r.max_kapacitas),
  });

  const hiany = h => ({
    alkatresz_id: szam(h.alkatresz_id),
    nev: String(h.nev ?? ''),
    hianyzo_darab: szam(h.hianyzo_darab),
    projektek: (h.projektek || []).map(p => ({
      id: szam(p.id),
      nev: String(p.nev ?? ''),
      statusz: p.statusz ?? '',
      darab: szam(p.darab),
    })),
  });

  const foglalas = f => ({
    projekt_id: szam(f.projekt_id),
    projekt_nev: String(f.projekt_nev ?? ''),
    statusz: f.statusz ?? '',
    alkatresz_id: szam(f.alkatresz_id),
    nev: String(f.nev ?? ''),
    darab: szam(f.darab),
    igenyelt: szamVagyNull(f.igenyelt),
  });

  const felhasznalo = u => ({
    id: szam(u?.id),
    username: String(u?.username ?? ''),
    role: String(u?.role ?? ''),
  });

  /* ================= Demo megvalósítás ================= */

  const mock = (method, path, body) => MockBackend.handle(method, path, body);

  const Demo = {
    alkatreszek: () => mock('GET', '/alkatreszek').then(lista(alkatresz)),
    ujAlkatresz: adat => mock('POST', '/alkatreszek', adat),
    modositAlkatresz: (id, adat) => mock('PUT', `/alkatreszek/${id}`, adat),
    rekeszek: () => mock('GET', '/rekeszek').then(lista(rekesz)),
    ujRekesz: adat => mock('POST', '/rekeszek', adat),
    bevetelezes: adat => mock('POST', '/bevetelezes', adat),
    hianyzoAlkatreszek: () => mock('GET', '/hianyzo').then(lista(hiany)),
    lefoglaltAlkatreszek: () => mock('GET', '/lefoglalt').then(lista(foglalas)),
  };

  /* ================= Éles megvalósítás ================= */

  // Nyers táblavégpontok (Eszter mezőneveivel, átalakítás nélkül).
  const nyers = {
    parts: () => eles('GET', '/parts.php'),
    bins: () => eles('GET', '/bins.php'),
    projects: () => eles('GET', '/projects.php'),
    projectParts: () => eles('GET', '/project_parts.php'),
  };

  // Aktív projekt = még dolgozunk vele. A lezárt (Completed) és meghiúsult
  // (Failed) projektek foglalásai nem terhelik a készletet.
  const LEZART = ['Completed', 'Failed'];

  // project_id → { nev, statusz }. Eszternél nincs projektnév mező, ezért a
  // megrendelő és a helyszín összefűzése adja a megjelenített nevet.
  function projektIndex(projects) {
    const map = new Map();
    for (const p of projects || []) {
      map.set(Number(p.id), {
        nev: [p.customer_name, p.location].filter(Boolean).join(' – ') || `#${p.id}`,
        statusz: p.status ?? '',
      });
    }
    return map;
  }

  const aktiv = (projektek, project_id) => {
    const p = projektek.get(Number(project_id));
    return p !== undefined && !LEZART.includes(p.statusz);
  };

  const osszegez = (map, kulcs, mennyi) => map.set(kulcs, (map.get(kulcs) ?? 0) + mennyi);

  async function elesAlkatreszek() {
    const [parts, bins, projectParts, projects] = await Promise.all([
      nyers.parts(), nyers.bins(), nyers.projectParts(), nyers.projects(),
    ]);
    const projektek = projektIndex(projects);

    // Készlet: a rekeszekben fizikailag meglévő darabszám.
    const keszlet = new Map();
    for (const b of bins || []) {
      if (b.part_id !== null && b.part_id !== undefined) {
        osszegez(keszlet, Number(b.part_id), Number(b.quantity) || 0);
      }
    }

    // Lefoglalt: aktív projektek lefoglalt tételei. A reserved logikai mező,
    // ezért a foglalás mindent-vagy-semmit: a tétel teljes darabszáma számít.
    const lefoglalt = new Map();
    for (const pp of projectParts || []) {
      if (Number(pp.reserved) === 1 && aktiv(projektek, pp.project_id)) {
        osszegez(lefoglalt, Number(pp.part_id), Number(pp.quantity) || 0);
      }
    }

    return (parts || []).map(p => alkatresz({
      id: p.id,
      nev: p.name,
      ar: p.price,
      max_darab: p.max_per_bin,
      keszlet: keszlet.get(Number(p.id)) ?? 0,
      lefoglalt: lefoglalt.get(Number(p.id)) ?? 0,
    }));
  }

  async function elesRekeszek() {
    const bins = await nyers.bins();
    return (bins || []).map(b => rekesz({
      id: b.id,
      sor: b.row_num,
      oszlop: b.col_num,
      polc: b.level_num,
      // Az identifier szöveges mező (a projektfeladat szerint pl. „A1-1”), a
      // felület viszont számként rendezi és jeleníti meg. A mi adatbázisunkban
      // ez sorszám ('1', '2'), így a szám-konverzió helyes marad.
      rekesz: b.identifier,
      alkatresz_id: b.part_id,
      darab: b.quantity,
      max_kapacitas: b.max_capacity,
    }));
  }

  async function elesHianyzo() {
    const [projectParts, projects] = await Promise.all([nyers.projectParts(), nyers.projects()]);
    const projektek = projektIndex(projects);
    const sorok = new Map();   // part_id → hiány-sor

    for (const pp of projectParts || []) {
      if (Number(pp.reserved) === 1 || !aktiv(projektek, pp.project_id)) continue;
      const pid = Number(pp.part_id);
      if (!sorok.has(pid)) {
        sorok.set(pid, { alkatresz_id: pid, nev: pp.part_name ?? '', hianyzo_darab: 0, projektek: [] });
      }
      const sor = sorok.get(pid);
      const darab = Number(pp.quantity) || 0;
      const p = projektek.get(Number(pp.project_id));
      sor.hianyzo_darab += darab;
      sor.projektek.push({ id: Number(pp.project_id), nev: p.nev, statusz: p.statusz, darab });
    }

    return [...sorok.values()].map(hiany);
  }

  async function elesLefoglalt() {
    const [projectParts, projects] = await Promise.all([nyers.projectParts(), nyers.projects()]);
    const projektek = projektIndex(projects);

    return (projectParts || [])
      .filter(pp => Number(pp.reserved) === 1 && aktiv(projektek, pp.project_id))
      .map(pp => {
        const p = projektek.get(Number(pp.project_id));
        const darab = Number(pp.quantity) || 0;
        return foglalas({
          projekt_id: pp.project_id,
          projekt_nev: p.nev,
          statusz: p.statusz,
          alkatresz_id: pp.part_id,
          nev: pp.part_name ?? '',
          darab,
          // Mindent-vagy-semmit foglalás: ami le van foglalva, az a teljes igény.
          igenyelt: darab,
        });
      });
  }

  const Eles = {
    alkatreszek: elesAlkatreszek,
    rekeszek: elesRekeszek,
    hianyzoAlkatreszek: elesHianyzo,
    lefoglaltAlkatreszek: elesLefoglalt,

    // Figyelem: Eszter végpontjai ?id= paramétert várnak, nem /id útvonalat.
    ujAlkatresz: a => eles('POST', '/parts.php', {
      name: a.nev, price: a.ar, max_per_bin: a.max_darab,
    }),
    modositAlkatresz: (id, a) => {
      const adat = {};
      if (a.nev !== undefined) adat.name = a.nev;
      if (a.ar !== undefined) adat.price = a.ar;
      if (a.max_darab !== undefined) adat.max_per_bin = a.max_darab;
      return eles('PUT', `/parts.php?id=${encodeURIComponent(id)}`, adat);
    },
    ujRekesz: r => eles('POST', '/bins.php', {
      row_num: r.sor,
      col_num: r.oszlop,
      level_num: r.polc,
      identifier: String(r.rekesz),
      max_capacity: r.max_kapacitas,
    }),

    // Az egyetlen művelet, amihez új PHP végpont kellett: tranzakcióban írja a
    // rekeszeket, a foglalásokat és a projektstátuszt.
    bevetelezes: async adat => {
      const valasz = await eles('POST', '/receiving.php', {
        part_id: adat.alkatresz_id,
        items: (adat.tetelek || []).map(t => ({ bin_id: t.rekesz_id, quantity: t.darab })),
      });
      return {
        ok: true,
        lefoglalva: Number(valasz?.reserved) || 0,
        utemezett_projektek: (valasz?.scheduled_projects || []).map(p => ({
          id: szam(p.id),
          nev: String(p.name ?? ''),
        })),
      };
    },
  };

  /* ================= Kifelé látszó felület =================
     A választás hívásonként történik, mert a ?mock=… az URL-ből jön. */

  const muvelet = nev => (...args) => (CONFIG.USE_MOCK ? Demo : Eles)[nev](...args);

  return {
    login: (username, password) => authRequest('POST', 'login', { username, password }).then(d => felhasznalo(d?.user)),
    me: () => authRequest('GET', 'me').then(d => felhasznalo(d?.user)),
    logout: () => authRequest('POST', 'logout'),
    bejelentkezesre,

    alkatreszek: muvelet('alkatreszek'),
    ujAlkatresz: muvelet('ujAlkatresz'),
    modositAlkatresz: muvelet('modositAlkatresz'),

    rekeszek: muvelet('rekeszek'),
    ujRekesz: muvelet('ujRekesz'),

    bevetelezes: muvelet('bevetelezes'),

    hianyzoAlkatreszek: muvelet('hianyzoAlkatreszek'),
    lefoglaltAlkatreszek: muvelet('lefoglaltAlkatreszek'),
  };
})();
