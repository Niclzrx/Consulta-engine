/* ============================================
   CONSULTA CNPJ — Application Logic
   ============================================ */

(function () {
  'use strict';

  const API_BASE = 'https://publica.cnpj.ws/cnpj/';

  const input = document.getElementById('cnpjInput');
  const btn = document.getElementById('btnConsultar');
  const loadingEl = document.getElementById('loading');
  const erroEl = document.getElementById('erro');
  const resultadoEl = document.getElementById('resultado');

  input.addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '').slice(0, 14);
    if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
    else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4');
    else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3');
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,3})/, '$1.$2');
    this.value = v;
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') consultar();
  });

  function limpar() {
    erroEl.classList.add('hidden');
    resultadoEl.classList.add('hidden');
    loadingEl.classList.add('hidden');
  }

  function mostrarErro(titulo, msg) {
    limpar();
    erroEl.innerHTML =
      '<div class="error-icon">&#9888;</div>' +
      '<div class="error-text">' +
        '<strong>' + titulo + '</strong>' +
        '<span>' + msg + '</span>' +
      '</div>';
    erroEl.classList.remove('hidden');
  }

  function formatarCNPJ(cnpj) {
    var d = cnpj.replace(/\D/g, '');
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  function formatarMoeda(valor) {
    if (!valor) return '—';
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarData(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  }

  function escHtml(str) {
    if (!str) return '—';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function badgeSituacao(s) {
    var lower = (s || '').toLowerCase();
    if (lower === 'ativa') return 'badge-success';
    if (['baixada', 'suspensa', 'nula', 'inapta', 'não existente'].indexOf(lower) !== -1) return 'badge-error';
    return 'badge-warning';
  }

  async function consultar() {
    var raw = input.value.replace(/\D/g, '');
    if (raw.length !== 14) {
      mostrarErro('CNPJ inválido', 'O CNPJ deve conter exatamente 14 dígitos numéricos.');
      return;
    }

    limpar();
    loadingEl.classList.remove('hidden');
    btn.disabled = true;

    try {
      var res = await fetch(API_BASE + raw);

      if (res.status === 404) {
        mostrarErro('CNPJ não encontrado', 'Nenhum registro encontrado para o CNPJ informado. Verifique o número e tente novamente.');
        return;
      }
      if (res.status === 429) {
        mostrarErro('Limite de requisições', 'Muitas consultas em pouco tempo. Aguarde alguns minutos e tente novamente.');
        return;
      }
      if (!res.ok) {
        mostrarErro('Erro na consulta', 'O servidor retornou o status HTTP ' + res.status + '. Tente novamente mais tarde.');
        return;
      }

      var d = await res.json();
      renderizar(d);
    } catch (err) {
      mostrarErro('Erro de conexão', 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.');
    } finally {
      btn.disabled = false;
      loadingEl.classList.add('hidden');
    }
  }

  function renderizar(d) {
    var est = d.estabelecimento || {};
    var cidade = (est.cidade && est.cidade.nome) || '—';
    var uf = (est.estado && est.estado.sigla) || '—';
    var partes = [est.tipo_logradouro, est.logradouro, est.numero, est.complemento].filter(Boolean);
    var endereco = partes.join(' ');
    var bairro = est.bairro || '';
    var cep = est.cep ? est.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2') : '';
    var telefone = (est.ddd1 && est.telefone1) ? '(' + est.ddd1 + ') ' + est.telefone1 : '—';

    var html = '<div class="card-inner">';

    html += '<div class="card-header">';
    html += '<div>';
    html += '<h2>' + escHtml(d.razao_social) + '</h2>';
    html += '<div class="cnpj-display">' + formatarCNPJ(est.cnpj || '') + '</div>';
    if (est.nome_fantasia) {
      html += '<div class="nome-fantasia">' + escHtml(est.nome_fantasia) + '</div>';
    }
    html += '</div>';
    html += '<span class="badge ' + badgeSituacao(est.situacao_cadastral) + '">' + escHtml(est.situacao_cadastral) + '</span>';
    html += '</div>';

    html += '<div class="info-grid">';
    html += infoItem('Capital Social', formatarMoeda(d.capital_social));
    html += infoItem('Porte', (d.porte && d.porte.descricao) || '—');
    html += infoItem('Natureza Jurídica', (d.natureza_juridica && d.natureza_juridica.descricao) || '—');
    html += infoItem('Data Início Atividade', formatarData(est.data_inicio_atividade));
    html += infoItem('Telefone', telefone);
    html += infoItem('E-mail', escHtml(est.email));
    html += infoItem('Endereco', endereco + (bairro ? ', ' + bairro : '') + ' — ' + cidade + '/' + uf + (cep ? ' — CEP ' + cep : ''), true);
    html += '</div>';

    if (est.atividade_principal) {
      html += '<div class="section-title">Atividade Principal (CNAE)</div>';
      html += '<div class="atividades">';
      html += atividadeTag(est.atividade_principal.subclasse || est.atividade_principal.id, est.atividade_principal.descricao);
      html += '</div>';
    }

    if (est.atividades_secundarias && est.atividades_secundarias.length > 0) {
      html += '<div class="section-title">Atividades Secundárias (' + est.atividades_secundarias.length + ')</div>';
      html += '<div class="atividades atividades-scroll">';
      for (var i = 0; i < est.atividades_secundarias.length; i++) {
        var a = est.atividades_secundarias[i];
        html += atividadeTag(a.subclasse || a.id, a.descricao);
      }
      html += '</div>';
    }

    if (d.socios && d.socios.length > 0) {
      html += '<div class="section-title">Sócios (' + d.socios.length + ')</div>';
      html += '<div class="table-wrapper">';
      html += '<table class="socios-table">';
      html += '<thead><tr><th>Nome</th><th>Tipo</th><th>Qualificação</th><th>Entrada</th></tr></thead><tbody>';
      for (var j = 0; j < d.socios.length; j++) {
        var s = d.socios[j];
        var tagClass = s.tipo === 'Pessoa Física' ? 'tag-pf' : 'tag-pj';
        html += '<tr>';
        html += '<td>' + escHtml(s.nome) + '</td>';
        html += '<td><span class="tag-tipo ' + tagClass + '">' + escHtml(s.tipo) + '</span></td>';
        html += '<td>' + escHtml(s.qualificacao_socio && s.qualificacao_socio.descricao) + '</td>';
        html += '<td>' + formatarData(s.data_entrada) + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }

    if (est.inscricoes_estaduais && est.inscricoes_estaduais.length > 0) {
      html += '<div class="section-title">Inscrições Estaduais</div>';
      html += '<div class="ie-list">';
      for (var k = 0; k < est.inscricoes_estaduais.length; k++) {
        var ie = est.inscricoes_estaduais[k];
        html += '<div class="ie-chip">';
        html += '<span class="ie-uf">' + escHtml(ie.estado && ie.estado.sigla) + '</span>';
        html += '<span class="ie-num">' + escHtml(ie.inscricao_estadual) + '</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    if (d.simples) {
      html += '<div class="section-title">Simples Nacional</div>';
      html += '<div class="simples-grid">';
      html += infoItem('MEI', d.simples.mei || '—');
      html += infoItem('Simples Nacional', d.simples.simples || '—');
      html += infoItem('Opção Simples', formatarData(d.simples.data_opcao_simples));
      html += infoItem('Exclusão Simples', formatarData(d.simples.data_exclusao_simples));
      html += '</div>';
    }

    html += '</div>';

    resultadoEl.innerHTML = html;
    resultadoEl.classList.remove('hidden');
  }

  function infoItem(label, value, fullWidth) {
    return '<div class="info-item' + (fullWidth ? ' full-width' : '') + '">' +
      '<label>' + label + '</label>' +
      '<span>' + escHtml(value) + '</span>' +
    '</div>';
  }

  function atividadeTag(code, desc) {
    return '<div class="atividade-tag">' +
      '<span class="cnae-code">' + escHtml(code) + '</span>' +
      '<span>' + escHtml(desc) + '</span>' +
    '</div>';
  }

  window.consultar = consultar;

})();
