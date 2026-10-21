/* ================= Beállítások =================
   Szakemberi felület. Élesben Eszter PHP API-ját hívja, a közös belépő
   (Közös/belepes) a specialist szerepkört ide irányítja.

   A címek egy helyen vannak, és nincs bennük gépnév. A gyökér a lap
   saját címéből jön (pl. http://192.168.0.10/napelem/szakember/ → /napelem),
   ezért a felület localhostól és a LAN másik gépéről is ugyanúgy működik.
   A login.php, a me.php és a logout.php az api mappában van; az auth/
   mappa csak a PHP osztály, nincs külön HTTP-végpontja.

   Demo mód backend nélkül: bármelyik oldal címéhez ?mock=1
   (vissza élesre: ?mock=0). A választás a böngészőlaphoz tartozik,
   így az aloldalak is demóban maradnak. */

const NAPELEM_GYOKER = (() => {
  const ut = window.location.pathname;
  const jel = '/napelem/';
  const hely = ut.indexOf(jel);
  return hely === -1 ? '/napelem' : ut.slice(0, hely) + '/napelem';
})();

const CONFIG = {
  GYOKER: NAPELEM_GYOKER,
  API_BASE: NAPELEM_GYOKER + '/api',
  AUTH_BASE: NAPELEM_GYOKER + '/api',
  BELEPES: NAPELEM_GYOKER + '/belepes/',

  // Ehhez a felülethez szakemberi jogosultság kell (users.role).
  ENGEDETT_SZEREPKOR: 'specialist',

  // false = a valódi PHP API. A demo a ?mock=1 címmel kapcsolható be.
  USE_MOCK: false,
};

(function () {
  const KULCS = 'szakember_mock';
  let mock = null;
  try {
    mock = new URLSearchParams(location.search).get('mock');
  } catch (e) {
    mock = null;
  }
  try {
    if (mock === '0') sessionStorage.removeItem(KULCS);
    else if (mock === '1') sessionStorage.setItem(KULCS, '1');
    if (mock !== '0' && sessionStorage.getItem(KULCS) === '1') CONFIG.USE_MOCK = true;
  } catch (e) {
    /* sessionStorage nem elérhető – marad az éles mód */
  }
})();

// A users.role értékek magyar megnevezése.
const SZEREPKOR_NEV = {
  specialist: 'Szakember',
  warehouse_manager: 'Raktárvezető',
  warehouse_worker: 'Raktáros',
  admin: 'Adminisztrátor',
};

/* A feladatkiírás hét állapota. A szakember viszi Új → Tervezet →
   Várakozik vagy Ütemezett, és a végén Befejezett vagy Sikertelen.
   Folyamatban állapotra a raktáros állítja kivételezéskor. */
const STATUSZ_SORREND = ['New', 'Draft', 'Wait', 'Scheduled', 'InProgress', 'Completed', 'Failed'];

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

const STATUSZ_PONT = {
  New: 'new',
  Draft: 'draft',
  Wait: 'wait',
  Scheduled: 'scheduled',
  InProgress: 'progress',
  Completed: 'completed',
  Failed: 'failed',
};

// Aktív = még nem zárult le. A raktár csak ezekre tart fenn készletet.
const AKTIV_STATUSZOK = ['New', 'Draft', 'Wait', 'Scheduled', 'InProgress'];
