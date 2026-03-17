/* ═══════════════════════════════════════════════════════════════════
   script.js  —  QuantumCalc · Calculadora Científica Avanzada
   Lógica principal: Math.js · Plotly · Tesseract · GSAP
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────────
   1. ESTADO GLOBAL
   ───────────────────────────────────────────────────────────────── */
const STATE = {
  expression:  '',
  allSteps:    [],
  currentMode: 'basic',
  isTyping:    false,
  typingTimer: null,
  isCalculating: false,
};

/* ─────────────────────────────────────────────────────────────────
   2. REFERENCIAS AL DOM
   ───────────────────────────────────────────────────────────────── */
const DOM = {
  get display()        { return document.getElementById('input-display'); },
  get result()         { return document.getElementById('result-display'); },
  get stepsContainer() { return document.getElementById('steps-container'); },
  get stepsEmpty()     { return document.getElementById('steps-empty'); },
  get stepsCount()     { return document.getElementById('steps-count'); },
  get displayMain()    { return document.getElementById('display-main'); },
  get typingIndicator(){ return document.getElementById('typing-indicator'); },
  get graphExpr()      { return document.getElementById('graph-expr'); },
  get graphContainer() { return document.getElementById('graph-container'); },
  get graphPlaceholder(){ return document.getElementById('graph-placeholder'); },
  get graphLoading()   { return document.getElementById('graph-loading'); },
  get ocrProgress()    { return document.getElementById('ocr-progress'); },
  get ocrBar()         { return document.getElementById('ocr-bar'); },
  get ocrStatus()      { return document.getElementById('ocr-status'); },
  get ocrGlow()        { return document.getElementById('ocr-glow'); },
  get ocrDropZone()    { return document.getElementById('ocr-drop-zone'); },
  get toastContainer() { return document.getElementById('toast-container'); },
  get clockDisplay()   { return document.getElementById('clock-display'); },
  get headerStatus()   { return document.getElementById('header-status'); },
  get mobileMenuBtn()  { return document.getElementById('mobile-menu-btn'); },
};

/* ─────────────────────────────────────────────────────────────────
   3. INICIALIZACIÓN — DOMContentLoaded
   ───────────────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  initAnimations();
  initClock();
  initKeyboardListeners();
  initDragDrop();
  initMobileMenu();
  initScrollHeader();

  DOM.display.textContent = '';
  updatePreview();

  showToast('Sistema listo · Math.js + Plotly + Tesseract activos', 'success');
});

/* ─────────────────────────────────────────────────────────────────
   4. ANIMACIONES DE ENTRADA (GSAP)
   ───────────────────────────────────────────────────────────────── */
function initAnimations() {
  /* Línea de escaneo del header */
  gsap.fromTo('.header',
    { opacity: 0, y: -30 },
    { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }
  );

  /* Calc panel: entra desde la izquierda */
  gsap.fromTo('#calc-panel',
    { opacity: 0, x: -40, filter: 'blur(6px)' },
    { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.75, delay: 0.15, ease: 'power3.out' }
  );

  /* Graph panel: entra desde abajo con fade */
  gsap.fromTo('#graph-panel',
    { opacity: 0, y: 30, filter: 'blur(4px)' },
    { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.65, delay: 0.3, ease: 'power3.out' }
  );

  /* Steps panel: entra desde la derecha */
  gsap.fromTo('#steps-panel',
    { opacity: 0, x: 40, filter: 'blur(6px)' },
    { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.75, delay: 0.4, ease: 'power3.out' }
  );

  /* Teclas: stagger suave de entrada */
  gsap.fromTo('.key',
    { opacity: 0, scale: 0.85, y: 5 },
    {
      opacity: 1, scale: 1, y: 0,
      duration: 0.25,
      stagger: { each: 0.012, from: 'start' },
      delay: 0.5,
      ease: 'power2.out',
    }
  );

  /* Zona OCR: fade in */
  gsap.fromTo('.ocr-section',
    { opacity: 0 },
    { opacity: 1, duration: 0.5, delay: 0.9, ease: 'power2.out' }
  );

  /* Estado vacío del panel de pasos */
  gsap.fromTo('.empty-state',
    { opacity: 0, scale: 0.9 },
    { opacity: 0.3, scale: 1, duration: 0.6, delay: 0.8, ease: 'elastic.out(1, 0.5)' }
  );
}

/* ─────────────────────────────────────────────────────────────────
   5. RELOJ EN TIEMPO REAL
   ───────────────────────────────────────────────────────────────── */
function initClock() {
  function tick() {
    const now = new Date();
    DOM.clockDisplay.textContent = now.toLocaleTimeString('es-CO', { hour12: false });
  }
  tick();
  setInterval(tick, 1000);
}

/* ─────────────────────────────────────────────────────────────────
   6. MENÚ MÓVIL
   ───────────────────────────────────────────────────────────────── */
function initMobileMenu() {
  const btn = DOM.mobileMenuBtn;
  if (!btn) return;

  btn.addEventListener('click', () => {
    const isOpen = btn.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen);
    DOM.headerStatus.classList.toggle('mobile-open', isOpen);

    if (isOpen) {
      gsap.fromTo(DOM.headerStatus,
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' }
      );
    }
  });

  // Cerrar al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !DOM.headerStatus.contains(e.target)) {
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', false);
      DOM.headerStatus.classList.remove('mobile-open');
    }
  });
}

/* ─────────────────────────────────────────────────────────────────
   7. SCROLL → SOMBRA EN HEADER
   ───────────────────────────────────────────────────────────────── */
function initScrollHeader() {
  const header = document.querySelector('.header');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 5);
  }, { passive: true });
}

/* ─────────────────────────────────────────────────────────────────
   8. TECLADO FÍSICO
   ───────────────────────────────────────────────────────────────── */
