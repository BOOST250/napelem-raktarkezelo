/* ================= Bejelentkezés =================
   Felhasználónév + jelszó → Api.login(). Csak raktárvezető (CONFIG.ENGEDETT_SZEREPKOR) léphet tovább.
   Regisztráció nincs: a felhasználókat az adminisztrátor veszi fel (users tábla). */

(() => {
  const $ = sel => document.querySelector(sel);
  const urlap = $('#login-form');
  const gomb = $('#login-submit');
  const hibaDoboz = $('#login-error');
  const infoDoboz = $('#login-info');

  const tovabb = () => location.replace('index.html' + location.search);
  const nincsJog = role =>
    `Ehhez a felülethez raktárvezetői jogosultság kell (a te szerepköröd: ${SZEREPKOR_NEV[role] ?? role}).`;

  function hiba(uzenet) {
    infoDoboz.hidden = true;
    hibaDoboz.textContent = uzenet;
    hibaDoboz.hidden = !uzenet;
  }

  if (location.hash === '#kijelentkezve') {
    infoDoboz.textContent = 'Sikeresen kijelentkeztél.';
    infoDoboz.hidden = false;
    history.replaceState(null, '', location.pathname + location.search);
  } else if (location.hash === '#nincs-jog') {
    hiba('Ehhez a felülethez raktárvezetői jogosultság kell.');
    history.replaceState(null, '', location.pathname + location.search);
  }

  // Demo módban a tesztfelhasználókra kattintva kitöltődik az űrlap
  if (CONFIG.USE_MOCK) {
    $('#demo-hint').hidden = false;
    $('#demo-hint').addEventListener('click', e => {
      const b = e.target.closest('button[data-user]');
      if (!b) return;
      $('#username').value = b.dataset.user;
      $('#password').value = b.dataset.pass;
      gomb.focus();
    });
  }

  // Ha már be van jelentkezve raktárvezetőként, egyből tovább
  Api.me()
    .then(user => { if (user.role === CONFIG.ENGEDETT_SZEREPKOR) tovabb(); })
    .catch(err => { if (err.status === 0) hiba(err.message); });

  urlap.addEventListener('submit', async e => {
    e.preventDefault();
    const username = $('#username').value.trim();
    const password = $('#password').value;
    if (!username || !password) {
      hiba('Add meg a felhasználónevet és a jelszót.');
      (username ? $('#password') : $('#username')).focus();
      return;
    }

    hiba('');
    gomb.disabled = true;
    gomb.textContent = 'Bejelentkezés…';
    try {
      const user = await Api.login(username, password);
      if (user.role !== CONFIG.ENGEDETT_SZEREPKOR) {
        await Api.logout().catch(() => {});
        hiba(nincsJog(user.role));
        return;
      }
      tovabb();
    } catch (err) {
      hiba(err.message);
      $('#password').select();
    } finally {
      gomb.disabled = false;
      gomb.textContent = 'Bejelentkezés';
    }
  });
})();
