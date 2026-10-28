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
};

// Szerepkörök megjelenített neve (a szakemberi felülettel egyezően)
const SZEREPKOR_NEV = {
  specialist: 'Szakember',
  warehouse_manager: 'Raktárvezető',
  warehouse_worker: 'Raktáros',
};
