# Raktárvezetői felület

Sima HTML + CSS + JavaScript, keretrendszer nélkül. A szerverrel `fetch`-csel kommunikál (`js/api.js`). A felület szövege magyar.

A feladatkiírás B. pontjai:

| Követelmény | Hol |
|---|---|
| B.1 Új alkatrész (név, ár, max. darab / rekesz) | **Alkatrészek** → „+ Új alkatrész” |
| B.2 Árak módosítása | **Alkatrészek** → „Módosítás” |
| B.3 Hiányzó alkatrészek, a lefoglalások figyelembevételével (rendeléshez) | **Hiányzó alkatrészek** – rendelendő = aktív igény − raktárkészlet |
| B.4 Hiányzó, de már előre lefoglalt alkatrészek | **Előfoglalt hiányok** – Wait és Draft projektek készletre váró előfoglalása |
| B.5 Bevételezés, rekesz meghatározásával | **Bevételezés** – javaslat, szerkeszthető rekesz és mennyiség |
| B.6 Rekesz maximális darabszáma | **Rekeszek** → „Kapacitás”, új rekesznél is; bevételezéskor az alkatrész maximumával együtt érvényes |
| Készletből már lefoglalt tételek (a kiírás külön kéri a lefoglaltak listázását is) | **Lefoglalt alkatrészek** |

Az előfoglalás nem ugyanaz, mint a készletből való lefoglalás. Előfoglalás: a projekt igénye már le van adva (Wait, vagy még Draft), de a szabad készlet nem fedezi a teljes tételt, ezért a beérkező árura vár. A készletből lefoglalt tétel már a raktárban van, projekthez kötve.

## Futtatás

**Éles mód** az alapértelmezés (`js/config.js` → `USE_MOCK: false`). A felület a `napelem/raktarvezeto/` mappából hívja a `napelem/api/` végpontokat (`API_BASE: '../api'`).

1. XAMPP: Apache és MySQL.
2. Importáld a `napelemrendszer.sql` fájlt, utána a `napelemrendszer_illesztes.sql` fájlt. A második nélkül a szerepkörök magyar enum-értékek (`raktarvezeto`), a bevételezés viszont `warehouse_manager`-t vár.
3. A mappa a `htdocs/napelem/raktarvezeto/` helyre kerüljön, az API pedig `htdocs/napelem/api/`.
4. Nyisd meg `http://localhost/napelem/belepes/` címen, és `raktarvezeto1` / `Z12356` fiókkal lépj be (a dump jelszava; első belépéskor a backend hash-eli).
5. Csak `warehouse_manager` maradhat ezen a felületen. Más szerepkör a közös belépőre kerül vissza, kijelentkeztetés nélkül, hogy a saját felületére jusson.

Más címről (például `python -m http.server`) az API így adható meg: `index.html?api=http://localhost/napelem/api`. A böngészőt ne `file://` alól nyisd meg: a session-süti úgy nem megy el. A lap és az API legyen ugyanaz a host (`localhost` a `localhosttal`, ne keverd a `127.0.0.1`-gyel), különben a SameSite süti nem jut el a kéréshez.

**Demo mód** backend nélkül: `index.html?mock=1` (vissza élesre: `?mock=0`). Nyolc alkatrész, 24 rekesz, öt projekt, a módosítás a `localStorage`-ban marad (`raktarvezeto_demo_v2`). A bal alsó **„Demo adatok visszaállítása”** a kezdőadatot hozza vissza, kijelentkeztetés nélkül.

| Felhasználónév | Jelszó | Szerepkör | Beléphet? |
|---|---|---|---|
| `raktarvezeto` | `raktar123` | Raktárvezető | igen |
| `szakember` | `szakember123` | Szakember | nem |
| `raktaros` | `raktaros123` | Raktáros | nem |

## Amit a felület az API-tól vár