function initKeyboardListeners() {
  document.addEventListener('keydown', (e) => {
    if (e.target === DOM.display) return; // Deja actuar el campo editable
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); calculate(); }
    if (e.key === 'Escape') clearAll();
    if (e.key === 'Backspace' && e.ctrlKey) clearAll();
  });
}

/* ─────────────────────────────────────────────────────────────────
   9. DISPLAY — LECTURA Y ESCRITURA
   ───────────────────────────────────────────────────────────────── */
function getExpression() {
  let txt = DOM.display.textContent.trim();
  txt = txt.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  return txt;
}

function setExpression(txt) {
  DOM.display.textContent = txt;
}

function insertText(val) {
  setExpression(getExpression() + val);
  updatePreview();
  animateKeyPress();
  triggerTypingIndicator();
}

function deleteLast() {
  const expr = getExpression();
  if (!expr) return;
  setExpression(expr.slice(0, -1));
  updatePreview();

  // Micro-animación de delete
  gsap.fromTo(DOM.display,
    { x: -4 },
    { x: 0, duration: 0.2, ease: 'elastic.out(2, 0.5)' }
  );
}

function clearAll() {
  if (!getExpression() && !DOM.result.textContent) return;

  // Animación de limpieza: flash + fade
  gsap.timeline()
    .to(DOM.displayMain, {
      boxShadow: '0 0 0 3px rgba(255,68,102,0.35), inset 0 0 30px rgba(255,68,102,0.08)',
      borderColor: '#ff4466',
      duration: 0.15,
    })
    .to(DOM.display, { opacity: 0, y: -5, duration: 0.18, ease: 'power2.in' })
    .call(() => {
      setExpression('');
      DOM.result.textContent = '';
    })
    .to(DOM.display, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' })
    .to(DOM.displayMain, {
      boxShadow: 'none',
      borderColor: 'var(--border-bright)',
      duration: 0.25,
    }, '<');
}

/* Vista previa en tiempo real mientras se escribe */
function updatePreview() {
  try {
    const expr = getExpression();
    if (expr && expr.length > 1) {
      const preview = math.evaluate(expr);
      if (typeof preview === 'number' || typeof preview === 'string') {
        DOM.result.textContent = '≈ ' + formatResult(preview);
        gsap.fromTo(DOM.result,
          { opacity: 0, y: 3 },
          { opacity: 0.85, y: 0, duration: 0.2, ease: 'power2.out' }
        );
      } else {
        DOM.result.textContent = '';
      }
    } else {
      DOM.result.textContent = '';
    }
  } catch (e) {
    DOM.result.textContent = '';
  }
}

/* Escuchar cambios directos en el display editable */
DOM.display.addEventListener && document.addEventListener('DOMContentLoaded', () => {
  DOM.display.addEventListener('input', () => {
    updatePreview();
    triggerTypingIndicator();
  });
});

/* Indicador visual de escritura */
function triggerTypingIndicator() {
  if (!DOM.typingIndicator) return;
  DOM.typingIndicator.classList.add('visible');
  clearTimeout(STATE.typingTimer);
  STATE.typingTimer = setTimeout(() => {
    DOM.typingIndicator.classList.remove('visible');
  }, 1200);
}

/* ─────────────────────────────────────────────────────────────────
   10. MICRO-ANIMACIÓN DE TECLA PULSADA
   ───────────────────────────────────────────────────────────────── */
function animateKeyPress() {
  gsap.timeline()
    .to(DOM.display, {
      textShadow: '0 0 28px rgba(0,212,255,0.95)',
      duration: 0.06,
    })
    .to(DOM.display, {
      textShadow: '0 0 10px rgba(0,212,255,0.4)',
      duration: 0.35,
      ease: 'power2.out',
    });
}

/* Ripple en botón al hacer click */
function addKeyRipple(btn) {
  gsap.fromTo(btn, { scale: 0.9 }, { scale: 1, duration: 0.25, ease: 'elastic.out(2, 0.4)' });
}

/* ─────────────────────────────────────────────────────────────────
   11. CAMBIO DE MODO (con animación GSAP)
   ───────────────────────────────────────────────────────────────── */
function switchMode(mode) {
  if (mode === STATE.currentMode) return;
  STATE.currentMode = mode;

  /* Actualizar tabs */
  document.querySelectorAll('.mode-tab').forEach(t => {
    const isActive = t.dataset.mode === mode;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive);
  });

  /* Animar salida del panel actual */
  const panels = { basic: 'fn-basic', algebra: 'fn-algebra', stats: 'fn-stats' };
  const allPanels = Object.values(panels);

  allPanels.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    if (id === panels[mode]) {
      /* Panel entrante */
      el.style.display = '';
      gsap.fromTo(el,
        { opacity: 0, y: 12, filter: 'blur(3px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.35, ease: 'power3.out' }
      );

      /* Stagger en teclas del panel nuevo */
      gsap.fromTo(el.querySelectorAll('.key'),
        { opacity: 0, scale: 0.88, y: 4 },
        {
          opacity: 1, scale: 1, y: 0,
          duration: 0.22,
          stagger: 0.018,
          ease: 'power2.out',
        }
      );
    } else {
      /* Paneles salientes */
      if (el.style.display !== 'none') {
        gsap.to(el, {
          opacity: 0, y: -8,
          duration: 0.18,
          ease: 'power2.in',
          onComplete: () => { el.style.display = 'none'; }
        });
      }
    }
  });

  /* Flash en el tab activo */
  const activeTab = document.querySelector(`.mode-tab[data-mode="${mode}"]`);
  if (activeTab) {
    gsap.fromTo(activeTab,
      { boxShadow: '0 0 18px rgba(0,212,255,0.6)' },
      { boxShadow: '0 0 0 rgba(0,212,255,0)', duration: 0.5, ease: 'power2.out' }
    );
  }
}

