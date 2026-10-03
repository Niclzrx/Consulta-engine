/* ============================================
   CPF ENGINE — Application Logic
   ============================================ */

const THREADS = navigator.hardwareConcurrency || 4;
const MAX_RESULTS = 5000000;

let workers = [];
let workersDone = 0;
let lastUIUpdate = 0;
let allResults = [];
let stopped = false;

const WORKER_CODE = `
  let rodando = false;
  let input = "";
  let fixedDigits = [];
  let wildcardPos = [];
  let numWildcards = 0;
  let totalCombos = 0;
  let combo = 0;
  let comboStep = 1;
  let batchSize = 50000;

  function calcularDV(d0,d1,d2,d3,d4,d5,d6,d7,d8) {
    let soma = d0*10+d1*9+d2*8+d3*7+d4*6+d5*5+d6*4+d7*3+d8*2;
    let dv1 = (soma*10)%11;
    if (dv1===10) dv1=0;
    soma = d0*11+d1*10+d2*9+d3*8+d4*7+d5*6+d6*5+d7*4+d8*3+dv1*2;
    let dv2 = (soma*10)%11;
    if (dv2===10) dv2=0;
    return [dv1,dv2];
  }

  function processarLote() {
    if (!rodando) return;

    let encontrados = [];

    for (let count = 0; count < batchSize; count++) {
      if (combo >= totalCombos) {
        rodando = false;
        if (encontrados.length > 0) postMessage({ found: encontrados });
        postMessage({ done: true });
        return;
      }

      let c = combo;
      for (let w = 0; w < numWildcards; w++) {
        fixedDigits[wildcardPos[w]] = c % 10;
        c = (c - c%10) / 10;
      }

      const d0=fixedDigits[0], d1=fixedDigits[1], d2=fixedDigits[2];
      const d3=fixedDigits[3], d4=fixedDigits[4], d5=fixedDigits[5];
      const d6=fixedDigits[6], d7=fixedDigits[7], d8=fixedDigits[8];

      const [dv1,dv2] = calcularDV(d0,d1,d2,d3,d4,d5,d6,d7,d8);

      if ((input[9]==="?"||Number(input[9])===dv1) &&
          (input[10]==="?"||Number(input[10])===dv2)) {
        if (!(d0===d1&&d0===d2&&d0===d3&&d0===d4&&d0===d5&&d0===d6&&d0===d7&&d0===d8&&d0===dv1&&d0===dv2)) {
          encontrados.push(''+d0+d1+d2+d3+d4+d5+d6+d7+d8+dv1+dv2);
        }
      }

      combo += comboStep;
    }

    if (encontrados.length > 0) postMessage({ found: encontrados });
    setTimeout(processarLote, 0);
  }

  onmessage = function(e) {
    if (e.data.stop) { rodando = false; return; }

    input     = e.data.input;
    comboStep = e.data.step;
    combo     = e.data.start;

    fixedDigits = new Array(9);
    wildcardPos = [];
    numWildcards = 0;

    for (let i = 0; i < 9; i++) {
      if (input[i] === "?") {
        fixedDigits[i] = -1;
        wildcardPos.push(i);
        numWildcards++;
      } else {
        fixedDigits[i] = Number(input[i]);
      }
    }

    totalCombos = Math.pow(10, numWildcards);
    rodando = true;
    processarLote();
  };
`;

function createWorker() {
  const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

function formatCPF(raw) {
  const match = raw.match(/^(\d{3})(\d{3})(\d{3})(\d{2})$/);
  if (!match) return raw;
  return match[1] + '.' + match[2] + '.' + match[3] + '-' + match[4];
}

function appendResult(cpf) {
  if (allResults.length >= MAX_RESULTS) return;
  const res = document.getElementById('res');
  const formatted = formatCPF(cpf);
  allResults.push(formatted);

  const now = Date.now();
  if (now - lastUIUpdate < 100) return;
  lastUIUpdate = now;

  const slice = allResults.slice(-200).reverse();
  res.innerHTML = slice.map((c, i) =>
    `<div class="cpf-line">
      <span class="cpf-num">${c}</span>
      <span class="cpf-idx">#${allResults.length - i}</span>
    </div>`
  ).join('');

  updateInfo();
}

function updateInfo() {
  const info = document.getElementById('info');
  info.textContent = '';
  const t1 = document.createTextNode(`> threads: ${THREADS}  |  encontrados: ${allResults.length}`);
  info.appendChild(t1);
}

function start() {
  const rawInput = document.getElementById('cpfInput').value.trim();
  const res = document.getElementById('res');

  if (rawInput.length !== 11) {
    res.textContent = '> erro: insira exatamente 11 caracteres (use ? para curingas)';
    return;
  }

  if (!/^[\d?]{11}$/.test(rawInput)) {
    res.textContent = '> erro: use apenas dígitos (0-9) e ? como curinga';
    return;
  }

  stop();
  res.textContent = '';
  lastUIUpdate = 0;
  allResults = [];
  workersDone = 0;
  stopped = false;

  updateInfo();

  for (let i = 0; i < THREADS; i++) {
    const w = createWorker();

    w.onmessage = (e) => {
      if (e.data.found) {
        e.data.found.forEach(appendResult);
      }
      if (e.data.done) {
        workersDone++;
        if (workersDone >= THREADS && !stopped) {
          showExportMsg(`> varredura concluída: ${allResults.length} CPFs encontrados`);
        }
      }
    };

    w.onerror = (err) => {
      console.error('Worker error:', err);
      showExportMsg('> erro no worker');
    };

    w.postMessage({ input: rawInput, start: i, step: THREADS });
    workers.push(w);
  }
}

function stop() {
  stopped = true;
  workers.forEach(w => w.terminate());
  workers = [];
}

document.getElementById('cpfInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') start();
});

function showExportMsg(txt) {
  const msg = document.getElementById('exportMsg');
  msg.textContent = txt;
  msg.classList.add('visible');
  setTimeout(() => msg.classList.remove('visible'), 2500);
}

function copiarTodos() {
  if (allResults.length === 0) {
    showExportMsg('> nenhum resultado ainda');
    return;
  }
  const texto = allResults.join('\n');
  navigator.clipboard.writeText(texto)
    .then(() => showExportMsg(`> ${allResults.length} CPFs copiados ✓`))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showExportMsg(`> ${allResults.length} CPFs copiados ✓`);
    });
}

function baixarTxt() {
  if (allResults.length === 0) {
    showExportMsg('> nenhum resultado ainda');
    return;
  }
  const texto = allResults.join('\n');
  const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cpfs_${Date.now()}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showExportMsg(`> ${allResults.length} CPFs baixados ✓`);
}
