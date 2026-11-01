(() => {
  const OPS = ['+', '−', '×', '÷'];
  const $main = document.getElementById('main');
  const $sub = document.getElementById('sub').firstElementChild;
  const $rolls = document.getElementById('rolls');
  const $exNote = document.getElementById('exNote');

  let tokens = [];        // [{t:'n', v:'12.5'} | {t:'o', v:'+'}]
  let done = false;       // just pressed "="
  let lastExpr = '';

  const EXAMPLES = [
    { x: '18,450 ÷ 3', r: '6,150', ex: true },
    { x: '1,299 × 12 − 2,000', r: '13,588', ex: true },
    { x: '640 + 18%', r: '640.18', ex: true },
  ];
  let tape = null;
  try { tape = JSON.parse(localStorage.getItem('deskTape') || 'null'); } catch (e) {}
  if (!Array.isArray(tape)) tape = EXAMPLES.slice();
  const saveTape = () => { try { localStorage.setItem('deskTape', JSON.stringify(tape.filter(t => !t.ex))); } catch (e) {} };

  const last = () => tokens[tokens.length - 1];

  function group(s) {
    const neg = s.startsWith('-'); if (neg) s = s.slice(1);
    let [i, f] = s.split('.');
    i = (i || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '−' : '') + i + (f !== undefined ? '.' + f : '');
  }
  function fmt(n) {
    if (!isFinite(n)) return 'Error';
    const v = parseFloat(n.toPrecision(12));
    if (v !== 0 && (Math.abs(v) >= 1e15 || Math.abs(v) < 1e-9)) return v.toExponential(6).replace('-', '−');
    return group(String(v));
  }
  const exprText = (ts) => ts.map(t => t.t === 'n' ? group(t.v) : t.v).join(' ');

  function evaluate(ts) {
    ts = ts.slice();
    while (ts.length && ts[ts.length - 1].t === 'o') ts.pop();
    if (!ts.length) return 0;
    const nums = [parseFloat(ts[0].v) || 0], ops = [];
    for (let i = 1; i < ts.length; i += 2) {
      const op = ts[i].v, n = parseFloat(ts[i + 1].v) || 0;
      if (op === '×') nums.push(nums.pop() * n);
      else if (op === '÷') { if (n === 0) return NaN; nums.push(nums.pop() / n); }
      else { ops.push(op); nums.push(n); }
    }
    let r = nums[0];
    ops.forEach((op, i) => { r = op === '+' ? r + nums[i + 1] : r - nums[i + 1]; });
    return r;
  }

  function render() {
    const txt = tokens.length ? exprText(tokens) : '0';
    $main.textContent = txt;
    $main.classList.toggle('err', txt === 'Error');
    $main.classList.toggle('m', txt.length > 12 && txt.length <= 18);
    $main.classList.toggle('s', txt.length > 18);
    if (done) $sub.textContent = lastExpr ? lastExpr + ' =' : '';
    else {
      const hasOp = tokens.some(t => t.t === 'o') && last() && last().t === 'n';
      $sub.textContent = hasOp ? '= ' + fmt(evaluate(tokens)) : '';
    }
    const lo = last();
    document.querySelectorAll('.keys .op').forEach(b => b.classList.toggle('on', !!lo && lo.t === 'o' && lo.v === b.dataset.k));
  }

  function renderTape() {
    $exNote.hidden = !tape.some(t => t.ex);
    $rolls.innerHTML = '';
    if (!tape.length) { $rolls.innerHTML = '<li class="empty">Totals print here when you press =.</li>'; return; }
    tape.forEach((t) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.innerHTML = '<span class="x"></span><span class="r"></span>';
      b.querySelector('.x').textContent = t.x;
      b.querySelector('.r').textContent = t.r;
      b.setAttribute('aria-label', 'Use ' + t.r);
      b.addEventListener('click', () => {
        const v = t.r.replace(/,/g, '').replace('−', '-');
        if (isNaN(parseFloat(v))) return;
        if (done || !tokens.length || last().t === 'n') tokens = [];
        tokens.push({ t: 'n', v }); done = false; render();
      });
      li.appendChild(b); $rolls.appendChild(li);
    });
  }

  function press(k) {
    if (/^\d$/.test(k)) {
      if (done) { tokens = []; done = false; }
      const l = last();
      if (l && l.t === 'n') {
        if (l.v.replace(/[-.]/g, '').length >= 12) return;
        l.v = (l.v === '0') ? k : (l.v === '-0' ? '-' + k : l.v + k);
      } else tokens.push({ t: 'n', v: k });
    } else if (k === '.') {
      if (done) { tokens = []; done = false; }
      const l = last();
      if (l && l.t === 'n') { if (!l.v.includes('.')) l.v += '.'; }
      else tokens.push({ t: 'n', v: '0.' });
    } else if (OPS.includes(k)) {
      if (done) { done = false; }
      if (!tokens.length) tokens.push({ t: 'n', v: '0' });
      if (last().t === 'o') last().v = k; else tokens.push({ t: 'o', v: k });
    } else if (k === 'neg') {
      const l = last();
      if (l && l.t === 'n') l.v = l.v.startsWith('-') ? l.v.slice(1) : '-' + l.v;
      done = false;
    } else if (k === '%') {
      const l = last();
      if (l && l.t === 'n') l.v = String(parseFloat((parseFloat(l.v) / 100).toPrecision(12)));
      done = false;
    } else if (k === 'back') {
      if (done) { tokens = []; done = false; }
      const l = last();
      if (!l) {} else if (l.t === 'o') tokens.pop();
      else { l.v = l.v.slice(0, -1); if (l.v === '' || l.v === '-') tokens.pop(); }
    } else if (k === 'clear') {
      tokens = []; done = false; lastExpr = '';
    } else if (k === '=') {
      while (tokens.length && last().t === 'o') tokens.pop();
      if (!tokens.length || done || tokens.length < 3) { render(); return; }
      const r = evaluate(tokens), rs = fmt(r);
      lastExpr = exprText(tokens);
      if (tape.some(t => t.ex)) tape = [];
      tape.unshift({ x: lastExpr, r: rs }); tape = tape.slice(0, 50);
      saveTape(); renderTape();
      tokens = isFinite(r) ? [{ t: 'n', v: String(parseFloat(r.toPrecision(12))) }] : [];
      if (!isFinite(r)) { $main.textContent = 'Error'; done = true; $sub.textContent = lastExpr + ' ='; $main.classList.add('err'); return; }
      done = true;
    }
    render();
  }

  document.getElementById('keys').addEventListener('click', e => {
    const b = e.target.closest('button'); if (b) press(b.dataset.k);
  });
  document.getElementById('clearTape').addEventListener('click', () => { tape = []; saveTape(); renderTape(); });

  const KEYMAP = { '+': '+', '-': '−', '*': '×', 'x': '×', 'X': '×', '/': '÷', 'Enter': '=', '=': '=',
    'Backspace': 'back', 'Escape': 'clear', 'Delete': 'clear', '%': '%', '.': '.', ',': '.' };
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = /^\d$/.test(e.key) ? e.key : KEYMAP[e.key];
    if (!k) return;
    e.preventDefault(); press(k);
    const btn = document.querySelector(`.keys button[data-k="${CSS.escape(k)}"]`);
    if (btn) { btn.classList.add('press'); setTimeout(() => btn.classList.remove('press'), 110); }
  });

  // Open in a working state: a sample sum in progress.
  tokens = [{ t: 'n', v: '1250' }, { t: 'o', v: '×' }, { t: 'n', v: '4' }];
  render(); renderTape();
})();
