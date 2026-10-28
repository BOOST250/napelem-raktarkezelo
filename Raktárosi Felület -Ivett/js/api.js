/* ================= API réteg =================
   Minden adat Eszter PHP API-járól jön: projects.php, project_parts.php, bins.php.
   A nézetek továbbra is { id, nev, statusz } és { nev, hely } objektumokat kapnak.
   Bejelentkezés nélkül (401) a közös belépőre visz (../belepes/). */

const Api = (() => {
    function bejelentkezesre() {
        location.replace('../belepes/');
    }

    async function leker(fajl) {
        let res;
        try {
            res = await fetch(`${CONFIG.API_BASE}${fajl}`, {
                headers: { Accept: 'application/json' },
                credentials: 'include',
            });
        } catch {
            const err = new Error('A szerver nem érhető el. Fut az Apache és a MySQL?');
            err.status = 0;
            throw err;
        }

        const szoveg = await res.text();
        let adat = null;
        if (szoveg) {
            try {
                adat = JSON.parse(szoveg);
            } catch {
                const err = new Error(`A szerver nem JSON választ adott: ${szoveg.slice(0, 150)}`);
                err.status = res.status;
                throw err;
            }
        }
        if (!res.ok) {
            if (res.status === 401) {
                bejelentkezesre();
                return new Promise(() => {});
            }
            const err = new Error(adat?.error || adat?.message || `Hiba a kérés során (HTTP ${res.status})`);
            err.status = res.status;
            throw err;
        }
        if (adat && !Array.isArray(adat) && typeof adat === 'object' && 'data' in adat) return adat.data;
        return adat;
    }

    const szam = v => (v === null || v === undefined || v === '' ? 0 : Number(v));

    function projektNev(p) {
        const nev = [p.customer_name, p.location].filter(Boolean).join(' – ');
        return nev || `#${p.id}`;
    }

    // A raktárvezetői felület helykódja: S sor · O oszlop · P polc · R azonosító.
    function hely(b) {
        return `S${szam(b.row_num)} · O${szam(b.col_num)} · P${szam(b.level_num)} · R${b.identifier ?? ''}`;
    }

    return {
        async projektek() {
            const lista = await leker('/projects.php');
            return (Array.isArray(lista) ? lista : []).map(p => ({
                id: szam(p.id),
                nev: projektNev(p),
                statusz: String(p.status ?? ''),
            }));
        },

        async projektAlkatreszek(projektId) {
            const [tetelek, rekeszek] = await Promise.all([
                leker('/project_parts.php'),
                leker('/bins.php'),
            ]);
            const helyek = new Map();
            for (const b of Array.isArray(rekeszek) ? rekeszek : []) {
                if (b.part_id === null || b.part_id === undefined || szam(b.quantity) <= 0) continue;
                const partId = szam(b.part_id);
                if (!helyek.has(partId)) helyek.set(partId, []);
                helyek.get(partId).push(hely(b));
            }
            const id = szam(projektId);
            return (Array.isArray(tetelek) ? tetelek : [])
                .filter(t => szam(t.project_id) === id)
                .map(t => ({
                    nev: String(t.part_name ?? ''),
                    hely: (helyek.get(szam(t.part_id)) || []).join(', ') || 'nincs raktári hely',
                }));
        },
    };
})();
