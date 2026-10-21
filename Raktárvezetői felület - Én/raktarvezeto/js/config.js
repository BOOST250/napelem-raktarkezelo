/* ================= Beállítások ================= */

const CONFIG = {
  // Az adatvégpontok mappája (Eszter backendje): parts.php, bins.php,
  // projects.php, project_parts.php, receiving.php.
  // A felület a napelem/raktarvezeto/ mappából fut, az API a napelem/api/.
  // Felülírható: index.html?api=http://localhost/napelem/api
  API_BASE: '../api',

  // A bejelentkezési végpontok mappája (login.php, me.php, logout.php – PHP session).
  AUTH_BASE: '../api',

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

// URL-ből felülírható: ?mock=1 (demo), ?mock=0 (éles), ?api=… és ?auth=…
(function () {
  const q = new URLSearchParams(location.search);
  const mock = q.get('mock');
  if (mock !== null) CONFIG.USE_MOCK = mock !== '0' && mock !== 'false';
  const api = q.get('api');
  if (api) CONFIG.API_BASE = api.replace(/\/$/, '');
  const auth = q.get('auth');
  if (auth) CONFIG.AUTH_BASE = auth.replace(/\/$/, '');
  else if (api) CONFIG.AUTH_BASE = CONFIG.API_BASE;
})();
