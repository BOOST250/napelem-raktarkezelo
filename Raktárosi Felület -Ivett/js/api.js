/* ================= API réteg =================
   Minden szerverhívás és a kivételezési terv számítása itt van.

   Két megvalósítás közül a CONFIG.USE_MOCK választ, de MINDKETTŐ ugyanazokat a
   végpontokat „hívja” (parts.php, bins.php, projects.php, project_parts.php,
   me.php, logout.php): éles módban fetch-csel Eszter PHP-ját, demo módban a
   MockBackend-et. Így a tervezés és a kivételezés ugyanaz a kód mindkét módban.

   Az app.js csak az Api objektum függvényeit látja (alul, a return blokkban). */

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const Api = (() => {
  /* ---------------- HTTP ---------------- */

  function belepoOldalra(hash = '') {
    if (CONFIG.USE_MOCK) return;
    location.replace(CONFIG.BELEPO_OLDAL + hash);
  }

  async function kuld(method, fajl, body) {
    if (CONFIG.USE_MOCK) return MockBackend.handle(method, fajl, body);

    const options = {
      method,
      headers: { Accept: 'application/json' },
      credentials: 'include',   // a PHP session-süti miatt
    };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(CONFIG.API_BASE + fajl, options);
    } catch {
      throw new ApiError('A szerver nem érhető el. Fut az Apache és a MySQL a XAMPP-ban?', 0);
    }

    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new ApiError(`A szerver nem JSON választ adott: ${text.slice(0, 150)}`, res.status);
      }
    }
    if (!res.ok) {
      if (res.status === 401 && fajl !== '/me.php') belepoOldalra();
      throw new ApiError(data?.error || data?.message || `Hiba a kérés során (HTTP ${res.status})`, res.status);
    }
    return data;
  }

  /* ---------------- Segédek ---------------- */

  // A PHP a számokat gyakran stringként adja – itt egységesítjük.
  const szam = v => (v === null || v === undefined || v === '' ? 0 : Number(v));
  const lista = v => (Array.isArray(v) ? v : []);

  // Eszter adatbázisában nincs projektnév mező: megrendelő + helyszín adja.
  const projektNev = p => [p.customer_name, p.location].filter(Boolean).join(' – ') || `#${p.id}`;

  /* ---------------- Kivételezési terv ----------------
     Bemenet: a projekt, a projekt tételei (project_parts) és a rekeszek (bins).
     Kimenet: melyik rekeszből hány darabot kell kivenni, és milyen sorrendben. */

  /* A rekeszek bejárási sorrendje: soronként haladunk, és minden második sort
     visszafelé járjuk be (S-alakú útvonal), így nincs felesleges visszasétálás.
     Az első sor balról jobbra megy; egy oszlopon belül a polcok alulról felfelé.
     A bejáratot az 1. sor 1. oszlopánál feltételezzük. */
  function bejarasiSorrend(rekeszek) {
    const sorok = [...new Set(rekeszek.map(r => r.sor))].sort((a, b) => a - b);
    const ki = [];
    sorok.forEach((sor, i) => {
      const visszafele = i % 2 === 1;
      const sorban = rekeszek
        .filter(r => r.sor === sor)
        .sort((a, b) => (visszafele ? b.oszlop - a.oszlop : a.oszlop - b.oszlop) || a.polc - b.polc);
      ki.push(...sorban);
    });
    return ki;
  }

  function tervez(projekt, projektSorok, bins) {
    const tetelek = [];
    const kivesz = [];   // rekeszenként egy bejegyzés

    for (const pp of projektSorok) {
      const alkatreszId = szam(pp.part_id);
      const kell = szam(pp.quantity);
      let marad = kell;
      const helyek = [];

      // Előbb a teltebb rekeszeket ürítjük: kevesebb megállóból összejön a mennyiség.
      const jeloltek = bins
        .filter(b => b.part_id !== null && szam(b.part_id) === alkatreszId && szam(b.quantity) > 0)
        .sort((a, b) => szam(b.quantity) - szam(a.quantity) || szam(a.id) - szam(b.id));

      for (const b of jeloltek) {
        if (marad <= 0) break;
        const darab = Math.min(marad, szam(b.quantity));
        marad -= darab;
        const hely = {
          bin_id: szam(b.id),
          azonosito: String(b.identifier ?? ''),
          sor: szam(b.row_num),
          oszlop: szam(b.col_num),
          polc: szam(b.level_num),
          alkatresz_id: alkatreszId,
          nev: String(pp.part_name ?? ''),
          darab,
          raktaron: szam(b.quantity),
        };
        helyek.push(hely);
        kivesz.push(hely);
      }

      tetelek.push({
        alkatresz_id: alkatreszId,
        nev: String(pp.part_name ?? ''),
        kell,
        lefoglalt: szam(pp.reserved) === 1,
        helyek,
        hianyzik: Math.max(marad, 0),
      });
    }

    const lepesek = bejarasiSorrend(kivesz).map((h, i) => ({ ...h, sorszam: i + 1 }));

    // A teljes rács mérete a térképhez (az összes rekeszből, nem csak a mostaniakból).
    const sorokSzama = Math.max(0, ...bins.map(b => szam(b.row_num)));
    const oszlopokSzama = Math.max(0, ...bins.map(b => szam(b.col_num)));

    return {
      projekt,
      tetelek,
      lepesek,
      osszesDb: kivesz.reduce((s, h) => s + h.darab, 0),
      hianyzik: tetelek.some(t => t.hianyzik > 0),
      racs: { sorok: sorokSzama, oszlopok: oszlopokSzama },
    };
  }

  /* ---------------- Kifelé látszó műveletek ---------------- */

  async function me() {
    const adat = await kuld('GET', '/me.php');
    const u = adat?.user ?? {};
    return { id: szam(u.id), username: String(u.username ?? ''), role: String(u.role ?? '') };
  }

  async function logout() {
    await kuld('POST', '/logout.php').catch(() => {});
  }

  async function projektek() {
    const [projects, projectParts] = await Promise.all([
      kuld('GET', '/projects.php'),
      kuld('GET', '/project_parts.php'),
    ]);
    const sorok = lista(projectParts);

    return lista(projects)
      .filter(p => !LEZART_STATUSZOK.includes(p.status))
      .map(p => {
        const sajat = sorok.filter(x => szam(x.project_id) === szam(p.id));
        const foglalt = sajat.filter(x => szam(x.reserved) === 1).length;

        // A kivételezés akadálya (ha van) – ezt írjuk ki a gomb helyett.
        let akadaly = null;
        if (!KIVETELEZHETO_STATUSZOK.includes(p.status)) {
          akadaly = 'Még nem ütemezett: az alkatrészek foglalása után indulhat a kivételezés.';
        } else if (sajat.length === 0) {
          akadaly = 'Nincs alkatrész a projekthez rendelve.';
        } else if (foglalt < sajat.length) {
          akadaly = 'Nincs minden alkatrész lefoglalva.';
        }

        return {
          id: szam(p.id),
          nev: projektNev(p),
          megrendelo: String(p.customer_name ?? ''),
          helyszin: String(p.location ?? ''),
          statusz: String(p.status ?? ''),
          tetelek: sajat.length,
          darab: sajat.reduce((s, x) => s + szam(x.quantity), 0),
          foglalt,
          akadaly,
        };
      })
      // Kivételezhető projektek előre, aztán azonosító szerint
      .sort((a, b) => (a.akadaly ? 1 : 0) - (b.akadaly ? 1 : 0) || a.id - b.id);
  }

  async function terv(projektId) {
    const [projects, projectParts, bins] = await Promise.all([
      kuld('GET', '/projects.php'),
      kuld('GET', '/project_parts.php'),
      kuld('GET', '/bins.php'),
    ]);
    const p = lista(projects).find(x => szam(x.id) === projektId);
    if (!p) throw new ApiError('Nincs ilyen projekt.', 404);

    const projekt = {
      id: szam(p.id),
      nev: projektNev(p),
      helyszin: String(p.location ?? ''),
      leiras: String(p.description ?? ''),
      statusz: String(p.status ?? ''),
    };
    const sorok = lista(projectParts).filter(x => szam(x.project_id) === projektId);
    return tervez(projekt, sorok, lista(bins));
  }

  /* A kivételezés rögzítése: a kivett darabszámokat levonja a rekeszekből.

     Előbb friss állapotot kérünk, és MINDEN rekeszt ellenőrzünk, csak utána írunk –
     így ha közben valaki más (pl. egy másik raktáros) változtatott a készleten,
     nem kerül negatívba semmi.

     Figyelem: a bins.php-nak nincs „összes rekesz egy tranzakcióban” végpontja,
     ezért az írás rekeszenként külön PUT. Hálózati hiba esetén részben
     végrehajtott kivételezés maradhat – ezt a hibaüzenet külön jelzi. */
  async function kivetelez(terv) {
    const friss = lista(await kuld('GET', '/bins.php'));
    const index = new Map(friss.map(b => [szam(b.id), b]));

    const hibak = [];
    for (const l of terv.lepesek) {
      const b = index.get(l.bin_id);
      if (!b || szam(b.part_id) !== l.alkatresz_id) {
        hibak.push(`${l.azonosito}: a rekesz tartalma megváltozott`);
      } else if (szam(b.quantity) < l.darab) {
        hibak.push(`${l.azonosito}: csak ${szam(b.quantity)} db van benne, ${l.darab} db kellene`);
      }
    }
    if (hibak.length) {
      throw new ApiError(`A raktárkészlet közben megváltozott – töltsd újra az oldalt. (${hibak.join('; ')})`, 409);
    }

    let kesz = 0;
    for (const l of terv.lepesek) {
      try {
        await kuld('PUT', `/bins.php?id=${encodeURIComponent(l.bin_id)}`, {
          quantity: szam(index.get(l.bin_id).quantity) - l.darab,
        });
        kesz++;
      } catch (err) {
        throw new ApiError(
          `Részben rögzítve (${kesz}/${terv.lepesek.length} rekesz), a(z) ${l.azonosito} rekesznél hiba történt: ${err.message}`,
          err.status ?? 0,
        );
      }
    }
    return { rekeszek: kesz, darab: terv.osszesDb };
  }

  return {
    me,
    logout,
    belepoOldalra,
    projektek,
    terv,
    kivetelez,
    // csak a teszteléshez
    _tervez: tervez,
    _bejarasiSorrend: bejarasiSorrend,
  };
})();
