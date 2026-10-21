# SolarSystem – napelemes raktárkezelő rendszer

Csapatprojekt (Szoftvertechnológia beadandó): napelemrendszer-telepítő cég raktár- és projektkezelő webalkalmazása.
PHP (Slim 4) + MySQL backend, sima HTML/CSS/JavaScript felületek.

## Felépítés

| Mappa | Tartalom | Készítette |
|---|---|---|
| `Adatbazis + backend - Eszter/napelem/` | Slim 4 API (`api/`, `src/`), bejelentkezés, adatbázis-kapcsolat, SQL-fájlok | Eszter |
| `Közös/belepes/` | Közös belépő oldal – szerepkör alapján a megfelelő felületre visz | közös |
| `Szakemberi Felület - Attila/beadandoszoft/` | Szakemberi felület (projektek) | Attila |
| `Raktárvezetői felület - Én/raktarvezeto/` | Raktárvezetői felület (alkatrészek, rekeszek, bevételezés) | Ábel |
| `Raktárosi Felület -Ivett/` | Raktárosi felület (fejlesztés alatt) | Ivett |

## Futtatás (XAMPP)

1. Indítsd el az Apache-t és a MySQL-t a XAMPP-ban.
2. phpMyAdminban importáld a `napelemrendszer.sql`-t, utána a `napelemrendszer_illesztes.sql`-t. A sorrend számít: először a dump, utána az illesztés.
3. Másold a `napelem` mappát a `C:\xampp\htdocs\` alá (a `vendor/` és a `src/` is kell), és mellé (a `napelem` mappán belülre) a felületeket ezekkel a nevekkel:
   ```
   htdocs/napelem/
   ├── api/  auth/  config/  src/  vendor/   (backend)
   ├── belepes/                    ← Közös/belepes
   ├── szakember/                  ← Szakemberi Felület - Attila/beadandoszoft
   ├── raktarvezeto/               ← Raktárvezetői felület - Én/raktarvezeto
   └── raktaros/                   ← Raktárosi Felület -Ivett
   ```
4. A `vendor/` mappa benne van a repóban, ezért Composer nélkül is elindul. Ha hiányzik, a `napelem` mappában futtasd: `composer install`.
5. Nyisd meg: <http://localhost/napelem/belepes/>

A végpontok leírása: `Adatbazis + backend - Eszter/napelem/API.md`.

A `config/database.php` alapból a XAMPP `root` felhasználóját használja, üres jelszóval, `localhost` kiszolgálón. Ez a MySQL a saját gépen; nem a böngésző címe. Más jelszóhoz másold a `config/database.local.php.example` fájlt `database.local.php` néven (ez nem kerül a gitbe).

### Demó felhasználók

Az illesztő SQL ezeket hozza létre. A jelszó hash-elve van; ha valaki már lecserélte, az újrafuttatás nem írja vissza.

| Felhasználónév | Jelszó | Szerepkör |
|---|---|---|
| `szakember1` | `A12346` | szakember |
| `raktarvezeto1` | `Z12356` | raktárvezető |
| `raktaros1` | `U23456` | raktáros |
| `admin` | `Admin123!` | adminisztrátor |

Regisztráció nincs. További felhasználót az adminisztrátor vesz fel a `users` végponton.

A raktárvezetői felület backend nélkül, demo módban is kipróbálható – lásd [a felület README-jét](<Raktárvezetői felület - Én/raktarvezeto/README.md>).

## Elérés másik gépről

A rendszernek egy gépen kell futnia a XAMPP alatt, a többiek ugyanarról a Wi-Fi-ről vagy helyi hálózatról nyitják meg. A backend nem a `localhost` szóra épül: a süti a megnyitott címhez kötődik, a CORS a kérés címét engedi, az API-útvonal pedig a mappából számolódik.

1. A két gép legyen ugyanazon a hálózaton.
2. A szervergépen keresd meg az IPv4-címet: Windows parancssorban `ipconfig` (pl. `192.168.1.20`).
3. A XAMPP Apache `httpd.conf` fájljában a figyelés legyen `Listen 80`, ne `Listen 127.0.0.1:80`, különben csak a saját gépről nyílik meg.
4. A Windows tűzfalon engedélyezd az Apache HTTP Server alkalmazást (TCP 80-as port). A MySQL 3306-os portját nem kell megnyitni: az adatbázis a XAMPP-gépen marad.
5. A másik gépen ezt nyisd meg: `http://<a szerver IP-címe>/napelem/belepes/` — ne a `localhost` szót. A felületek gyökérhez képesti API-útvonala (`/napelem/api`) követi ezt a címet.

Az `Raktárosi Felület -Ivett/config.js` fájlban az API-cím abszolút `http://localhost/...`. Azt a fájlt ez a változtatás nem írja át; amíg így marad, másik gépről a raktárosi felület a saját gépére próbál hívni.
