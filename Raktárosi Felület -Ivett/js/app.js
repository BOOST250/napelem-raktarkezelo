let aktualisProjekt = null;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function projektekNezet() {

    const projektek = await Api.projektek();

    document.getElementById("page-title").textContent =
        "Projektek";

    document.getElementById("view").innerHTML = `

    <div class="card">

        <div class="table-wrap">

            <table class="table">

                <thead>
                    <tr>
                        <th>Projekt</th>
                        <th>Státusz</th>
                        <th></th>
                    </tr>
                </thead>

                <tbody>

                ${projektek.map(p => `

                    <tr>

                        <td>${esc(p.nev)}</td>

                        <td>${esc(p.statusz)}</td>

                        <td>

                            <button
                                class="btn primary"
                                onclick="inditas(${Number(p.id)})">

                                Kivételezés

                            </button>

                        </td>

                    </tr>

                `).join('')}

                </tbody>

            </table>

        </div>

    </div>
    `;
}

async function inditas(id){

    aktualisProjekt = id;

    location.hash = "kivetelezes";
}

async function kivetelezesNezet(){

    if(!aktualisProjekt){

        document.getElementById("view").innerHTML =
            "<p>Válassz először projektet.</p>";

        return;
    }

    const alkatreszek =
        await Api.projektAlkatreszek(
            aktualisProjekt
        );

    document.getElementById("page-title").textContent =
        "Kivételezés";

    document.getElementById("view").innerHTML = `

        <div class="card pad">

            <h2>Szükséges alkatrészek</h2>

            <ul>

            ${alkatreszek.map(a => `

                <li>

                    ${esc(a.nev)}
                    <br>
                    <small>${esc(a.hely)}</small>

                </li>

            `).join("")}

            </ul>

        </div>

    `;
}

async function utvonalNezet(){

    if(!aktualisProjekt){

        document.getElementById("view").innerHTML =
            "<p>Válassz projektet.</p>";

        return;
    }

    const alkatreszek =
        await Api.projektAlkatreszek(
            aktualisProjekt
        );

    document.getElementById("page-title").textContent =
        "Útvonal";

    document.getElementById("view").innerHTML = `

    <div class="card pad">

        <h2>Ajánlott sorrend</h2>

        <ol>

        ${alkatreszek.map(a => `

            <li>${esc(a.hely)}</li>

        `).join("")}

        </ol>

    </div>

    `;
}

function hibaNezet(err) {
    document.getElementById("page-title").textContent = "Hiba";
    const view = document.getElementById("view");
    view.replaceChildren();
    const p = document.createElement("p");
    p.textContent = (err && err.message) || "Nem sikerült betölteni az adatokat.";
    view.appendChild(p);
}

function router(){

    const hash =
        location.hash.replace("#","");

    const nezet = hash === "kivetelezes" ? kivetelezesNezet
        : hash === "utvonal" ? utvonalNezet
        : projektekNezet;

    Promise.resolve(nezet()).catch(hibaNezet);
}

window.addEventListener(
    "hashchange",
    router
);

router();