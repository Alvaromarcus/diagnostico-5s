// js/app.js

// --- Data Structure ---
const SENSOS = [
    {
      id: 's1',
      nome: '1º S – UTILIZAÇÃO (SEIRI)',
      perguntas: [
        { id: 's1q1', texto: 'Existem materiais e/ou utensílios que não estão sendo utilizados sobre as máquinas ou armários?', positiva: 'NAO' },
        { id: 's1q2', texto: 'Existem objetos desnecessários nos armários?', positiva: 'NAO' },
        { id: 's1q3', texto: 'Há evidências de desperdícios na área (energia, papel, materiais de consumo)?', positiva: 'NAO' },
        { id: 's1q4', texto: 'Encontrados na área somente paletes e caixas em uso na área?', positiva: 'SIM' },
        { id: 's1q5', texto: 'Os equipamentos, ferramentas e utensílios que estão em desuso, estão armazenados em locais apropriados?', positiva: 'SIM' },
      ]
    },
    {
      id: 's2',
      nome: '2º S – ORGANIZAÇÃO (SEITON)',
      perguntas: [
        { id: 's2q1', texto: 'Os materiais/objetos/equipamentos estão em locais adequados e organizados?', positiva: 'SIM' },
        { id: 's2q2', texto: 'Os locais onde os materiais são guardados/alocados estão identificados corretamente?', positiva: 'SIM' },
        { id: 's2q3', texto: 'Uso das lixeiras corretamente para papéis, plásticos, metais, orgânicos etc?', positiva: 'SIM' },
        { id: 's2q4', texto: 'Os produtos químicos estão devidamente identificados e guardados em local apropriado quando não estão em uso?', positiva: 'SIM' },
        { id: 's2q5', texto: 'Os EPIs estão em uso ou armazenados em local adequado? (observar se estão largados por cima de máquina ou outro local inadequado)', positiva: 'SIM' },
      ]
    },
    {
      id: 's3',
      nome: '3º S – LIMPEZA (SEISOU)',
      perguntas: [
        { id: 's3q1', texto: 'Os armários, materiais, máquinas e equipamentos estão em boas condições de limpeza?', positiva: 'SIM' },
        { id: 's3q2', texto: 'O chão está isento de parafusos, etiquetas, sacos, grampos, isomanta ou papéis caídos?', positiva: 'SIM' },
        { id: 's3q3', texto: 'As máquinas, computadores, armários estão conservados de acordo com seu tempo de uso?', positiva: 'SIM' },
        { id: 's3q4', texto: 'Existem trapos, pedaços de papelão, lona deixados pela área?', positiva: 'NAO' },
        { id: 's3q5', texto: 'No geral o setor está limpo?', positiva: 'SIM' },
      ]
    },
    {
      id: 's4',
      nome: '4º S – PADRONIZAÇÃO (SEIKETSU)',
      perguntas: [
        { id: 's4q1', texto: 'Os armários e/ou gavetas estão de livre acesso à qualquer pessoa?', positiva: 'SIM' },
        { id: 's4q2', texto: 'Os banheiros encontram-se em bom estado de conservação por parte dos usuários?', positiva: 'SIM' },
        { id: 's4q3', texto: 'Os colaboradores estão trajando uniforme?', positiva: 'SIM' },
        { id: 's4q4', texto: 'Os colaboradores zelam pela limpeza do seu ambiente de trabalho?', positiva: 'SIM' },
        { id: 's4q5', texto: 'As demarcações estão sendo respeitadas?', positiva: 'SIM' },
      ]
    },
    {
      id: 's5',
      nome: '5º S – DISCIPLINA (SHITSUKE)',
      perguntas: [
        { id: 's5q1', texto: 'As iluminações desnecessárias estão sendo apagadas após a saída do local?', positiva: 'SIM' },
        { id: 's5q2', texto: 'Os equipamentos estão sendo desligados nos horários em que não há atividades?', positiva: 'SIM' },
        { id: 's5q3', texto: 'São deixadas portas de armários e gavetas abertas?', positiva: 'NAO' },
        { id: 's5q4', texto: 'Os materiais de uso comum, quando não estão sendo mais utilizados, são colocados nos locais determinados?', positiva: 'NAO' },
        { id: 's5q5', texto: 'Os colaboradores demonstram se importar com o cumprimento dos requisitos do programa 5S?', positiva: 'SIM' },
      ]
    }
];

// State
let respostas = {}; // { qId: 'SIM' | 'NAO' | 'NA' }
let observacoes = {}; // { qId: 'text' }
let radarChartInstance = null;