/* ─────────────────────────────────────────────────────────────────
   12. CÁLCULO PRINCIPAL CON PASOS
   ───────────────────────────────────────────────────────────────── */
function calculate() {
  const expr = getExpression();
  if (!expr || STATE.isCalculating) return;
  STATE.isCalculating = true;

  clearSteps();
  STATE.allSteps = [];

  /* Animación de "procesando" en el display */
  gsap.timeline()
    .to(DOM.displayMain, {
      boxShadow: '0 0 0 2px rgba(0,212,255,0.25), 0 0 30px rgba(0,212,255,0.12)',
      duration: 0.2,
    })
    .to(DOM.display, {
      color: '#ffffff',
      textShadow: '0 0 20px rgba(0,212,255,0.8)',
      duration: 0.15,
    })
    .to(DOM.display, {
      color: 'var(--accent-cyan)',
      textShadow: '0 0 10px rgba(0,212,255,0.4)',
      duration: 0.4,
    })
    .to(DOM.displayMain, {
      boxShadow: 'none',
      duration: 0.3,
    }, '<+=0.2');

  setTimeout(() => {
    try {
      const steps = generateSteps(expr);
      STATE.allSteps = steps;

      DOM.stepsEmpty.style.display = 'none';
      animateStepsSequentially(steps);
      DOM.stepsCount.textContent = steps.length + ' PASOS';

      /* Resultado en display con animación */
      const lastVal = steps.filter(s => s.value !== null).pop()?.value;
      if (lastVal != null) {
        gsap.timeline()
          .to(DOM.result, { opacity: 0, y: 5, duration: 0.15 })
          .call(() => { DOM.result.textContent = '= ' + lastVal; })
          .to(DOM.result, {
            opacity: 0.95,
            y: 0,
            duration: 0.35,
            ease: 'power3.out',
          });
      }

    } catch (err) {
      addStepCard('⚠ ERROR', err.message, 'step-error');
      DOM.stepsEmpty.style.display = 'none';
      showToast('Error: ' + err.message, 'error');
    }

    STATE.isCalculating = false;
  }, 80);
}

/* ─────────────────────────────────────────────────────────────────
   13. GENERACIÓN DE PASOS EXPLICATIVOS
   ───────────────────────────────────────────────────────────────── */
function generateSteps(expr) {
  const steps = [];

  /* Parsear la expresión con math.js */
  const node = math.parse(expr);

  /* PASO 1 · Expresión original */
  steps.push({
    label: 'PASO 1 · EXPRESIÓN ORIGINAL',
    content: `<span class="highlight">Expresión:</span> <span class="math-val">${escHtml(expr)}</span>`,
    type: '',
    value: null,
  });

  /* PASO 2 · Análisis sintáctico */
  steps.push({
    label: 'PASO 2 · ANÁLISIS SINTÁCTICO',
    content: `Tipo de nodo: <span class="highlight">${escHtml(node.type)}</span><br>
              Forma canónica: <span class="math-val">${escHtml(node.toString())}</span>`,
    type: '',
    value: null,
  });

  /* PASO 3 · Sustitución de constantes */
  let exprProcessed = expr;
  const constSubs = [];
  if (expr.includes('pi')) {
    exprProcessed = exprProcessed.replace(/\bpi\b/g, Math.PI.toFixed(8));
    constSubs.push(`π → <span class="math-val">${Math.PI.toFixed(8)}</span>`);
  }
  if (expr.includes(' e') || /\be\b/.test(expr)) {
    constSubs.push(`e → <span class="math-val">${Math.E.toFixed(8)}</span>`);
  }
  if (constSubs.length > 0) {
    steps.push({
      label: 'PASO 3 · SUSTITUCIÓN DE CONSTANTES',
      content: constSubs.join('<br>') +
        `<br>Expresión: <span class="highlight">${escHtml(exprProcessed)}</span>`,
      type: '',
      value: null,
    });
  }

  /* PASO 4 · Sub-evaluaciones */
  try {
    const children = getSubExpressions(node, expr);
    children.forEach((sub, i) => {
      try {
        const subVal = math.evaluate(sub);
        if (typeof subVal === 'number' && sub !== expr) {
          steps.push({
            label: `PASO ${steps.length + 1} · SUB-EXPRESIÓN`,
            content: `<span class="highlight">${escHtml(sub)}</span>
                      <span class="op-symbol"> = </span>
                      <span class="math-val">${escHtml(formatResult(subVal))}</span>`,
            type: '',
            value: null,
          });
        }
      } catch (e) { /* ignorar sub-expresiones inválidas */ }
    });
  } catch (e) { /* continuar */ }

  /* PASO N · Evaluación final */
  const result = math.evaluate(expr);
  const formatted = formatResult(result);

  steps.push({
    label: `PASO ${steps.length + 1} · EVALUACIÓN FINAL`,
    content: `<span class="highlight">${escHtml(expr)}</span>
              <span class="op-symbol"> = </span>
              <span class="math-val">${escHtml(formatted)}</span>`,
    type: 'step-result',
    value: formatted,
  });

  /* PASO EXTRA · Propiedades del resultado numérico */
  if (typeof result === 'number' && isFinite(result)) {
    const props = [];
    props.push(Number.isInteger(result)
      ? 'Tipo: <span class="highlight">número entero</span>'
      : 'Tipo: <span class="highlight">número decimal (ℝ)</span>');
    props.push(result > 0
      ? 'Signo: <span class="math-val">positivo (+)</span>'
      : result < 0
        ? 'Signo: <span class="math-val">negativo (−)</span>'
        : 'Signo: <span class="highlight">cero</span>');

    if (Number.isInteger(result) && Math.abs(result) > 1 && Math.abs(result) < 1e7) {
      const primes = getPrimeFactors(Math.abs(result));
      if (primes.length > 1) {
        props.push(`Factores primos: <span class="math-val">${primes.join(' × ')}</span>`);
      }
    }

    if (!Number.isInteger(result)) {
      props.push(`Fracción ≈ <span class="math-val">${approximateFraction(result)}</span>`);
    }

    steps.push({
      label: `PASO ${steps.length + 1} · PROPIEDADES DEL RESULTADO`,
      content: props.join('<br>'),
      type: '',
      value: formatted,
    });
  }

  return steps;
}

