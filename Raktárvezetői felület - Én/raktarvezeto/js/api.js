/* ================= API réteg =================
   Minden szerverhívás ezen a fájlon megy át (fetch).

   A felület magyar kulcsú, összesített objektumokkal dolgozik. Eszter
   PHP API-ja táblánként egy fájl, angol mezőnevekkel és ?id= paraméterrel,
   ezért az éles ág itt fordít és összesít. A demo ág ugyanezt a formát
   adja vissza a MockBackendből, hogy az app.js ne tudjon a különbségről.

   Éles végpontok (API_BASE, alapból /napelem/api, a lap originjéhez képest):
     parts.php, bins.php, projects.php, project_parts.php, receiving.php
     login.php, me.php, logout.php
*/

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const Api = (() => {
  /* A régi, magyar enum (napelemrendszer.sql illesztés előtt) és az angol
     szerepkör, amit a felület és a receiving.php vár. */
  const SZEREPKOR_ALIAS = {
    raktarvezeto: 'warehouse_manager',
    szakember: 'specialist',
    raktaros: 'warehouse_worker',
  };

  /* Előfoglalás: a szakember leadta az igényt (Wait), vagy még tervezet
     (Draft), és a receiving.php ebből a sorból foglal, amint van készlet.
     A készletből már lefoglalt (reserved = 1) tétel NEM előfoglalás. */
  const ELOFOGLALAS_STATUSZ = ['Wait', 'Draft'];
  const STATUSZ_SORREND = { Wait: 0, Draft: 1, New: 2, Scheduled: 3, InProgress: 4 };

  /* ---------------- Közös HTTP-réteg ---------------- */

  /* Lejárt munkamenet: demo módban a saját login.html, élesben a közös belépő.
     A ?mock=… és a hash megmarad. */
  function bejelentkezesre(hash = '') {
    const ut = CONFIG.USE_MOCK
      ? 'login.html' + location.search
      : '../belepes/';
    location.replace(ut + hash);
  }

  /* A mysqli angol SQL-hibáit a felület magyarul írja ki. A javítás
     ettől még a backend dolga (lásd a README „ismert eltérések” szakaszát). */
  function emberUzenet(url, data, status) {
    const nyers = String(data?.error || data?.message || `Hiba a kérés során (HTTP ${status})`);
    if (/Duplicate entry/i.test(nyers)) {
      if (/identifier/i.test(nyers)) return 'Ez a rekeszazonosító már létezik.';
      if (/name|parts/i.test(nyers)) return 'Már létezik ilyen nevű alkatrész.';
      return 'Ez az érték már foglalt.';
    }
    if (/foreign key constraint fails/i.test(nyers)) {
      return 'A műveletet az adatbázis idegenkulcs-szabálya elutasította. '
        + 'Üres rekesz felvételekor ez jellemzően a bins.php hibája: a NULL part_id '
        + 'egész számként 0-ra áll, és nincs 0-s alkatrész.';
    }
    if (/Data truncated for column 'role'/i.test(nyers)) {
      return 'A szerepkör nem fér bele a users.role mezőbe. Importáld a napelemrendszer_illesztes.sql fájlt.';
    }
    if (status === 403 && /receiving\.php/.test(url)) {
      return nyers + ' Bevételezéshez warehouse_manager szerepkör kell '
        + '(ha a fiók még „raktarvezeto”, futtasd a napelemrendszer_illesztes.sql-t).';
    }
    return nyers;
  }

  async function kuld(method, alap, url, body) {
    const options = {
      method,
      headers: { Accept: 'application/json' },
      // A PHP session sütijét minden kérésnél küldeni kell.
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
    // A database.php kapcsolat-hibája HTTP 200 + {"success": false} is lehet.
    if (!res.ok || (data && typeof data === 'object' && !Array.isArray(data) && data.success === false)) {
      throw new ApiError(emberUzenet(url, data, res.status), res.status || 500);
    }
    if (data && !Array.isArray(data) && typeof data === 'object' && 'data' in data) return data.data;
    return data;
  }

  // Egyszerre indított olvasások (egy nézet több listája) ne kérjék le négyszer ugyanazt.
  const repules = { nyers: null, ellatas: null };

  function egyszer(slot, gyarto) {
    if (!repules[slot]) {
      const p = Promise.resolve().then(gyarto).finally(() => {
        if (repules[slot] === p) repules[slot] = null;
      });
      repules[slot] = p;
    }
    return repules[slot];
  }

  function cacheTorol() {
    repules.nyers = null;
    repules.ellatas = null;
  }

  async function eles(method, fajl, body) {
    try {
      return await kuld(method, CONFIG.API_BASE, CONFIG.API_BASE + fajl, body);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) bejelentkezesre();
      throw err;
    }
  }

  function authRequest(method, nev, body) {
    if (CONFIG.USE_MOCK) return MockBackend.handle(method, `/auth/${nev}`, body);
    return kuld(method, CONFIG.AUTH_BASE, `${CONFIG.AUTH_BASE}/${nev}.php`, body);
  }

  /* ---------------- Normalizálás ---------------- */

  const szam = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const szamVagyNull = v => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  // A part_id 0 nem létező alkatrész (a bins.php NULL-t 0-ként kötné be).
  const alkatreszId = v => {
    const n = szamVagyNull(v);
    return n !== null && n > 0 ? n : null;
  };
  const egeszVagyNull = v => {
    if (typeof v === 'number' && Number.isInteger(v)) return v;
    if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return Number(v.trim());
    return null;
  };
  const lista = alakit => data => (Array.isArray(data) ? data.map(alakit) : []);

  const alkatresz = a => ({
    id: szam(a.id),
    nev: String(a.nev ?? '').trim(),
    ar: szam(a.ar),
    max_darab: szam(a.max_darab),
    keszlet: szam(a.keszlet),
    lefoglalt: szam(a.lefoglalt),
  });

  const rekesz = r => {
    const kap = r.max_kapacitas;
    return {
      id: szam(r.id),
      sor: szam(r.sor),
      oszlop: szam(r.oszlop),
      polc: szam(r.polc),
      // A 4. koordináta csak a demóban szám. Élesben az azonosító szöveg (A1-1),
      // azt nem szabad Number()-rel NaN-ná tenni.
      rekesz: egeszVagyNull(r.rekesz),
      azonosito: r.azonosito ? String(r.azonosito) : '',
      alkatresz_id: alkatreszId(r.alkatresz_id),
      darab: szam(r.darab),
      max_kapacitas: kap === undefined || kap === null || kap === ''
        ? Infinity
        : szam(kap),
    };
  };

  const projektSor = p => ({
    id: szam(p.id),
    nev: String(p.nev ?? ''),
    statusz: p.statusz ?? '',
    darab: szam(p.darab),
    igenyelt: p.igenyelt === undefined ? null : szam(p.igenyelt),
    lefoglalt: p.lefoglalt === undefined ? null : szam(p.lefoglalt),
  });

  const hiany = h => ({
    alkatresz_id: szam(h.alkatresz_id),
    nev: String(h.nev ?? ''),
    hianyzo_darab: szam(h.hianyzo_darab),
    keszlet: szam(h.keszlet),
    igenyelt: szam(h.igenyelt),
    lefoglalt: szam(h.lefoglalt),
    szabad_maradt: szam(h.szabad_maradt),
    projektek: (h.projektek || []).map(projektSor),
  });

  const elofoglalas = h => ({
    alkatresz_id: szam(h.alkatresz_id),
    nev: String(h.nev ?? ''),
    elofoglalt_darab: szam(h.elofoglalt_darab),
    keszlet: szam(h.keszlet),
    szabad_maradt: szam(h.szabad_maradt),
    projektek: (h.projektek || []).map(projektSor),
  });

  const foglalas = f => ({
    projekt_id: szam(f.projekt_id),
    projekt_nev: String(f.projekt_nev ?? ''),
    statusz: f.statusz ?? '',
    alkatresz_id: szam(f.alkatresz_id),
    nev: String(f.nev ?? ''),
    darab: szam(f.darab),
    igenyelt: f.igenyelt === undefined || f.igenyelt === null ? null : szam(f.igenyelt),
  });

  const felhasznalo = u => {
    const eredeti = String(u?.role ?? '');
    return {
      id: szam(u?.id),
      username: String(u?.username ?? ''),
      role: SZEREPKOR_ALIAS[eredeti] || eredeti,
      eredetiSzerepkor: eredeti,
    };
  };

  /* ---------------- B.3 / B.4 közös számítás ----------------
     igenyek: aktív projektek tételei
       { projekt_id, projekt_nev, statusz, alkatresz_id, nev, igenyelt, lefoglalt }
     A lefoglalt itt a KÉSZLETBŐL már elkülönített darab (demóban részleges is
     lehet, élesben 0 vagy a teljes igény).
     mindentVagySemmit: a receiving.php csak teljes tételt foglal le. */

  function ellatas(igenyek, keszletMap, mindentVagySemmit) {
    const csop = new Map();
    for (const sor of igenyek || []) {
      const id = szam(sor.alkatresz_id);
      if (!csop.has(id)) csop.set(id, []);
      csop.get(id).push(sor);
    }

    const hianyzo = [];
    const elofoglalt = [];

    for (const [aid, sorok] of csop) {
      const nev = String(sorok.find(s => s.nev)?.nev ?? '');
      const keszlet = keszletMap.get(aid) ?? 0;
      const igenyelt = sorok.reduce((s, x) => s + szam(x.igenyelt), 0);
      const lefoglalt = sorok.reduce((s, x) => s + szam(x.lefoglalt), 0);
      // Rendelendő: amennyivel az aktív igény meghaladja a fizikai készletet.
      // A már lefoglalt darab benne van a készletben, ezért nem rendeljük meg újra.
      const rendeles = Math.max(0, igenyelt - keszlet);

      let szabad = keszlet;
      const sor = sorok.map(s => ({
        ...s,
        igenyelt: szam(s.igenyelt),
        lefoglalt: szam(s.lefoglalt),
        hiany: 0,
      }));

      for (const s of sor) {
        const foglal = Math.min(szabad, s.lefoglalt);
        szabad -= foglal;
      }

      const varolista = [...sor].sort((a, b) =>
        (STATUSZ_SORREND[a.statusz] ?? 9) - (STATUSZ_SORREND[b.statusz] ?? 9)
        || szam(a.projekt_id) - szam(b.projekt_id));

      for (const s of varolista) {
        const kell = s.igenyelt - s.lefoglalt;
        if (kell <= 0) continue;
        const kap = mindentVagySemmit
          ? (szabad >= kell ? kell : 0)
          : Math.min(szabad, kell);
        szabad -= kap;
        s.hiany = kell - kap;
      }

      const hianyProjektek = sor
        .filter(s => s.hiany > 0)
        .map(s => ({
          id: s.projekt_id,
          nev: s.projekt_nev,
          statusz: s.statusz,
          darab: s.hiany,
          igenyelt: s.igenyelt,
          lefoglalt: s.lefoglalt,
        }));

      if (rendeles > 0) {
        hianyzo.push({
          alkatresz_id: aid,
          nev,
          hianyzo_darab: rendeles,
          keszlet,
          igenyelt,
          lefoglalt,
          szabad_maradt: szabad,
          projektek: hianyProjektek,
        });
      }

      const eloSorok = sor.filter(s =>
        ELOFOGLALAS_STATUSZ.includes(s.statusz) && s.hiany > 0);
      if (eloSorok.length) {
        elofoglalt.push({
          alkatresz_id: aid,
          nev,
          elofoglalt_darab: eloSorok.reduce((s, x) => s + x.hiany, 0),
          keszlet,
          szabad_maradt: szabad,
          projektek: eloSorok.map(s => ({
            id: s.projekt_id,
            nev: s.projekt_nev,
            statusz: s.statusz,
            darab: s.hiany,
            igenyelt: s.igenyelt,
            lefoglalt: s.lefoglalt,
          })),
        });
      }
    }

    return { hianyzo, elofoglalt };
  }

  /* ================= Demo megvalósítás ================= */

  const mock = (method, path, body) => MockBackend.handle(method, path, body);

  function demoEllatas() {
    return egyszer('ellatas', async () => {
      const ny = await mock('GET', '/nyers');
      const keszlet = new Map((ny.alkatreszek || []).map(a => [szam(a.id), szam(a.keszlet)]));
      return ellatas(ny.igenyek, keszlet, false);
    });
  }

  const Demo = {
    alkatreszek: () => mock('GET', '/alkatreszek').then(lista(alkatresz)),
    ujAlkatresz: adat => mock('POST', '/alkatreszek', adat),
    modositAlkatresz: (id, adat) => mock('PUT', `/alkatreszek/${id}`, adat),
    rekeszek: () => mock('GET', '/rekeszek').then(lista(rekesz)),
    ujRekesz: adat => mock('POST', '/rekeszek', adat),
    modositRekesz: (id, adat) => mock('PUT', `/rekeszek/${id}`, adat),
    bevetelezes: adat => mock('POST', '/bevetelezes', adat),
    hianyzoAlkatreszek: () => demoEllatas().then(e => e.hianyzo.map(hiany)),
    elofoglaltAlkatreszek: () => demoEllatas().then(e => e.elofoglalt.map(elofoglalas)),
    lefoglaltAlkatreszek: () => mock('GET', '/lefoglalt').then(lista(foglalas)),
  };

  /* ================= Éles megvalósítás ================= */

  const nyersMind = () => egyszer('nyers', () => Promise.all([
    eles('GET', '/parts.php'),
    eles('GET', '/bins.php'),
    eles('GET', '/project_parts.php'),
    eles('GET', '/projects.php'),
  ]));

  const LEZART = ['Completed', 'Failed'];

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

  function elesIgenyek(projectParts, projektek) {
    const igenyek = [];
    for (const pp of projectParts || []) {
      const projekt = projektek.get(Number(pp.project_id));
      if (!projekt || LEZART.includes(projekt.statusz)) continue;
      const igenyelt = szam(pp.quantity);
      const keszletbol = szam(pp.reserved) === 1 ? igenyelt : 0;
      igenyek.push({
        projekt_id: pp.project_id,
        projekt_nev: projekt.nev,
        statusz: projekt.statusz,
        alkatresz_id: pp.part_id,
        nev: pp.part_name ?? '',
        igenyelt,
        lefoglalt: keszletbol,
      });
    }
    return igenyek;
  }

  function elesEllatas() {
    return egyszer('ellatas', async () => {
      const [, bins, projectParts, projects] = await nyersMind();
      const projektek = projektIndex(projects);
      const keszlet = new Map();
      for (const b of bins || []) {
        const pid = alkatreszId(b.part_id);
        if (pid !== null) keszlet.set(pid, (keszlet.get(pid) ?? 0) + szam(b.quantity));
      }
      // Élesben a reserved logikai mező: a receiving.php csak teljes tételt foglal.
      return ellatas(elesIgenyek(projectParts, projektek), keszlet, true);
    });
  }

  async function elesAlkatreszek() {
    const [parts, bins, projectParts, projects] = await nyersMind();
    const projektek = projektIndex(projects);
    const keszlet = new Map();
    for (const b of bins || []) {
      const pid = alkatreszId(b.part_id);
      if (pid !== null) keszlet.set(pid, (keszlet.get(pid) ?? 0) + szam(b.quantity));
    }
    const lefoglalt = new Map();
    for (const pp of projectParts || []) {
      const projekt = projektek.get(Number(pp.project_id));
      if (!projekt || LEZART.includes(projekt.statusz)) continue;
      if (szam(pp.reserved) === 1) {
        const pid = szam(pp.part_id);
        lefoglalt.set(pid, (lefoglalt.get(pid) ?? 0) + szam(pp.quantity));
      }
    }
    return (parts || []).map(p => alkatresz({
      id: p.id,
      nev: p.name,
      ar: p.price,
      max_darab: p.max_per_bin,
      keszlet: keszlet.get(szam(p.id)) ?? 0,
      lefoglalt: lefoglalt.get(szam(p.id)) ?? 0,
    }));
  }

  async function elesRekeszek() {
    const [, bins] = await nyersMind();
    return (bins || []).map(b => rekesz({
      id: b.id,
      sor: b.row_num,
      oszlop: b.col_num,
      polc: b.level_num,
      // Az identifier szöveg (A1-1). A rekesz() csak akkor tesz belőle számot,
      // ha tényleg egész – különben az azonosító mezőben marad.
      rekesz: b.identifier,
      azonosito: b.identifier,
      alkatresz_id: b.part_id,
      darab: b.quantity,
      max_kapacitas: b.max_capacity,
    }));
  }

  async function elesLefoglalt() {
    const [, , projectParts, projects] = await nyersMind();
    const projektek = projektIndex(projects);
    return (projectParts || [])
      .filter(pp => {
        const projekt = projektek.get(Number(pp.project_id));
        return projekt && !LEZART.includes(projekt.statusz) && szam(pp.reserved) === 1;
      })
      .map(pp => {
        const projekt = projektek.get(Number(pp.project_id));
        const darab = szam(pp.quantity);
        return foglalas({
          projekt_id: pp.project_id,
          projekt_nev: projekt.nev,
          statusz: projekt.statusz,
          alkatresz_id: pp.part_id,
          nev: pp.part_name ?? '',
          darab,
          igenyelt: darab,
        });
      });
  }

  const Eles = {
    alkatreszek: elesAlkatreszek,
    rekeszek: elesRekeszek,
    hianyzoAlkatreszek: () => elesEllatas().then(e => e.hianyzo.map(hiany)),
    elofoglaltAlkatreszek: () => elesEllatas().then(e => e.elofoglalt.map(elofoglalas)),
    lefoglaltAlkatreszek: elesLefoglalt,

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
      identifier: r.azonosito,
      max_capacity: r.max_kapacitas,
    }),
    modositRekesz: (id, r) => eles('PUT', `/bins.php?id=${encodeURIComponent(id)}`, {
      max_capacity: r.max_kapacitas,
    }),

    bevetelezes: async adat => {
      const valasz = await eles('POST', '/receiving.php', {
        part_id: adat.alkatresz_id,
        items: (adat.tetelek || []).map(t => ({ bin_id: t.rekesz_id, quantity: t.darab })),
      });
      return {
        ok: true,
        lefoglalva: szam(valasz?.reserved),
        utemezett_projektek: (valasz?.scheduled_projects || []).map(p => ({
          id: szam(p.id),
          nev: String(p.name ?? ''),
        })),
      };
    },
  };

  /* ================= Kifelé látszó felület ================= */

  const muvelet = nev => (...args) => (CONFIG.USE_MOCK ? Demo : Eles)[nev](...args);
  const iras = nev => (...args) => {
    cacheTorol();
    return muvelet(nev)(...args);
  };

  return {
    login: (username, password) => authRequest('POST', 'login', { username, password }).then(d => felhasznalo(d?.user)),
    me: () => authRequest('GET', 'me').then(d => felhasznalo(d?.user)),
    logout: () => authRequest('POST', 'logout'),
    bejelentkezesre,

    alkatreszek: muvelet('alkatreszek'),
    ujAlkatresz: iras('ujAlkatresz'),
    modositAlkatresz: iras('modositAlkatresz'),

    rekeszek: muvelet('rekeszek'),
    ujRekesz: iras('ujRekesz'),
    modositRekesz: iras('modositRekesz'),

    bevetelezes: iras('bevetelezes'),

    hianyzoAlkatreszek: muvelet('hianyzoAlkatreszek'),
    elofoglaltAlkatreszek: muvelet('elofoglaltAlkatreszek'),
    lefoglaltAlkatreszek: muvelet('lefoglaltAlkatreszek'),
  };
})();
