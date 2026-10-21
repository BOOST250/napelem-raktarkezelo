/* ================= Bejelentkezés (csak demo mód) =================
   Élesben a közös belépő (../belepes/) ellenőrzi a jelszót, és a
   warehouse_worker szerepkört ide irányítja. Ez az oldal a backend
   nélküli bemutatóhoz kell: a mock.js felhasználóival lép be, és csak
   a raktárost engedi tovább. */

(() => {
  if (!CONFIG.USE_MOCK) {
    location.replace('../belepes/' + location.hash);
    return;
  }

  const $ = sel => document.querySelector(sel);
  const urlap = $('#login-form');
  const gomb = $('#login-submit');
  const hibaDoboz = $('#login-error');
  const infoDoboz = $('#login-info');

  const tovabb = () => location.replace('index.html' + location.search);
  const nincsJog = role =>
    `Ehhez a felülethez raktárosi jogosultság kell (a te szerepköröd: ${SZEREPKOR_NEV[role] ?? role}).`;

  function hiba(uzenet) {
    infoDoboz.hidden = true;
    hibaDoboz.textContent = uzenet;
    hibaDoboz.hidden = !uzenet;
  }

  if (location.hash === '#kijelentkezve') {
    infoDoboz.textContent = 'Sikeresen kijelentkeztél.';
    infoDoboz.hidden = false;
    history.replaceState(null, '', location.pathname + location.search);
  }

  const hint = $('#demo-hint');
  hint.hidden = false;
  hint.addEventListener('click', e => {
    const b = e.target.closest('button[data-user]');
    if (!b) return;
    $('#username').value = b.dataset.user;
    $('#password').value = b.dataset.pass;
    gomb.focus();
  });

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
