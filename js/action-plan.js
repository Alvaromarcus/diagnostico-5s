// js/action-plan.js

let actionCounter = 0;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-add-action').addEventListener('click', () => {
        addActionRow();
    });
});

function addActionRow(sensoRelacionado = '') {
    actionCounter++;
    const tbody = document.getElementById('action-plan-body');
    const tr = document.createElement('tr');

    tr.innerHTML = `
        <td>${actionCounter}</td>
        <td><input type="text" class="ap-what" placeholder="Ação..."></td>
        <td><input type="text" class="ap-why" placeholder="Motivo..."></td>
        <td><input type="text" class="ap-who" placeholder="Responsável..."></td>
        <td><input type="date" class="ap-when"></td>
        <td><input type="text" class="ap-where" placeholder="Local..."></td>
        <td><input type="text" class="ap-how" placeholder="Método..."></td>
        <td><input type="text" class="ap-howmuch" placeholder="Custo..."></td>
        <td>
            <select class="ap-senso">
                <option value="">Selecione</option>
                <option value="1S" ${sensoRelacionado === '1S' ? 'selected' : ''}>1S</option>
                <option value="2S" ${sensoRelacionado === '2S' ? 'selected' : ''}>2S</option>
                <option value="3S" ${sensoRelacionado === '3S' ? 'selected' : ''}>3S</option>
                <option value="4S" ${sensoRelacionado === '4S' ? 'selected' : ''}>4S</option>
                <option value="5S" ${sensoRelacionado === '5S' ? 'selected' : ''}>5S</option>
                <option value="Geral" ${sensoRelacionado === 'Geral' ? 'selected' : ''}>Geral</option>
            </select>
        </td>
        <td>
            <select class="ap-status">
                <option value="A fazer">A fazer</option>
                <option value="Em andamento">Em andamento</option>
                <option value="Concluído">Concluído</option>
            </select>
        </td>
        <td class="text-center">
            <button type="button" class="btn-remove" title="Remover" onclick="this.closest('tr').remove()">✕</button>
        </td>
    `;

    tbody.appendChild(tr);
}

function populateActionPlan() {
    // Prevent adding duplicates if already populated
    const tbody = document.getElementById('action-plan-body');

    if(!window.appState || !window.appState.getResults) return;

    const results = window.appState.getResults();

    // If table is empty, auto-populate
    if (tbody.children.length === 0) {
        let addedCriticos = false;

        results.sensos.forEach((r, idx) => {
            if (['Ruim', 'Muito Ruim', 'Péssimo'].includes(r.avaliacao.texto)) {
                // Get the short prefix "1S", "2S" etc based on the original index
                const sensoPrefix = (idx + 1) + "S";
                addActionRow(sensoPrefix);
                addedCriticos = true;
            }
        });

        // Just add one empty row if none critical
        if (!addedCriticos) {
            addActionRow();
        }
    }
}

// Global function to gather data for PDF
window.getActionPlanData = function() {
    const rows = document.querySelectorAll('#action-plan-body tr');
    const data = [];

    rows.forEach((row, index) => {
        data.push([
            (index + 1).toString(),
            row.querySelector('.ap-what').value || '-',
            row.querySelector('.ap-why').value || '-',
            row.querySelector('.ap-who').value || '-',
            row.querySelector('.ap-when').value || '-',
            row.querySelector('.ap-where').value || '-',
            row.querySelector('.ap-how').value || '-',
            row.querySelector('.ap-howmuch').value || '-',
            row.querySelector('.ap-senso').value || '-',
            row.querySelector('.ap-status').value || '-'
        ]);
    });

    return data;
};
