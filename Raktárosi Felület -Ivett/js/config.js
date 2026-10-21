/* ================= Beállítások =================
   Raktárosi felület. A végpontok szerződése: README.md.
   A három raktárosi PHP fájlt Eszter írja (api/raktaros_*.php);
   amíg nincsenek meg, a felület demo módban, mock.js-ből működik. */

const CONFIG = {
  // Gyökér-relatív út a XAMPP htdocs/napelem/api mappára (parts.php, login.php,
  // és a raktárosnak szánt raktaros_*.php). Szándékosan NEM "http://localhost/…":
  // a felületet másik gépről is megnyitják a hálózaton, és a localhost ott a
  // kliens saját gépére mutatna. A /napelem/api ugyanahhoz a géphez megy,
  // amelyik a lapot kiszolgálta.
  API_BASE: '/napelem/api',

  // Bejelentkezés: ugyanaz a PHP session, mint a közös belépőn (login.php, me.php, logout.php).
  // Ugyanaz a gyökér-relatív cím, ugyanabból az okból.
  AUTH_BASE: '/napelem/api',

  // Erre a felületre csak raktáros léphet be.
  ENGEDETT_SZEREPKOR: 'warehouse_worker',

  // false = a PHP API-t hívja. Demo, backend nélkül: index.html?mock=1
  // A raktárosi végpontok külön PR-ben készülnek, ezért a bemutató a demo mód.
  USE_MOCK: false,
};

const SZEREPKOR_NEV = {
  specialist: 'Szakember',
  warehouse_manager: 'Raktárvezető',
  warehouse_worker: 'Raktáros',
  admin: 'Adminisztrátor',
};

// A projects.status hét értéke, a másik két felülettel egyező címkével.
const STATUSZ_NEV = {
  New: ['Új', 'new'],
  Draft: ['Tervezet', 'draft'],
  Wait: ['Várakozik', 'wait'],
  Scheduled: ['Ütemezett', 'scheduled'],
  InProgress: ['Folyamatban', 'progress'],
  Completed: ['Befejezett', 'completed'],
  Failed: ['Sikertelen', 'failed'],
};

(function () {
  const mock = new URLSearchParams(location.search).get('mock');
  if (mock !== null) CONFIG.USE_MOCK = mock !== '0';
})();
