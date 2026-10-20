/* ================= Beállítások ================= */

const CONFIG = {
  // Az adatvégpontok mappája (Eszter backendje): parts.php, bins.php,
  // projects.php, project_parts.php, receiving.php.
  // Részletek: README.md → "API-szerződés"
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

// URL-ből felülírható: index.html?mock=0 (valódi API) vagy index.html?mock=1 (demo)
(function () {
  const mock = new URLSearchParams(location.search).get('mock');
  if (mock !== null) CONFIG.USE_MOCK = mock !== '0';
})();