/* Obtiene sub-expresiones relevantes de un nodo math.js */
function getSubExpressions(node, original) {
  const subs = [];
  try {
    node.forEach(child => {
      const s = child.toString();
      if (s.length > 1 && s !== original) subs.push(s);
    });
  } catch (e) { /* nodo sin hijos */ }
  return subs;
}

/* Factorización prima simple */
function getPrimeFactors(n) {
  const factors = [];
  let d = 2;
  while (n > 1) {
    while (n % d === 0) { factors.push(d); n = Math.round(n / d); }
    d++;
    if (d * d > n) { if (n > 1) factors.push(n); break; }
  }
  return factors;
}

/* Aproximación de fracción racional (algoritmo de fracciones continuas) */
function approximateFraction(x, tol = 1e-6, maxDen = 1000) {
  let h1=1, h2=0, k1=0, k2=1, b=x;
  do {
    const a = Math.floor(b);
    let aux = h1; h1 = a*h1+h2; h2 = aux;
    aux = k1; k1 = a*k1+k2; k2 = aux;
    b = 1/(b-a);
  } while (Math.abs(x - h1/k1) > x * tol && k1 <= maxDen);
  return `${h1}/${k1}`;
}

/* Escapa HTML para evitar XSS en step cards */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Formatea resultado numérico */
function formatResult(val) {
  if (typeof val === 'number') {
    if (!isFinite(val)) return val > 0 ? '∞' : '-∞';
    if (Number.isInteger(val)) return val.toString();
    return parseFloat(val.toFixed(10)).toString();
  }
  if (val && typeof val.toString === 'function') return val.toString();
  return String(val);
}

/* ─────────────────────────────────────────────────────────────────
   14. GESTIÓN DE STEP CARDS
   ───────────────────────────────────────────────────────────────── */
function addStepCard(label, content, type = '') {
  DOM.stepsEmpty.style.display = 'none';
  const card = document.createElement('div');
  card.className = `step-card ${type}`;
  card.innerHTML = `
    <div class="step-number">${escHtml(label)}</div>
    <div class="step-content">${content}</div>
  `;
  DOM.stepsContainer.appendChild(card);
  return card;
}

/* Anima pasos secuencialmente con GSAP timeline */
function animateStepsSequentially(steps) {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  steps.forEach((step, i) => {
    const card = addStepCard(step.label, step.content, step.type || '');

    /* Animación de cada card */
    tl.fromTo(card,
      { opacity: 0, x: -30, scale: 0.96, filter: 'blur(4px)' },
      {
        opacity: 1,
        x: 0,
        scale: 1,
        filter: 'blur(0px)',
        duration: 0.4,
      },
      i * 0.18   /* delay escalonado */
    );

    /* Scroll automático al card actual */
    tl.call(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [], i * 0.18 + 0.1);
  });

  /* Pulso final en la última card */
  tl.call(() => {
    const last = DOM.stepsContainer.lastElementChild;
    if (last && last !== DOM.stepsEmpty) {
      gsap.timeline()
        .to(last, {
          boxShadow: '0 0 24px rgba(0,255,136,0.35), inset 0 0 30px rgba(0,255,136,0.06)',
          borderColor: 'rgba(0,255,136,0.5)',
          duration: 0.4,
        })
        .to(last, {
          boxShadow: 'none',
          borderColor: 'var(--border-dim)',
          duration: 0.6,
          ease: 'power2.inOut',
        });
    }
  });
}

/* Limpia todas las tarjetas del panel */
function clearSteps() {
  const cards = Array.from(DOM.stepsContainer.children).filter(c => c !== DOM.stepsEmpty);

  if (cards.length === 0) return;

  gsap.to(cards, {
    opacity: 0,
    x: 15,
    scale: 0.95,
    duration: 0.2,
    stagger: 0.03,
    ease: 'power2.in',
    onComplete: () => {
      cards.forEach(c => c.remove());
      DOM.stepsEmpty.style.display = '';
      gsap.fromTo(DOM.stepsEmpty,
        { opacity: 0 },
        { opacity: 0.3, duration: 0.4 }
      );
    }
  });

  DOM.stepsCount.textContent = '0 PASOS';
}

/* Repite la animación de pasos */
function replaySteps() {
  if (STATE.allSteps.length === 0) return;

  const cards = Array.from(DOM.stepsContainer.children).filter(c => c !== DOM.stepsEmpty);
  gsap.to(cards, {
    opacity: 0, scale: 0.9, duration: 0.25, stagger: 0.02,
    onComplete: () => {
      cards.forEach(c => c.remove());
      DOM.stepsEmpty.style.display = 'none';
      animateStepsSequentially(STATE.allSteps);
      DOM.stepsCount.textContent = STATE.allSteps.length + ' PASOS';
    }
  });
}

/* ─────────────────────────────────────────────────────────────────
   15. FUNCIONES ALGEBRAICAS ESPECIALES
   ───────────────────────────────────────────────────────────────── */

