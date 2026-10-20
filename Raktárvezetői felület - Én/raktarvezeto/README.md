# Raktárvezetői felület (3. fő – Frontend)

Sima HTML + CSS + JavaScript, keretrendszer és telepítés nélkül. A szerverrel `fetch`-csel kommunikál (`js/api.js`).

## Futtatás

**Demo mód (backend nélkül)** – alapértelmezett (`js/config.js` → `USE_MOCK: true`):
- Nyisd meg az `index.html`-t böngészőben, vagy tedd a mappát a XAMPP `htdocs` alá és nyisd meg `http://localhost/.../raktarvezeto/`.
- Beépített tesztadatokkal működik (8 alkatrész, 24 rekesz, 5 projekt), a módosítások a böngészőben (localStorage) maradnak.
- A bal alsó **„Demo adatok visszaállítása”** gomb visszaállítja a kezdőállapotot.

**Éles mód (az 1. fő PHP API-jával)**:
1. `js/config.js`: `API_BASE` = a PHP API címe, `USE_MOCK: false`
2. vagy módosítás nélkül: `index.html?mock=0` (vissza demóra: `?mock=1`)

## Bejelentkezés

A felület csak bejelentkezés után érhető el, és csak **raktárvezető** (`warehouse_manager`) szerepkörrel. Bejelentkezés nélkül az `index.html` a `login.html`-re irányít. Regisztráció nincs, a felhasználókat az adminisztrátor veszi fel.

**Demo mód** – beépített tesztfelhasználók (a login oldalon rájuk kattintva kitöltődik az űrlap):

| Felhasználónév | Jelszó | Szerepkör | Beléphet? |
|---|---|---|---|
| `raktarvezeto` | `raktar123` | Raktárvezető | igen |
| `szakember` | `szakember123` | Szakember | nem – jogosultsági hiba |
| `raktaros` | `raktaros123` | Raktáros | nem – jogosultsági hiba |

A demo munkamenet a localStorage-ban van, a „Demo adatok visszaállítása” nem jelentkeztet ki.

**Éles mód** – PHP session (cookie) a 2. fő backendjében (`napelem/auth/Auth.php`):
- `js/config.js` → `AUTH_BASE` = az auth-végpontok mappája (alapból `http://localhost/napelem/api`).
- A frontendet `http://localhost…` címről nyisd meg (pl. XAMPP `htdocs` vagy `localhost:8123`), **ne dupla kattintással** – `file://` alól a böngésző nem küldi el a session-cookie-t.
- Kezdő felhasználó felvétele: `POST users.php` `{"username":"admin", "password":"…", "role":"warehouse_manager"}` – a jelszó már hash-elve kerül az adatbázisba. A régi, sima szövegként mentett jelszavak is működnek: első belépéskor automatikusan hash-re cserélődnek.

| | |
|---|---|
| `POST login.php` | kérés: `{"username":"...", "password":"..."}` → `{"user":{"id":1, "username":"...", "role":"warehouse_manager"}}`; 400 hiányzó mező, 401 hibás adatok |
| `GET me.php` | `{"user":{...}}` vagy 401, ha nincs bejelentkezve |
| `POST logout.php` | `{"ok":true}` – munkamenet törlése |

Ezek a végpontok a kérő `Origin`-t küldik vissza `Access-Control-Allow-Credentials: true` mellett (cookie-hoz a `*` nem engedett), és a frontend csak ezeket hívja `credentials: 'include'`-dal. A többi végpont (`parts`, `bins` …) még nincs védve; ehhez az elejükre kell: `$auth = new Auth($conn); $auth->requireLogin(['warehouse_manager']);` (401 / 403 – a frontend 401-re a login oldalra irányít).

## Követelmények → hol találod

| Követelmény | Menüpont |
|---|---|
| Új alkatrész felvétele | **Alkatrészek** → „+ Új alkatrész” |
| Árak módosítása | **Alkatrészek** → „Módosítás” |
| Rekesz maximális kapacitás kezelése | **Alkatrészek** → „Módosítás” (max. db / rekesz), bevételezéskor ellenőrizve; **Rekeszek** → telítettség, „+ Új rekesz” |
| Bevételezés (rekesz + készlet) | **Bevételezés** – automatikus elhelyezési javaslat, szerkeszthető rekesz / mennyiség |
| Hiányzó alkatrészek listázása | **Hiányzó alkatrészek** (+ „Bevételezés →” gyorsgomb) |
| Lefoglalt alkatrészek listázása | **Lefoglalt alkatrészek** (projekt vagy alkatrész szerint) |
| Kommunikáció az API-val (fetch) | `js/api.js` – minden hívás itt van |

## Fájlok

