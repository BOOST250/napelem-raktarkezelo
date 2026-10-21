/* ================= API réteg =================
   Minden szerverhívás itt megy ki. Az app.js magyar kulcsú objektumokat
   kap, akár a PHP, akár a demo backend válaszol.

   Éles módban három olyan végpontot hívunk, ami a meglévő táblavégpontok
   között még nincs meg (Eszter külön fájlban készíti, lásd README.md):

     GET  raktaros_projektek.php
     POST raktaros_kivetelezes.php
     GET  raktaros_helyek.php?project_id=

   A bejelentkezés a már meglévő login.php / me.php / logout.php.
   Az útvonal-optimalizálás kliensoldali (js/route.js): nem kér külön végpontot,
   a helyek válaszában lévő koordinátákból számol. */

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const Api = (() => {
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
    if (data && !Array.isArray(data) && typeof data === 'object' && 'data' in data && Object.keys(data).length === 1) {
      return data.data;
    }
    return data;
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

  const szam = v => (v === null || v === undefined || v === '' ? 0 : Number(v));

  const felhasznalo = u => ({
    id: szam(u?.id),
    username: String(u?.username ?? ''),
    role: String(u?.role ?? ''),
  });

  const projekt = p => ({
    id: szam(p.id),
    ugyfel: String(p.customer_name ?? ''),
    helyszin: String(p.location ?? ''),
    leiras: String(p.description ?? ''),
    statusz: String(p.status ?? ''),
    letrehozva: p.created_at ?? '',
    tetelszam: szam(p.part_lines),
    lefoglaltTetel: szam(p.reserved_lines),
  });

  const rekesz = r => ({
    id: szam(r.id),
    azonosito: String(r.identifier ?? ''),
    sor: szam(r.row_num),
    oszlop: szam(r.col_num),
    polc: szam(r.level_num),
    darab: szam(r.quantity),
    maxKapacitas: szam(r.max_capacity),
  });

  function helyekAlakit(nyers) {
    const alkatreszek = (nyers?.parts || []).map(a => ({
      id: szam(a.part_id),
      nev: String(a.name ?? ''),
      igenyelt: szam(a.quantity),
      lefoglalva: szam(a.reserved) === 1 || a.reserved === true,
      rekeszek: (a.bins || []).map(rekesz),
    }));
    return {
      projekt: {
        id: szam(nyers?.project_id),
        ugyfel: String(nyers?.customer_name ?? ''),
        helyszin: String(nyers?.location ?? ''),
        leiras: String(nyers?.description ?? ''),
        statusz: String(nyers?.status ?? ''),
      },
      raktar: {
        sorok: szam(nyers?.warehouse?.rows) || 1,
        oszlopok: szam(nyers?.warehouse?.columns) || 1,
        szintek: szam(nyers?.warehouse?.levels) || 1,
      },
      alkatreszek,
    };
  }

  const mock = (method, path, body) => MockBackend.handle(method, path, body);

  const Demo = {
    projektek: () => mock('GET', '/raktaros/projektek').then(lista => (lista || []).map(projekt)),
    inditKivetelezes: id => mock('POST', '/raktaros/kivetelezes', { project_id: id }).then(projekt),
    helyek: id => mock('GET', `/raktaros/helyek?project_id=${encodeURIComponent(id)}`).then(helyekAlakit),
  };

  const Eles = {
    projektek: () => eles('GET', '/raktaros_projektek.php').then(lista => (lista || []).map(projekt)),
    inditKivetelezes: id => eles('POST', '/raktaros_kivetelezes.php', { project_id: id }).then(projekt),
    helyek: id => eles('GET', `/raktaros_helyek.php?project_id=${encodeURIComponent(id)}`).then(helyekAlakit),
  };

  const muvelet = nev => (...args) => (CONFIG.USE_MOCK ? Demo : Eles)[nev](...args);

  return {
    login: (username, password) => authRequest('POST', 'login', { username, password }).then(d => felhasznalo(d?.user)),
    me: () => authRequest('GET', 'me').then(d => felhasznalo(d?.user)),
    logout: () => authRequest('POST', 'logout'),
    bejelentkezesre,

    projektek: muvelet('projektek'),
    inditKivetelezes: muvelet('inditKivetelezes'),
    helyek: muvelet('helyek'),
  };
})();
