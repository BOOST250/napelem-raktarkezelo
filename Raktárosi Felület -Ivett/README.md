# Raktárosi felület (4. fő – Frontend)

Sima HTML + CSS + JavaScript, keretrendszer nélkül. Eszter PHP végpontjait hívja `fetch`-csel (`js/api.js`).

## Mit tud

| Menüpont | Funkció |
|---|---|
| **Projektek** *(C.1)* | Az aktív projektek listája. Kivételezni az **ütemezett** (`Scheduled`) és **folyamatban lévő** (`InProgress`) projektekből lehet, ha minden alkatrészük le van foglalva. |
| **Kivételezés** *(C.1, C.2)* | A projekt kiválasztásakor egy `Scheduled` projekt státusza **automatikusan `InProgress`** lesz (`projects.php` PUT, a váltást a backend naplózza a `project_history`-ba). Alatta az alkatrészek: melyik rekeszből (azonosító, sor/oszlop/polc) hány darabot kell kivenni. Rekeszenként pipálható. Ha minden ki van pipálva, a **Kivételezés rögzítése** levonja a darabszámokat a rekeszekből (`bins.php` PUT). |
| **Útvonal** *(C.3)* | Ugyanezek bejárási sorrendben (soronként, minden második sor visszafelé – S-alakú útvonal), raktártérképpel. A pipák a Kivételezés nézettel közösek. |

A kivételezés előtt a felület friss készletet kér, és minden rekeszt ellenőriz; ha közben változott a készlet, nem ír semmit.

## Futtatás

**Éles mód** (alapértelmezett): a felület a `napelem/raktaros/` mappából fut, az API a `napelem/api/`-ban. Belépés a közös belépő oldalon (`../belepes/`), a szerepkör `warehouse_worker` (az SQL-ben: `raktaros1`).

**Demo mód** (backend nélkül, tesztadatokkal): `index.html?mock=1`. Dupla kattintással megnyitva (`file://`) automatikusan demo módra kapcsol. A demóban a bal alsó „Demo adatok visszaállítása” gomb visszaállítja a kezdőállapotot.

## Fájlok

```
index.html      oldalváz, menü
css/style.css   megjelenés (a másik két felülettel egyező színek, mobilon is használható)
js/config.js    API-cím, demo kapcsoló, státusznevek
js/api.js       fetch hívások, kivételezési terv és útvonal számítása
js/mock.js      demo backend (Eszter tesztadataival)
js/app.js       nézetek, pipák, rögzítés, belépés-ellenőrzés
```

## Használt végpontok (csak a meglévők, a backendhez nem kellett nyúlni)

`me.php`, `logout.php`, `projects.php` (GET, PUT `?id=` – státusz), `project_parts.php` (GET), `bins.php` (GET, PUT `?id=`)

## Ismert korlát

A feladatleírás a raktárosnak csak az összegyűjtést (C.1–C.3) írja elő, a készlet levonását nem; az adatbázisban nincs „kivételezve” állapot. Ezért:
1. A „kivételezve” jelölés csak abban a böngészőben él, ahol a raktáros rögzítette.
2. A foglalás (`project_parts.reserved`) a kivételezés után is megmarad, amíg a projekt `Completed` / `Failed` nem lesz. Eddig a raktárvezetői felület és a `receiving.php` szabad készlete (készlet − foglalt) a kivett darabokkal alacsonyabbnak látszik. A lezárás után a szám helyes.

Ha a csapat nem szeretné, hogy a raktáros levonja a készletet, az `app.js` `rogzit()` függvényében kihagyható az `Api.kivetelez(t)` hívás.
