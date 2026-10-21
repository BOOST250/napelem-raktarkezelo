/* ================= Legrövidebb kigyűjtési útvonal =================
   A feladatleírás ábrája szerint egy rekeszt a (sor, oszlop, szint)
   hármas határoz meg. A szint (polc) függőleges: ugyanannál a
   sornál és oszlopnál a különböző polcok EGY megállót jelentenek,
   oda nem kell külön odasétálni.

   A polcsorok párhuzamosak. A raktáros a sor mentén, oszlopról
   oszlopra közlekedik. Másik sorba csak a polcsor két végén lévő
   keresztfolyosón lehet átmenni (a polcokon nem lehet átvágni):

       bejárat / kiadó
       ════ első keresztfolyosó (az oszlopok előtt) ════
       [1. sor]  1.oszlop   2.oszlop   3.oszlop
       [2. sor]  ...
       ════ hátsó keresztfolyosó (az utolsó oszlop után) ════

   A bejárat a raktár elején van: (sor 0, oszlop 0). Egy lépés egy
   oszlopnyi vagy egy sornyi gyaloglás. A körutat (bejárat → minden
   megálló pontosan egyszer → vissza a kiadóhoz) Held–Karp algoritmussal
   számoljuk, amíg a megállók száma kezelhető; efölött legközelebbi
   szomszéd + 2-opt.

   A készlet több rekeszben is lehet. Ha egy rekesz fedezi az igényt,
   az összes ilyen rekesz jelölt, és azt a kombinációt választjuk,
   amelyiknek a körútja a legrövidebb. Ha egy rekesz nem elég, a
   minimális rekeszhalmazokat vizsgáljuk (mindegyikből kell venni). */

