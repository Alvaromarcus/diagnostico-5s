/* Módulo MFV (Mapeamento do Fluxo de Valor): cálculos, formulário, diagrama SVG, pan/zoom e exportação. */
(function () {
  'use strict';

  /* ---------- Estado ---------- */
  const EXEMPLO = () => ({
    empresa: 'Cartonagem Exemplo', familia: 'Caixa de papelão C-32', data: new Date().toISOString().slice(0, 10), responsavel: 'Equipe Lean',
    inicio: '07:30', fim: '17:30', turnos: 1, pausas: 90,
    demandaModo: 'mensal', demandaMensal: 12600, diasUteis: 21, demandaDiaria: 600,
    cliente: { nome: 'Distribuidora', freqPedido: 'Semanal', freqEntrega: 'Caminhão diário', estoquePA: 2400 },
    pcp: { emissao: 'Programação semanal', comunicacao: 'Via encarregado' },
    fornecedor: { nome: 'Papelão Ondulado', leadTime: 7, freqEntrega: 'Quinzenal' },
    processos: [
      proc('Corte e vinco', 'Chapas 1,20 × 0,80 m', 1, 18, 's', 25, 3600, 'un', 'empurrado', false),
      proc('Impressão flexo', 'Logo em 2 cores', 2, 54, 's', 40, 1800, 'un', 'empurrado', false),
      proc('Coladeira', 'Colagem da aba', 1, 16, 's', 15, 1200, 'un', 'empurrado', false),
      proc('Grampeadeira', 'Caixas especiais', 1, 46, 's', 5, 300, 'un', 'empurrado', true),
      proc('Amarrador', 'Fardos de 25 un', 1, 12, 's', 0, 600, 'un', 'fifo', false)
    ]
  });
  const VAZIO = () => ({
    empresa: '', familia: '', data: new Date().toISOString().slice(0, 10), responsavel: '',
    inicio: '07:30', fim: '17:30', turnos: 1, pausas: 60,
    demandaModo: 'mensal', demandaMensal: 0, diasUteis: 21, demandaDiaria: 0,
    cliente: { nome: 'Cliente', freqPedido: 'Semanal', freqEntrega: 'Caminhão semanal', estoquePA: 0 },
    pcp: { emissao: 'OF a cada pedido', comunicacao: 'Instrução direta' },
    fornecedor: { nome: 'Fornecedor', leadTime: 0, freqEntrega: 'Sob demanda' },
    processos: [proc('Processo 1', '', 1, 0, 's', 0, 0, 'un', 'empurrado', false)]
  });
  let uid = 0;
  function proc(nome, desc, operadores, tc, tcUnid, setup, estoque, estoqueUnid, ligacao, paralelo) {
    return { uid: ++uid, nome, desc, operadores, tc, tcUnid, setup, setupUnid: 'min', estoque, estoqueUnid, kgPorUn: 0.25, ligacao, paralelo };
  }
  let S = EXEMPLO();
  let openUid = S.processos[0].uid;
  let step = 0;

  /* ---------- Utilidades ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
  const fmt = (v, d = 1) => isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const fmtInt = v => isFinite(v) ? Math.round(v).toLocaleString('pt-BR') : '—';
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const getPath = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
  const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
  const toSec = (v, u) => num(v) * (u === 'h' ? 3600 : u === 'min' ? 60 : 1);
  const fmtTempo = s => !isFinite(s) ? '—' : s >= 3600 ? fmt(s / 3600, 1) + ' h' : s >= 120 ? fmt(s / 60, 1) + ' min' : fmt(s, s < 10 ? 1 : 0) + ' s';
  const minutos = hhmm => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

  /* ---------- Cálculos (seção 2 da especificação) ---------- */
  function calcular(s) {
    let jornada = minutos(s.fim) - minutos(s.inicio);
    if (jornada <= 0) jornada += 1440;
    const tdispMin = jornada * Math.max(1, num(s.turnos)) - num(s.pausas);
    const tdispS = tdispMin * 60;
    const demDia = s.demandaModo === 'mensal' ? num(s.demandaMensal) / Math.max(1, num(s.diasUteis)) : num(s.demandaDiaria);
    const takt = demDia > 0 ? tdispS / demDia : NaN;

    const procs = s.processos.map((p, i) => {
      const tcS = toSec(p.tc, p.tcUnid);
      const setupS = toSec(p.setup, p.setupUnid);
      const estoqueUn = p.estoqueUnid === 'kg' ? num(p.estoque) / Math.max(1e-9, num(p.kgPorUn)) : num(p.estoque);
      const ltDias = demDia > 0 ? estoqueUn / demDia : NaN;
      return { ...p, idx: i, codigo: 'P' + (i + 1), tcS, setupS, estoqueUn, ltDias, acimaTakt: isFinite(takt) && tcS > takt };
    });
    // Agrupa em colunas: processo "paralelo" entra na mesma coluna do anterior (máx. 3 ramos)
    const cols = [];
    procs.forEach(p => {
      const last = cols[cols.length - 1];
      if (p.paralelo && last && last.length < 3) last.push(p); else cols.push([p]);
    });
    const colTc = cols.map(c => Math.max(...c.map(p => p.tcS)));
    const colLt = cols.map(c => Math.max(...c.map(p => p.ltDias || 0)));
    const paLt = demDia > 0 ? num(s.cliente.estoquePA) / demDia : NaN;
    const tct = colTc.reduce((a, b) => a + b, 0);
    const ltEstoques = colLt.reduce((a, b) => a + b, 0) + (paLt || 0);
    const ltTotal = demDia > 0 && tdispS > 0 ? ltEstoques + tct / tdispS : NaN;
    const va = ltTotal > 0 ? tct / (ltTotal * tdispS) * 100 : NaN;
    const gargalos = procs.filter(p => p.acimaTakt);
    return { jornada, tdispMin, tdispS, demDia, takt, procs, cols, colTc, colLt, paLt, tct, ltEstoques, ltTotal, va, gargalos };
  }

  /* ---------- Formulário ---------- */
  function bindStatic() {
    $$('[data-k]').forEach(el => {
      el.addEventListener('input', () => {
        setPath(S, el.dataset.k, el.hasAttribute('data-num') ? num(el.value) : el.value);
        renderOutputs();
      });
    });
    $$('[data-dmodo]').forEach(b => b.addEventListener('click', () => { S.demandaModo = b.dataset.dmodo; syncStatic(); renderOutputs(); }));
    $$('.step-btn').forEach(b => b.addEventListener('click', () => goStep(+b.dataset.step)));
    $('#btn-prev').addEventListener('click', () => goStep(step - 1));
    $('#btn-next').addEventListener('click', () => {
      if (step < 2) goStep(step + 1);
      else document.querySelector('.preview-col').scrollIntoView({ behavior: 'smooth' });
    });
    $('#btn-add-proc').addEventListener('click', () => {
      const p = proc('Processo ' + (S.processos.length + 1), '', 1, 0, 's', 0, 0, 'un', 'empurrado', false);
      S.processos.push(p); openUid = p.uid; renderProcs(); renderOutputs();
    });
    let clearArmed = false, clearTimer;
    $('#btn-clear').addEventListener('click', e => {
      if (!clearArmed) {
        clearArmed = true; e.target.textContent = 'Confirmar limpeza';
        clearTimer = setTimeout(() => { clearArmed = false; e.target.textContent = 'Limpar'; }, 3000);
        return;
      }
      clearTimeout(clearTimer); clearArmed = false; e.target.textContent = 'Limpar';
      S = VAZIO(); openUid = S.processos[0].uid; syncStatic(); renderProcs(); renderOutputs(); fitView();
      setStatus('Formulário limpo.');
    });
  }

  function syncStatic() {
    $$('[data-k]').forEach(el => { const v = getPath(S, el.dataset.k); el.value = v ?? ''; });
    $$('[data-dmodo]').forEach(b => b.classList.toggle('on', b.dataset.dmodo === S.demandaModo));
    const mensal = S.demandaModo === 'mensal';
    $('#wrap-dmes').hidden = !mensal; $('#wrap-dias').hidden = !mensal; $('#wrap-ddia').hidden = mensal;
  }

  function goStep(n) {
    step = Math.max(0, Math.min(2, n));
    $$('.step-btn').forEach(b => { const on = +b.dataset.step === step; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    $$('.step-panel').forEach(p => p.hidden = +p.dataset.panel !== step);
    $('#btn-prev').style.visibility = step === 0 ? 'hidden' : 'visible';
    $('#btn-next').textContent = step === 2 ? 'Ver mapa ↓' : 'Próximo →';
  }

  function renderProcs() {
    const c = calcular(S);
    const list = $('#proc-list');
    list.innerHTML = S.processos.map((p, i) => {
      const cp = c.procs[i];
      const open = p.uid === openUid;
      return `
      <div class="proc ${open ? 'open' : ''} ${p.paralelo && i > 0 ? 'parallel' : ''} ${cp.acimaTakt ? 'over' : ''}" data-uid="${p.uid}">
        <button type="button" class="proc-head" data-act="toggle" aria-expanded="${open}">
          <span class="proc-id">P${i + 1}</span>
          <span class="proc-title"><strong data-live="nome">${esc(p.nome) || 'Sem nome'}</strong><small data-live="resumo">TC ${fmtTempo(cp.tcS)} · estoque ${fmt(cp.ltDias, 1)} d</small></span>
          ${cp.acimaTakt ? '<span class="pill pill-danger">acima do takt</span>' : ''}
          ${p.paralelo && i > 0 ? '<span class="pill pill-par">paralelo</span>' : ''}
          <span class="chev" aria-hidden="true">▾</span>
        </button>
        <div class="proc-body">
          <div class="grid2">
            <div class="field"><label for="p${p.uid}-nome">Nome do processo</label><input id="p${p.uid}-nome" type="text" data-pk="nome" value="${esc(p.nome)}"></div>
            <div class="field"><label for="p${p.uid}-desc">Descrição da tarefa</label><input id="p${p.uid}-desc" type="text" data-pk="desc" value="${esc(p.desc)}"></div>
          </div>
          <div class="grid3">
            <div class="field"><label for="p${p.uid}-op">Operadores</label><input id="p${p.uid}-op" type="number" min="0" inputmode="numeric" data-pk="operadores" data-num value="${p.operadores}"></div>
            <div class="field"><label for="p${p.uid}-tc">Tempo de ciclo</label><div class="combo"><input id="p${p.uid}-tc" type="number" min="0" inputmode="decimal" data-pk="tc" data-num value="${p.tc}"><select data-pk="tcUnid" aria-label="Unidade do tempo de ciclo">${['s', 'min', 'h'].map(u => `<option ${u === p.tcUnid ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
            <div class="field"><label for="p${p.uid}-setup">Setup</label><div class="combo"><input id="p${p.uid}-setup" type="number" min="0" inputmode="decimal" data-pk="setup" data-num value="${p.setup}"><select data-pk="setupUnid" aria-label="Unidade do setup">${['min', 'h'].map(u => `<option ${u === p.setupUnid ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
          </div>
          <div class="grid2">
            <div class="field"><label for="p${p.uid}-est">Estoque antes do processo</label><div class="combo"><input id="p${p.uid}-est" type="number" min="0" inputmode="decimal" data-pk="estoque" data-num value="${p.estoque}"><select data-pk="estoqueUnid" data-rerender aria-label="Unidade do estoque"><option value="un" ${p.estoqueUnid === 'un' ? 'selected' : ''}>un</option><option value="kg" ${p.estoqueUnid === 'kg' ? 'selected' : ''}>kg</option></select></div>${i === 0 ? '<div class="hint">No P1, é o estoque de matéria-prima.</div>' : ''}</div>
            <div class="field"><label for="p${p.uid}-lig">Ligação de entrada</label><select id="p${p.uid}-lig" data-pk="ligacao"><option value="empurrado" ${p.ligacao === 'empurrado' ? 'selected' : ''}>Empurrado</option><option value="fifo" ${p.ligacao === 'fifo' ? 'selected' : ''}>Puxado / FIFO</option></select></div>
            ${p.estoqueUnid === 'kg' ? `<div class="field"><label for="p${p.uid}-kg">Peso por unidade (kg)</label><input id="p${p.uid}-kg" type="number" min="0" step="0.01" inputmode="decimal" data-pk="kgPorUn" data-num value="${p.kgPorUn}"><div class="hint">Converte kg em peças para calcular os dias de estoque.</div></div>` : ''}
          </div>
          ${i > 0 ? `<label class="toggle-row"><input type="checkbox" data-pk="paralelo" data-rerender ${p.paralelo ? 'checked' : ''}> Corre em paralelo com P${i}</label>` : ''}
          <div class="proc-actions">
            <button type="button" class="btn btn-ghost" data-act="up" ${i === 0 ? 'disabled' : ''}>↑ Subir</button>
            <button type="button" class="btn btn-ghost" data-act="down" ${i === S.processos.length - 1 ? 'disabled' : ''}>↓ Descer</button>
            <button type="button" class="btn btn-danger-ghost" data-act="del" ${S.processos.length === 1 ? 'disabled' : ''}>Remover</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function bindProcs() {
    const list = $('#proc-list');
    list.addEventListener('click', e => {
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      const card = btn.closest('.proc'); const uidv = +card.dataset.uid;
      const i = S.processos.findIndex(p => p.uid === uidv);
      const act = btn.dataset.act;
      if (act === 'toggle') { openUid = openUid === uidv ? null : uidv; }
      else if (act === 'up' && i > 0) { [S.processos[i - 1], S.processos[i]] = [S.processos[i], S.processos[i - 1]]; }
      else if (act === 'down' && i < S.processos.length - 1) { [S.processos[i + 1], S.processos[i]] = [S.processos[i], S.processos[i + 1]]; }
      else if (act === 'del') { S.processos.splice(i, 1); }
      S.processos[0].paralelo = false;
      renderProcs(); renderOutputs();
    });
    const onField = e => {
      const el = e.target; if (!el.dataset.pk) return;
      const card = el.closest('.proc'); const p = S.processos.find(x => x.uid === +card.dataset.uid);
      p[el.dataset.pk] = el.type === 'checkbox' ? el.checked : el.hasAttribute('data-num') ? num(el.value) : el.value;
      if (el.hasAttribute('data-rerender')) { renderProcs(); }
      else {
        const c = calcular(S); const cp = c.procs.find(x => x.uid === p.uid);
        card.querySelector('[data-live="nome"]').textContent = p.nome || 'Sem nome';
        card.querySelector('[data-live="resumo"]').textContent = `TC ${fmtTempo(cp.tcS)} · estoque ${fmt(cp.ltDias, 1)} d`;
      }
      renderOutputs();
    };
    list.addEventListener('input', onField);
    list.addEventListener('change', e => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') onField(e); });
  }

  /* ---------- Saídas: KPIs, nota de cálculo, diagrama, lista ---------- */
  function renderOutputs() {
    const c = calcular(S);
    $('#calc-note').innerHTML = `
      <span>Jornada</span><b>${fmtInt(c.jornada)} min × ${fmtInt(num(S.turnos))} turno(s)</b>
      <span>Tempo disponível líquido</span><b>${fmtInt(c.tdispMin)} min/dia · ${fmtInt(c.tdispS)} s</b>
      <span>Demanda diária</span><b>${fmt(c.demDia, 0)} un/dia</b>
      <span>Takt time</span><b>${fmtTempo(c.takt)}</b>`;

    const g = c.gargalos;
    $('#kpis').innerHTML = `
      <div class="kpi"><div class="lbl">Takt time</div><div class="val">${fmt(c.takt, 1)}<small>s</small></div><div class="sub">${fmt(c.demDia, 0)} un/dia</div></div>
      <div class="kpi"><div class="lbl">Lead time total</div><div class="val">${fmt(c.ltTotal, 1)}<small>dias</small></div><div class="sub">${fmt(c.ltEstoques, 1)} d em estoque</div></div>
      <div class="kpi"><div class="lbl">Tempo de ciclo total</div><div class="val">${fmt(c.tct, 0)}<small>s</small></div><div class="sub">caminho crítico</div></div>
      <div class="kpi ${g.length ? 'alert' : ''}"><div class="lbl">${g.length ? 'Acima do takt' : 'Valor agregado'}</div><div class="val">${g.length ? g.length + '<small>' + (g.length > 1 ? 'processos' : 'processo') + '</small>' : fmt(c.va, 3) + '<small>%</small>'}</div><div class="sub">${g.length ? esc(g.map(p => p.codigo + ' ' + p.nome).join(', ')) : 'TCT ÷ lead time'}</div></div>`;

    const { svg, W, H } = buildSVG(S, c);
    const el = $('#mfv-svg');
    const firstDraw = !mapW;
    el.innerHTML = svg;
    if (W !== mapW) { mapW = W; mapH = H; if (firstDraw) initialView(); else clampView(); }
    applyView();
    renderList(c);
  }

  /* ---------- SVG (seção 5) ---------- */
  const COLW = 240, X0 = 140;
  const INK = '#1b1f24';
  function buildSVG(s, c) {
    const nCols = c.cols.length;
    const W = Math.max(1200, nCols * COLW + 380);
    const H = 850;
    const o = [];
    const T = (x, y, t, a = {}) => `<text x="${x}" y="${y}" font-size="${a.fs || 12}" ${a.anchor ? `text-anchor="${a.anchor}"` : ''} ${a.w ? `font-weight="${a.w}"` : ''} fill="${a.fill || INK}" ${a.fam === 'h' ? 'font-family="Barlow Condensed, Arial Narrow, sans-serif"' : ''}>${esc(t)}</text>`;
    const arrowHead = (x, y, dir = 'r', col = INK, sz = 9) => {
      const p = { r: [[x, y], [x - sz, y - sz * .6], [x - sz, y + sz * .6]], l: [[x, y], [x + sz, y - sz * .6], [x + sz, y + sz * .6]], u: [[x, y], [x - sz * .6, y + sz], [x + sz * .6, y + sz]], d: [[x, y], [x - sz * .6, y - sz], [x + sz * .6, y - sz]] }[dir];
      return `<polygon points="${p.map(q => q.join(',')).join(' ')}" fill="${col}"/>`;
    };
    const factory = (x, y, nome) => `<g transform="translate(${x},${y})"><path d="M 0,40 L 0,80 L 120,80 L 120,40 L 90,20 L 90,40 L 60,20 L 60,40 L 30,20 L 30,40 Z" fill="#ffffff" stroke="${INK}" stroke-width="2"/>${T(60, 68, trunc(nome, 18), { anchor: 'middle', fs: 11, w: 700 })}</g>`;
    const truck = (x, y) => `<g transform="translate(${x},${y})"><rect x="0" y="0" width="46" height="26" fill="#ffffff" stroke="${INK}" stroke-width="1.5"/><path d="M46,8 L60,8 L68,18 L68,26 L46,26 Z" fill="#ffffff" stroke="${INK}" stroke-width="1.5"/><circle cx="14" cy="30" r="5" fill="#ffffff" stroke="${INK}" stroke-width="1.5"/><circle cx="56" cy="30" r="5" fill="#ffffff" stroke="${INK}" stroke-width="1.5"/></g>`;
    const stock = (x, y, qtd, unid, dias) => `<g transform="translate(${x},${y})"><polygon points="0,50 30,0 60,50" fill="#b94a39" stroke="${INK}" stroke-width="1.5"/><text x="30" y="40" text-anchor="middle" font-size="16" font-weight="700" fill="#ffffff">I</text>${T(30, 66, fmtInt(qtd) + ' ' + unid, { anchor: 'middle', fs: 11, w: 700 })}${T(30, 80, fmt(dias, 1) + ' dias', { anchor: 'middle', fs: 11 })}</g>`;
    const flowArrow = (x1, y, x2, tipo) => {
      if (x2 - x1 < 6) return '';
      if (tipo === 'fifo') return `<line x1="${x1}" y1="${y}" x2="${x2 - 8}" y2="${y}" stroke="${INK}" stroke-width="2"/>${arrowHead(x2, y)}${T((x1 + x2) / 2, y - 6, 'FIFO', { anchor: 'middle', fs: 10, w: 700 })}`;
      return `<line x1="${x1}" y1="${y}" x2="${x2 - 10}" y2="${y}" stroke="${INK}" stroke-width="8"/><line x1="${x1 + 1}" y1="${y}" x2="${x2 - 11}" y2="${y}" stroke="#ffffff" stroke-width="5" stroke-dasharray="5 5"/>${arrowHead(x2, y, 'r', INK, 12)}`;
    };
    function trunc(t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; }

    o.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);
    o.push(`<defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#eef1f5" stroke-width="1"/></pattern></defs><rect x="0" y="0" width="${W}" height="${H}" fill="url(#grid)"/>`);

    /* Cabeçalho */
    o.push(T(30, 42, (s.empresa || 'Empresa') + (s.familia ? ' · ' + s.familia : ''), { fs: 26, w: 700, fam: 'h', fill: '#1a3a5c' }));
    const dataBr = s.data ? s.data.split('-').reverse().join('/') : '';
    o.push(T(30, 64, `Mapa do estado atual · ${dataBr}${s.responsavel ? ' · ' + s.responsavel : ''}`, { fs: 12, fill: '#5d6b7a' }));
    const dbx = W - 300;
    o.push(`<rect x="${dbx}" y="14" width="280" height="104" fill="#ffffff" stroke="${INK}" stroke-width="1.5"/><rect x="${dbx}" y="14" width="280" height="22" fill="#1a3a5c"/>`);
    o.push(T(dbx + 140, 30, 'DADOS DE PRODUÇÃO', { anchor: 'middle', fs: 11, w: 700, fill: '#ffffff' }));
    [['Demanda', `${fmtInt(c.demDia)} un/dia`], ['Tempo disponível', `${fmtInt(c.tdispS)} s/dia (${fmt(c.tdispMin / 60, 1)} h)`], ['Takt time', fmtTempo(c.takt)], ['Turnos · pausas', `${fmtInt(num(s.turnos))} · ${fmtInt(num(s.pausas))} min/dia`]]
      .forEach(([k, v], i) => { o.push(T(dbx + 10, 54 + i * 18, k, { fs: 11, fill: '#5d6b7a' })); o.push(T(dbx + 270, 54 + i * 18, v, { fs: 11, w: 700, anchor: 'end' })); });

    /* Nível superior: fornecedor, PCP, cliente */
    const fx = 30, cx = W - 150, pcpW = 200, pcpX = W / 2 - pcpW / 2;
    o.push(factory(fx, 140, s.fornecedor.nome || 'Fornecedor'));
    o.push(T(fx + 60, 240, `Reposição: ${fmt(num(s.fornecedor.leadTime), 0)} dias`, { anchor: 'middle', fs: 11 }));
    o.push(T(fx + 60, 254, `Entrega: ${s.fornecedor.freqEntrega}`, { anchor: 'middle', fs: 11 }));
    o.push(factory(cx, 140, s.cliente.nome || 'Cliente'));
    o.push(T(cx + 60, 240, `${fmtInt(c.demDia)} un/dia`, { anchor: 'middle', fs: 11, w: 700 }));
    o.push(T(cx + 60, 254, `Pedido: ${s.cliente.freqPedido}`, { anchor: 'middle', fs: 11 }));

    o.push(`<rect x="${pcpX}" y="150" width="${pcpW}" height="72" fill="#ffffff" stroke="${INK}" stroke-width="2"/><rect x="${pcpX}" y="150" width="${pcpW}" height="24" fill="#a2b87a" stroke="${INK}" stroke-width="2"/>`);
    o.push(T(W / 2, 167, 'PCP', { anchor: 'middle', fs: 13, w: 700 }));
    o.push(T(W / 2, 192, s.pcp.emissao, { anchor: 'middle', fs: 11 }));
    o.push(T(W / 2, 208, s.pcp.comunicacao, { anchor: 'middle', fs: 11, fill: '#5d6b7a' }));
    // cliente -> PCP
    o.push(`<line x1="${cx}" y1="186" x2="${pcpX + pcpW + 9}" y2="186" stroke="${INK}" stroke-width="1.5"/>${arrowHead(pcpX + pcpW, 186, 'l')}`);
    o.push(T((cx + pcpX + pcpW) / 2, 178, `Pedidos ${s.cliente.freqPedido.toLowerCase()}`, { anchor: 'middle', fs: 11 }));
    // PCP -> fornecedor
    o.push(`<line x1="${pcpX}" y1="186" x2="${fx + 129}" y2="186" stroke="${INK}" stroke-width="1.5"/>${arrowHead(fx + 120, 186, 'l')}`);
    o.push(T((pcpX + fx + 120) / 2, 178, `Pedido de compra · ${s.fornecedor.freqEntrega.toLowerCase()}`, { anchor: 'middle', fs: 11 }));

    /* Nível central: processos */
    const zoneTop = 300, zoneH = 330;
    const colX = i => X0 + i * COLW;
    const rowsY = n => { const rh = n <= 2 ? 150 : 110; const start = zoneTop + (zoneH - n * rh) / 2 + (n === 1 ? 20 : 0); return Array.from({ length: n }, (_, k) => start + k * rh); };
    const colRows = c.cols.map(col => rowsY(col.length));
    // barramento de informação do PCP
    const busY = 272;
    if (nCols) {
      const bx1 = colX(0) + 165, bx2 = colX(nCols - 1) + 165;
      o.push(`<line x1="${W / 2}" y1="222" x2="${W / 2}" y2="${busY}" stroke="${INK}" stroke-width="1" stroke-dasharray="4 3"/>`);
      o.push(`<line x1="${Math.min(bx1, W / 2)}" y1="${busY}" x2="${Math.max(bx2, W / 2)}" y2="${busY}" stroke="${INK}" stroke-width="1" stroke-dasharray="4 3"/>`);
      c.cols.forEach((col, i) => { const y = colRows[i][0]; o.push(`<line x1="${colX(i) + 165}" y1="${busY}" x2="${colX(i) + 165}" y2="${y - 7}" stroke="${INK}" stroke-width="1" stroke-dasharray="4 3"/>${arrowHead(colX(i) + 165, y - 1, 'd', INK, 7)}`); });
    }
    // caminhão do fornecedor
    const mainY = colRows[0] ? colRows[0][0] + 30 : 390;
    o.push(truck(fx + 20, mainY - 44));
    o.push(`<line x1="${fx + 60}" y1="262" x2="${fx + 60}" y2="${mainY - 50}" stroke="${INK}" stroke-width="1.5"/>${arrowHead(fx + 60, mainY - 46, 'd', INK, 7)}`);

    let prevEnds = [{ x: fx + 90, y: mainY }];
    c.cols.forEach((col, i) => {
      const x = colX(i), ys = colRows[i];
      const targets = ys.map(y => y + 30);
      const tipo = col[0].ligacao;
      if (prevEnds.length === 1 && targets.length === 1 && Math.abs(prevEnds[0].y - targets[0]) < 1) {
        o.push(flowArrow(prevEnds[0].x, targets[0], x + 100, tipo));
      } else {
        const xm = x + 8;
        const all = prevEnds.map(p => p.y).concat(targets);
        prevEnds.forEach(p => o.push(`<line x1="${p.x}" y1="${p.y}" x2="${xm}" y2="${p.y}" stroke="${INK}" stroke-width="2"/>`));
        o.push(`<line x1="${xm}" y1="${Math.min(...all)}" x2="${xm}" y2="${Math.max(...all)}" stroke="${INK}" stroke-width="2"/>`);
        col.forEach((p, k) => o.push(flowArrow(xm, targets[k], x + 100, p.ligacao)));
      }
      col.forEach((p, k) => {
        const y = ys[k];
        o.push(stock(x + 22, y + 40, p.estoque, p.estoqueUnid, p.ltDias));
        const stroke = p.acimaTakt ? '#c0392b' : INK;
        o.push(`<g transform="translate(${x + 100},${y})">
          <rect x="0" y="0" width="130" height="60" fill="#ffffff" stroke="${stroke}" stroke-width="${p.acimaTakt ? 2.5 : 1.5}"/>
          <rect x="0" y="0" width="130" height="22" fill="${p.acimaTakt ? '#fbeaea' : '#e6edf4'}" stroke="${stroke}" stroke-width="1"/>
          ${T(6, 15, p.codigo, { fs: 10, w: 700, fill: '#5d6b7a' })}
          ${T(74, 15, trunc(p.nome, 16).toUpperCase(), { anchor: 'middle', fs: 10, w: 700 })}
          ${T(65, 38, trunc(p.desc, 22), { anchor: 'middle', fs: 9, fill: '#5d6b7a' })}
          <circle cx="12" cy="47" r="3.5" fill="#ffffff" stroke="${INK}" stroke-width="1.2"/><path d="M6,57 Q12,49 18,57" fill="none" stroke="${INK}" stroke-width="1.2"/>
          ${T(24, 55, String(fmtInt(num(p.operadores))), { fs: 10, w: 700 })}
          <rect x="0" y="65" width="130" height="36" fill="#ffffff" stroke="${INK}" stroke-width="1"/>
          ${T(8, 80, 'TC', { fs: 9, fill: '#5d6b7a' })}${T(122, 80, fmtTempo(p.tcS), { fs: 10, w: 700, anchor: 'end', fill: p.acimaTakt ? '#c0392b' : INK })}
          ${T(8, 95, 'Setup', { fs: 9, fill: '#5d6b7a' })}${T(122, 95, fmtTempo(p.setupS), { fs: 10, w: 700, anchor: 'end' })}
          ${p.acimaTakt ? `<rect x="22" y="-17" width="86" height="14" rx="7" fill="#c0392b"/>${T(65, -7, 'TC > TAKT', { anchor: 'middle', fs: 9, w: 700, fill: '#ffffff' })}` : ''}
        </g>`);
      });
      prevEnds = targets.map(y => ({ x: x + 230, y }));
    });

    // Produto acabado -> caminhão -> cliente
    const lastX = nCols ? colX(nCols - 1) + 230 : X0;
    const shipX = cx + 26;
    if (prevEnds.length > 1) {
      const xm = lastX + 12;
      prevEnds.forEach(p => o.push(`<line x1="${p.x}" y1="${p.y}" x2="${xm}" y2="${p.y}" stroke="${INK}" stroke-width="2"/>`));
      o.push(`<line x1="${xm}" y1="${Math.min(mainY, ...prevEnds.map(p => p.y))}" x2="${xm}" y2="${Math.max(mainY, ...prevEnds.map(p => p.y))}" stroke="${INK}" stroke-width="2"/>`);
      o.push(flowArrow(xm, mainY, shipX - 4, 'empurrado'));
    } else {
      o.push(flowArrow(prevEnds[0].x, prevEnds[0].y, shipX - 4, 'empurrado'));
    }
    const paX = (lastX + shipX) / 2 - 30;
    o.push(stock(paX, mainY + 10, num(s.cliente.estoquePA), 'un', c.paLt));
    o.push(T(paX + 30, mainY + 104, 'Produto acabado', { anchor: 'middle', fs: 10, fill: '#5d6b7a' }));
    o.push(truck(shipX, mainY - 16));
    o.push(`<line x1="${shipX + 34}" y1="${mainY - 20}" x2="${shipX + 34}" y2="270" stroke="${INK}" stroke-width="1.5"/>${arrowHead(shipX + 34, 262, 'u', INK, 7)}`);
    o.push(T(shipX + 28, mainY - 40, s.cliente.freqEntrega, { fs: 11, anchor: 'end' }));

    /* Nível inferior: escada de lead time */
    const yTop = 700, yBot = 750;
    const L = [];
    let xa = X0;
    L.push(`M ${X0} ${yTop}`);
    c.cols.forEach((col, i) => {
      const x = colX(i);
      L.push(`L ${x + 95} ${yTop} L ${x + 95} ${yBot} L ${x + 235} ${yBot} L ${x + 235} ${yTop}`);
      const par = col.length > 1;
      o.push(T((xa + x + 95) / 2, yTop - 8, fmt(c.colLt[i], 1) + ' d' + (par ? ' (máx.)' : ''), { anchor: 'middle', fs: 11, w: 700 }));
      o.push(T(x + 165, yBot + 17, fmtTempo(c.colTc[i]) + (par ? ' (máx.)' : ''), { anchor: 'middle', fs: 11, w: 700 }));
      xa = x + 235;
    });
    L.push(`L ${shipX} ${yTop}`);
    o.push(T((xa + shipX) / 2, yTop - 8, fmt(c.paLt, 1) + ' d', { anchor: 'middle', fs: 11, w: 700 }));
    o.push(`<path d="${L.join(' ')}" fill="none" stroke="${INK}" stroke-width="2"/>`);
    o.push(T(30, yTop + 4, 'Espera', { fs: 10, fill: '#5d6b7a' }));
    o.push(T(30, yBot + 4, 'Ciclo', { fs: 10, fill: '#5d6b7a' }));

    const tbx = W - 250;
    o.push(`<rect x="${tbx}" y="770" width="230" height="68" fill="#ffffff" stroke="${INK}" stroke-width="2"/><rect x="${tbx}" y="770" width="6" height="68" fill="#f4a020"/>`);
    o.push(T(tbx + 16, 792, 'Lead time total', { fs: 11, fill: '#5d6b7a' }));
    o.push(T(tbx + 220, 792, fmt(c.ltTotal, 1) + ' dias', { fs: 14, w: 700, anchor: 'end' }));
    o.push(T(tbx + 16, 812, 'Tempo de ciclo total', { fs: 11, fill: '#5d6b7a' }));
    o.push(T(tbx + 220, 812, fmtTempo(c.tct), { fs: 14, w: 700, anchor: 'end' }));
    o.push(T(tbx + 16, 830, 'Valor agregado', { fs: 11, fill: '#5d6b7a' }));
    o.push(T(tbx + 220, 830, fmt(c.va, 3) + ' %', { fs: 12, w: 700, anchor: 'end' }));

    return { svg: o.join(''), W, H };
  }

  /* ---------- Vista em lista (mobile) ---------- */
  function renderList(c) {
    const node = (cls, title, meta) => `<div class="fl-node ${cls}"><h4>${esc(title)}</h4><div class="meta">${meta}</div></div>`;
    const stockRow = (qtd, unid, dias, extra = '') => `<div class="fl-stock"><span class="tri"></span>${fmtInt(qtd)} ${unid} · ${fmt(dias, 1)} dias ${extra}</div>`;
    const out = [node('', 'Fornecedor · ' + S.fornecedor.nome, `Reposição ${fmt(num(S.fornecedor.leadTime), 0)} dias · ${esc(S.fornecedor.freqEntrega)}`)];
    c.cols.forEach(col => {
      if (col.length === 1) {
        const p = col[0];
        out.push(stockRow(p.estoque, p.estoqueUnid, p.ltDias, p.ligacao === 'fifo' ? '· FIFO' : ''));
        out.push(node('proc-node ' + (p.acimaTakt ? 'over' : ''), `${p.codigo} · ${p.nome}`, `TC ${fmtTempo(p.tcS)} · setup ${fmtTempo(p.setupS)} · ${fmtInt(num(p.operadores))} op.${p.acimaTakt ? ' · <b style="color:var(--danger)">acima do takt</b>' : ''}`));
      } else {
        out.push(`<div class="fl-stock">Estoques antes dos ramos: ${col.map(p => `${p.codigo} ${fmt(p.ltDias, 1)} d`).join(' · ')}</div>`);
        out.push(`<div><div class="fl-par-label">Em paralelo</div><div class="fl-par">${col.map(p => node('proc-node ' + (p.acimaTakt ? 'over' : ''), `${p.codigo} · ${p.nome}`, `TC ${fmtTempo(p.tcS)}<br>setup ${fmtTempo(p.setupS)}`)).join('')}</div></div>`);
      }
    });
    out.push(stockRow(num(S.cliente.estoquePA), 'un', c.paLt, '· produto acabado'));
    out.push(node('', 'Cliente · ' + S.cliente.nome, `${fmtInt(c.demDia)} un/dia · entrega: ${esc(S.cliente.freqEntrega)}`));
    out.push(`<div class="fl-node" style="margin-top:12px;background:var(--primary-soft);border-color:transparent"><div class="meta" style="color:var(--primary)">Lead time <b>${fmt(c.ltTotal, 1)} dias</b> · TCT <b>${fmtTempo(c.tct)}</b> · takt <b>${fmtTempo(c.takt)}</b></div></div>`);
    $('#flow-list').innerHTML = out.join('');
  }

  /* ---------- Pan & zoom (seção 4.2) ---------- */
  let mapW = 0, mapH = 850, view = { x: 0, y: 0, w: 1200, h: 850 };
  const svgEl = () => $('#mfv-svg');
  function stageAspect() { const r = svgEl().getBoundingClientRect(); return r.width && r.height ? r.width / r.height : 1.6; }
  function fitView() { const a = stageAspect(); if (mapW / mapH > a) { view = { x: 0, w: mapW, h: mapW / a }; view.y = (mapH - view.h) / 2; } else { view = { y: 0, h: mapH, w: mapH * a }; view.x = (mapW - view.w) / 2; } applyView(); }
  function initialView() {
    const a = stageAspect();
    if (window.innerWidth < 768) { view = { x: 0, y: 100, h: 700, w: 700 * a }; applyView(); }
    else fitView();
  }
  function clampView() {
    const minW = 200, maxW = Math.max(mapW, mapH * stageAspect()) * 1.6;
    const a = view.w / view.h;
    if (view.w < minW) { const cx = view.x + view.w / 2, cy = view.y + view.h / 2; view.w = minW; view.h = minW / a; view.x = cx - view.w / 2; view.y = cy - view.h / 2; }
    if (view.w > maxW) { const cx = view.x + view.w / 2, cy = view.y + view.h / 2; view.w = maxW; view.h = maxW / a; view.x = cx - view.w / 2; view.y = cy - view.h / 2; }
    const padX = view.w * .5, padY = view.h * .5;
    view.x = Math.min(Math.max(view.x, -padX), mapW - view.w + padX);
    view.y = Math.min(Math.max(view.y, -padY), mapH - view.h + padY);
  }
  function applyView() {
    clampView();
    svgEl().setAttribute('viewBox', `${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`);
    const r = svgEl().getBoundingClientRect();
    $('#zoom-level').textContent = Math.round((r.width / view.w) * 100) + '%';
  }
  function zoomAt(f, px, py) {
    const r = svgEl().getBoundingClientRect();
    const ux = view.x + (px - r.left) / r.width * view.w, uy = view.y + (py - r.top) / r.height * view.h;
    view.w /= f; view.h /= f;
    view.x = ux - (px - r.left) / r.width * view.w; view.y = uy - (py - r.top) / r.height * view.h;
    applyView();
  }
  function zoomCenter(f) { const r = svgEl().getBoundingClientRect(); zoomAt(f, r.left + r.width / 2, r.top + r.height / 2); }
  function bindPanZoom() {
    const el = svgEl();
    const pts = new Map(); let last = null, pinch = null;
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); el.classList.add('dragging'); hideHint(); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } last = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = el.getBoundingClientRect();
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) zoomAt(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch = d; return;
      }
      if (last) { view.x -= (e.clientX - last.x) * view.w / r.width; view.y -= (e.clientY - last.y) * view.h / r.height; applyView(); }
      last = { x: e.clientX, y: e.clientY };
    });
    const end = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { el.classList.remove('dragging'); last = null; } else { last = [...pts.values()][0]; } };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }, { passive: false });
    $('#z-in').addEventListener('click', () => zoomCenter(1.25));
    $('#z-out').addEventListener('click', () => zoomCenter(0.8));
    $('#z-fit').addEventListener('click', fitView);
    $('#z-reset').addEventListener('click', initialView);
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(applyView, 120); });
    setTimeout(hideHint, 5000);
  }
  function hideHint() { const h = $('#gesture-hint'); if (h) h.style.opacity = 0; }

  $$('[data-view]').forEach(b => b.addEventListener('click', () => {
    const list = b.dataset.view === 'list';
    $$('[data-view]').forEach(x => x.classList.toggle('on', x === b));
    $('#map-stage').hidden = list; $('#flow-list').hidden = !list;
    if (!list) applyView();
  }));

  /* ---------- Exportação (seção 6) ---------- */
  function fullSVGString() {
    const { svg, W, H } = buildSVG(S, calcular(S));
    return { str: `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Nunito, Segoe UI, Arial, sans-serif">${svg}</svg>`, W, H };
  }
  function fileBase() { return ('MFV_' + (S.empresa || 'mapa') + '_' + (S.data || '')).replace(/[^\w\-]+/g, '_'); }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function toPNG(scale) {
    return new Promise((res, rej) => {
      const { str, W, H } = fullSVGString();
      const img = new Image();
      img.onload = () => { const cv = document.createElement('canvas'); cv.width = W * scale; cv.height = H * scale; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height); res({ canvas: cv, W, H }); };
      img.onerror = rej;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
    });
  }
  $$('[data-export]').forEach(b => b.addEventListener('click', async () => {
    const kind = b.dataset.export;
    try {
      if (kind === 'svg') download(new Blob([fullSVGString().str], { type: 'image/svg+xml' }), fileBase() + '.svg');
      if (kind === 'png') { const { canvas } = await toPNG(3); canvas.toBlob(bl => download(bl, fileBase() + '.png'), 'image/png'); }
      if (kind === 'pdf') {
        // Sempre folha A3 em paisagem (420 × 297 mm); o mapa é escalado para caber inteiro, sem cortes.
        const { canvas, W, H } = await toPNG(3);
        const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
        const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 10;
        const k = Math.min((pw - 2 * m) / W, (ph - 2 * m) / H);
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pw - W * k) / 2, (ph - H * k) / 2, W * k, H * k, undefined, 'FAST');
        pdf.setProperties({ title: 'MFV - ' + (S.empresa || 'Mapa do estado atual') });
        pdf.save(fileBase() + '_A3.pdf');
      }
      setStatus(kind === 'pdf' ? 'PDF gerado em folha A3 (paisagem).' : `Arquivo ${kind.toUpperCase()} gerado.`);
    } catch (err) { setStatus('Não foi possível gerar o arquivo: ' + err.message); }
  }));
  function setStatus(t) { $('#status').textContent = t; }

  /* ---------- Início ---------- */
  bindStatic(); bindProcs(); bindPanZoom();
  syncStatic(); goStep(0); renderProcs(); renderOutputs();
  requestAnimationFrame(initialView);
})();
