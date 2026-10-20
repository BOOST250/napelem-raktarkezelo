/* ================= Beállítások =================
   Szakemberi felület – Eszter PHP backendjének elérése.

   Ez a felület NINCS demo módban: közvetlenül az adatbázisból dolgozik.
   Ennek oka, hogy a szakemberi és a raktárvezetői felület CSAK a közös
   adatbázison keresztül tud összekapcsolódni. Egy localStorage-alapú demo
   mód minden felületnek külön tárolót adna, így a szakember által rögzített
   alkatrészigény soha nem jelenne meg a raktárvezetőnél. */

const CONFIG = {
  // Eszter api mappája a XAMPP htdocs alatt.
  API_BASE: '/napelem/api',
  AUTH_BASE: '/napelem/api',

  // Ehhez a felülethez szakemberi jogosultság kell (users.role).
  ENGEDETT_SZEREPKOR: 'specialist',
};

// A users.role értékek magyar megnevezése (app.js és login.js használja).
const SZEREPKOR_NEV = {
  specialist: 'Szakember',
  warehouse_manager: 'Raktárvezető',
  warehouse_worker: 'Raktáros',
};

/* A projects.status hét lehetséges értéke magyarul és CSS-osztállyal.
   Eddig ez a projects.js-ben volt beégetve; innen minden oldal eléri. */
const STATUSZ_NEV = {
  New: 'Új',
  Draft: 'Tervezet',
  Wait: 'Várakozik',
  Scheduled: 'Ütemezett',
  InProgress: 'Folyamatban',
  Completed: 'Befejezett',
  Failed: 'Sikertelen',
};

const STATUSZ_OSZTALY = {
  New: 'status-new',
  Draft: 'status-draft',
  Wait: 'status-wait',
  Scheduled: 'status-scheduled',
  InProgress: 'status-progress',
  Completed: 'status-completed',
  Failed: 'status-failed',
};

// Aktív = még nem zárult le. A raktár csak ezekre tart fenn készletet.
const AKTIV_STATUSZOK = ['New', 'Draft', 'Wait', 'Scheduled', 'InProgress'];
