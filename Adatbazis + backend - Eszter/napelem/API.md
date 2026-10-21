# Napelem API

Slim 4 alkalmazás a `api/` mappa alatt. A régi `valami.php` címek megmaradtak: a fájl csak továbbadja a kérést, a választ a `src/` alatti vezérlők adják. Ami nincs a lemezen (például `/alkatreszek`), azt az `api/.htaccess` az `index.php`-ra írja.

Az útvonal a mappából számolódik (`/napelem/api`), nem a `localhost` szóból. Másik gépről lásd a gyökér README „Elérés másik gépről” részét.

Hiba mindig `{"error":"magyar üzenet"}` és 4xx/5xx. A lista-végpontok JSON-tömböt adnak.

Bejelentkezés: `POST login.php` törzs `{"username","password"}` → `{"success":true,"user":{"id","username","role"}}`. Süti: `PHPSESSID`, path `/`, domain nélkül, HttpOnly, SameSite=Lax. `GET me.php` → `{"user":...}` vagy 401. `POST logout.php` → `{"ok":true}`.

A védett kérésnél a szerepkört a szerver az adatbázisból olvassa újra.

## Szerepkörök

| Szerepkör | Ki |
|---|---|
| `specialist` | szakember |
| `warehouse_manager` | raktárvezető |
| `warehouse_worker` | raktáros |
| `admin` | adminisztrátor, a raktárvezető és a szakember írási jogát is megkapja |

Olvasás (`GET` alkatrész, rekesz, projekt, tétel, történet): bármelyik bejelentkezett szerepkör. Az írás szűkebb, lásd alább.

## Meglévő végpontok (a cím változatlan)

A `.php` nélküli alak is él (`/parts` = `/parts.php`).

| Metódus | Útvonal | Ki írhat / olvashat |
|---|---|---|
| GET | `parts.php`, `bins.php` | bejelentkezett |
| POST, PUT, DELETE | `parts.php`, `bins.php` | raktárvezető, admin |
| GET | `projects.php`, `project_parts.php` | bejelentkezett |
| POST, PUT, DELETE | `projects.php`, `project_parts.php` | szakember, admin |
| GET | `project_history.php` | bejelentkezett, `changed_at` szerint csökkenő |
| DELETE | `project_history.php?id=` | admin |
| POST | `receiving.php` | raktárvezető, admin |
| GET, POST, PUT, DELETE | `users.php` | admin |

A `project_history.php` POST nincs kitéve: a történetet csak állapotváltás írja. Üres vagy hiányzó azonosító törlésnél 404, nem „sikeres”.

A `parts.php` és a `bins.php` a tábla sorait adja angol kulcsokkal (`name`, `price`, `identifier`, …), készletösszesítés nélkül. Szűrés: `?id=`, rekesznél `?part_id=`, projektnél `?status=`, tételnél `?project_id=`. A szűrt válasz is tömb.

Projekt létrehozása `{"id","status":"New"}` plusz `success`. Az állapotgép a szakembernek: New→Draft, Draft→Wait, Scheduled→InProgress, InProgress→Completed vagy Failed. Wait→Scheduled csak foglaláskor. Lezárt projektet a szakember nem módosít. Dupla tétel 409.

Bevételezés törzse `part_id` és `items[{bin_id,quantity}]`. Válaszban `success`, `received`, `reserved`, `scheduled_projects`, valamint `ok`, `lefoglalva`, `utemezett_projektek`.

## Raktárvezető (Ábel szerződése)

Mind raktárvezető vagy admin. A `parts.php` / `bins.php` / `receiving.php` ettől még megvan.

| Metódus | Útvonal | Megjegyzés |
|---|---|---|
| GET, POST | `/alkatreszek` | összesített `nev`, `ar`, `max_darab`, `keszlet`, `lefoglalt` |
| PUT | `/alkatreszek/{id}` | a módosított alkatrész |
| GET, POST | `/rekeszek` | `sor`, `oszlop`, `polc`, `rekesz` (szám), `azonosito`, `darab` |
| POST | `/bevetelezes` | `alkatresz_id`, `tetelek[{rekesz_id,darab}]` |
| GET | `/hianyzo` | előfoglalt (még nem reserved) tételek |
| GET | `/lefoglalt` | reserved, még ki nem adott mennyiség |

A `rekesz` a magyar létrehozásnál a négy koordináta negyedike. A tárolt azonosító `S{sor}-O{oszlop}-P{polc}-R{rekesz}`. A régi magok (`A1-1`) azonosítója az `azonosito` mezőben marad; a `rekesz` ilyenkor az oszlop száma, hogy számként lehessen olvasni. Ugyanabban a cellában több rekesz is lehet, az azonosító egyedi.

A `lefoglalt` a szerveren `quantity - issued_quantity` az aktív, reserved sorokon. A nyers `project_parts.php` a `reserved` jelzőt és az `issued_quantity` mezőt is adja.

Bevételezés egy tranzakció: egy rekeszben egy alkatrészfajta, üres rekesz (0 darab) kaphat új fajtát, plafon a rekesz kapacitása és az alkatrész `max_per_bin` közül a kisebb. Utána előbb a Wait, aztán a Draft projektek mindent-vagy-semmi foglalása. Ha egy Wait projekt minden sora reserved, Scheduled lesz, és egy történetsor készül.

Draft→Wait csak akkor megy, ha van legalább egy tétel. Ha a foglalás mindent lefed, az állapot egyből Scheduled, egy történetsorral.

## Raktáros

A felület (`Raktárosi Felület -Ivett`) pontosan ezt a hármat hívja. Jogosultság: `warehouse_worker` vagy `admin`. A raktárvezető és a szakember 403-at kap. Az útvonalat a böngésző számolja a helyek koordinátáiból, külön útvonal-végpont nincs. A kivételezés a készletet nem csökkenti.

| Metódus | Útvonal | Mit csinál |
|---|---|---|
| GET | `raktaros_projektek.php` | Minden projekt: `id`, `customer_name`, `location`, `description`, `status`, `created_at`, `part_lines`, `reserved_lines` |
| POST | `raktaros_kivetelezes.php` | Törzs: `{"project_id":11}`. Scheduled → InProgress és egy history sor. Már InProgress: 200, napló nélkül. Más állapot: 409. Ismeretlen: 404. Hiányzó azonosító: 400 |
| GET | `raktaros_helyek.php?project_id=` | `warehouse` (sorok, oszlopok, szintek) és a projekt minden tétele a készletes rekeszeivel |

A 409 szövege: `Csak ütemezett (Scheduled) projekt kivételezése indítható.`

A `warehouse.columns` a `bins.col_num` maximuma, legalább 1. A `parts` tömb a projekt minden `project_parts` sora `part_id` szerint. A `bins` csak azok a rekeszek, ahol `quantity > 0`.

Készletmozgás-napló (bevételezés írja): `GET raktaros_keszletmozgas.php`, raktáros, raktárvezető vagy admin. Állapotnapló időrendben: `GET projekt_naplo.php?project_id=`.

## Állapotnapló

Minden állapotváltás egy sor a `project_history` táblában (`status`, `user_id`, `changed_at`). Ugyanaz az állapot nem ír új sort. A strukturált napló `projekt_naplo.php`, a régi lista `project_history.php`.
