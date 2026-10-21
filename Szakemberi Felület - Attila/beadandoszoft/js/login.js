// =====================================
// BEJELENTKEZÉS
// =====================================
//
// Eszter login.php / me.php / logout.php végpontjait használja az Api
// rétegen keresztül. A PHP session-cookie-t a böngésző kezeli, itt nem
// tárolunk se tokent, se jelszót.
//
// Fontos: ez a felület csak szakember szerepkörrel használható
// (CONFIG.ENGEDETT_SZEREPKOR). Ha valaki raktárvezetőként vagy
// raktárosként lép be, azonnal kiléptetjük, hogy ne maradjon félkész
// session a böngészőben.

document.addEventListener('DOMContentLoaded', () => {

  // Éles módban a közös belépő dönti el a szerepkör alapján, hová megy a felhasználó.
  if (!CONFIG.USE_MOCK) {
    location.replace(CONFIG.BELEPES + location.hash);
    return;
  }

  const urlap = document.getElementById('login-form');
  const nevMezo = document.getElementById('username');
  const jelszoMezo = document.getElementById('password');
  const gomb = document.getElementById('login-submit');
  const hibaBox = document.getElementById('login-error');
  const infoBox = document.getElementById('login-info');

  function hiba(szoveg) {
    hibaBox.textContent = szoveg;
    hibaBox.classList.remove('login-hidden');
  }

  function hibaTorles() {
    hibaBox.textContent = '';
    hibaBox.classList.add('login-hidden');
  }

  function info(szoveg) {
    infoBox.textContent = szoveg;
    infoBox.classList.remove('login-hidden');
  }

  // Milyen szerepkör kellene, és mi jött helyette
  function nincsJog(szerepkor) {
    const kell = SZEREPKOR_NEV[CONFIG.ENGEDETT_SZEREPKOR] || CONFIG.ENGEDETT_SZEREPKOR;
    const kapott = SZEREPKOR_NEV[szerepkor] || szerepkor || 'ismeretlen';
    hiba(`Ehhez a felülethez ${kell} szerepkör kell, a megadott fiók viszont ${kapott}.`);
  }

  // ---- Kijelentkezés utáni visszajelzés ----
  // Az app.js a sikeres logout után ide navigál #kijelentkezve hash-sel.
  const kijelentkezett = location.hash === '#kijelentkezve';
  if (kijelentkezett) {
    info('Sikeresen kijelentkeztél.');
    history.replaceState(null, '', location.pathname);
  }

  const demoHint = document.getElementById('demo-hint');
  if (demoHint) {
    demoHint.hidden = false;
    demoHint.addEventListener('click', event => {
      const gombFelhasznalo = event.target.closest('button[data-user]');
      if (!gombFelhasznalo) return;
      nevMezo.value = gombFelhasznalo.dataset.user;
      jelszoMezo.value = gombFelhasznalo.dataset.pass;
      gomb.focus();
    });
  }

  // ---- Már be van jelentkezve? Akkor tovább a kezdőlapra ----
  if (!kijelentkezett) {
    Api.me()
      .then(user => {
        if (user && user.role === CONFIG.ENGEDETT_SZEREPKOR) {
          location.replace('index.html');
        }
      })
      // 401 = nincs session, ez a normális eset a belépő oldalon.
      .catch(() => {});
  }

  // ---- Belépés ----
  urlap.addEventListener('submit', async event => {
    event.preventDefault();
    hibaTorles();

    const username = nevMezo.value.trim();
    const password = jelszoMezo.value;

    if (!username || !password) {
      hiba('A felhasználónév és a jelszó megadása kötelező.');
      return;
    }

    gomb.disabled = true;
    gomb.textContent = 'Bejelentkezés...';

    try {
      const user = await Api.login(username, password);

      if (!user) {
        hiba('A szerver nem adott vissza felhasználót. Ellenőrizd a login.php választ.');
        return;
      }

      if (user.role !== CONFIG.ENGEDETT_SZEREPKOR) {
        // Ne hagyjunk érvényes session-t egy olyan fiókkal, amit itt
        // nem lehet használni.
        await Api.logout().catch(() => {});
        nincsJog(user.role);
        return;
      }

      location.replace('index.html');

    } catch (err) {
      hiba(err.message || 'Nem sikerült bejelentkezni.');
    } finally {
      gomb.disabled = false;
      gomb.textContent = 'Bejelentkezés';
    }
  });

});
