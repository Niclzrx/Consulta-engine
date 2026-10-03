/* ============================================
   CONSULTA CPF — Application Logic
   ============================================ */

(function () {
  'use strict';

  const TOKEN = '208500720dCMxzOgvuw376441728';

  const cpfsInput = document.getElementById('cpfs');
  const btnConsultar = document.getElementById('btnConsultar');
  const btnCopy = document.getElementById('btnCopy');
  const errorBox = document.getElementById('errorBox');
  const errorTitle = document.getElementById('errorTitle');
  const errorMsg = document.getElementById('errorMsg');
  const progressArea = document.getElementById('progressArea');
  const progressText = document.getElementById('progressText');
  const progressPct = document.getElementById('progressPct');
  const progressFill = document.getElementById('progressFill');
  const resultsArea = document.getElementById('resultsArea');
  const resultsList = document.getElementById('resultsList');
  const resultsCount = document.getElementById('resultsCount');

  let filtroAtual = 'all';

  function extrairCPFs(t) {
    return t.split(/[\n,;]+/).map(l => l.replace(/\D/g, '')).filter(c => c.length === 11);
  }

  function validarCPF(c) {
    if (/^(\d)\1{10}$/.test(c)) return false;
    let s = 0;
    for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
    let r = 11 - (s % 11);
    if (r > 9) r = 0;
    if (r !== parseInt(c[9])) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
    r = 11 - (s % 11);
    if (r > 9) r = 0;
    return r === parseInt(c[10]);
  }

  function fmt(c) {
    return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  function mostrarErro(t, m) {
    errorTitle.textContent = t;
    errorMsg.textContent = m;
    errorBox.classList.add('active');
  }

  function esconderErro() {
    errorBox.classList.remove('active');
  }

  async function consultar() {
    const cpfs = extrairCPFs(cpfsInput.value);
    if (!cpfs.length) {
      mostrarErro('Nenhum CPF', 'Digite pelo menos um CPF válido.');
      return;
    }

    const unicos = [...new Set(cpfs)];
    const total = unicos.length;

    esconderErro();
    resultsArea.classList.remove('active');
    progressArea.classList.add('active');
    btnConsultar.disabled = true;
    resultsList.innerHTML = '';
    let ok = 0, falha = 0;

    for (let i = 0; i < unicos.length; i++) {
      const cpf = unicos[i];
      progressText.textContent = `${i + 1}/${total}`;
      progressPct.textContent = `${Math.round(((i + 1) / total) * 100)}%`;
      progressFill.style.width = `${((i + 1) / total) * 100}%`;

      if (!validarCPF(cpf)) {
        adicionar(cpf, null, 'CPF inválido');
        falha++;
      } else {
        try {
          const resp = await fetch(`https://ws.hubdodesenvolvedor.com.br/v2/cadastropf/?cpf=${cpf}&token=${TOKEN}`);
          const data = await resp.json();
          if (data && data.status === true && data.result && data.result.nomeCompleto) {
            adicionar(cpf, data.result.nomeCompleto, null);
            ok++;
          } else {
            adicionar(cpf, null, 'Não encontrado');
            falha++;
          }
        } catch {
          adicionar(cpf, null, 'Erro de conexão');
          falha++;
        }
      }

      if (i < unicos.length - 1) await new Promise(r => setTimeout(r, 1000));
    }

    progressArea.classList.remove('active');
    resultsArea.classList.add('active');
    resultsCount.textContent = `${ok} ✓`;
    btnConsultar.disabled = false;
  }

  function adicionar(cpf, nome, erro) {
    const d = document.createElement('div');
    d.className = erro ? 'result-item error' : 'result-item success';
    d.innerHTML = `
      <div class="result-info">
        <div class="result-cpf">${fmt(cpf)}</div>
        ${nome ? `<div class="result-nome">${nome}</div>` : `<div class="result-erro">${erro}</div>`}
      </div>
      <span class="badge badge-sm ${erro ? 'badge-error' : 'badge-success'}">${erro ? 'ERRO' : 'OK'}</span>
    `;
    resultsList.appendChild(d);
    aplicarFiltro();
  }

  function aplicarFiltro() {
    resultsList.querySelectorAll('.result-item').forEach(item => {
      if (filtroAtual === 'all') {
        item.style.display = '';
      } else if (filtroAtual === 'ok') {
        item.style.display = item.classList.contains('success') ? '' : 'none';
      } else if (filtroAtual === 'error') {
        item.style.display = item.classList.contains('error') ? '' : 'none';
      }
    });
  }

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtroAtual = btn.dataset.filter;
      aplicarFiltro();
    });
  });

  btnConsultar.addEventListener('click', consultar);
  cpfsInput.addEventListener('keydown', e => { if (e.key === 'Enter' && e.ctrlKey) consultar(); });

  btnCopy.addEventListener('click', () => {
    let t = '';
    resultsList.querySelectorAll('.result-item').forEach(i => {
      if (i.style.display === 'none') return;
      const cpf = i.querySelector('.result-cpf').textContent;
      const n = i.querySelector('.result-nome');
      const e = i.querySelector('.result-erro');
      t += `${cpf} - ${n ? n.textContent : e.textContent}\n`;
    });
    navigator.clipboard.writeText(t);
    btnCopy.textContent = '✓ Copiado!';
    setTimeout(() => btnCopy.textContent = '📋 Copiar', 2000);
  });

})();