const Utvonal = (() => {
  const INF = 1e15;
  // depot + megállók. 15 csúcs: 2^15 × 15² lépés, böngészőben is azonnali.
  const MAX_EXAKT_CSOMOPONT = 15;
  const MAX_KOMBINACIO = 800;

  /** Két pont távolsága és hogy melyik folyosón éri meg menni. */
  function lepes(a, b, maxOszlop) {
    if (a.sor === b.sor) {
      return { tav: Math.abs(a.oszlop - b.oszlop), mod: 'sorban' };
    }
    const sorTav = Math.abs(a.sor - b.sor);
    const elso = a.oszlop + b.oszlop + sorTav;
    const hatar = maxOszlop + 1;
    const hatso = (hatar - a.oszlop) + (hatar - b.oszlop) + sorTav;
    if (elso <= hatso) return { tav: elso, mod: 'elso' };
    return { tav: hatso, mod: 'hatso' };
  }

  function tavolsag(a, b, maxOszlop) {
    return lepes(a, b, maxOszlop).tav;
  }

  const DEPOT = { sor: 0, oszlop: 0 };

  function kioszt(rekeszek, igeny) {
    const sorrend = [...rekeszek].sort((a, b) =>
      b.darab - a.darab
      || a.sor - b.sor
      || a.oszlop - b.oszlop
      || a.polc - b.polc
      || String(a.azonosito).localeCompare(String(b.azonosito), 'hu'));
    const out = [];
    let maradt = igeny;
    for (const rekesz of sorrend) {
      if (maradt <= 0) break;
      const kivenni = Math.min(maradt, rekesz.darab);
      if (kivenni > 0) {
        out.push({ rekesz, kivenni });
        maradt -= kivenni;
      }
    }
    return out;
  }

  /**
   * Egy alkatrész lehetséges leszedési tervei.
   * Minden terv: [{ rekesz, kivenni }]. Üres terv = nincs mit leszedni.
   */
  function forrasTervek(rekeszek, igeny) {
    const van = rekeszek.filter(r => r.darab > 0);
    if (igeny <= 0 || van.length === 0) return [[]];

    const teljes = van.filter(r => r.darab >= igeny);
    if (teljes.length) {
      return teljes.map(r => [{ rekesz: r, kivenni: igeny }]);
    }

    const ossz = van.reduce((s, r) => s + r.darab, 0);
    if (ossz < igeny || van.length > 10) return [kioszt(van, igeny)];

    const tervek = [];
    const n = van.length;
    for (let mask = 1; mask < (1 << n); mask++) {
      const valasztott = [];
      let sum = 0;
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) {
          valasztott.push(van[i]);
          sum += van[i].darab;
        }
      }
      if (sum < igeny) continue;
      // Minimális halmaz: bármelyik rekesz elhagyása már kevés lenne,
      // tehát mindegyikből tényleg kell venni.
      const minimal = valasztott.every(r => sum - r.darab < igeny);
      if (minimal) tervek.push(kioszt(valasztott, igeny));
    }
    return tervek.length ? tervek : [kioszt(van, igeny)];
  }

  function megallokTervbol(tervek) {
    const mapa = new Map();
    for (const terv of tervek) {
      for (const tetel of terv) {
        const { rekesz, kivenni } = tetel;
        const kulcs = `${rekesz.sor}:${rekesz.oszlop}`;
        if (!mapa.has(kulcs)) {
          mapa.set(kulcs, { sor: rekesz.sor, oszlop: rekesz.oszlop, kulcs, tetelek: [] });
        }
        mapa.get(kulcs).tetelek.push({
          rekesz_id: rekesz.id,
          azonosito: rekesz.azonosito,
          polc: rekesz.polc,
          nev: tetel.nev,
          alkatresz_id: tetel.alkatresz_id,
          kivenni,
        });
      }
    }
    for (const m of mapa.values()) {
      m.tetelek.sort((a, b) => a.polc - b.polc || String(a.azonosito).localeCompare(String(b.azonosito), 'hu'));
    }
    return [...mapa.values()].sort((a, b) => a.sor - b.sor || a.oszlop - b.oszlop || a.kulcs.localeCompare(b.kulcs));
  }

  function korTav(megallok, maxOszlop, sorrend) {
    const pontok = [DEPOT, ...sorrend.map(i => megallok[i])];
    let ossz = 0;
    for (let i = 0; i < pontok.length - 1; i++) ossz += tavolsag(pontok[i], pontok[i + 1], maxOszlop);
    ossz += tavolsag(pontok[pontok.length - 1], DEPOT, maxOszlop);
    return ossz;
  }

  /** Held–Karp, zárt körút a depóból. Visszaadja a megállók indexeit érkezési sorrendben. */
  function exaktKor(megallok, maxOszlop) {
    const pontok = [DEPOT, ...megallok];
    const n = pontok.length;
    const dist = (i, j) => tavolsag(pontok[i], pontok[j], maxOszlop);
    const size = 1 << n;
    const dp = Array.from({ length: size }, () => Array(n).fill(INF));
    const parent = Array.from({ length: size }, () => Array(n).fill(-1));
    dp[1][0] = 0;

    for (let mask = 0; mask < size; mask++) {
      for (let u = 0; u < n; u++) {
        const du = dp[mask][u];
        if (du >= INF || (mask & (1 << u)) === 0) continue;
        for (let v = 0; v < n; v++) {
          if (mask & (1 << v)) continue;
          const next = mask | (1 << v);
          const nd = du + dist(u, v);
          if (nd < dp[next][v]) {
            dp[next][v] = nd;
            parent[next][v] = u;
          }
        }
      }
    }

    const full = size - 1;
    let legjobb = INF;
    let veg = -1;
    for (let v = 1; v < n; v++) {
      const total = dp[full][v] + dist(v, 0);
      if (total < legjobb) {
        legjobb = total;
        veg = v;
      }
    }

    const forditott = [];
    let mask = full;
    let v = veg;
    let vedelem = 0;
    while (v > 0 && vedelem++ <= n) {
      forditott.push(v - 1); // megallok indexe (depot nélkül)
      const elozo = parent[mask][v];
      mask ^= (1 << v);
      v = elozo;
    }
    forditott.reverse();
    return { indexek: forditott, osszesen: legjobb >= INF ? 0 : legjobb };
  }

  function ketOpt(ut, dist) {
    const n = ut.length;
    let javult = true;
    while (javult) {
      javult = false;
      for (let i = 1; i < n - 1; i++) {
        for (let k = i + 1; k < n; k++) {
          const a = ut[i - 1];
          const b = ut[i];
          const c = ut[k];
          const d = k + 1 < n ? ut[k + 1] : ut[0];
          const regi = dist(a, b) + dist(c, d);
          const uj = dist(a, c) + dist(b, d);
          if (uj < regi) {
            const resz = ut.slice(i, k + 1).reverse();
            ut.splice(i, resz.length, ...resz);
            javult = true;
          }
        }
      }
    }
    return ut;
  }

  function heurisztika(megallok, maxOszlop) {
    const pontok = [DEPOT, ...megallok];
    const n = pontok.length;
    const dist = (i, j) => tavolsag(pontok[i], pontok[j], maxOszlop);
    const volt = Array(n).fill(false);
    const ut = [0];
    volt[0] = true;
    for (let lepesDb = 1; lepesDb < n; lepesDb++) {
      const u = ut[ut.length - 1];
      let best = -1;
      let bestD = INF;
      for (let v = 1; v < n; v++) {
        if (volt[v]) continue;
        const d = dist(u, v);
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      }
      volt[best] = true;
      ut.push(best);
    }
    ketOpt(ut, dist);
    const indexek = ut.slice(1).map(i => i - 1);
    let osszesen = 0;
    for (let i = 0; i < ut.length - 1; i++) osszesen += dist(ut[i], ut[i + 1]);
    osszesen += dist(ut[ut.length - 1], 0);
    return { indexek, osszesen };
  }

  function optimalisSorrend(megallok, maxOszlop) {
    if (megallok.length === 0) return { indexek: [], osszesen: 0 };
    if (megallok.length + 1 <= MAX_EXAKT_CSOMOPONT) return exaktKor(megallok, maxOszlop);
    return heurisztika(megallok, maxOszlop);
  }

  function szakaszokEpitese(megallok, indexek, maxOszlop) {
    const sorrend = indexek.map((idx, i) => {
      const m = megallok[idx];
      m.sorszam = i + 1;
      return m;
    });
    const szakaszok = [];
    let elozo = { ...DEPOT, felirat: 'Bejárat' };
    for (const m of sorrend) {
      const lep = lepes(elozo, m, maxOszlop);
      szakaszok.push({
        tav: lep.tav,
        mod: lep.mod,
        innen: elozo.felirat,
        ide: m.tetelek.map(t => t.azonosito).join(', '),
        megallo: m,
        vissza: false,
      });
      elozo = { sor: m.sor, oszlop: m.oszlop, felirat: m.tetelek.map(t => t.azonosito).join(', ') };
    }
    if (sorrend.length) {
      const lep = lepes(elozo, DEPOT, maxOszlop);
      szakaszok.push({
        tav: lep.tav,
        mod: lep.mod,
        innen: elozo.felirat,
        ide: 'Kiadó',
        megallo: null,
        vissza: true,
      });
    }
    const osszesen = szakaszok.reduce((s, sz) => s + sz.tav, 0);
    return { sorrend, szakaszok, osszesen };
  }

  function naivTav(megallok, maxOszlop) {
    const indexek = megallok.map((_, i) => i); // megallokTervbol már sor, oszlop szerint rendez
    return korTav(megallok, maxOszlop, indexek);
  }

  function depotKozel(terv, maxOszlop) {
    return terv.reduce((s, t) => s + tavolsag(DEPOT, t.rekesz, maxOszlop), 0);
  }

  /**
   * @param {{ raktar: { oszlopok: number, sorok?: number }, alkatreszek: Array }} bemenet
   * Az alkatrész: { id, nev, igenyelt, lefoglalva, rekeszek: [{ id, azonosito, sor, oszlop, polc, darab }] }
   */
  function utvonalTerv(bemenet) {
    const alkatreszek = (bemenet.alkatreszek || []).map(a => ({
      id: a.id,
      nev: a.nev,
      igenyelt: a.igenyelt,
      lefoglalva: !!a.lefoglalva,
      rekeszek: (a.rekeszek || []).map(r => ({ ...r, kivenni: 0 })),
      hiany: 0,
    }));

    const maxOszlop = Math.max(
      1,
      Number(bemenet.raktar?.oszlopok) || 0,
      ...alkatreszek.flatMap(a => a.rekeszek.map(r => r.oszlop)),
    );

    const gyujtendo = alkatreszek.filter(a => a.lefoglalva && a.igenyelt > 0);
    const tervListak = gyujtendo.map(a => forrasTervek(a.rekeszek, a.igenyelt).map(terv =>
      terv.map(t => ({ ...t, nev: a.nev, alkatresz_id: a.id }))));

    let kombok = null;
    const szorzat = tervListak.reduce((n, t) => n * Math.max(t.length, 1), 1);
    if (tervListak.length && szorzat <= MAX_KOMBINACIO && szorzat > 0) {
      kombok = [];
      for (let i = 0; i < szorzat; i++) {
        let x = i;
        const kombo = [];
        for (const tervek of tervListak) {
          const m = Math.max(tervek.length, 1);
          kombo.push(tervek[x % m] || []);
          x = Math.floor(x / m);
        }
        kombok.push(kombo);
      }
    }

    if (!kombok) {
      // Túl sok jelölt: alkatrészenként a legkevesebb rekesz, azon belül a bejárathoz közelebbi.
      kombok = [tervListak.map(tervek => {
        return [...tervek].sort((a, b) =>
          a.length - b.length || depotKozel(a, maxOszlop) - depotKozel(b, maxOszlop))[0] || [];
      })];
    }

    let legjobb = null;
    for (const kombo of kombok) {
      const megallok = megallokTervbol(kombo);
      let opt = optimalisSorrend(megallok, maxOszlop);
      // Ha a visszakeresés elhagyna egy megállót, a heurisztika akkor is végigmegy mindenen.
      if (new Set(opt.indexek).size !== megallok.length) opt = heurisztika(megallok, maxOszlop);
      const rekeszDb = kombo.reduce((s, t) => s + t.length, 0);
      const kulcs = megallok.map(m => m.kulcs).join('|');
      const jobb = !legjobb
        || opt.osszesen < legjobb.opt.osszesen
        || (opt.osszesen === legjobb.opt.osszesen && megallok.length < legjobb.megallok.length)
        || (opt.osszesen === legjobb.opt.osszesen && megallok.length === legjobb.megallok.length && rekeszDb < legjobb.rekeszDb)
        || (opt.osszesen === legjobb.opt.osszesen && megallok.length === legjobb.megallok.length && rekeszDb === legjobb.rekeszDb && kulcs < legjobb.kulcs);
      if (jobb) legjobb = { kombo, megallok, opt, rekeszDb, kulcs };
    }

    const valasztott = new Map(); // rekesz_id → kivenni, csak a választott tételek
    if (legjobb) {
      for (const terv of legjobb.kombo) {
        for (const t of terv) {
          valasztott.set(t.rekesz.id, (valasztott.get(t.rekesz.id) || 0) + t.kivenni);
        }
      }
    }

    for (const a of alkatreszek) {
      if (!a.lefoglalva) {
        a.hiany = 0;
        continue;
      }
      let kivett = 0;
      for (const r of a.rekeszek) {
        // Ugyanaz a rekesz csak egyféle alkatrészt tárol, ezért a rekesz id elég.
        const k = valasztott.get(r.id) || 0;
        if (k && kivett < a.igenyelt) {
          const adhato = Math.min(k, a.igenyelt - kivett);
          r.kivenni = adhato;
          kivett += adhato;
          valasztott.set(r.id, k - adhato);
        }
      }
      a.hiany = Math.max(0, a.igenyelt - kivett);
    }

    const megallok = legjobb ? legjobb.megallok : [];
    const ut = legjobb
      ? szakaszokEpitese(megallok, legjobb.opt.indexek, maxOszlop)
      : { sorrend: [], szakaszok: [], osszesen: 0 };
    const naiv = naivTav(megallok, maxOszlop);

    return {
      alkatreszek,
      megallok: ut.sorrend,
      raktar: {
        sorok: Math.max(Number(bemenet.raktar?.sorok) || 0, ...megallok.map(m => m.sor), 1),
        oszlopok: maxOszlop,
      },
      ut: {
        osszesen: ut.osszesen,
        naiv,
        megtakaritas: Math.max(0, naiv - ut.osszesen),
        szakaszok: ut.szakaszok,
      },
    };
  }

  return { lepes, tavolsag, utvonalTerv };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Utvonal;
