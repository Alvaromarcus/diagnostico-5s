// js/pdf.js

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-export-pdf').addEventListener('click', generatePDF);
});

function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // Configurações
    const primaryColor = [26, 58, 92]; // #1a3a5c
    const secondaryColor = [244, 160, 32]; // #f4a020
    const margin = 14;
    let currentY = 20;
    const pageWidth = doc.internal.pageSize.width;

    // Get Data
    const dataObj = document.getElementById('data-avaliacao').value;
    const turno = document.getElementById('turno').value;
    const setor = document.getElementById('setor').value || 'Não informado';
    const auditores = document.getElementById('auditores').value || 'Não informado';

    // Format date properly if exists
    let dataFormatada = 'Não informada';
    if(dataObj) {
        const d = new Date(dataObj);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset()); // Fix timezone offset
        dataFormatada = d.toLocaleDateString('pt-BR');
    }

    const results = window.appState.getResults();

    // --- PÁGINA 1: Cabeçalho ---
    doc.setFontSize(22);
    doc.setTextColor(...primaryColor);
    doc.text("Diagnóstico de Maturidade 5S", pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text("Relatório de Avaliação do Programa 5S", pageWidth / 2, currentY, { align: 'center' });
    currentY += 15;

    // Informações Gerais
    doc.autoTable({
        startY: currentY,
        head: [['Informações da Avaliação']],
        body: [
            [`Data: ${dataFormatada} | Turno: ${turno || 'Não informado'}`],
            [`Setor Auditado: ${setor}`],
            [`Auditor(es): ${auditores}`]
        ],
        theme: 'plain',
        headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
        bodyStyles: { fillColor: [245, 246, 250], textColor: 50 },
        margin: { left: margin, right: margin }
    });
    currentY = doc.lastAutoTable.finalY + 10;

    // Critérios de Maturidade (Referência)
    doc.setFontSize(14);
    doc.setTextColor(...primaryColor);
    doc.text("Critérios de Maturidade (Referência)", margin, currentY);
    currentY += 5;

    doc.autoTable({
        startY: currentY,
        head: [['Nota', 'Avaliação', 'Faixa Geral']],
        body: [
            ['0', 'Péssimo', '0'],
            ['1 a 20', 'Muito Ruim', '1 a 100'],
            ['21 a 40', 'Ruim', '101 a 200'],
            ['41 a 60', 'Regular', '201 a 300'],
            ['61 a 80', 'Bom', '301 a 400'],
            ['81 a 100', 'Excelente', '401 a 500']
        ],
        theme: 'grid',
        headStyles: { fillColor: [200, 200, 200], textColor: 50 },
        styles: { fontSize: 9, halign: 'center' },
        margin: { left: margin, right: margin }
    });
    currentY = doc.lastAutoTable.finalY + 15;

    // Resumo dos Resultados
    doc.setFontSize(14);
    doc.setTextColor(...primaryColor);
    doc.text("Resumo dos Resultados", margin, currentY);
    currentY += 5;

    const summaryBody = results.sensos.map(s => [
        s.nome,
        s.pontuacao !== null ? s.pontuacao : 'N/A',
        s.avaliacao.texto
    ]);

    doc.autoTable({
        startY: currentY,
        head: [['Senso', 'Pontuação', 'Avaliação']],
        body: summaryBody,
        theme: 'striped',
        headStyles: { fillColor: primaryColor, textColor: 255 },
        columnStyles: {
            1: { halign: 'center' },
            2: { halign: 'center', fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin }
    });
    currentY = doc.lastAutoTable.finalY + 10;

    // Radar Chart
    const canvas = document.getElementById('radar-chart');
    if (canvas) {
        const radarImgData = canvas.toDataURL('image/png');
        // Radar centralizado, largura 120mm, altura proporcional
        const radarWidth = 120;
        const radarHeight = (canvas.height / canvas.width) * radarWidth;
        const radarX = (pageWidth - radarWidth) / 2;

        doc.addImage(radarImgData, 'PNG', radarX, currentY, radarWidth, radarHeight);
        currentY += radarHeight + 10;

        // Verifica quebra de página
        if (currentY > doc.internal.pageSize.height - 20) {
            doc.addPage();
            currentY = 20;
        }
    }

    // Resultado Geral em Destaque
    doc.setFillColor(...secondaryColor);
    doc.rect(margin, currentY, pageWidth - (margin*2), 20, 'F');
    doc.setTextColor(255);
    doc.setFontSize(14);
    doc.text(`PONTUAÇÃO GERAL: ${results.geral.pontuacao}`, margin + 5, currentY + 13);
    doc.text(`AVALIAÇÃO: ${results.geral.avaliacao.texto.toUpperCase()}`, pageWidth - margin - 5, currentY + 13, { align: 'right' });

    // --- PÁGINAS SEGUINTES: Detalhe por Senso ---
    doc.addPage();
    currentY = 20;

    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.text("Detalhamento por Senso", pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    window.appState.SENSOS.forEach((senso, idx) => {
        const resultadoSenso = results.sensos[idx];

        const sensoHead = [`${senso.nome} - Score: ${resultadoSenso.pontuacao !== null ? resultadoSenso.pontuacao : 'N/A'} (${resultadoSenso.avaliacao.texto})`];

        const sensoBody = senso.perguntas.map((q, i) => {
            const resp = window.appState.respostas[q.id] || 'Sem reposta';
            const obs = window.appState.observacoes[q.id] || '';
            let notaStr = '-';

            if(resp !== 'NA' && resp !== 'Sem reposta') {
                notaStr = (resp === q.positiva) ? '20' : '0';
            }

            return [
                `${i+1}. ${q.texto}`,
                resp,
                notaStr,
                obs
            ];
        });

        doc.autoTable({
            startY: currentY,
            head: [sensoHead],
            body: [], // Empty body for main header row
            theme: 'plain',
            headStyles: { fillColor: secondaryColor, textColor: 255, fontSize: 11 }
        });

        doc.autoTable({
            startY: doc.lastAutoTable.finalY,
            head: [['Pergunta', 'Resposta', 'Nota', 'Observações']],
            body: sensoBody,
            theme: 'grid',
            headStyles: { fillColor: [240, 240, 240], textColor: 50, fontSize: 9 },
            styles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 80 },
                1: { cellWidth: 20, halign: 'center' },
                2: { cellWidth: 15, halign: 'center' },
                3: { cellWidth: 'auto' }
            }
        });

        currentY = doc.lastAutoTable.finalY + 10;

        // Inserir fotos do Senso atual
        senso.perguntas.forEach((q, i) => {
            if (window.appState.fotos && window.appState.fotos[q.id]) {
                const imgData = window.appState.fotos[q.id];

                // Pegar dimensões originais da imagem de forma síncrona usando getImageProperties do jsPDF
                const imgProps = doc.getImageProperties(imgData);

                // Lógica de proporção
                const maxImgWidth = pageWidth - (margin * 2);
                let imgWidth = maxImgWidth;
                let imgHeight = (imgProps.height / imgProps.width) * imgWidth;

                // Limitar altura a 140mm
                if (imgHeight > 140) {
                    imgHeight = 140;
                    imgWidth = (imgProps.width / imgProps.height) * imgHeight;
                }

                // Verificar quebra de página antes de inserir
                if (currentY + imgHeight + 15 > doc.internal.pageSize.height - margin) {
                    doc.addPage();
                    currentY = 20;
                }

                const imgX = (pageWidth - imgWidth) / 2;

                // Adicionar texto indicando de qual pergunta é a foto
                doc.setFontSize(10);
                doc.setTextColor(...primaryColor);
                doc.text(`Foto da Pergunta ${i+1}:`, margin, currentY);
                currentY += 5;

                // Adicionar borda
                doc.setDrawColor(200, 200, 200); // Cinza
                doc.setLineWidth(0.5);
                doc.rect(imgX, currentY, imgWidth, imgHeight);

                // Adicionar Imagem
                doc.addImage(imgData, 'PNG', imgX, currentY, imgWidth, imgHeight);
                currentY += imgHeight + 5;

                // Adicionar Legenda
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text("📷 Foto registrada", pageWidth / 2, currentY, { align: 'center' });

                currentY += 15;
            }
        });

        // Check page break manually if needed, autotable usually handles it
        // mas as fotos podem ter alterado o currentY significativamente
        if (currentY > doc.internal.pageSize.height - 20 && idx < window.appState.SENSOS.length - 1) {
            doc.addPage();
            currentY = 20;
        }
    });

    // --- ÚLTIMA SEÇÃO: Plano de Ação 5W2H ---
    const actionPlanData = window.getActionPlanData ? window.getActionPlanData() : [];

    if (actionPlanData.length > 0) {
        doc.addPage();
        currentY = 20;

        doc.setFontSize(16);
        doc.setTextColor(...primaryColor);
        doc.text("Plano de Ação 5W2H", pageWidth / 2, currentY, { align: 'center' });
        currentY += 10;

        doc.autoTable({
            startY: currentY,
            head: [['#', 'O Quê (What)', 'Por Quê (Why)', 'Quem (Who)', 'Quando (When)', 'Onde (Where)', 'Como (How)', 'Quanto (How Much)', 'Senso', 'Status']],
            body: actionPlanData,
            theme: 'grid',
            headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 1 },
            columnStyles: {
                0: { cellWidth: 5 },
                1: { cellWidth: 'auto' }, // What
                2: { cellWidth: 'auto' }, // Why
                3: { cellWidth: 15 }, // Who
                4: { cellWidth: 15 }, // When
                5: { cellWidth: 15 }, // Where
                6: { cellWidth: 20 }, // How
                7: { cellWidth: 15 }, // How Much
                8: { cellWidth: 10 }, // Senso
                9: { cellWidth: 15 }  // Status
            }
        });
    }

    // Save PDF
    const filename = `diagnostico-5s-${setor.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${dataFormatada.replace(/\//g, '-')}.pdf`;
    doc.save(filename);
}