/* Derivada simbólica */
function runDerivative() {
  const expr = getExpression();
  if (!expr) { showToast('Ingresa una expresión en x', 'info'); return; }

  clearSteps();
  STATE.allSteps = [];
  DOM.stepsEmpty.style.display = 'none';

  const steps = [];
  steps.push({
    label: 'DERIVADA — PASO 1 · EXPRESIÓN',
    content: `Diferenciando respecto a x:<br>
              <span class="op-symbol">d/dx</span> <span class="highlight">[${escHtml(expr)}]</span>`,
    type: '', value: null,
  });

  try {
    const derived = math.derivative(expr, 'x');
    steps.push({
      label: 'DERIVADA — PASO 2 · REGLAS',
      content: `Aplicando reglas de diferenciación...<br>
                (Regla de la cadena, potencia, trig, etc.)`,
      type: '', value: null,
    });

    const simplified = math.simplify(derived);
    steps.push({
      label: 'DERIVADA — RESULTADO',
      content: `<span class="highlight">f\'(x)</span>
                <span class="op-symbol"> = </span>
                <span class="math-val">${escHtml(simplified.toString())}</span>`,
      type: 'step-result',
      value: simplified.toString(),
    });

    setExpression(simplified.toString());
    updatePreview();
    showToast("Derivada calculada correctamente", 'success');
  } catch (e) {
    steps.push({ label: 'ERROR', content: '⚠ ' + escHtml(e.message), type: 'step-error', value: null });
    showToast('Error en derivada: ' + e.message, 'error');
  }

  STATE.allSteps = steps;
  DOM.stepsCount.textContent = steps.length + ' PASOS';
  animateStepsSequentially(steps);
}

/* Simplificación algebraica */
function runSimplify() {
  const expr = getExpression();
  if (!expr) { showToast('Ingresa una expresión', 'info'); return; }

  clearSteps();
  STATE.allSteps = [];
  DOM.stepsEmpty.style.display = 'none';

  const steps = [];
  steps.push({
    label: 'SIMPLIFICACIÓN — PASO 1',
    content: `Expresión original: <span class="math-val">${escHtml(expr)}</span>`,
    type: '', value: null,
  });

  try {
    const simplified = math.simplify(expr);
    steps.push({
      label: 'SIMPLIFICACIÓN — RESULTADO',
      content: `<span class="highlight">${escHtml(expr)}</span>
                <span class="op-symbol"> → </span>
                <span class="math-val">${escHtml(simplified.toString())}</span>`,
      type: 'step-result',
      value: simplified.toString(),
    });
    setExpression(simplified.toString());
    updatePreview();
    showToast('Expresión simplificada', 'success');
  } catch (e) {
    steps.push({ label: 'ERROR', content: '⚠ ' + escHtml(e.message), type: 'step-error', value: null });
  }

  STATE.allSteps = steps;
  DOM.stepsCount.textContent = steps.length + ' PASOS';
  animateStepsSequentially(steps);
}

/* Resolución numérica de ecuaciones */
function runSolve() {
  const expr = getExpression();
  if (!expr) { showToast('Formato: ecuación en x (ej: x^2 - 4 = 0)', 'info'); return; }

  clearSteps();
  STATE.allSteps = [];
  DOM.stepsEmpty.style.display = 'none';

  const steps = [];
  steps.push({
    label: 'RESOLUCIÓN — PASO 1 · ECUACIÓN',
    content: `Analizando: <span class="math-val">${escHtml(expr)}</span>`,
    type: '', value: null,
  });

  try {
    let cleanExpr = expr;
    if (expr.includes('=')) {
      const [lhs, rhs] = expr.split('=');
      cleanExpr = `(${lhs.trim()}) - (${rhs.trim()})`;
    }

    steps.push({
      label: 'RESOLUCIÓN — PASO 2 · FORMA ESTÁNDAR',
      content: `Reordenando a f(x) = 0:<br>
                <span class="highlight">${escHtml(cleanExpr)}</span> = 0`,
      type: '', value: null,
    });

    steps.push({
      label: 'RESOLUCIÓN — PASO 3 · BISECCIÓN',
      content: `Buscando raíces en [-100, 100]<br>
                Método: <span class="highlight">Bisección iterativa</span> (50 iter/raíz)`,
      type: '', value: null,
    });

    const roots = findRoots(cleanExpr, -100, 100);

    if (roots.length > 0) {
      steps.push({
        label: 'RESOLUCIÓN — RESULTADO',
        content: roots.map((r, i) =>
          `<span class="highlight">x${i > 0 ? (i + 1) : ''}</span>
           <span class="op-symbol"> = </span>
           <span class="math-val">${r.toFixed(8)}</span>`
        ).join('<br>'),
        type: 'step-result',
        value: roots.map(r => r.toFixed(6)).join(', '),
      });
      showToast(`${roots.length} raíz(ces) encontrada(s)`, 'success');
    } else {
      steps.push({
        label: 'RESOLUCIÓN — SIN RAÍCES REALES',
        content: 'No se encontraron raíces reales en [-100, 100].<br>' +
                 '<span class="highlight">La ecuación puede tener raíces complejas.</span>',
        type: 'step-warning', value: 'sin raíces',
      });
      showToast('Sin raíces reales en el rango', 'info');
    }
  } catch (e) {
    steps.push({ label: 'ERROR', content: '⚠ ' + escHtml(e.message), type: 'step-error', value: null });
    showToast('Error: ' + e.message, 'error');
  }

  STATE.allSteps = steps;
  DOM.stepsCount.textContent = steps.length + ' PASOS';
  animateStepsSequentially(steps);
}

