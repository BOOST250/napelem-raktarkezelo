/* ================= KÖZÖS BEJELENTKEZÉS =================

   Egyetlen belépő oldal mindhárom felülethez. A users tábla bármelyik
   fiókjával működik: a jelszót az api/login.php ellenőrzi, és a válaszban
   kapott szerepkör (users.role) dönti el, hová navigálunk.

   Regisztráció nincs: a felhasználókat az adminisztrátor veszi fel. */

(() => {

  /* A bejelentkezési végpontok mappája. Relatív útvonal, mert ez az oldal
     ugyanabból a napelem mappából szolgál ki, mint az api:
         .../napelem/belepes/   ←  ez az oldal
         .../napelem/api/       ←  login.php, me.php, logout.php
     Így bármelyik gépen és porton működik, és nincs CORS. */
  const AUTH_BASE = '../api';

  /* Szerepkör → felület. A `kesz` azt jelzi, hogy a felület használható-e
     már. Az adminisztrátornak nincs saját felülete, oda nem irányítunk. */
  const FELULETEK = {
    specialist: {
      nev: 'Szakember',
      ut: '../szakember/index.html',
      kesz: true,
    },
    warehouse_manager: {
      nev: 'Raktárvezető',
      ut: '../raktarvezeto/index.html',
      kesz: true,
    },
    warehouse_worker: {
      nev: 'Raktáros',
      ut: '../raktaros/index.html',
      kesz: true,
    },
    admin: {
      nev: 'Adminisztrátor',
      ut: null,          // ehhez a szerepkörhöz nem készült felület
      kesz: false,
    },
  };

  const $ = sel => document.querySelector(sel);

  const urlap = $('#belepo-urlap');
  const gomb = $('#belepo-gomb');
  const hibaDoboz = $('#belepo-hiba');
  const infoDoboz = $('#belepo-info');

  /* ---------------- visszajelzések ---------------- */

  function hiba(uzenet) {
    infoDoboz.hidden = true;
    hibaDoboz.textContent = uzenet;
    hibaDoboz.hidden = !uzenet;
  }

  function info(uzenet) {
    hibaDoboz.hidden = true;
    infoDoboz.textContent = uzenet;
    infoDoboz.hidden = !uzenet;
  }

  /* ---------------- HTTP ---------------- */

  // A PHP session cookie-ja miatt kell a credentials. Egyazon originről
  // ez amúgy is az alapértelmezés, de kiírjuk, hogy látható legyen.
  async function kuld(method, nev, torzs) {
    let valasz;
    try {
      valasz = await fetch(`${AUTH_BASE}/${nev}.php`, {
        method,
        credentials: 'same-origin',
        headers: torzs
          ? { Accept: 'application/json', 'Content-Type': 'application/json' }
          : { Accept: 'application/json' },
        body: torzs ? JSON.stringify(torzs) : undefined,
      });
    } catch {
      // Hálózati hiba: nem is jutott el a kérés a szerverig.
      const err = new Error('Nem érhető el a szerver. Fut az Apache és a MySQL a XAMPP-ban?');
      err.status = 0;
      throw err;
    }

    const szoveg = await valasz.text();
    let adat = null;
    try {
      adat = szoveg ? JSON.parse(szoveg) : null;
    } catch {
      const err = new Error(`A szerver nem JSON választ adott: ${szoveg.slice(0, 150)}`);
      err.status = valasz.status;
      throw err;
    }

    if (!valasz.ok) {
      const err = new Error(adat?.error || `Hiba a kérés során (HTTP ${valasz.status})`);
      err.status = valasz.status;
      throw err;
    }
    return adat;
  }

  /* ---------------- továbbítás szerepkör szerint ---------------- */

  function tovabb(user) {
    const cel = FELULETEK[user.role];

    // Olyan szerepkör, amihez nem készült felület (pl. admin), vagy
    // ismeretlen érték az adatbázisban.
    if (!cel || !cel.ut) {
      hiba(`Belépés sikeres (${user.username}), de a szerepköréhez `
         + `(${cel ? cel.nev : user.role}) nem tartozik felület.`);
      return;
    }

    // Készen lévő felület: egyből odamegyünk. A replace() azért jobb a
    // href-nél, mert így a Vissza gomb nem dobja ide a belépett embert.
    if (cel.kesz) {
      location.replace(cel.ut);
      return;
    }

    // Félig kész felület: nem navigálunk magától, hanem megmondjuk az okát.
    infoDoboz.hidden = false;
    hibaDoboz.hidden = true;
    infoDoboz.textContent = `Belépve: ${user.username} (${cel.nev}). `
      + 'Ez a felület még fejlesztés alatt áll. ';
    const link = document.createElement('a');
    link.href = cel.ut;
    link.textContent = 'Megnyitom mégis';
    infoDoboz.appendChild(link);
  }

  /* ---------------- jelszó megjelenítése ---------------- */

  const jelszoMezo = $('#jelszo');
  const mutatGomb = $('#jelszo-mutat');

  mutatGomb.addEventListener('click', () => {
    const latszik = jelszoMezo.type === 'password';
    jelszoMezo.type = latszik ? 'text' : 'password';
    mutatGomb.setAttribute('aria-pressed', String(latszik));
    const felirat = latszik ? 'Jelszó elrejtése' : 'Jelszó megjelenítése';
    mutatGomb.setAttribute('aria-label', felirat);
    mutatGomb.title = felirat;
    mutatGomb.querySelector('.szem-nyitott').toggleAttribute('hidden', latszik);
    mutatGomb.querySelector('.szem-csukott').toggleAttribute('hidden', !latszik);
    jelszoMezo.focus();
  });

  /* ---------------- induláskor ---------------- */

  if (location.hash === '#kijelentkezve') {
    info('Sikeresen kijelentkeztél.');
    history.replaceState(null, '', location.pathname);
  }

  // Ha van élő session, nem kérdezzük meg újra a jelszót.
  kuld('GET', 'me')
    .then(adat => { if (adat?.user) tovabb(adat.user); })
    .catch(err => {
      // A 401 itt a normális eset: nincs bejelentkezve. Csak a szerver
      // elérhetetlenségét érdemes azonnal jelezni.
      if (err.status === 0) hiba(err.message);
    });

  /* ---------------- belépés ---------------- */

  urlap.addEventListener('submit', async e => {
    e.preventDefault();

    const username = $('#felhasznalonev').value.trim();
    const password = $('#jelszo').value;

    if (!username || !password) {
      hiba('Add meg a felhasználónevet és a jelszót.');
      (username ? $('#jelszo') : $('#felhasznalonev')).focus();
      return;
    }

    hiba('');
    gomb.disabled = true;
    gomb.textContent = 'Bejelentkezés…';

    try {
      const adat = await kuld('POST', 'login', { username, password });
      tovabb(adat.user);
    } catch (err) {
      hiba(err.message);
      $('#jelszo').select();
    } finally {
      gomb.disabled = false;
      gomb.textContent = 'Bejelentkezés';
    }
  });

})();