// --- Initialize Application ---
document.addEventListener('DOMContentLoaded', () => {
    // Set default date to today
    document.getElementById('data-avaliacao').valueAsDate = new Date();

    renderQuestions();
    initRadarChart();
    updateResults(); // Initial render of results (zeros)

    // Event Listeners for controls
    document.getElementById('btn-reset').addEventListener('click', handleReset);
    document.getElementById('btn-generate-action-plan').addEventListener('click', () => {
        const actionPlanSection = document.getElementById('action-plan-section');
        actionPlanSection.classList.remove('hidden');
        actionPlanSection.scrollIntoView({ behavior: 'smooth' });
        // Call global function from action-plan.js if it exists to pre-populate
        if(typeof populateActionPlan === 'function') {
            populateActionPlan();
        }
    });

    // Mobile Results Toggle Logic
    const mobileToggle = document.getElementById('mobile-results-toggle');
    const resultsContent = document.getElementById('results-content');

    mobileToggle.addEventListener('click', () => {
        resultsContent.classList.toggle('active');
        mobileToggle.classList.toggle('active');

        // Need to resize the chart if it becomes visible
        if (resultsContent.classList.contains('active') && radarChartInstance) {
            radarChartInstance.resize();
        }
    });

    // Make state available globally for pdf.js and action-plan.js
    window.appState = {
        SENSOS,
        respostas,
        observacoes,
        getResults: calculateAllResults
    };
});

// --- Render Functions ---
function renderQuestions() {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';

    SENSOS.forEach((senso, sIndex) => {
        // Accordion item
        const item = document.createElement('div');
        item.className = 'accordion-item';

        // Header
        const header = document.createElement('div');
        header.className = 'accordion-header';
        header.innerHTML = `
            <h3>${senso.nome}</h3>
            <span class="senso-progress" id="progress-${senso.id}">0/5 respondidas</span>
        `;

        // Toggle accordion
        header.addEventListener('click', () => {
            content.classList.toggle('active');
        });

        // Content
        const content = document.createElement('div');
        content.className = 'accordion-content';
        if (sIndex === 0) content.classList.add('active'); // Expand first one by default

        // Questions
        senso.perguntas.forEach((q, qIndex) => {
            const qDiv = document.createElement('div');
            qDiv.className = 'question-item';

            const qNumber = qIndex + 1;

            qDiv.innerHTML = `
                <div class="question-text">${qNumber}. ${q.texto}</div>
                <div class="question-controls">
                    <div class="radio-group">
                        <label class="radio-label">
                            <input type="radio" name="${q.id}" value="SIM">
                            <span>SIM</span>
                        </label>
                        <label class="radio-label">
                            <input type="radio" name="${q.id}" value="NAO">
                            <span>NÃO</span>
                        </label>
                        <label class="radio-label">
                            <input type="radio" name="${q.id}" value="NA">
                            <span>N/A</span>
                        </label>
                    </div>
                    <div class="obs-group">
                        <textarea id="obs-${q.id}" placeholder="Observações..."></textarea>
                    </div>
                </div>
            `;
            content.appendChild(qDiv);
        });

        item.appendChild(header);
        item.appendChild(content);
        container.appendChild(item);
    });

    // Attach event listeners to all radios and textareas
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            respostas[e.target.name] = e.target.value;
            updateResults();
            updateProgress();
        });
    });

    document.querySelectorAll('textarea[id^="obs-"]').forEach(ta => {
        ta.addEventListener('input', (e) => {
            const qId = e.target.id.replace('obs-', '');
            observacoes[qId] = e.target.value;
        });
    });
}

function updateProgress() {
    SENSOS.forEach(senso => {
        const respondidas = senso.perguntas.filter(q => respostas[q.id] !== undefined).length;
        document.getElementById(`progress-${senso.id}`).textContent = `${respondidas}/5 respondidas`;
    });
}

// --- Calculation Logic ---

function calcularPontuacaoSenso(senso) {
    let soma = 0;
    let qtdNAs = 0;

    senso.perguntas.forEach(p => {
        const resp = respostas[p.id];
        if (resp === 'NA') {
            qtdNAs++;
            return;
        }
        if (resp === p.positiva) {
            soma += 20;
        }
    });

    const qtdAplicaveis = senso.perguntas.length - qtdNAs;
    if (qtdAplicaveis === 0) return null; // Não aplicado

    return Math.round((soma / (100 - qtdNAs * 20)) * 100);
}

function avaliarSenso(pontuacao) {
    if (pontuacao === null) return { texto: 'Não aplicado', classe: 'regular' };

    const nivel = Math.round(pontuacao / 20);

    if (nivel === 0) return { texto: 'Péssimo', classe: 'pessimo' };
    if (nivel === 1) return { texto: 'Muito Ruim', classe: 'muito-ruim' };
    if (nivel === 2) return { texto: 'Ruim', classe: 'ruim' };
    if (nivel === 3) return { texto: 'Regular', classe: 'regular' };
    if (nivel === 4) return { texto: 'Bom', classe: 'bom' };
    return { texto: 'Excelente', classe: 'excelente' };
}

