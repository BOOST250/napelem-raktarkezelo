# Raktárosi felület

Sima HTML + CSS + JavaScript, keretrendszer nélkül. A szerverrel `fetch`-csel kommunikál (`js/api.js`). A gyalogutat a böngésző számolja (`js/route.js`), ehhez nincs külön végpont.

A követelmény a feladatleírás **C** pontja:

1. Projektek listázása, projekt kiválasztása kivételezéshez, a státusz automatikus `InProgress` értéke.
2. A projekthez tartozó alkatrészek és a helyük: sor, oszlop, polc, valamint a rekesz egyedi, olvasható azonosítója.
3. Az összegyűjtés útvonalának optimalizálása a polcrendszeren.

## Futtatás

A mappa a XAMPP-ban ide kerül (a gyökér README szerint):

```
htdocs/napelem/raktaros/    ← ez a mappa
```

Nyisd meg: <http://localhost/napelem/belepes/> — raktáros szerepkörrel ide irányít. Másik gépről ugyanez a szerver IP-címével (`http://192.168.x.x/napelem/belepes/`). Az API cím **gyökér-relatív** (`/napelem/api`), ezért a kérés ahhoz a géphez megy, amelyik a lapot adta; a `http://localhost/...` cím LAN-on a kliens saját gépére mutatna, azt nem használjuk.

**Demo mód (backend nélkül)** — `index.html?mock=1`:

- Beépített tesztadatok (a `napelemrendszer.sql` + illesztés készlete, plusz egy AC-kábel a `C1-3` rekeszben, hogy két rekesz közül válasszon az útvonal).
- A módosítás a böngésző `localStorage`-ában marad. A **Demo adatok visszaállítása** gomb a kezdőállapotra írja vissza, és nem jelentkeztet ki.
- Saját belépő: `login.html?mock=1`

| Felhasználónév | Jelszó | Szerepkör | Beléphet? |
|---|---|---|---|
| `raktaros` | `raktaros123` | Raktáros | igen |
| `raktarvezeto` | `raktar123` | Raktárvezető | nem |
| `szakember` | `szakember123` | Szakember | nem |

**Éles mód** — `js/config.js` alapból `USE_MOCK: false`, felülírás: `?mock=0`.

- `API_BASE` és `AUTH_BASE`: `/napelem/api`
- Bejelentkezés a közös oldalon (`../belepes/`), PHP session. A lapot `http://…/napelem/raktaros/` alól nyisd, ne `file://` módban.
- Éles fiók az adatbázisban: `raktaros1`, szerepkör `warehouse_worker` (az illesztő SQL után).

## Mit csinál a felület

| Menü | Feladat |
|---|---|
| **Kezdőlap** | Hány projekt vár kigyűjtésre, melyik már folyamatban |
| **Projektek** | Minden projekt. Ütemezett soron a **Kivételezés** gomb `InProgress`-re állítja az állapotot |
| **Kivételezés** | Alkatrészenként a rekeszek: azonosító, sor, oszlop, polc, készlet, és hogy ebből mennyit visz az útvonal |
| **Útvonal** | A legrövidebb körút, megállónként a folyosó és a lépésszám, valamint a polctérkép |

Útvonalmodell (a feladatleírás polcábrája): a sorok párhuzamos polcsorok, az oszlop a sor menti pozíció, a polc (szint) függőleges, ezért ugyanannál a sornál és oszlopnál egy megálló. Másik sorba csak az első vagy a hátsó keresztfolyosón lehet átmenni, amelyik rövidebb. A körút a bejárattól indul és a kiadóhoz tér vissza. A készletet a felület **nem** csökkenti: a C pont nem kér készletlevonást, és a `project_parts` táblában nincs kiadott mennyiség.

## Fájlok

```
raktaros/
├── index.html
├── login.html          csak demo mód; élesben a közös belépő van
├── css/style.css       a raktárvezetői felület megjelenése
├── css/raktaros.css    útvonal, polctérkép
├── js/config.js        /napelem/api , demo kapcsoló, szerepkör
├── js/api.js           fetch + a válaszok egységesítése
├── js/mock.js          demo backend
├── js/route.js         legrövidebb körút
├── js/login.js
└── js/app.js
```

