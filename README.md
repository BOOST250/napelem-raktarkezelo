# SolarSystem – napelemes raktárkezelő rendszer

Csapatprojekt (Szoftvertechnológia beadandó): napelemrendszer-telepítő cég raktár- és projektkezelő webalkalmazása.
PHP + MySQL backend, sima HTML/CSS/JavaScript felületek, keretrendszer nélkül.

## Felépítés

| Mappa | Tartalom | Készítette |
|---|---|---|
| `Adatbazis + backend - Eszter/napelem/` | PHP API (`api/`), bejelentkezés (`auth/`), adatbázis-kapcsolat, SQL-fájlok | Eszter |
| `Közös/belepes/` | Közös belépő oldal – szerepkör alapján a megfelelő felületre visz | közös |
| `Szakemberi Felület - Attila/beadandoszoft/` | Szakemberi felület (projektek) | Attila |
| `Raktárvezetői felület - Én/raktarvezeto/` | Raktárvezetői felület (alkatrészek, rekeszek, bevételezés) | Ábel |
| `Raktárosi Felület -Ivett/` | Raktárosi felület (projektek, kivételezés, útvonal) | Ivett |

Futtatás:
Nyisd meg: https://solarpanel.infinityfree.io/napelem/belepes/

A felhasználókat az adminisztrátor veszi fel (`users` tábla); regisztráció nincs. A jelszavakat a backend hash-elve tárolja.

A raktárvezetői és a raktárosi felület backend nélkül, demo módban is kipróbálható – lásd a felületek README-jét ([raktárvezető](<Raktárvezetői felület - Én/raktarvezeto/README.md>), [raktáros](<Raktárosi Felület -Ivett/README.md>)).
