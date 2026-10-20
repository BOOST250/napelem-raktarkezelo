let aktualisProjekt = null;

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

                        <td>${p.nev}</td>

                        <td>${p.statusz}</td>

                        <td>

                            <button
                                class="btn primary"
                                onclick="inditas(${p.id})">

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

                    ${a.nev}
                    <br>
                    <small>${a.hely}</small>

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

            <li>${a.hely}</li>

        `).join("")}

        </ol>

    </div>

    `;
}

function router(){

    const hash =
        location.hash.replace("#","");

    if(hash === "kivetelezes"){

        kivetelezesNezet();
        return;
    }

    if(hash === "utvonal"){

        utvonalNezet();
        return;
    }

    projektekNezet();
}

window.addEventListener(
    "hashchange",
    router
);

router();