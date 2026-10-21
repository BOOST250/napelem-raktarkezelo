# Szakemberi felület

Sima HTML + CSS + JavaScript, keretrendszer nélkül. A szerverrel `fetch` kommunikál (`js/api.js`). Telepítéskor ez a mappa a `htdocs/napelem/szakember/` helyre kerül, a közös belépő mellé.

A felület a feladatkiírás **A.1–A.7** pontját fedi le. Az állapotok a kiírás szerint változnak, és minden váltás bekerül a `project_history` táblába.

## A szakember teendői

| Követelmény | Hol |
|---|---|
| A.1 Új projekt, állapot `New`, helyszín, leírás, megrendelő | **Projektek** → „+ Új projekt” |
| A.2 Projektek és állapotok | **Kezdőlap** és **Projektek** (keresés, státuszszűrő) |
| A.3 Alkatrész, ár, elérhetőség | **Alkatrészek** – a szabad készlet a foglalások után megmaradó mennyiség |
| A.4 Alkatrész a projekthez, állapot `Draft` | Projekt oldal. Van szabad készlet → **lefoglalva** (`reserved = 1`). Nincs → **előfoglalás** (`reserved = 0`), a bevételezés később foglalja le |
| A.5 Becsült munkaóra és munkadíj | Projekt oldal → „Becsült munka” |
| A.6 Árkalkuláció | „Árkalkuláció elkészítése”. Hiányzó készlet → `Wait`. Minden tétel foglalt és a munkadíj megvan → `Scheduled`, végleges ár = anyag + munkadíj |
| A.7 Lezárás `Completed` / `Failed` | Csak `InProgress` állapotból. Folyamatban állapotra a **raktáros** állítja a kivételezéskor (C.1) |

Állapot előzményei a projekt oldal alján látszanak.

## Állapotok

1. **New** – a projekt létrejött, felmérés még nincs.
2. **Draft** – felmérés, az alkatrészlista még szerkeszthető. Az első tétel ide lépteti az Új projektet.
3. **Wait** – az árkalkuláció nem fejezhető be, mert valamiből nincs elég raktárkészlet. Az előfoglalt sorokat a raktárvezető bevételezése tudja lefoglalni; ha egy Várakozik projekt minden tétele megvan, a bevételezés Ütemezettre állítja.
4. **Scheduled** – az árkalkuláció kész, a kivitelezésre vár.
5. **InProgress** – a raktáros kezdte meg a kivételezést. A szakemberi felület ezt nem állítja.
6. **Completed** / **Failed** – a szakember zárja le, utána az adatok nem módosíthatók.

A lezárt projekt foglalása már nem köti a szabad készletet (a készletszámítás csak az aktív állapotokat veszi figyelembe, ahogy a bevételezés is).

## Futtatás éles módban

A gyökér README XAMPP-elrendezése kell: `htdocs/napelem/` alatt az `api`, az `auth`, a `config`, a `belepes` és ez a mappa `szakember` néven.

1. Apache és MySQL.
2. Import: `napelemrendszer.sql`, utána `napelemrendszer_illesztes.sql`.
3. Nyisd meg a kiszolgáló címén: `http://<szerver>/napelem/belepes/`  
   A `<szerver>` lehet `localhost` vagy a gép LAN-IP-je (például `192.168.0.10`). A másik gépről is ez a cím kell, a felület nem kötődik egy gépnévhez.

Szakemberként a `users` tábla `specialist` szerepköre léphet be. A dump illesztése után: **szakember1** / **A12346**. A jelszó első belépéskor hash-re cserélődik. Más szerepkör a saját felületére kerül, erről a képernyőről a közös belépő nem engedi tovább.

A felület saját `login.html` oldala éles módban azonnal a közös belépőre visz. A lapot a webszerveren keresztül kell megnyitni, nem `file://` címről, különben a böngésző nem küldi a session sütit.

A címek a `js/config.js`-ben vannak, egy gyökérből. A gyökeret a lap útvonala adja (`/napelem`), host nélkül:

| Kulcs | Érték |
|---|---|
| `API_BASE` | `/napelem/api` |
| `AUTH_BASE` | `/napelem/api` (itt van a `login.php`, a `me.php` és a `logout.php`) |
| `BELEPES` | `/napelem/belepes/` |

## Demo mód (backend nélkül)

Bármelyik oldal címéhez: `?mock=1` (vissza: `?mock=0`). A választás a böngészőlapon megmarad, az aloldalak is demóban nyílnak. Az adat a `localStorage`-ban van, a közös adatbázist nem írja.

Demo belépés a felület saját login oldalán (a gomb kitölti az űrlapot):

| Felhasználónév | Jelszó | Beléphet? |
|---|---|---|
| `szakember` | `szakember123` | igen |
| `raktarvezeto` | `raktar123` | nem |
| `raktaros` | `raktaros123` | nem |

A sárga sávon a „Demo adatok visszaállítása” a kezdő projekteket hozza vissza, kijelentkeztetés nélkül. A mintaadatok között van Folyamatban projekt is, azon az A.7 lezárás azonnal kipróbálható.

## Új API-végpontok

A meglévő `projects.php` és `project_parts.php` **nem módosult**. A foglalás, az árkalkuláció és a lezárás egy tranzakcióban több táblát ír, ezért külön végpontok készültek (objektumorientált `SpecialistProjectService`). Mind szakember vagy admin sessionnel hívható, és állapotváltáskor a `project_history` táblába ír.

| Végpont | Szerepe |
|---|---|
| `POST project_assign.php` | `{project_id, part_id, quantity}` – foglalás vagy előfoglalás, Új → Tervezet |
| `POST project_quote.php` | `{project_id}` – árkalkuláció, eredménye `Wait` vagy `Scheduled` |
| `POST project_close.php` | `{project_id, status}` – csak `InProgress` → `Completed` vagy `Failed` |
| `PUT project_contact.php?id=` | `{customer_email, customer_phone}` – ezt a két mezőt a `projects.php` PUT-ja nem menti |

A helyszín, a leírás, az ügyfél neve, a munkaóra és a munkadíj továbbra is a `projects.php` PUT-ján megy. Az ügyfél e-mailje és telefonszáma nem kötelező; ha meg van adva, a felület ellenőrzi a formátumot és a tábla hosszát.

A feladatkiírás a PHP-t csak keretrendszerrel, objektumorientáltan fogadja el. A csapat stackje keretrendszer nélküli PHP, ezt a felület nem cseréli le. Az új végpontok osztályban vannak (`SpecialistProjectService`); a keretrendszerre váltás kockázata a pull request leírásában is szerepel.

## Fájlok

```
szakember/
├── index.html              kezdőlap, állapot összesítő
├── login.html              csak demo mód; élesben átirányít a közös belépőre
├── pages/projects.html     projektek listája
├── pages/new-project.html  új projekt
├── pages/project.html      igény, munka, ár, lezárás, napló
├── pages/parts.html        alkatrész, ár, szabad készlet
├── css/
└── js/   config, api, mock, validate, app, dashboard, projects, project, parts, new-project, login
```
