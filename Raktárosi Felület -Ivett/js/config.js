/* ================= Beállítások ================= */

const CONFIG = {
  // Eszter PHP végpontjainak mappája (parts.php, bins.php, projects.php,
  // project_parts.php, me.php, logout.php). Relatív útvonal, mert a felület a
  // szerveren a napelem/raktaros/ mappából szolgál ki, az API pedig a napelem/api/-ból:
  //     .../napelem/raktaros/   ←  ez a felület
  //     .../napelem/api/        ←  a backend
  API_BASE: '../api',

  // Ide kerül vissza, akit ki kell léptetni / nincs bejelentkezve (közös belépő oldal).
  BELEPO_OLDAL: '../belepes/',

  // Ezzel a szerepkörrel lehet használni ezt a felületet.
  ENGEDETT_SZEREPKOR: 'warehouse_worker',

  // true  = demo mód: beépített tesztadatokkal, backend nélkül (localStorage).
  // false = a valódi PHP API-t hívja.
  // Dupla kattintással megnyitva (file://) a böngésző nem küldi a session-sütit,
  // ezért ott automatikusan demo módba kapcsol.
  USE_MOCK: location.protocol === 'file:',
};

// URL-ből felülírható: index.html?mock=1 (demo) vagy index.html?mock=0 (valódi API)
(function () {
  const mock = new URLSearchParams(location.search).get('mock');
  if (mock !== null) CONFIG.USE_MOCK = mock !== '0';
})();

// A felületek között közös elnevezések (a szakemberi és a raktárvezetői felülettel egyezően)
const SZEREPKOR_NEV = {
  specialist: 'Szakember',
  warehouse_manager: 'Raktárvezető',
  warehouse_worker: 'Raktáros',
};

const STATUSZ_NEV = {
  New: 'Új',
  Draft: 'Tervezet',
  Wait: 'Várakozik',
  Scheduled: 'Ütemezett',
  InProgress: 'Folyamatban',
  Completed: 'Befejezett',
  Failed: 'Sikertelen',
};

// Ezekből a státuszokból lehet kivételezni: az alkatrészek már le vannak foglalva
// (a bevételezés ütemezi a projektet, amikor minden tétel foglalt), a munka még nem zárult le.
const KIVETELEZHETO_STATUSZOK = ['Scheduled', 'InProgress'];

// Lezárt projektek a raktárosnak nem jelennek meg.
const LEZART_STATUSZOK = ['Completed', 'Failed'];