Az `app.js` magyar kulcsokkal dolgozik. Az `api.js` éles módban Eszter fájljaira fordít. Lista jöhet tömbként vagy `{"data":[...]}` alakban. A szám lehet string (a mysqli így adja). Hiba: 4xx/5xx és `{"error":"…"}`. A `{"success":false}` válasz HTTP 200 mellett is hiba.

| Felület | HTTP |
|---|---|
| Belépés | `POST login.php` `{"username","password"}` → `{"user":{"id","username","role"}}` |
| Munkamenet | `GET me.php` → `{"user":…}` vagy 401 |
| Kilépés | `POST logout.php` → `{"ok":true}` |
| Alkatrészek | `GET/POST parts.php`, `PUT parts.php?id=` – mezők: `name`, `price`, `max_per_bin` |
| Rekeszek | `GET/POST bins.php`, `PUT bins.php?id=` – `row_num`, `col_num`, `level_num`, `identifier`, `max_capacity`, `part_id`, `quantity` |
| Készlet és foglalás | `GET projects.php`, `GET project_parts.php` – a felület ezekből számol |
| Bevételezés | `POST receiving.php` `{"part_id","items":[{"bin_id","quantity"}]}` → `reserved`, `scheduled_projects` |

A rekesz azonosítója szöveg (`A1-1`: sor betűje, polc, oszlop), nem sorszám. Üres rekesz: `part_id` null. Egy rekeszbe csak egyféle alkatrész kerülhet. A bevételezés határa a rekesz `max_capacity` és az alkatrész `max_per_bin` közül a kisebb.

A hiányzó lista (B.3) az aktív projektek igénye mínusz a fizikai készlet. A lezárt (`Completed`, `Failed`) projekt nem számít. Az előfoglalt hiány (B.4) a Wait, majd a Draft sorokból az a rész, amit a szabad készlet nem fedez. Éles módban a `reserved` mező igen/nem: a `receiving.php` csak teljes tételt foglal, ezért egy kisebb szabad készlet „beragadhat” a következő, nagyobb előfoglalás mellett. A rendelendő mennyiség ettől függetlenül az igény és a teljes készlet különbsége.

A kérések `credentials: 'include'`-dal mennek. 401-re a felület a belépőre visz. 403-nál a hibaüzenet marad a képernyőn.

## Fájlok

```
raktarvezeto/
├── index.html      oldalváz, menü
├── login.html      saját belépő (csak demo módban)
├── css/style.css   megjelenés, mobil nézet
├── js/config.js    API-cím, demo kapcsoló, engedett szerepkör
├── js/api.js       fetch, mezőfordítás, B.3/B.4 számítás
├── js/mock.js      demo adatok (csak demo módban)
├── js/login.js     demo belépés
└── js/app.js       nézetek, űrlapok, belépés-ellenőrzés
```

## Ismert backend-eltérések

Ezeket ez a mappa nem javítja; Eszter `napelem` mappájában kell megoldani. Részletesen a pull request leírásában is szerepelnek.

- Üres rekesz felvétele `bins.php`-ban elbukik: a `part_id` NULL értéket az `bind_param("i", …)` 0-ra köti, az idegen kulcs ezt elutasítja. A NULL-t külön, kötés nélkül kell beszúrni.
- A `parts.php` és a `bins.php` bármely bejelentkezett szerepkört beenged (`kotelezo_bejelentkezes()` szerep nélkül), és a módosító metódusokat sem köti `warehouse_manager`-hez. A `PUT` nem ad 409-et, ha az új maximum kisebb, mint a rekeszben lévő mennyiség.
- Ismételt alkatrésznév vagy rekeszazonosító HTTP 500 és angol SQL-szöveg (a felület lefordítja, de a helyes válasz 409 lenne).
- A `users.role` a nyers dumpban magyar. Az illesztő SQL nélkül a bevételezés 403.
- A kiírás szerint a PHP csak objektumorientált keretrendszerrel együtt fogadható el. A mostani API keretrendszer nélküli, procedurális PHP.