/* Búsqueda de raíces por bisección */
function findRoots(expr, from, to, step = 0.5) {
  const roots = [];
  let prev = null;

  for (let x = from; x <= to; x += step) {
    try {
      const val = math.evaluate(expr, { x });
      if (!isFinite(val)) { prev = null; continue; }

      if (prev !== null && Math.sign(val) !== Math.sign(prev.val)) {
        let lo = prev.x, hi = x;
        for (let iter = 0; iter < 60; iter++) {
          const mid = (lo + hi) / 2;
          const fmid = math.evaluate(expr, { x: mid });
          if (Math.abs(fmid) < 1e-10) { roots.push(mid); break; }
          if (Math.sign(fmid) === Math.sign(math.evaluate(expr, { x: lo }))) lo = mid;
          else hi = mid;
          if (iter === 59) roots.push((lo + hi) / 2);
        }
      }
      prev = { x, val };
    } catch (e) { prev = null; }
  }

  /* Deduplicar raíces cercanas */
  return roots.filter((r, i) => roots.findIndex(o => Math.abs(o - r) < 1e-5) === i).slice(0, 8);
}

/* Integral numérica (método de Simpson) */
function runIntegral() {
  const expr = getExpression();
  if (!expr) { showToast('Ingresa una función de x', 'info'); return; }

  clearSteps();
  STATE.allSteps = [];
  DOM.stepsEmpty.style.display = 'none';

  const steps = [];
  const a = 0, b = 1, n = 1000;
  const h = (b - a) / n;

  steps.push({
    label: 'INTEGRAL — PASO 1 · PLANTEAMIENTO',
    content: `Calculando integral numérica:<br>
              <span class="op-symbol">∫₀¹</span> <span class="highlight">${escHtml(expr)}</span> dx<br>
              Límites: a=<span class="math-val">0</span>, b=<span class="math-val">1</span>`,
    type: '', value: null,
  });

  try {
    let sum = math.evaluate(expr, { x: a }) + math.evaluate(expr, { x: b });
    for (let i = 1; i < n; i++) {
      sum += (i % 2 === 0 ? 2 : 4) * math.evaluate(expr, { x: a + i * h });
    }
    const result = (h / 3) * sum;

    steps.push({
      label: 'INTEGRAL — PASO 2 · MÉTODO',
      content: `Regla de Simpson 1/3<br>
                n = <span class="highlight">${n}</span> subintervalos<br>
                h = (b−a)/n = <span class="math-val">${h.toFixed(8)}</span>`,
      type: '', value: null,
    });

    steps.push({
      label: 'INTEGRAL — PASO 3 · FÓRMULA',
      content: `I ≈ (h/3)[f(a) + 4f(x₁) + 2f(x₂) + … + f(b)]<br>
                Error estimado: O(h⁴)`,
      type: '', value: null,
    });

    steps.push({
      label: 'INTEGRAL — RESULTADO',
      content: `<span class="op-symbol">∫₀¹</span> <span class="highlight">${escHtml(expr)}</span> dx
                <span class="op-symbol"> ≈ </span>
                <span class="math-val">${result.toFixed(10)}</span>`,
      type: 'step-result',
      value: result.toFixed(10),
    });

    DOM.result.textContent = '∫ = ' + result.toFixed(10);
    showToast('Integral numérica calculada', 'success');
  } catch (e) {
    steps.push({ label: 'ERROR', content: '⚠ ' + escHtml(e.message), type: 'step-error', value: null });
  }

  STATE.allSteps = steps;
  DOM.stepsCount.textContent = steps.length + ' PASOS';
  animateStepsSequentially(steps);
}

/* ─────────────────────────────────────────────────────────────────
   16. ESTADÍSTICAS ESPECIALES
   ───────────────────────────────────────────────────────────────── */
function runRegression() {
  showToast('Ingresa pares: [[x1,y1],[x2,y2],...]', 'info');
  setExpression('[[1,2],[2,4],[3,5],[4,4],[5,5]]');
  updatePreview();
}