## Végpontok, amiket a felület vár

A bejelentkezés **már megvan** (`login.php`, `me.php`, `logout.php`), süti: `credentials: 'include'`. 401-re a felület a közös belépőre megy.

A lenti három fájl **még nincs** a backendben. Eszter ezeket külön, új fájlként teszi az `api/` mappába. A felület pontosan ezeket hívja, a meglévő `projects.php` / `bins.php` végpontokat nem. A mezőnevek az ő táblavégpontjaihoz igazodnak (angol kulcsok). A szám jöhet szövegként is. Hiba: 4xx/5xx + `{"error": "Magyar nyelvű üzenet"}`. Jogosultság: bejelentkezett `warehouse_worker` (az `admin` is elfogadható), különben 401 / 403.

### `GET /napelem/api/raktaros_projektek.php`

Projektek a listához, minden állapottal.

```json
[
  {
    "id": 11,
    "customer_name": "Szabó Anna",
    "location": "Szeged, Napfény sor 12.",
    "description": "Családi ház, 10 panel",
    "status": "Scheduled",
    "created_at": "2026-09-22 14:30:00",
    "part_lines": 3,
    "reserved_lines": 3
  }
]
```

`part_lines` = a projekt `project_parts` sorainak száma. `reserved_lines` = ezek közül hány `reserved = 1`.

### `POST /napelem/api/raktaros_kivetelezes.php`

Kivételezés indítása. Törzs:

```json
{ "project_id": 11 }
```

Ha a státusz `Scheduled`: `projects.status = 'InProgress'`, és egy sor a `project_history` táblába (`status = 'InProgress'`), ugyanúgy, ahogy a `projects.php` PUT naplóz. Válasz:

```json
{
  "success": true,
  "message": "A projekt kivételezése elindult.",
  "id": 11,
  "customer_name": "Szabó Anna",
  "location": "Szeged, Napfény sor 12.",
  "description": "Családi ház, 10 panel",
  "status": "InProgress",
  "created_at": "2026-09-22 14:30:00",
  "part_lines": 3,
  "reserved_lines": 3
}
```

Ha már `InProgress`: HTTP 200, `"message": "A kivételezés már folyamatban van."`, státusz marad, **új history sor nem kell**. Minden más állapot: **409** `{"error": "Csak ütemezett (Scheduled) projekt kivételezése indítható."}`. Ismeretlen projekt: **404**. Hiányzó `project_id`: **400**.

### `GET /napelem/api/raktaros_helyek.php?project_id=11`

A projekt alkatrészei és minden rekesz, ahol az adott alkatrészből van készlet (`quantity > 0`). A `warehouse` a `bins` tábla legnagyobb sor / oszlop / szint értéke (legalább 1); ebből tudni, hol van a hátsó keresztfolyosó.

```json
{
  "project_id": 11,
  "customer_name": "Szabó Anna",
  "location": "Szeged, Napfény sor 12.",
  "description": "Családi ház, 10 panel",
  "status": "InProgress",
  "warehouse": { "rows": 3, "columns": 3, "levels": 2 },
  "parts": [
    {
      "part_id": 3,
      "name": "DC kábel 5m",
      "quantity": 10,
      "reserved": 1,
      "bins": [
        {
          "id": 3,
          "identifier": "B1-1",
          "row_num": 2,
          "col_num": 1,
          "level_num": 1,
          "quantity": 15,
          "max_capacity": 20
        }
      ]
    }
  ]
}
```

`parts` a projekt minden `project_parts` sora (`reserved` 0 vagy 1), `part_id` szerint. `bins` üres tömb, ha sehol nincs belőle készlet. Ismeretlen projekt: **404**.

Az útvonalat nem a szerver adja: `js/route.js` a fenti koordinátákból választ rekeszt és számol körutat.
