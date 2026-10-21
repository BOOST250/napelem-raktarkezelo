/* ================= Beállítások ================= */

const CONFIG = {
  // Az adatvégpontok mappája (Eszter backendje): parts.php, bins.php,
  // projects.php, project_parts.php, receiving.php.
  // Gyökérhez képesti, ugyanazon origin útvonal (htdocs/napelem/api).
  // A böngésző a lap hostját használja, ezért LAN-ról is működik
  // (pl. http://192.168.1.23/napelem/raktarvezeto/ → /napelem/api).
  // Felülírható ugyanilyen útvonallal: index.html?api=/napelem/api
  API_BASE: '/napelem/api',

  // A bejelentkezési végpontok mappája (login.php, me.php, logout.php – PHP session).
  AUTH_BASE: '/napelem/api',

  // Ezzel a szerepkörrel lehet belépni erre a felületre.
  ENGEDETT_SZEREPKOR: 'warehouse_manager',

  // true  = demo mód: beépített tesztadatokkal működik, backend nélkül (localStorage).
  // false = a valódi PHP API-t hívja fetch-csel.
  //
  // Alapértelmezés a valódi API, mert a felület élesben Eszter adatbázisából
  // dolgozik, és a közös belépő (../belepes/) is ide irányít. A demo a
  // bemutatóhoz megmarad: index.html?mock=1
  USE_MOCK: false,
};

// Szerepkörök megjelenített neve (a szakemberi felülettel egyezően)
const SZEREPKOR_NEV = {
  specialist: 'Szakember',
  warehouse_manager: 'Raktárvezető',
  warehouse_worker: 'Raktáros',
};

// Csak gyökérhez képesti útvonalat fogadunk el (?api=/napelem/api).
// Teljes URL-t (hosttal) szándékosan eldobunk, hogy a hívás a lap originjén maradjon.
function ugyanazonUt(ertek) {
  if (!ertek) return '';
  const ut = ertek.trim();
  if (!ut.startsWith('/') || ut.startsWith('//')) return '';
  return ut.replace(/\/$/, '');
}

// URL-ből felülírható: ?mock=1 (demo), ?mock=0 (éles), ?api=/útvonal és ?auth=/útvonal
(function () {
  const q = new URLSearchParams(location.search);
  const mock = q.get('mock');
  if (mock !== null) CONFIG.USE_MOCK = mock !== '0' && mock !== 'false';
  const api = ugyanazonUt(q.get('api'));
  if (api) CONFIG.API_BASE = api;
  const auth = ugyanazonUt(q.get('auth'));
  if (auth) CONFIG.AUTH_BASE = auth;
  else if (api) CONFIG.AUTH_BASE = CONFIG.API_BASE;
})();