function runHistogram() {
  const expr = getExpression();
  if (!expr) { showToast('Ingresa un array de datos', 'info'); return; }

  try {
    const data = math.evaluate(expr);
    if (!Array.isArray(data)) { showToast('Se esperaba un array []', 'error'); return; }
    const flat = data.flat().map(Number).filter(isFinite);

    showGraphLoading(true);

    setTimeout(() => {
      DOM.graphPlaceholder.style.display = 'none';
      Plotly.newPlot('graph-container', [{
        x: flat,
        type: 'histogram',
        marker: {
          color: flat.map((_, i) => `hsl(${190 + i * 12}, 80%, 60%)`),
          line: { color: '#00d4ff', width: 1 },
        },
        name: 'Distribución',
        opacity: 0.85,
      }], {
        ...getPlotlyLayout('Histograma de Frecuencias'),
        bargap: 0.05,
      }, { responsive: true });

      showGraphLoading(false);
    }, 100);

    /* Estadísticas en el panel de pasos */
    clearSteps();
    DOM.stepsEmpty.style.display = 'none';
    const stats = [
      { label: 'ESTADÍSTICA · MEDIA',          content: `μ <span class="op-symbol">=</span> <span class="math-val">${math.mean(flat).toFixed(6)}</span>`,     type: '' },
      { label: 'ESTADÍSTICA · MEDIANA',        content: `Mediana <span class="op-symbol">=</span> <span class="math-val">${math.median(flat).toFixed(6)}</span>`, type: '' },
      { label: 'ESTADÍSTICA · DESV. ESTÁNDAR', content: `σ <span class="op-symbol">=</span> <span class="math-val">${math.std(flat).toFixed(6)}</span>`,       type: '' },
      { label: 'ESTADÍSTICA · VARIANZA',       content: `σ² <span class="op-symbol">=</span> <span class="math-val">${math.variance(flat).toFixed(6)}</span>`, type: '' },
      { label: 'ESTADÍSTICA · RANGO',          content: `Min: <span class="highlight">${math.min(flat)}</span>  Max: <span class="highlight">${math.max(flat)}</span>  N: <span class="math-val">${flat.length}</span>`, type: 'step-result', value: '' },
    ];
    STATE.allSteps = stats;
    animateStepsSequentially(stats);
    DOM.stepsCount.textContent = stats.length + ' PASOS';
    showToast('Histograma generado', 'success');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

/* ─────────────────────────────────────────────────────────────────
   17. GRÁFICAS PLOTLY
   ───────────────────────────────────────────────────────────────── */
function getPlotlyLayout(title) {
  return {
    title: {
      text: title,
      font: { color: '#c8e6f5', family: 'Space Mono', size: 12 },
      pad: { t: 8 },
    },
    paper_bgcolor: '#050a0f',
    plot_bgcolor:  '#090e15',
    font: { color: '#5a8aaa', family: 'Space Mono', size: 10 },
    xaxis: {
      gridcolor: '#1a2d45', zerolinecolor: '#1e4070',
      tickfont: { color: '#5a8aaa' }, linecolor: '#1a2d45',
    },
    yaxis: {
      gridcolor: '#1a2d45', zerolinecolor: '#1e4070',
      tickfont: { color: '#5a8aaa' }, linecolor: '#1a2d45',
    },
    margin: { t: 46, r: 16, b: 40, l: 48 },
    legend: { font: { color: '#5a8aaa' } },
    modebar: { bgcolor: 'transparent', color: '#5a8aaa', activecolor: '#00d4ff' },
  };
}

function showGraphLoading(visible) {
  DOM.graphLoading.classList.toggle('visible', visible);
}

function plot2D() {
  const raw = DOM.graphExpr.value.trim();
  if (!raw) { showToast('Ingresa una función f(x)', 'info'); return; }

  const expr = raw.replace(/^f\s*\(x\)\s*=\s*/i, '').trim();

  showGraphLoading(true);

  requestAnimationFrame(() => {
    const N = 600;
    const xVals = [], yVals = [];
    for (let i = 0; i <= N; i++) {
      const x = -10 + (20 * i / N);
      try {
        const y = math.evaluate(expr, { x });
        xVals.push(x);
        yVals.push(isFinite(y) ? y : null);
      } catch (e) { xVals.push(x); yVals.push(null); }
    }

    DOM.graphPlaceholder.style.display = 'none';

    Plotly.newPlot('graph-container', [{
      x: xVals, y: yVals,
      mode: 'lines',
      name: `f(x) = ${expr}`,
      line: { color: '#00d4ff', width: 2.5, shape: 'spline' },
      fill: 'tozeroy',
      fillcolor: 'rgba(0,212,255,0.04)',
    }], {
      ...getPlotlyLayout(`f(x) = ${expr}`),
      shapes: [
        { type: 'line', x0: -10, x1: 10, y0: 0, y1: 0, line: { color: '#1e4070', width: 1, dash: 'dot' } },
        { type: 'line', x0: 0, x1: 0, y0: -1e6, y1: 1e6, line: { color: '#1e4070', width: 1, dash: 'dot' } },
      ],
    }, { responsive: true, displaylogo: false });

    showGraphLoading(false);

    /* Animar la aparición de la gráfica */
    gsap.fromTo('#graph-container .plotly',
      { opacity: 0 },
      { opacity: 1, duration: 0.5, ease: 'power2.out' }
    );

    showToast('Gráfica 2D generada', 'success');
  });
}

function plot3D() {
  const raw = DOM.graphExpr.value.trim();
  if (!raw) { showToast('Ingresa una función f(x,y)', 'info'); return; }
  const expr = raw.replace(/^f\s*\(x,?\s*y\)\s*=\s*/i, '').trim();

  showGraphLoading(true);

  setTimeout(() => {
    const N = 45;
    const xVals = Array.from({ length: N + 1 }, (_, i) => -5 + 10 * i / N);
    const yVals = Array.from({ length: N + 1 }, (_, j) => -5 + 10 * j / N);
    const zVals = yVals.map(y =>
      xVals.map(x => {
        try {
          const z = math.evaluate(expr, { x, y });
          return isFinite(z) ? z : null;
        } catch (e) { return null; }
      })
    );

    DOM.graphPlaceholder.style.display = 'none';

    Plotly.newPlot('graph-container', [{
      type: 'surface',
      x: xVals, y: yVals, z: zVals,
      colorscale: [
        [0,    '#020610'],
        [0.15, '#001a40'],
        [0.35, '#003366'],
        [0.55, '#00d4ff'],
        [0.75, '#00ff88'],
        [1,    '#ffd700'],
      ],
      contours: {
        z: { show: true, color: '#1e4070', width: 1, usecolormap: false },
      },
      name: expr,
      opacity: 0.93,
      lighting: { ambient: 0.7, diffuse: 0.8, specular: 0.3, roughness: 0.5 },
    }], {
      ...getPlotlyLayout(`f(x,y) = ${expr}`),
      scene: {
        bgcolor: '#050a0f',
        xaxis: { gridcolor: '#1a2d45', color: '#5a8aaa', backgroundcolor: '#050a0f', showbackground: true },
        yaxis: { gridcolor: '#1a2d45', color: '#5a8aaa', backgroundcolor: '#050a0f', showbackground: true },
        zaxis: { gridcolor: '#1a2d45', color: '#5a8aaa', backgroundcolor: '#050a0f', showbackground: true },
        camera: { eye: { x: 1.4, y: 1.4, z: 1 } },
      },
    }, { responsive: true, displaylogo: false });

    showGraphLoading(false);
    showToast('Superficie 3D generada', 'success');
  }, 50);
}

function clearGraph() {
  gsap.to('#graph-container', {
    opacity: 0,
    duration: 0.25,
    onComplete: () => {
      Plotly.purge('graph-container');
      DOM.graphPlaceholder.style.display = '';
      gsap.to('#graph-container', { opacity: 1, duration: 0.3 });
    }
  });
}

/* ─────────────────────────────────────────────────────────────────
   18. OCR — TESSERACT.JS
   ───────────────────────────────────────────────────────────────── */
function initDragDrop() {
  const zone = DOM.ocrDropZone;

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('dragging');
    gsap.to(zone, { scale: 1.02, duration: 0.2 });
  });

  zone.addEventListener('dragleave', e => {
    if (!zone.contains(e.relatedTarget)) {
      zone.classList.remove('dragging');
      gsap.to(zone, { scale: 1, duration: 0.2 });
    }
  });

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragging');
    gsap.to(zone, { scale: 1, duration: 0.2 });
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) processOCR(file);
    else showToast('Archivo no válido — usa PNG, JPG o BMP', 'error');
  });
}

