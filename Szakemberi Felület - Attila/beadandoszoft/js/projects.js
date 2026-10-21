/* Projektek listája (A.2). Az adat a projects.php végpontból jön,
   a költség oszlop a tételek és a munkadíj összesítése. */

let projects = [];
let tetelek = [];

function esc(szoveg) {
    return String(szoveg ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatFt(szam) {
    return Number(szam).toLocaleString('hu-HU') + ' Ft';
}

function formatDate(dateString) {
    if (!dateString) return '–';
    const date = new Date(String(dateString).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return '–';
    return date.toLocaleDateString('hu-HU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

function projektAr(project) {
    const sorok = tetelek.filter(t => t.project_id === project.id);
    if (sorok.length === 0) return '–';
    const mindFoglalt = sorok.every(t => t.reserved);
    const anyag = sorok.reduce((s, t) => s + t.part_price * t.quantity, 0);
    const vegleges = mindFoglalt
        && project.labor_cost !== null
        && ['Scheduled', 'InProgress', 'Completed', 'Failed'].includes(project.status);
    if (vegleges) return formatFt(anyag + project.labor_cost);
    if (!mindFoglalt) return 'hiányos';
    return 'nincs véglegesítve';
}

function displayProjects(projectList) {
    const tableBody = document.getElementById('projectsTableBody');
    document.getElementById('projectCount').textContent = projectList.length + ' projekt';
    tableBody.innerHTML = '';

    if (projectList.length === 0) {
        const uzenet = projects.length === 0
            ? 'Még nincs projekt. Hozz létre egy újat.'
            : 'Nincs a keresésnek megfelelő projekt.';
        tableBody.innerHTML =
            '<tr><td colspan="7"><div class="empty-projects">' + esc(uzenet) + '</div></td></tr>';
        return;
    }

    projectList.forEach(project => {
        const elerhetoseg = [project.customer_email, project.customer_phone].filter(Boolean).join(' · ');
        const row = document.createElement('tr');
        row.innerHTML =
            '<td>#' + esc(project.id) + '</td>' +
            '<td><div class="customer-name">' + esc(project.customer_name) + '</div>' +
            '<div class="customer-contact">' + esc(elerhetoseg || '–') + '</div></td>' +
            '<td>' + esc(project.location) + '</td>' +
            '<td><span class="project-status ' + esc(STATUSZ_OSZTALY[project.status] || '') + '">' +
            esc(STATUSZ_NEV[project.status] || project.status) + '</span></td>' +
            '<td>' + esc(projektAr(project)) + '</td>' +
            '<td>' + esc(formatDate(project.created_at)) + '</td>' +
            '<td><a href="project.html?id=' + encodeURIComponent(project.id) + '" class="open-project">Megnyitás</a></td>';
        tableBody.appendChild(row);
    });
}

function filterProjects() {
    const searchText = document.getElementById('searchInput').value.toLowerCase().trim();
    const selectedStatus = document.getElementById('statusFilter').value;

    displayProjects(projects.filter(project => {
        const matchesSearch =
            project.customer_name.toLowerCase().includes(searchText) ||
            project.location.toLowerCase().includes(searchText) ||
            project.customer_email.toLowerCase().includes(searchText) ||
            project.customer_phone.toLowerCase().includes(searchText);
        const matchesStatus = selectedStatus === 'all' || project.status === selectedStatus;
        return matchesSearch && matchesStatus;
    }));
}

function showLoadError(message) {
    document.getElementById('projectCount').textContent = '–';
    document.getElementById('projectsTableBody').innerHTML =
        '<tr><td colspan="7"><div class="empty-projects">' + esc(message) + '</div></td></tr>';
}

async function loadProjects() {
    document.getElementById('projectsTableBody').innerHTML =
        '<tr><td colspan="7"><div class="empty-projects">Projektek betöltése…</div></td></tr>';
    try {
        const [lista, sorok] = await Promise.all([Api.projektek(), Api.mindenTetel()]);
        projects = lista;
        tetelek = sorok;
        filterProjects();
    } catch (error) {
        showLoadError(error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
    document.getElementById('searchInput').addEventListener('input', filterProjects);
    document.getElementById('statusFilter').addEventListener('change', filterProjects);
});
