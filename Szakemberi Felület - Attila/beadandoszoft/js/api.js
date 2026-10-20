/* ================= API réteg =================
   Minden szerverhívás ezen a fájlon megy át (fetch). Eszter végpontjai:
   projects.php, project_parts.php, parts.php, bins.php, project_history.php,
   login.php, me.php, logout.php.

   Szerencsés helyzet: Attila felülete eleve Eszter mezőneveit használja
   (customer_name, location, status, work_hours, labor_cost, created_at),
   ezért itt NINCS angol↔magyar leképezés – csak a PHP-tól stringként
   visszakapott számokat alakítjuk számmá.

   Három dolgot viszont kliensoldalon kell megoldani, mert a backend nem
   tudja:

   1) Nincs egyrekordos GET. A projects.php és a project_parts.php mindig a
      teljes táblát adja vissza, ?id= nélkül. A részletező oldal ezért
      lekéri a listát és abból szűr (projekt(), projektAlkatreszek()).

   2) Nincs összesítés. Egy alkatrész készlete a bins tábla soraiból,
      lefoglaltsága a project_parts soraiból adódik össze (alkatreszek()).

   3) A project_parts.php POST-ja nem ellenőriz duplikátumot, a
      (project_id, part_id) viszont összetett elsődleges kulcs – ismételt
      POST HTTP 500-at ad "Duplicate entry" hibával. Ezt itt fogjuk el, és
      érthető magyar üzenetet adunk helyette. */

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const Api = (() => {
  /* ---------------- Közös HTTP-réteg ---------------- */

  // A közös belépő a napelem mappában van (../belepes/), az oldalak viszont
  // a pages/ alatt futnak – onnan egy szinttel több ".." kell.
  function bejelentkezesre() {
    const ut = location.pathname.includes('/pages/') ? '../../belepes/' : '../belepes/';
    location.replace(ut);
  }

  async function kuld(method, url, body) {
    const options = {
      method,
      headers: { Accept: 'application/json' },
      // A PHP session-cookie-t minden kérésnél küldeni kell. A cors.php ezért
      // tükrözi vissza a kérés originjét "*" helyett – credentials mellett a
      // "*" nem megengedett.
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
      throw new ApiError(
        `A szerver nem érhető el (${CONFIG.API_BASE}). Fut az Apache és a MySQL a XAMPP-ban?`,
        0
      );
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
      throw new ApiError(
        data?.error || data?.message || `Hiba a kérés során (HTTP ${res.status})`,
        res.status
      );
    }
    // {"data": [...]} formátumú választ is elfogadunk
    if (data && !Array.isArray(data) && typeof data === 'object' && 'data' in data) return data.data;
    return data;
  }

  // Adatvégpont hívása. 401-nél (lejárt session) vissza a belépő oldalra.
  async function hiv(method, fajl, body) {
    try {
      return await kuld(method, CONFIG.API_BASE + fajl, body);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) bejelentkezesre();
      throw err;
    }
  }

  /* ---------------- Normalizálás ----------------
     A mysqli minden oszlopot stringként ad vissza, ezért a számokat
     egységesítjük – különben a "10" + 5 összefűzés lenne, nem összeadás. */

  const szam = v => (v === null || v === undefined || v === '' ? 0 : Number(v));
  const szamVagyNull = v => (v === null || v === undefined || v === '' ? null : Number(v));
  const lista = alakito => data => (Array.isArray(data) ? data.map(alakito) : []);

  const alakit = {
    projekt: p => ({
      id: szam(p.id),
      location: String(p.location ?? ''),
      description: String(p.description ?? ''),
      customer_name: String(p.customer_name ?? ''),
      customer_email: String(p.customer_email ?? ''),
      customer_phone: String(p.customer_phone ?? ''),
      status: String(p.status ?? ''),
      work_hours: szamVagyNull(p.work_hours),
      labor_cost: szamVagyNull(p.labor_cost),
      created_at: p.created_at ?? null,
      updated_at: p.updated_at ?? null,
    }),

    // project_parts egy sora, a parts táblából JOIN-olt névvel és árral.
    tetel: t => ({
      project_id: szam(t.project_id),
      part_id: szam(t.part_id),
      part_name: String(t.part_name ?? ''),
      part_price: szam(t.part_price),
      quantity: szam(t.quantity),
      // A reserved logikai mező ("le van-e foglalva"), nem darabszám.
      reserved: szam(t.reserved) === 1,
      reserved_at: t.reserved_at ?? null,
    }),

    tortenet: h => ({
      id: szam(h.id),
      project_id: szam(h.project_id),
      status: String(h.status ?? ''),
      changed_at: h.changed_at ?? null,
    }),

    felhasznalo: u =>
      u
        ? {
            id: szam(u.id),
            username: String(u.username ?? ''),
            role: String(u.role ?? ''),
          }
        : null,
  };

  /* ---------------- Projektek ---------------- */

  const projektek = () => hiv('GET', '/projects.php').then(lista(alakit.projekt));

  // Nincs egyrekordos GET, ezért a teljes listából szűrünk (lásd a fájl fejét).
  async function projekt(id) {
    const keresett = Number(id);
    const talalat = (await projektek()).find(p => p.id === keresett);
    if (!talalat) throw new ApiError(`Nincs ilyen projekt (azonosító: ${id}).`, 404);
    return talalat;
  }

  // A státuszt nem küldjük: a projects.php minden új projektet 'New'-ra állít.
  async function ujProjekt(adat) {
    const valasz = await hiv('POST', '/projects.php', {
      location: adat.location,
      description: adat.description ?? '',
      customer_name: adat.customer_name,
      customer_email: adat.customer_email ?? '',
      customer_phone: adat.customer_phone ?? '',
    });
    return szam(valasz?.id);
  }

  // Részleges módosítás: csak a megadott mezőket küldjük.
  // A projects.php PUT-ja státuszváltáskor magától ír a project_history-ba.
  const modositProjekt = (id, adat) => hiv('PUT', `/projects.php?id=${encodeURIComponent(id)}`, adat);

  const projektStatusz = (id, status) => modositProjekt(id, { status });

  async function projektTortenet(id) {
    const keresett = Number(id);
    const sorok = lista(alakit.tortenet)(await hiv('GET', '/project_history.php'));
    return sorok.filter(h => h.project_id === keresett);
  }

  /* ---------------- Alkatrészek és készlet ----------------
     A raktárvezetői felület ugyanezt az összesítést végzi – a szakember
     innen látja, hogy amit igényel, van-e egyáltalán raktáron. */

  async function alkatreszek() {
    const [parts, bins, tetelek, projects] = await Promise.all([
      hiv('GET', '/parts.php'),
      hiv('GET', '/bins.php'),
      hiv('GET', '/project_parts.php'),
      hiv('GET', '/projects.php'),
    ]);

    // Lezárt (Completed/Failed) projektek foglalása már nem köti a készletet.
    const aktivProjektek = new Set(
      (Array.isArray(projects) ? projects : [])
        .filter(p => AKTIV_STATUSZOK.includes(String(p.status ?? '')))
        .map(p => szam(p.id))
    );

    const keszlet = new Map();
    for (const b of Array.isArray(bins) ? bins : []) {
      const partId = szamVagyNull(b.part_id);
      if (partId === null) continue;
      keszlet.set(partId, (keszlet.get(partId) || 0) + szam(b.quantity));
    }

    const lefoglalt = new Map();
    const igenyelt = new Map();
    for (const t of Array.isArray(tetelek) ? tetelek : []) {
      const projektId = szam(t.project_id);
      if (!aktivProjektek.has(projektId)) continue;
      const partId = szam(t.part_id);
      const cel = szam(t.reserved) === 1 ? lefoglalt : igenyelt;
      cel.set(partId, (cel.get(partId) || 0) + szam(t.quantity));
    }

    return (Array.isArray(parts) ? parts : []).map(a => {
      const id = szam(a.id);
      const keszletDarab = keszlet.get(id) || 0;
      const lefoglaltDarab = lefoglalt.get(id) || 0;
      return {
        id,
        name: String(a.name ?? ''),
        price: szam(a.price),
        max_per_bin: szam(a.max_per_bin),
        keszlet: keszletDarab,
        lefoglalt: lefoglaltDarab,
        // Szabad = ami raktáron van és nincs más projektre lefoglalva.
        szabad: keszletDarab - lefoglaltDarab,
        // Még nem lefoglalt igény az aktív projektekről (erre vár a raktár).
        igenyelt: igenyelt.get(id) || 0,
      };
    });
  }

  /* ---------------- Projekt alkatrészigénye ----------------
     EZ A KAPCSOLÓDÁSI PONT a raktárvezetői felülethez: amit a szakember ide
     felvesz, az jelenik meg Ábel felületén a "Hiányzó alkatrészek" listában,
     és a bevételezés ezeket a sorokat állítja reserved=1-re. */

  async function projektAlkatreszek(projektId) {
    const keresett = Number(projektId);
    const sorok = lista(alakit.tetel)(await hiv('GET', '/project_parts.php'));
    return sorok.filter(t => t.project_id === keresett);
  }

  async function ujProjektAlkatresz(projektId, alkatreszId, darab) {
    // A POST-nak nincs duplikátum-ellenőrzése, az összetett kulcs miatt viszont
    // az ismételt beszúrás 500-ba fut. Előbb megnézzük, van-e már ilyen sor.
    const meglevo = (await projektAlkatreszek(projektId)).find(t => t.part_id === Number(alkatreszId));
    if (meglevo) {
      throw new ApiError(
        'Ez az alkatrész már szerepel a projekt listáján – a mennyiséget a táblázatban módosítsd.',
        409
      );
    }
    return hiv('POST', '/project_parts.php', {
      project_id: Number(projektId),
      part_id: Number(alkatreszId),
      quantity: Number(darab),
    });
  }

  const tetelKulcs = (projektId, alkatreszId) =>
    `?project_id=${encodeURIComponent(projektId)}&part_id=${encodeURIComponent(alkatreszId)}`;

  const modositProjektAlkatresz = (projektId, alkatreszId, adat) =>
    hiv('PUT', '/project_parts.php' + tetelKulcs(projektId, alkatreszId), adat);

  const torolProjektAlkatresz = (projektId, alkatreszId) =>
    hiv('DELETE', '/project_parts.php' + tetelKulcs(projektId, alkatreszId));

  /* ---------------- Bejelentkezés ---------------- */

  const auth = (method, nev, body) => kuld(method, `${CONFIG.AUTH_BASE}/${nev}.php`, body);

  return {
    login: (username, password) =>
      auth('POST', 'login', { username, password }).then(d => alakit.felhasznalo(d?.user)),
    me: () => auth('GET', 'me').then(d => alakit.felhasznalo(d?.user)),
    logout: () => auth('POST', 'logout'),
    bejelentkezesre,

    projektek,
    projekt,
    ujProjekt,
    modositProjekt,
    projektStatusz,
    projektTortenet,

    alkatreszek,

    projektAlkatreszek,
    ujProjektAlkatresz,
    modositProjektAlkatresz,
    torolProjektAlkatresz,
  };
})();