function handleOCRFile(event) {
  const file = event.target.files[0];
  if (file) processOCR(file);
  event.target.value = '';
}

async function processOCR(file) {
  const zone = DOM.ocrDropZone;

  /* Feedback visual al iniciar OCR */
  zone.classList.add('processing');
  DOM.ocrProgress.classList.add('visible');
  DOM.ocrProgress.style.display = 'block';
  DOM.ocrBar.style.width = '0%';
  DOM.ocrStatus.textContent = 'Cargando motor OCR...';

  gsap.timeline()
    .to(zone, { borderColor: 'var(--accent-orange)', duration: 0.2 })
    .to('.ocr-icon', { rotation: 15, scale: 1.2, duration: 0.3, ease: 'power2.out' })
    .to('.ocr-icon', { rotation: 0, scale: 1, duration: 0.3, ease: 'bounce.out' });

  /* Animación de carga indeterminada */
  const loadingAnim = gsap.to(DOM.ocrBar, {
    width: '60%',
    duration: 3,
    ease: 'power1.inOut',
  });

  try {
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          loadingAnim.kill();
          const pct = Math.round(m.progress * 100);
          gsap.to(DOM.ocrBar, { width: `${pct}%`, duration: 0.3 });
          DOM.ocrStatus.textContent = `Reconociendo... ${pct}%`;
        } else if (m.status) {
          DOM.ocrStatus.textContent = m.status;
        }
      },
    });

    await worker.setParameters({
      tessedit_char_whitelist: '0123456789+-*/()^.=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ πΩ√∑∫',
    });

    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();

    /* Animación de éxito */
    loadingAnim.kill();
    gsap.to(DOM.ocrBar, { width: '100%', duration: 0.4 });
    gsap.to(DOM.ocrBar, {
      background: 'linear-gradient(90deg, var(--accent-green), #00ffaa)',
      duration: 0.3,
    });
    DOM.ocrStatus.textContent = '✓ Reconocimiento completado';

    const cleaned = cleanOCRText(text);
    if (cleaned) {
      /* Animar inserción en el display */
      gsap.timeline()
        .to(DOM.display, { opacity: 0, y: -8, duration: 0.2 })
        .call(() => {
          setExpression(cleaned);
          updatePreview();
        })
        .to(DOM.display, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' });

      showToast('Ecuación detectada: ' + cleaned, 'success');
      setTimeout(() => calculate(), 900);
    } else {
      showToast('No se detectó una expresión válida en la imagen', 'error');
    }

  } catch (e) {
    loadingAnim.kill();
    gsap.to(DOM.ocrBar, {
      background: 'var(--accent-red)',
      width: '100%',
      duration: 0.3,
    });
    DOM.ocrStatus.textContent = '✗ Error: ' + e.message;
    showToast('Error OCR: ' + e.message, 'error');
  } finally {
    zone.classList.remove('processing');
    gsap.to(zone, { borderColor: 'var(--border-bright)', duration: 0.4 });

    setTimeout(() => {
      gsap.to(DOM.ocrProgress, {
        opacity: 0,
        duration: 0.4,
        onComplete: () => {
          DOM.ocrProgress.style.display = 'none';
          DOM.ocrProgress.classList.remove('visible');
          gsap.set(DOM.ocrProgress, { opacity: 1 });
          gsap.set(DOM.ocrBar, {
            background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-green))',
            width: '0%',
          });
        },
      });
    }, 2500);
  }
}

/* Limpia y valida el texto reconocido por OCR */
function cleanOCRText(text) {
  let clean = text
    .replace(/\n/g, ' ')
    .replace(/\s+/g, '')
    .replace(/[×xX✕]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\|/g, '')
    .trim();

  try { math.parse(clean); return clean; }
  catch (e) {
    clean = clean.replace(/[^0-9+\-*/()^.=xyπsincostalogexpabssqrt]/g, '');
    try { math.parse(clean); return clean.length > 0 ? clean : null; }
    catch (e2) { return null; }
  }
}

/* ─────────────────────────────────────────────────────────────────
   19. TOASTS
   ───────────────────────────────────────────────────────────────── */
const TOAST_ICONS = { success: '✓', error: '✗', info: 'ℹ' };
const TOAST_COLORS = {
  success: 'var(--accent-green)',
  error:   'var(--accent-red)',
  info:    'var(--accent-cyan)',
};

function showToast(msg, type = 'info') {
  const container = DOM.toastContainer;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon" style="color:${TOAST_COLORS[type]}">${TOAST_ICONS[type]}</span>
    <span>${escHtml(msg)}</span>
  `;
  container.appendChild(toast);

  /* Entrada */
  gsap.fromTo(toast,
    { opacity: 0, x: 30, scale: 0.9 },
    { opacity: 1, x: 0, scale: 1, duration: 0.35, ease: 'power3.out' }
  );

  /* Salida */
  setTimeout(() => {
    gsap.to(toast, {
      opacity: 0,
      x: 30,
      scale: 0.9,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => toast.remove(),
    });
  }, 3800);
}