```
raktarvezeto/
├── index.html      oldalváz, menü
├── login.html      bejelentkező oldal
├── css/style.css   megjelenés (világos/sötét téma, mobil nézet)
├── js/config.js    API cím, demo mód kapcsoló, engedett szerepkör
├── js/api.js       fetch hívások + válaszok egységesítése, login/me/logout
├── js/mock.js      demo backend + demo felhasználók (csak demo módban)
├── js/login.js     bejelentkezés logikája
└── js/app.js       nézetek, űrlapok, logika, belépés-ellenőrzés
```

---

## API-szerződés (az 1. fő backendjéhez)

A frontend ezeket a végpontokat hívja. Az URL = `API_BASE` + útvonal, pl.
`http://localhost/raktar/api/index.php/alkatreszek` – így PHP-ban `$_SERVER['PATH_INFO']` = `/alkatreszek`, `.htaccess` sem kell.

**Általános szabályok**
- Kérés és válasz JSON (UTF-8). POST/PUT törzse: `json_decode(file_get_contents('php://input'), true)`.
- Hiba esetén 4xx/5xx HTTP kód + `{"error": "Magyar nyelvű üzenet"}` – a felület ezt írja ki.
- A számok jöhetnek stringként is (PDO alapból így adja), a frontend átalakítja. Listát adhatsz sima tömbként vagy `{"data": [...]}` formában.
- Az oszlopnevek eltérhetnek, csak a JSON-ban legyenek ezek a kulcsok (`SELECT ... AS max_darab`).

### Alkatrészek
| | |
|---|---|
| `GET /alkatreszek` | `[{"id":1, "nev":"Napelem panel 410W", "ar":52000, "max_darab":10, "keszlet":26, "lefoglalt":26}]` |
| `POST /alkatreszek` | kérés: `{"nev":"...", "ar":52000, "max_darab":10}` → válasz: a létrehozott alkatrész |
| `PUT /alkatreszek/{id}` | kérés: `{"ar":49900, "max_darab":10}` → válasz: a módosított alkatrész |

- `max_darab` = legfeljebb hány darab fér **egy rekeszbe** ebből az alkatrészből.
- `keszlet` = a rekeszekben lévő darabok összege; `lefoglalt` = aktív projektekhez lefoglalt darabszám.
- PUT: 409, ha `max_darab` kisebb lenne, mint amennyi valamelyik rekeszben már van. POST: 409 ha a név már létezik.

### Rekeszek
| | |
|---|---|
| `GET /rekeszek` | `[{"id":1, "sor":1, "oszlop":1, "polc":1, "rekesz":1, "alkatresz_id":1, "darab":10}]` – üres rekesznél `alkatresz_id: null`, `darab: 0` |
| `POST /rekeszek` | kérés: `{"sor":2, "oszlop":3, "polc":2, "rekesz":3}` → üres rekesz jön létre; 409 ha a hely már létezik |

### Bevételezés
`POST /bevetelezes`
```json
{ "alkatresz_id": 1, "tetelek": [ { "rekesz_id": 3, "darab": 4 }, { "rekesz_id": 4, "darab": 10 } ] }
```
A backend feladata:
1. Ellenőrzés (hiba esetén semmit ne módosítson): a rekesz üres vagy ugyanez az alkatrész van benne; `jelenlegi + darab ≤ max_darab`.
2. Rekeszek frissítése (`alkatresz_id`, `darab`).
3. Az új szabad készletből foglalás a hiányos projektekhez (előbb `Wait`, aztán `Draft`).
4. Ha egy `Wait` projekt minden alkatrésze le van foglalva → státusza `Scheduled`.

Válasz (a `lefoglalva` és `utemezett_projektek` opcionális, értesítéshez használjuk):
```json
{ "ok": true, "lefoglalva": 14, "utemezett_projektek": [ { "id": 2, "nev": "Nagy és Társa Kft. – Budaörs" } ] }
```

### Hiányzó alkatrészek
`GET /hianyzo` – alkatrészenként, ahol az igényelt > lefoglalt (aktív projekteknél):
```json
[ { "alkatresz_id": 1, "nev": "Napelem panel 410W", "hianyzo_darab": 14,
    "projektek": [ { "id": 2, "nev": "Nagy és Társa Kft. – Budaörs", "statusz": "Wait", "darab": 6 } ] } ]
```

### Lefoglalt alkatrészek
`GET /lefoglalt` – egy sor = egy projekt egy alkatrésze, ahol van foglalás (`igenyelt` opcionális):
```json
[ { "projekt_id": 1, "projekt_nev": "Kovács család – Érd", "statusz": "Scheduled",
    "alkatresz_id": 1, "nev": "Napelem panel 410W", "darab": 12, "igenyelt": 12 } ]
```

### PHP fejléc (index.php elejére)
Kell, ha a frontend nem ugyanarról a címről fut, mint az API (pl. dupla kattintással megnyitva):
```php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
```
