/* Közös mezőellenőrzés az új projekt űrlaphoz és a szerkesztéshez.
   A hosszak a projects tábla oszlopaiból jönnek. */

function projektAdatHiba(adat) {
  const location = String(adat.location ?? '').trim();
  const name = String(adat.customer_name ?? '').trim();
  const email = String(adat.customer_email ?? '').trim();
  const phone = String(adat.customer_phone ?? '').trim();
  const description = String(adat.description ?? '').trim();

  if (!location) return 'A helyszín megadása kötelező.';
  if (location.length > 255) return 'A helyszín legfeljebb 255 karakter lehet.';
  if (!name) return 'Az ügyfél nevének megadása kötelező.';
  if (name.length > 100) return 'Az ügyfél neve legfeljebb 100 karakter lehet.';
  if (description.length > 5000) return 'A leírás legfeljebb 5000 karakter lehet.';
  if (email.length > 100) return 'Az e-mail cím legfeljebb 100 karakter lehet.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Az e-mail cím formátuma érvénytelen.';
  }
  if (phone.length > 20) return 'A telefonszám legfeljebb 20 karakter lehet.';
  if (phone && !/^[+0-9][0-9 +\-/()]{4,19}$/.test(phone)) {
    return 'A telefonszám csak számot, szóközt és a + - / ( ) jeleket tartalmazhatja.';
  }
  return null;
}

/* work_hours decimal(5,2), labor_cost decimal(10,2). Mindkettő kell az árkalkulációhoz. */
function munkaAdatHiba(oraSzoveg, dijSzoveg) {
  const ora = String(oraSzoveg ?? '').trim().replace(',', '.');
  const dij = String(dijSzoveg ?? '').trim().replace(',', '.');

  if (ora === '' || dij === '') {
    return 'A munkaóra és a munkadíj megadása is kötelező.';
  }
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(ora)) {
    return 'A munkaóra legfeljebb 999,99 lehet, két tizedesjegyig.';
  }
  if (!(Number(ora) > 0)) return 'A munkaóra legyen nagyobb nullánál.';
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(dij)) {
    return 'A munkadíj legfeljebb 99 999 999,99 Ft lehet, és nem lehet negatív.';
  }
  return null;
}