function calcularPontuacaoGeral(pontuacoesSensos) {
    const aplicaveis = pontuacoesSensos.filter(p => p !== null);
    if (aplicaveis.length === 0) return 0;
    return Math.round(aplicaveis.reduce((a, b) => a + b, 0));
}

function avaliarGeral(pontuacao) {
    if (pontuacao === 0) return { texto: 'Péssimo', classe: 'pessimo' };
    if (pontuacao <= 100) return { texto: 'Muito Ruim', classe: 'muito-ruim' };
    if (pontuacao <= 200) return { texto: 'Ruim', classe: 'ruim' };
    if (pontuacao <= 300) return { texto: 'Regular', classe: 'regular' };
    if (pontuacao <= 400) return { texto: 'Bom', classe: 'bom' };
    return { texto: 'Excelente', classe: 'excelente' };
}

function calculateAllResults() {
    const resultadosSensos = SENSOS.map(senso => {
        const pontuacao = calcularPontuacaoSenso(senso);
        const avaliacao = avaliarSenso(pontuacao);
        return {
            id: senso.id,
            nome: senso.nome,
            pontuacao: pontuacao,
            avaliacao: avaliacao
        };
    });

    const pontuacaoGeral = calcularPontuacaoGeral(resultadosSensos.map(r => r.pontuacao));
    const avaliacaoGeral = avaliarGeral(pontuacaoGeral);

    return {
        sensos: resultadosSensos,
        geral: {
            pontuacao: pontuacaoGeral,
            avaliacao: avaliacaoGeral
        }
    };
}

// --- UI Updates ---

function updateResults() {
    const results = calculateAllResults();

    // Update Overall
    document.getElementById('overall-score').textContent = results.geral.pontuacao;
    const badge = document.getElementById('overall-badge');
    badge.textContent = results.geral.avaliacao.texto;
    badge.className = `badge ${results.geral.avaliacao.classe}`;

    // Update Mobile Header Badge
    const mobileBadge = document.getElementById('overall-score-mobile-badge');
    mobileBadge.textContent = `${results.geral.pontuacao} pts`;
    mobileBadge.className = `badge ${results.geral.avaliacao.classe}`;

    // Update Sensos Summary
    const summaryContainer = document.getElementById('sensos-summary');
    summaryContainer.innerHTML = '';

    results.sensos.forEach((r, idx) => {
        const displayScore = r.pontuacao !== null ? `${r.pontuacao}/100` : '-';
        const item = document.createElement('div');
        item.className = 'summary-item';
        item.innerHTML = `
            <div class="summary-item-name">${idx + 1}º S</div>
            <div class="summary-item-score">
                <span>${displayScore}</span>
                <span class="badge ${r.avaliacao.classe}" style="font-size:0.75rem; padding: 0.2rem 0.5rem;">${r.avaliacao.texto}</span>
            </div>
        `;
        summaryContainer.appendChild(item);
    });

    // Update Chart
    updateRadarChart(results.sensos);
}

// --- Chart.js ---

function initRadarChart() {
    const ctx = document.getElementById('radar-chart').getContext('2d');

    radarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['1S - Utilização', '2S - Organização', '3S - Limpeza', '4S - Padronização', '5S - Disciplina'],
            datasets: [{
                label: 'Pontuação por Senso',
                data: [0, 0, 0, 0, 0],
                backgroundColor: 'rgba(26, 58, 92, 0.2)', // Primary color with opacity
                borderColor: 'rgba(26, 58, 92, 1)',
                pointBackgroundColor: 'rgba(244, 160, 32, 1)', // Secondary color
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(244, 160, 32, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { display: true },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: {
                        stepSize: 20
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function updateRadarChart(sensosResults) {
    if (!radarChartInstance) return;

    // Convert nulls (N/A) to 0 for chart display purposes
    const data = sensosResults.map(r => r.pontuacao !== null ? r.pontuacao : 0);

    radarChartInstance.data.datasets[0].data = data;
    radarChartInstance.update();
}

// --- Reset ---

function handleReset() {
    if (confirm('Tem certeza que deseja limpar todo o formulário? Todos os dados serão perdidos.')) {
        // Reset state
        respostas = {};
        observacoes = {};

        // Reset UI form elements
        document.querySelectorAll('input[type="radio"]').forEach(radio => radio.checked = false);
        document.querySelectorAll('textarea').forEach(ta => ta.value = '');
        document.getElementById('turno').value = '';
        document.getElementById('setor').value = '';
        document.getElementById('auditores').value = '';
        document.getElementById('data-avaliacao').valueAsDate = new Date();

        // Hide action plan
        document.getElementById('action-plan-section').classList.add('hidden');
        document.getElementById('action-plan-body').innerHTML = ''; // clear action plan table

        // Update progress & results
        updateProgress();
        updateResults();

        // Scroll to top
        window.scrollTo(0,0);
    }
}
