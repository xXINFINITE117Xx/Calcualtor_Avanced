/* ═══════════════════════════════════════════════════════════════════
   script.js  —  QuantumCalc · Calculadora Científica Avanzada
   Lógica principal: Math.js · Plotly · Tesseract · GSAP
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────────
   1. ESTADO GLOBAL
   ───────────────────────────────────────────────────────────────── */
const STATE = {
  expression: "",
  allSteps: [],
  currentMode: "basic",
  isTyping: false,
  typingTimer: null,
  isCalculating: false,
};

/* ─────────────────────────────────────────────────────────────────
   2. REFERENCIAS AL DOM
   ───────────────────────────────────────────────────────────────── */
const DOM = {
  get display() {
    return document.getElementById("input-display");
  },
  get result() {
    return document.getElementById("result-display");
  },
  get stepsContainer() {
    return document.getElementById("steps-container");
  },
  get stepsEmpty() {
    return document.getElementById("steps-empty");
  },
  get stepsCount() {
    return document.getElementById("steps-count");
  },
  get displayMain() {
    return document.getElementById("display-main");
  },
  get typingIndicator() {
    return document.getElementById("typing-indicator");
  },
  get graphExpr() {
    return document.getElementById("graph-expr");
  },
  get graphContainer() {
    return document.getElementById("graph-container");
  },
  get graphPlaceholder() {
    return document.getElementById("graph-placeholder");
  },
  get graphLoading() {
    return document.getElementById("graph-loading");
  },
  get ocrProgress() {
    return document.getElementById("ocr-progress");
  },
  get ocrBar() {
    return document.getElementById("ocr-bar");
  },
  get ocrStatus() {
    return document.getElementById("ocr-status");
  },
  get ocrGlow() {
    return document.getElementById("ocr-glow");
  },
  get ocrDropZone() {
    return document.getElementById("ocr-drop-zone");
  },
  get toastContainer() {
    return document.getElementById("toast-container");
  },
  get clockDisplay() {
    return document.getElementById("clock-display");
  },
  get headerStatus() {
    return document.getElementById("header-status");
  },
  get mobileMenuBtn() {
    return document.getElementById("mobile-menu-btn");
  },
};

/* ─────────────────────────────────────────────────────────────────
   3. INICIALIZACIÓN — DOMContentLoaded
   ───────────────────────────────────────────────────────────────── */
window.addEventListener("DOMContentLoaded", () => {
  initAnimations();
  initClock();
  initKeyboardListeners();
  initDragDrop();
  initMobileMenu();
  initScrollHeader();

  DOM.display.textContent = "";
  updatePreview();

  showToast("Sistema listo · Math.js + Plotly + Tesseract activos", "success");
});

/* ─────────────────────────────────────────────────────────────────
   4. ANIMACIONES DE ENTRADA (GSAP)
   ───────────────────────────────────────────────────────────────── */
function initAnimations() {
  /* Línea de escaneo del header */
  gsap.fromTo(
    ".header",
    { opacity: 0, y: -30 },
    { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" },
  );

  /* Calc panel: entra desde la izquierda */
  gsap.fromTo(
    "#calc-panel",
    { opacity: 0, x: -40, filter: "blur(6px)" },
    {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      duration: 0.75,
      delay: 0.15,
      ease: "power3.out",
    },
  );

  /* Graph panel: entra desde abajo con fade */
  gsap.fromTo(
    "#graph-panel",
    { opacity: 0, y: 30, filter: "blur(4px)" },
    {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      duration: 0.65,
      delay: 0.3,
      ease: "power3.out",
    },
  );

  /* Steps panel: entra desde la derecha */
  gsap.fromTo(
    "#steps-panel",
    { opacity: 0, x: 40, filter: "blur(6px)" },
    {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      duration: 0.75,
      delay: 0.4,
      ease: "power3.out",
    },
  );

  /* Teclas: stagger suave de entrada */
  gsap.fromTo(
    ".key",
    { opacity: 0, scale: 0.85, y: 5 },
    {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 0.25,
      stagger: { each: 0.012, from: "start" },
      delay: 0.5,
      ease: "power2.out",
    },
  );

  /* Zona OCR: fade in */
  gsap.fromTo(
    ".ocr-section",
    { opacity: 0 },
    { opacity: 1, duration: 0.5, delay: 0.9, ease: "power2.out" },
  );

  /* Estado vacío del panel de pasos */
  gsap.fromTo(
    ".empty-state",
    { opacity: 0, scale: 0.9 },
    {
      opacity: 0.3,
      scale: 1,
      duration: 0.6,
      delay: 0.8,
      ease: "elastic.out(1, 0.5)",
    },
  );
}

/* ─────────────────────────────────────────────────────────────────
   5. RELOJ EN TIEMPO REAL
   ───────────────────────────────────────────────────────────────── */
function initClock() {
  function tick() {
    const now = new Date();
    DOM.clockDisplay.textContent = now.toLocaleTimeString("es-CO", {
      hour12: false,
    });
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

  btn.addEventListener("click", () => {
    const isOpen = btn.classList.toggle("open");
    btn.setAttribute("aria-expanded", isOpen);
    DOM.headerStatus.classList.toggle("mobile-open", isOpen);

    if (isOpen) {
      gsap.fromTo(
        DOM.headerStatus,
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" },
      );
    }
  });

  // Cerrar al hacer click fuera
  document.addEventListener("click", (e) => {
    if (!btn.contains(e.target) && !DOM.headerStatus.contains(e.target)) {
      btn.classList.remove("open");
      btn.setAttribute("aria-expanded", false);
      DOM.headerStatus.classList.remove("mobile-open");
    }
  });
}

/* ─────────────────────────────────────────────────────────────────
   7. SCROLL → SOMBRA EN HEADER
   ───────────────────────────────────────────────────────────────── */
function initScrollHeader() {
  const header = document.querySelector(".header");
  window.addEventListener(
    "scroll",
    () => {
      header.classList.toggle("scrolled", window.scrollY > 5);
    },
    { passive: true },
  );
}

/* ─────────────────────────────────────────────────────────────────
   8. TECLADO FÍSICO
   ───────────────────────────────────────────────────────────────── */
function initKeyboardListeners() {
  document.addEventListener("keydown", (e) => {
    if (e.target === DOM.display) return; // Deja actuar el campo editable
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      calculate();
    }
    if (e.key === "Escape") clearAll();
    if (e.key === "Backspace" && e.ctrlKey) clearAll();
  });
}

/* ─────────────────────────────────────────────────────────────────
   9. DISPLAY — LECTURA Y ESCRITURA
   ───────────────────────────────────────────────────────────────── */
function getExpression() {
  let txt = DOM.display.textContent.trim();
  txt = txt.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
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
  gsap.fromTo(
    DOM.display,
    { x: -4 },
    { x: 0, duration: 0.2, ease: "elastic.out(2, 0.5)" },
  );
}

function clearAll() {
  if (!getExpression() && !DOM.result.textContent) return;

  // Animación de limpieza: flash + fade
  gsap
    .timeline()
    .to(DOM.displayMain, {
      boxShadow:
        "0 0 0 3px rgba(255,68,102,0.35), inset 0 0 30px rgba(255,68,102,0.08)",
      borderColor: "#ff4466",
      duration: 0.15,
    })
    .to(DOM.display, { opacity: 0, y: -5, duration: 0.18, ease: "power2.in" })
    .call(() => {
      setExpression("");
      DOM.result.textContent = "";
    })
    .to(DOM.display, { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" })
    .to(
      DOM.displayMain,
      {
        boxShadow: "none",
        borderColor: "var(--border-bright)",
        duration: 0.25,
      },
      "<",
    );
}

/* Vista previa en tiempo real mientras se escribe */
function updatePreview() {
  try {
    const expr = getExpression();
    if (expr && expr.length > 1) {
      const preview = math.evaluate(expr);
      if (typeof preview === "number" || typeof preview === "string") {
        DOM.result.textContent = "≈ " + formatResult(preview);
        gsap.fromTo(
          DOM.result,
          { opacity: 0, y: 3 },
          { opacity: 0.85, y: 0, duration: 0.2, ease: "power2.out" },
        );
      } else {
        DOM.result.textContent = "";
      }
    } else {
      DOM.result.textContent = "";
    }
  } catch (e) {
    DOM.result.textContent = "";
  }
}

/* Escuchar cambios directos en el display editable */
DOM.display.addEventListener &&
  document.addEventListener("DOMContentLoaded", () => {
    DOM.display.addEventListener("input", () => {
      updatePreview();
      triggerTypingIndicator();
    });
  });

/* Indicador visual de escritura */
function triggerTypingIndicator() {
  if (!DOM.typingIndicator) return;
  DOM.typingIndicator.classList.add("visible");
  clearTimeout(STATE.typingTimer);
  STATE.typingTimer = setTimeout(() => {
    DOM.typingIndicator.classList.remove("visible");
  }, 1200);
}

/* ─────────────────────────────────────────────────────────────────
   10. MICRO-ANIMACIÓN DE TECLA PULSADA
   ───────────────────────────────────────────────────────────────── */
function animateKeyPress() {
  gsap
    .timeline()
    .to(DOM.display, {
      textShadow: "0 0 28px rgba(0,212,255,0.95)",
      duration: 0.06,
    })
    .to(DOM.display, {
      textShadow: "0 0 10px rgba(0,212,255,0.4)",
      duration: 0.35,
      ease: "power2.out",
    });
}

/* Ripple en botón al hacer click */
function addKeyRipple(btn) {
  gsap.fromTo(
    btn,
    { scale: 0.9 },
    { scale: 1, duration: 0.25, ease: "elastic.out(2, 0.4)" },
  );
}

/* ─────────────────────────────────────────────────────────────────
   11. CAMBIO DE MODO (con animación GSAP)
   ───────────────────────────────────────────────────────────────── */
function switchMode(mode) {
  if (mode === STATE.currentMode) return;
  STATE.currentMode = mode;

  /* Actualizar tabs */
  document.querySelectorAll(".mode-tab").forEach((t) => {
    const isActive = t.dataset.mode === mode;
    t.classList.toggle("active", isActive);
    t.setAttribute("aria-selected", isActive);
  });

  /* Animar salida del panel actual */
  const panels = {
    basic: "fn-basic",
    algebra: "fn-algebra",
    stats: "fn-stats",
  };
  const allPanels = Object.values(panels);

  allPanels.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    if (id === panels[mode]) {
      /* Panel entrante */
      el.style.display = "";
      gsap.fromTo(
        el,
        { opacity: 0, y: 12, filter: "blur(3px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.35,
          ease: "power3.out",
        },
      );

      /* Stagger en teclas del panel nuevo */
      gsap.fromTo(
        el.querySelectorAll(".key"),
        { opacity: 0, scale: 0.88, y: 4 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.22,
          stagger: 0.018,
          ease: "power2.out",
        },
      );
    } else {
      /* Paneles salientes */
      if (el.style.display !== "none") {
        gsap.to(el, {
          opacity: 0,
          y: -8,
          duration: 0.18,
          ease: "power2.in",
          onComplete: () => {
            el.style.display = "none";
          },
        });
      }
    }
  });

  /* Flash en el tab activo */
  const activeTab = document.querySelector(`.mode-tab[data-mode="${mode}"]`);
  if (activeTab) {
    gsap.fromTo(
      activeTab,
      { boxShadow: "0 0 18px rgba(0,212,255,0.6)" },
      {
        boxShadow: "0 0 0 rgba(0,212,255,0)",
        duration: 0.5,
        ease: "power2.out",
      },
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
  gsap
    .timeline()
    .to(DOM.displayMain, {
      boxShadow:
        "0 0 0 2px rgba(0,212,255,0.25), 0 0 30px rgba(0,212,255,0.12)",
      duration: 0.2,
    })
    .to(DOM.display, {
      color: "#ffffff",
      textShadow: "0 0 20px rgba(0,212,255,0.8)",
      duration: 0.15,
    })
    .to(DOM.display, {
      color: "var(--accent-cyan)",
      textShadow: "0 0 10px rgba(0,212,255,0.4)",
      duration: 0.4,
    })
    .to(
      DOM.displayMain,
      {
        boxShadow: "none",
        duration: 0.3,
      },
      "<+=0.2",
    );

  setTimeout(() => {
    try {
      const steps = generateSteps(expr);
      STATE.allSteps = steps;

      DOM.stepsEmpty.style.display = "none";
      animateStepsSequentially(steps);
      DOM.stepsCount.textContent = steps.length + " PASOS";

      /* Resultado en display con animación */
      const lastVal = steps.filter((s) => s.value !== null).pop()?.value;
      if (lastVal != null) {
        gsap
          .timeline()
          .to(DOM.result, { opacity: 0, y: 5, duration: 0.15 })
          .call(() => {
            DOM.result.textContent = "= " + lastVal;
          })
          .to(DOM.result, {
            opacity: 0.95,
            y: 0,
            duration: 0.35,
            ease: "power3.out",
          });
      }
    } catch (err) {
      addStepCard("⚠ ERROR", err.message, "step-error");
      DOM.stepsEmpty.style.display = "none";
      showToast("Error: " + err.message, "error");
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
    label: "PASO 1 · EXPRESIÓN ORIGINAL",
    content: `<span class="highlight">Expresión:</span> <span class="math-val">${escHtml(expr)}</span>`,
    type: "",
    value: null,
  });

  /* PASO 2 · Análisis sintáctico */
  steps.push({
    label: "PASO 2 · ANÁLISIS SINTÁCTICO",
    content: `Tipo de nodo: <span class="highlight">${escHtml(node.type)}</span><br>
              Forma canónica: <span class="math-val">${escHtml(node.toString())}</span>`,
    type: "",
    value: null,
  });

  /* PASO 3 · Sustitución de constantes */
  let exprProcessed = expr;
  const constSubs = [];
  if (expr.includes("pi")) {
    exprProcessed = exprProcessed.replace(/\bpi\b/g, Math.PI.toFixed(8));
    constSubs.push(`π → <span class="math-val">${Math.PI.toFixed(8)}</span>`);
  }
  if (expr.includes(" e") || /\be\b/.test(expr)) {
    constSubs.push(`e → <span class="math-val">${Math.E.toFixed(8)}</span>`);
  }
  if (constSubs.length > 0) {
    steps.push({
      label: "PASO 3 · SUSTITUCIÓN DE CONSTANTES",
      content:
        constSubs.join("<br>") +
        `<br>Expresión: <span class="highlight">${escHtml(exprProcessed)}</span>`,
      type: "",
      value: null,
    });
  }

  /* PASO 4 · Sub-evaluaciones */
  try {
    const children = getSubExpressions(node, expr);
    children.forEach((sub, i) => {
      try {
        const subVal = math.evaluate(sub);
        if (typeof subVal === "number" && sub !== expr) {
          steps.push({
            label: `PASO ${steps.length + 1} · SUB-EXPRESIÓN`,
            content: `<span class="highlight">${escHtml(sub)}</span>
                      <span class="op-symbol"> = </span>
                      <span class="math-val">${escHtml(formatResult(subVal))}</span>`,
            type: "",
            value: null,
          });
        }
      } catch (e) {
        /* ignorar sub-expresiones inválidas */
      }
    });
  } catch (e) {
    /* continuar */
  }

  /* PASO N · Evaluación final */
  const result = math.evaluate(expr);
  const formatted = formatResult(result);

  steps.push({
    label: `PASO ${steps.length + 1} · EVALUACIÓN FINAL`,
    content: `<span class="highlight">${escHtml(expr)}</span>
              <span class="op-symbol"> = </span>
              <span class="math-val">${escHtml(formatted)}</span>`,
    type: "step-result",
    value: formatted,
  });

  /* PASO EXTRA · Propiedades del resultado numérico */
  if (typeof result === "number" && isFinite(result)) {
    const props = [];
    props.push(
      Number.isInteger(result)
        ? 'Tipo: <span class="highlight">número entero</span>'
        : 'Tipo: <span class="highlight">número decimal (ℝ)</span>',
    );
    props.push(
      result > 0
        ? 'Signo: <span class="math-val">positivo (+)</span>'
        : result < 0
          ? 'Signo: <span class="math-val">negativo (−)</span>'
          : 'Signo: <span class="highlight">cero</span>',
    );

    if (
      Number.isInteger(result) &&
      Math.abs(result) > 1 &&
      Math.abs(result) < 1e7
    ) {
      const primes = getPrimeFactors(Math.abs(result));
      if (primes.length > 1) {
        props.push(
          `Factores primos: <span class="math-val">${primes.join(" × ")}</span>`,
        );
      }
    }

    if (!Number.isInteger(result)) {
      props.push(
        `Fracción ≈ <span class="math-val">${approximateFraction(result)}</span>`,
      );
    }

    steps.push({
      label: `PASO ${steps.length + 1} · PROPIEDADES DEL RESULTADO`,
      content: props.join("<br>"),
      type: "",
      value: formatted,
    });
  }

  return steps;
}

/* Obtiene sub-expresiones relevantes de un nodo math.js */
function getSubExpressions(node, original) {
  const subs = [];
  try {
    node.forEach((child) => {
      const s = child.toString();
      if (s.length > 1 && s !== original) subs.push(s);
    });
  } catch (e) {
    /* nodo sin hijos */
  }
  return subs;
}

/* Factorización prima simple */
function getPrimeFactors(n) {
  const factors = [];
  let d = 2;
  while (n > 1) {
    while (n % d === 0) {
      factors.push(d);
      n = Math.round(n / d);
    }
    d++;
    if (d * d > n) {
      if (n > 1) factors.push(n);
      break;
    }
  }
  return factors;
}

/* Aproximación de fracción racional (algoritmo de fracciones continuas) */
function approximateFraction(x, tol = 1e-6, maxDen = 1000) {
  let h1 = 1,
    h2 = 0,
    k1 = 0,
    k2 = 1,
    b = x;
  do {
    const a = Math.floor(b);
    let aux = h1;
    h1 = a * h1 + h2;
    h2 = aux;
    aux = k1;
    k1 = a * k1 + k2;
    k2 = aux;
    b = 1 / (b - a);
  } while (Math.abs(x - h1 / k1) > x * tol && k1 <= maxDen);
  return `${h1}/${k1}`;
}

/* Escapa HTML para evitar XSS en step cards */
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Formatea resultado numérico */
function formatResult(val) {
  if (typeof val === "number") {
    if (!isFinite(val)) return val > 0 ? "∞" : "-∞";
    if (Number.isInteger(val)) return val.toString();
    return parseFloat(val.toFixed(10)).toString();
  }
  if (val && typeof val.toString === "function") return val.toString();
  return String(val);
}

/* ─────────────────────────────────────────────────────────────────
   14. GESTIÓN DE STEP CARDS
   ───────────────────────────────────────────────────────────────── */
function addStepCard(label, content, type = "") {
  DOM.stepsEmpty.style.display = "none";
  const card = document.createElement("div");
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
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  steps.forEach((step, i) => {
    const card = addStepCard(step.label, step.content, step.type || "");

    /* Animación de cada card */
    tl.fromTo(
      card,
      { opacity: 0, x: -30, scale: 0.96, filter: "blur(4px)" },
      {
        opacity: 1,
        x: 0,
        scale: 1,
        filter: "blur(0px)",
        duration: 0.4,
      },
      i * 0.18 /* delay escalonado */,
    );

    /* Scroll automático al card actual */
    tl.call(
      () => {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      },
      [],
      i * 0.18 + 0.1,
    );
  });

  /* Pulso final en la última card */
  tl.call(() => {
    const last = DOM.stepsContainer.lastElementChild;
    if (last && last !== DOM.stepsEmpty) {
      gsap
        .timeline()
        .to(last, {
          boxShadow:
            "0 0 24px rgba(0,255,136,0.35), inset 0 0 30px rgba(0,255,136,0.06)",
          borderColor: "rgba(0,255,136,0.5)",
          duration: 0.4,
        })
        .to(last, {
          boxShadow: "none",
          borderColor: "var(--border-dim)",
          duration: 0.6,
          ease: "power2.inOut",
        });
    }
  });
}

/* Limpia todas las tarjetas del panel */
function clearSteps() {
  const cards = Array.from(DOM.stepsContainer.children).filter(
    (c) => c !== DOM.stepsEmpty,
  );

  if (cards.length === 0) return;

  gsap.to(cards, {
    opacity: 0,
    x: 15,
    scale: 0.95,
    duration: 0.2,
    stagger: 0.03,
    ease: "power2.in",
    onComplete: () => {
      cards.forEach((c) => c.remove());
      DOM.stepsEmpty.style.display = "";
      gsap.fromTo(
        DOM.stepsEmpty,
        { opacity: 0 },
        { opacity: 0.3, duration: 0.4 },
      );
    },
  });

  DOM.stepsCount.textContent = "0 PASOS";
}

/* Repite la animación de pasos */
function replaySteps() {
  if (STATE.allSteps.length === 0) return;

  const cards = Array.from(DOM.stepsContainer.children).filter(
    (c) => c !== DOM.stepsEmpty,
  );
  gsap.to(cards, {
    opacity: 0,
    scale: 0.9,
    duration: 0.25,
    stagger: 0.02,
    onComplete: () => {
      cards.forEach((c) => c.remove());
      DOM.stepsEmpty.style.display = "none";
      animateStepsSequentially(STATE.allSteps);
      DOM.stepsCount.textContent = STATE.allSteps.length + " PASOS";
    },
  });
}

/* ─────────────────────────────────────────────────────────────────
   15. FUNCIONES ALGEBRAICAS ESPECIALES
   ───────────────────────────────────────────────────────────────── */

/* Derivada simbólica */
function runDerivative() {
  const expr = getExpression();
  if (!expr) {
    showToast("Ingresa una expresión en x", "info");
    return;
  }

  clearSteps();
  STATE.allSteps = [];
  DOM.stepsEmpty.style.display = "none";

  const steps = [];
  steps.push({
    label: "DERIVADA — PASO 1 · EXPRESIÓN",
    content: `Diferenciando respecto a x:<br>
              <span class="op-symbol">d/dx</span> <span class="highlight">[${escHtml(expr)}]</span>`,
    type: "",
    value: null,
  });

  try {
    const derived = math.derivative(expr, "x");
    steps.push({
      label: "DERIVADA — PASO 2 · REGLAS",
      content: `Aplicando reglas de diferenciación...<br>
                (Regla de la cadena, potencia, trig, etc.)`,
      type: "",
      value: null,
    });

    const simplified = math.simplify(derived);
    steps.push({
      label: "DERIVADA — RESULTADO",
      content: `<span class="highlight">f\'(x)</span>
                <span class="op-symbol"> = </span>
                <span class="math-val">${escHtml(simplified.toString())}</span>`,
      type: "step-result",
      value: simplified.toString(),
    });

    setExpression(simplified.toString());
    updatePreview();
    showToast("Derivada calculada correctamente", "success");
  } catch (e) {
    steps.push({
      label: "ERROR",
      content: "⚠ " + escHtml(e.message),
      type: "step-error",
      value: null,
    });
    showToast("Error en derivada: " + e.message, "error");
  }

  STATE.allSteps = steps;
  DOM.stepsCount.textContent = steps.length + " PASOS";
  animateStepsSequentially(steps);
}

/* Simplificación algebraica */
function runSimplify() {
  const expr = getExpression();
  if (!expr) {
    showToast("Ingresa una expresión", "info");
    return;
  }

  clearSteps();
  STATE.allSteps = [];
  DOM.stepsEmpty.style.display = "none";

  const steps = [];
  steps.push({
    label: "SIMPLIFICACIÓN — PASO 1",
    content: `Expresión original: <span class="math-val">${escHtml(expr)}</span>`,
    type: "",
    value: null,
  });

  try {
    const simplified = math.simplify(expr);
    steps.push({
      label: "SIMPLIFICACIÓN — RESULTADO",
      content: `<span class="highlight">${escHtml(expr)}</span>
                <span class="op-symbol"> → </span>
                <span class="math-val">${escHtml(simplified.toString())}</span>`,
      type: "step-result",
      value: simplified.toString(),
    });
    setExpression(simplified.toString());
    updatePreview();
    showToast("Expresión simplificada", "success");
  } catch (e) {
    steps.push({
      label: "ERROR",
      content: "⚠ " + escHtml(e.message),
      type: "step-error",
      value: null,
    });
  }

  STATE.allSteps = steps;
  DOM.stepsCount.textContent = steps.length + " PASOS";
  animateStepsSequentially(steps);
}

/* Resolución numérica de ecuaciones */
function runSolve() {
  const expr = getExpression();
  if (!expr) {
    showToast("Formato: ecuación en x (ej: x^2 - 4 = 0)", "info");
    return;
  }

  clearSteps();
  STATE.allSteps = [];
  DOM.stepsEmpty.style.display = "none";

  const steps = [];
  steps.push({
    label: "RESOLUCIÓN — PASO 1 · ECUACIÓN",
    content: `Analizando: <span class="math-val">${escHtml(expr)}</span>`,
    type: "",
    value: null,
  });

  try {
    let cleanExpr = expr;
    if (expr.includes("=")) {
      const [lhs, rhs] = expr.split("=");
      cleanExpr = `(${lhs.trim()}) - (${rhs.trim()})`;
    }

    steps.push({
      label: "RESOLUCIÓN — PASO 2 · FORMA ESTÁNDAR",
      content: `Reordenando a f(x) = 0:<br>
                <span class="highlight">${escHtml(cleanExpr)}</span> = 0`,
      type: "",
      value: null,
    });

    steps.push({
      label: "RESOLUCIÓN — PASO 3 · BISECCIÓN",
      content: `Buscando raíces en [-100, 100]<br>
                Método: <span class="highlight">Bisección iterativa</span> (50 iter/raíz)`,
      type: "",
      value: null,
    });

    const roots = findRoots(cleanExpr, -100, 100);

    if (roots.length > 0) {
      steps.push({
        label: "RESOLUCIÓN — RESULTADO",
        content: roots
          .map(
            (r, i) =>
              `<span class="highlight">x${i > 0 ? i + 1 : ""}</span>
           <span class="op-symbol"> = </span>
           <span class="math-val">${r.toFixed(8)}</span>`,
          )
          .join("<br>"),
        type: "step-result",
        value: roots.map((r) => r.toFixed(6)).join(", "),
      });
      showToast(`${roots.length} raíz(ces) encontrada(s)`, "success");
    } else {
      steps.push({
        label: "RESOLUCIÓN — SIN RAÍCES REALES",
        content:
          "No se encontraron raíces reales en [-100, 100].<br>" +
          '<span class="highlight">La ecuación puede tener raíces complejas.</span>',
        type: "step-warning",
        value: "sin raíces",
      });
      showToast("Sin raíces reales en el rango", "info");
    }
  } catch (e) {
    steps.push({
      label: "ERROR",
      content: "⚠ " + escHtml(e.message),
      type: "step-error",
      value: null,
    });
    showToast("Error: " + e.message, "error");
  }

  STATE.allSteps = steps;
  DOM.stepsCount.textContent = steps.length + " PASOS";
  animateStepsSequentially(steps);
}

/* Búsqueda de raíces por bisección */
function findRoots(expr, from, to, step = 0.5) {
  const roots = [];
  let prev = null;

  for (let x = from; x <= to; x += step) {
    try {
      const val = math.evaluate(expr, { x });
      if (!isFinite(val)) {
        prev = null;
        continue;
      }

      if (prev !== null && Math.sign(val) !== Math.sign(prev.val)) {
        let lo = prev.x,
          hi = x;
        for (let iter = 0; iter < 60; iter++) {
          const mid = (lo + hi) / 2;
          const fmid = math.evaluate(expr, { x: mid });
          if (Math.abs(fmid) < 1e-10) {
            roots.push(mid);
            break;
          }
          if (Math.sign(fmid) === Math.sign(math.evaluate(expr, { x: lo })))
            lo = mid;
          else hi = mid;
          if (iter === 59) roots.push((lo + hi) / 2);
        }
      }
      prev = { x, val };
    } catch (e) {
      prev = null;
    }
  }

  /* Deduplicar raíces cercanas */
  return roots
    .filter((r, i) => roots.findIndex((o) => Math.abs(o - r) < 1e-5) === i)
    .slice(0, 8);
}

/* Integral numérica (método de Simpson) */
function runIntegral() {
  const expr = getExpression();
  if (!expr) {
    showToast("Ingresa una función de x", "info");
    return;
  }

  clearSteps();
  STATE.allSteps = [];
  DOM.stepsEmpty.style.display = "none";

  const steps = [];
  const a = 0,
    b = 1,
    n = 1000;
  const h = (b - a) / n;

  steps.push({
    label: "INTEGRAL — PASO 1 · PLANTEAMIENTO",
    content: `Calculando integral numérica:<br>
              <span class="op-symbol">∫₀¹</span> <span class="highlight">${escHtml(expr)}</span> dx<br>
              Límites: a=<span class="math-val">0</span>, b=<span class="math-val">1</span>`,
    type: "",
    value: null,
  });

  try {
    let sum = math.evaluate(expr, { x: a }) + math.evaluate(expr, { x: b });
    for (let i = 1; i < n; i++) {
      sum += (i % 2 === 0 ? 2 : 4) * math.evaluate(expr, { x: a + i * h });
    }
    const result = (h / 3) * sum;

    steps.push({
      label: "INTEGRAL — PASO 2 · MÉTODO",
      content: `Regla de Simpson 1/3<br>
                n = <span class="highlight">${n}</span> subintervalos<br>
                h = (b−a)/n = <span class="math-val">${h.toFixed(8)}</span>`,
      type: "",
      value: null,
    });

    steps.push({
      label: "INTEGRAL — PASO 3 · FÓRMULA",
      content: `I ≈ (h/3)[f(a) + 4f(x₁) + 2f(x₂) + … + f(b)]<br>
                Error estimado: O(h⁴)`,
      type: "",
      value: null,
    });

    steps.push({
      label: "INTEGRAL — RESULTADO",
      content: `<span class="op-symbol">∫₀¹</span> <span class="highlight">${escHtml(expr)}</span> dx
                <span class="op-symbol"> ≈ </span>
                <span class="math-val">${result.toFixed(10)}</span>`,
      type: "step-result",
      value: result.toFixed(10),
    });

    DOM.result.textContent = "∫ = " + result.toFixed(10);
    showToast("Integral numérica calculada", "success");
  } catch (e) {
    steps.push({
      label: "ERROR",
      content: "⚠ " + escHtml(e.message),
      type: "step-error",
      value: null,
    });
  }

  STATE.allSteps = steps;
  DOM.stepsCount.textContent = steps.length + " PASOS";
  animateStepsSequentially(steps);
}

/* ─────────────────────────────────────────────────────────────────
   16. ESTADÍSTICAS ESPECIALES
   ───────────────────────────────────────────────────────────────── */
function runRegression() {
  showToast("Ingresa pares: [[x1,y1],[x2,y2],...]", "info");
  setExpression("[[1,2],[2,4],[3,5],[4,4],[5,5]]");
  updatePreview();
}

function runHistogram() {
  const expr = getExpression();
  if (!expr) {
    showToast("Ingresa un array de datos", "info");
    return;
  }

  try {
    const data = math.evaluate(expr);
    if (!Array.isArray(data)) {
      showToast("Se esperaba un array []", "error");
      return;
    }
    const flat = data.flat().map(Number).filter(isFinite);

    showGraphLoading(true);

    setTimeout(() => {
      DOM.graphPlaceholder.style.display = "none";
      Plotly.newPlot(
        "graph-container",
        [
          {
            x: flat,
            type: "histogram",
            marker: {
              color: flat.map((_, i) => `hsl(${190 + i * 12}, 80%, 60%)`),
              line: { color: "#00d4ff", width: 1 },
            },
            name: "Distribución",
            opacity: 0.85,
          },
        ],
        {
          ...getPlotlyLayout("Histograma de Frecuencias"),
          bargap: 0.05,
        },
        { responsive: true },
      );

      showGraphLoading(false);
    }, 100);

    /* Estadísticas en el panel de pasos */
    clearSteps();
    DOM.stepsEmpty.style.display = "none";
    const stats = [
      {
        label: "ESTADÍSTICA · MEDIA",
        content: `μ <span class="op-symbol">=</span> <span class="math-val">${math.mean(flat).toFixed(6)}</span>`,
        type: "",
      },
      {
        label: "ESTADÍSTICA · MEDIANA",
        content: `Mediana <span class="op-symbol">=</span> <span class="math-val">${math.median(flat).toFixed(6)}</span>`,
        type: "",
      },
      {
        label: "ESTADÍSTICA · DESV. ESTÁNDAR",
        content: `σ <span class="op-symbol">=</span> <span class="math-val">${math.std(flat).toFixed(6)}</span>`,
        type: "",
      },
      {
        label: "ESTADÍSTICA · VARIANZA",
        content: `σ² <span class="op-symbol">=</span> <span class="math-val">${math.variance(flat).toFixed(6)}</span>`,
        type: "",
      },
      {
        label: "ESTADÍSTICA · RANGO",
        content: `Min: <span class="highlight">${math.min(flat)}</span>  Max: <span class="highlight">${math.max(flat)}</span>  N: <span class="math-val">${flat.length}</span>`,
        type: "step-result",
        value: "",
      },
    ];
    STATE.allSteps = stats;
    animateStepsSequentially(stats);
    DOM.stepsCount.textContent = stats.length + " PASOS";
    showToast("Histograma generado", "success");
  } catch (e) {
    showToast("Error: " + e.message, "error");
  }
}

/* ─────────────────────────────────────────────────────────────────
   17. GRÁFICAS PLOTLY
   ───────────────────────────────────────────────────────────────── */
function getPlotlyLayout(title) {
  return {
    title: {
      text: title,
      font: { color: "#c8e6f5", family: "Space Mono", size: 12 },
      pad: { t: 8 },
    },
    paper_bgcolor: "#050a0f",
    plot_bgcolor: "#090e15",
    font: { color: "#5a8aaa", family: "Space Mono", size: 10 },
    xaxis: {
      gridcolor: "#1a2d45",
      zerolinecolor: "#1e4070",
      tickfont: { color: "#5a8aaa" },
      linecolor: "#1a2d45",
    },
    yaxis: {
      gridcolor: "#1a2d45",
      zerolinecolor: "#1e4070",
      tickfont: { color: "#5a8aaa" },
      linecolor: "#1a2d45",
    },
    margin: { t: 46, r: 16, b: 40, l: 48 },
    legend: { font: { color: "#5a8aaa" } },
    modebar: {
      bgcolor: "transparent",
      color: "#5a8aaa",
      activecolor: "#00d4ff",
    },
  };
}

function showGraphLoading(visible) {
  DOM.graphLoading.classList.toggle("visible", visible);
}

function plot2D() {
  const raw = DOM.graphExpr.value.trim();
  if (!raw) {
    showToast("Ingresa una función f(x)", "info");
    return;
  }

  const expr = raw.replace(/^f\s*\(x\)\s*=\s*/i, "").trim();

  showGraphLoading(true);

  requestAnimationFrame(() => {
    const N = 600;
    const xVals = [],
      yVals = [];
    for (let i = 0; i <= N; i++) {
      const x = -10 + (20 * i) / N;
      try {
        const y = math.evaluate(expr, { x });
        xVals.push(x);
        yVals.push(isFinite(y) ? y : null);
      } catch (e) {
        xVals.push(x);
        yVals.push(null);
      }
    }

    DOM.graphPlaceholder.style.display = "none";

    Plotly.newPlot(
      "graph-container",
      [
        {
          x: xVals,
          y: yVals,
          mode: "lines",
          name: `f(x) = ${expr}`,
          line: { color: "#00d4ff", width: 2.5, shape: "spline" },
          fill: "tozeroy",
          fillcolor: "rgba(0,212,255,0.04)",
        },
      ],
      {
        ...getPlotlyLayout(`f(x) = ${expr}`),
        shapes: [
          {
            type: "line",
            x0: -10,
            x1: 10,
            y0: 0,
            y1: 0,
            line: { color: "#1e4070", width: 1, dash: "dot" },
          },
          {
            type: "line",
            x0: 0,
            x1: 0,
            y0: -1e6,
            y1: 1e6,
            line: { color: "#1e4070", width: 1, dash: "dot" },
          },
        ],
      },
      { responsive: true, displaylogo: false },
    );

    showGraphLoading(false);

    /* Animar la aparición de la gráfica */
    gsap.fromTo(
      "#graph-container .plotly",
      { opacity: 0 },
      { opacity: 1, duration: 0.5, ease: "power2.out" },
    );

    showToast("Gráfica 2D generada", "success");
  });
}

function plot3D() {
  const raw = DOM.graphExpr.value.trim();
  if (!raw) {
    showToast("Ingresa una función f(x,y)", "info");
    return;
  }
  const expr = raw.replace(/^f\s*\(x,?\s*y\)\s*=\s*/i, "").trim();

  showGraphLoading(true);

  setTimeout(() => {
    const N = 45;
    const xVals = Array.from({ length: N + 1 }, (_, i) => -5 + (10 * i) / N);
    const yVals = Array.from({ length: N + 1 }, (_, j) => -5 + (10 * j) / N);
    const zVals = yVals.map((y) =>
      xVals.map((x) => {
        try {
          const z = math.evaluate(expr, { x, y });
          return isFinite(z) ? z : null;
        } catch (e) {
          return null;
        }
      }),
    );

    DOM.graphPlaceholder.style.display = "none";

    Plotly.newPlot(
      "graph-container",
      [
        {
          type: "surface",
          x: xVals,
          y: yVals,
          z: zVals,
          colorscale: [
            [0, "#020610"],
            [0.15, "#001a40"],
            [0.35, "#003366"],
            [0.55, "#00d4ff"],
            [0.75, "#00ff88"],
            [1, "#ffd700"],
          ],
          contours: {
            z: { show: true, color: "#1e4070", width: 1, usecolormap: false },
          },
          name: expr,
          opacity: 0.93,
          lighting: {
            ambient: 0.7,
            diffuse: 0.8,
            specular: 0.3,
            roughness: 0.5,
          },
        },
      ],
      {
        ...getPlotlyLayout(`f(x,y) = ${expr}`),
        scene: {
          bgcolor: "#050a0f",
          xaxis: {
            gridcolor: "#1a2d45",
            color: "#5a8aaa",
            backgroundcolor: "#050a0f",
            showbackground: true,
          },
          yaxis: {
            gridcolor: "#1a2d45",
            color: "#5a8aaa",
            backgroundcolor: "#050a0f",
            showbackground: true,
          },
          zaxis: {
            gridcolor: "#1a2d45",
            color: "#5a8aaa",
            backgroundcolor: "#050a0f",
            showbackground: true,
          },
          camera: { eye: { x: 1.4, y: 1.4, z: 1 } },
        },
      },
      { responsive: true, displaylogo: false },
    );

    showGraphLoading(false);
    showToast("Superficie 3D generada", "success");
  }, 50);
}

function clearGraph() {
  gsap.to("#graph-container", {
    opacity: 0,
    duration: 0.25,
    onComplete: () => {
      Plotly.purge("graph-container");
      DOM.graphPlaceholder.style.display = "";
      gsap.to("#graph-container", { opacity: 1, duration: 0.3 });
    },
  });
}

/* ─────────────────────────────────────────────────────────────────
   18. OCR — TESSERACT.JS
   ───────────────────────────────────────────────────────────────── */
function initDragDrop() {
  const zone = DOM.ocrDropZone;

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragging");
    gsap.to(zone, { scale: 1.02, duration: 0.2 });
  });

  zone.addEventListener("dragleave", (e) => {
    if (!zone.contains(e.relatedTarget)) {
      zone.classList.remove("dragging");
      gsap.to(zone, { scale: 1, duration: 0.2 });
    }
  });

  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragging");
    gsap.to(zone, { scale: 1, duration: 0.2 });
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) processOCR(file);
    else showToast("Archivo no válido — usa PNG, JPG o BMP", "error");
  });
}

function handleOCRFile(event) {
  const file = event.target.files[0];
  if (file) processOCR(file);
  event.target.value = "";
}

async function processOCR(file) {
  const zone = DOM.ocrDropZone;

  /* Feedback visual al iniciar OCR */
  zone.classList.add("processing");
  DOM.ocrProgress.classList.add("visible");
  DOM.ocrProgress.style.display = "block";
  DOM.ocrBar.style.width = "0%";
  DOM.ocrStatus.textContent = "Cargando motor OCR...";

  gsap
    .timeline()
    .to(zone, { borderColor: "var(--accent-orange)", duration: 0.2 })
    .to(".ocr-icon", {
      rotation: 15,
      scale: 1.2,
      duration: 0.3,
      ease: "power2.out",
    })
    .to(".ocr-icon", {
      rotation: 0,
      scale: 1,
      duration: 0.3,
      ease: "bounce.out",
    });

  /* Animación de carga indeterminada */
  const loadingAnim = gsap.to(DOM.ocrBar, {
    width: "60%",
    duration: 3,
    ease: "power1.inOut",
  });

  try {
    const worker = await Tesseract.createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
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
      tessedit_char_whitelist:
        "0123456789+-*/()^.=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ πΩ√∑∫",
    });

    const {
      data: { text },
    } = await worker.recognize(file);
    await worker.terminate();

    /* Animación de éxito */
    loadingAnim.kill();
    gsap.to(DOM.ocrBar, { width: "100%", duration: 0.4 });
    gsap.to(DOM.ocrBar, {
      background: "linear-gradient(90deg, var(--accent-green), #00ffaa)",
      duration: 0.3,
    });
    DOM.ocrStatus.textContent = "✓ Reconocimiento completado";

    const cleaned = cleanOCRText(text);
    if (cleaned) {
      /* Animar inserción en el display */
      gsap
        .timeline()
        .to(DOM.display, { opacity: 0, y: -8, duration: 0.2 })
        .call(() => {
          setExpression(cleaned);
          updatePreview();
        })
        .to(DOM.display, {
          opacity: 1,
          y: 0,
          duration: 0.35,
          ease: "power3.out",
        });

      showToast("Ecuación detectada: " + cleaned, "success");
      setTimeout(() => calculate(), 900);
    } else {
      showToast("No se detectó una expresión válida en la imagen", "error");
    }
  } catch (e) {
    loadingAnim.kill();
    gsap.to(DOM.ocrBar, {
      background: "var(--accent-red)",
      width: "100%",
      duration: 0.3,
    });
    DOM.ocrStatus.textContent = "✗ Error: " + e.message;
    showToast("Error OCR: " + e.message, "error");
  } finally {
    zone.classList.remove("processing");
    gsap.to(zone, { borderColor: "var(--border-bright)", duration: 0.4 });

    setTimeout(() => {
      gsap.to(DOM.ocrProgress, {
        opacity: 0,
        duration: 0.4,
        onComplete: () => {
          DOM.ocrProgress.style.display = "none";
          DOM.ocrProgress.classList.remove("visible");
          gsap.set(DOM.ocrProgress, { opacity: 1 });
          gsap.set(DOM.ocrBar, {
            background:
              "linear-gradient(90deg, var(--accent-cyan), var(--accent-green))",
            width: "0%",
          });
        },
      });
    }, 2500);
  }
}

/* Limpia y valida el texto reconocido por OCR */
function cleanOCRText(text) {
  let clean = text
    .replace(/\n/g, " ")
    .replace(/\s+/g, "")
    .replace(/[×xX✕]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\|/g, "")
    .trim();

  try {
    math.parse(clean);
    return clean;
  } catch (e) {
    clean = clean.replace(/[^0-9+\-*/()^.=xyπsincostalogexpabssqrt]/g, "");
    try {
      math.parse(clean);
      return clean.length > 0 ? clean : null;
    } catch (e2) {
      return null;
    }
  }
}

/* ─────────────────────────────────────────────────────────────────
   19. TOASTS
   ───────────────────────────────────────────────────────────────── */
const TOAST_ICONS = { success: "✓", error: "✗", info: "ℹ" };
const TOAST_COLORS = {
  success: "var(--accent-green)",
  error: "var(--accent-red)",
  info: "var(--accent-cyan)",
};

function showToast(msg, type = "info") {
  const container = DOM.toastContainer;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon" style="color:${TOAST_COLORS[type]}">${TOAST_ICONS[type]}</span>
    <span>${escHtml(msg)}</span>
  `;
  container.appendChild(toast);

  /* Entrada */
  gsap.fromTo(
    toast,
    { opacity: 0, x: 30, scale: 0.9 },
    { opacity: 1, x: 0, scale: 1, duration: 0.35, ease: "power3.out" },
  );

  /* Salida */
  setTimeout(() => {
    gsap.to(toast, {
      opacity: 0,
      x: 30,
      scale: 0.9,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => toast.remove(),
    });
  }, 3800);
}

/* ═══════════════════════════════════════════════════════════════════
   MÓDULO HISTORIAL — v2.5.0
   Guarda operaciones en localStorage, renderiza el drawer y permite
   cargar, buscar y eliminar entradas.
   ═══════════════════════════════════════════════════════════════════ */

const HISTORY_KEY = "quantumcalc_history_v2";
const HISTORY_MAX = 500;

/* ── Estado del historial ── */
const HIST = {
  records: [], // Array de { id, expr, result, mode, date, ts }
  isOpen: false,
  filterText: "",
};

/* ── Referencias DOM adicionales ── */
const HISTDOM = {
  get drawer() {
    return document.getElementById("history-drawer");
  },
  get backdrop() {
    return document.getElementById("history-backdrop");
  },
  get list() {
    return document.getElementById("history-list");
  },
  get empty() {
    return document.getElementById("history-empty");
  },
  get badge() {
    return document.getElementById("history-badge");
  },
  get countLabel() {
    return document.getElementById("history-count-label");
  },
  get toggleBtn() {
    return document.getElementById("history-toggle-btn");
  },
  get search() {
    return document.getElementById("history-search");
  },
};

/* ─────────────────────────────────────────────────────────────────
   INICIALIZACIÓN DEL HISTORIAL
   ───────────────────────────────────────────────────────────────── */
(function initHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    HIST.records = raw ? JSON.parse(raw) : [];
  } catch (e) {
    HIST.records = [];
  }
  // Esperar a que el DOM esté listo para renderizar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      renderHistoryList();
      updateHistoryBadge();
    });
  } else {
    renderHistoryList();
    updateHistoryBadge();
  }
})();

/* ─────────────────────────────────────────────────────────────────
   GUARDAR EN HISTORIAL
   ───────────────────────────────────────────────────────────────── */
function saveToHistory(expr, result, mode) {
  if (!expr || result === null || result === undefined) return;

  const record = {
    id: Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    expr: String(expr).slice(0, 300),
    result: String(result).slice(0, 200),
    mode: mode || STATE.currentMode || "basic",
    date: new Date().toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    ts: Date.now(),
  };

  // Evitar duplicados consecutivos
  if (HIST.records.length > 0) {
    const last = HIST.records[0];
    if (last.expr === record.expr && last.result === record.result) return;
  }

  HIST.records.unshift(record);
  if (HIST.records.length > HISTORY_MAX)
    HIST.records = HIST.records.slice(0, HISTORY_MAX);

  persistHistory();
  renderHistoryList();
  updateHistoryBadge(true);
}

function persistHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(HIST.records));
  } catch (e) {
    console.warn("localStorage lleno, limpiando historial antiguo...");
  }
}

/* ─────────────────────────────────────────────────────────────────
   RENDERIZADO DEL PANEL DE HISTORIAL
   ───────────────────────────────────────────────────────────────── */
function renderHistoryList(filter) {
  const list = HISTDOM.list;
  const empty = HISTDOM.empty;
  if (!list) return;

  const q = (filter !== undefined ? filter : HIST.filterText)
    .toLowerCase()
    .trim();

  // Filtrar registros
  const filtered = q
    ? HIST.records.filter(
        (r) =>
          r.expr.toLowerCase().includes(q) ||
          r.result.toLowerCase().includes(q) ||
          r.mode.toLowerCase().includes(q),
      )
    : HIST.records;

  // Vaciar lista (menos el empty state)
  Array.from(list.children).forEach((c) => {
    if (c !== empty) c.remove();
  });

  if (filtered.length === 0) {
    empty.style.display = "";
    HISTDOM.countLabel && (HISTDOM.countLabel.textContent = "0 registros");
    return;
  }

  empty.style.display = "none";

  // Agrupar por fecha (hoy / ayer / más antiguo)
  const groups = groupByDate(filtered);

  groups.forEach(({ label, items }) => {
    // Cabecera de grupo
    const grpEl = document.createElement("div");
    grpEl.className = "history-group-label";
    grpEl.textContent = label;
    list.appendChild(grpEl);

    items.forEach((record, idx) => {
      const item = buildHistoryItem(record, idx);
      list.appendChild(item);
    });
  });

  HISTDOM.countLabel &&
    (HISTDOM.countLabel.textContent = `${filtered.length} registro${filtered.length !== 1 ? "s" : ""}`);

  updateHistoryBadge();
}

/* Agrupa registros por "Hoy", "Ayer", día o semana */
function groupByDate(records) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const week = new Date(today);
  week.setDate(week.getDate() - 6);

  const map = new Map();

  records.forEach((r) => {
    const d = new Date(r.ts);
    d.setHours(0, 0, 0, 0);
    let label;
    if (d.getTime() === today.getTime()) label = "HOY";
    else if (d.getTime() === yesterday.getTime()) label = "AYER";
    else if (d >= week) {
      label = d.toLocaleDateString("es-CO", { weekday: "long" }).toUpperCase();
    } else {
      label = d
        .toLocaleDateString("es-CO", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
        .toUpperCase();
    }
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(r);
  });

  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

/* Construye el elemento DOM de un item del historial */
function buildHistoryItem(record, idx) {
  const item = document.createElement("div");
  item.className = "history-item";
  item.setAttribute("role", "listitem");
  item.setAttribute("tabindex", "0");
  item.setAttribute("data-id", record.id);
  item.setAttribute("aria-label", `${record.expr} = ${record.result}`);

  const modeLabel = {
    basic: "BÁS",
    algebra: "ALG",
    stats: "STA",
    derive: "d/dx",
    integral: "∫",
  };

  item.innerHTML = `
    <div class="history-item-expr">
      ${escHtml(record.expr.slice(0, 60))}${record.expr.length > 60 ? "…" : ""}
      <span class="history-item-mode mode-${record.mode}">${modeLabel[record.mode] || record.mode.toUpperCase()}</span>
    </div>
    <button class="history-item-del" title="Eliminar" onclick="deleteHistoryItem('${escHtml(record.id)}', event)">✕</button>
    <div class="history-item-result">= ${escHtml(record.result.slice(0, 80))}</div>
    <div class="history-item-date">${escHtml(record.date)}</div>
  `;

  // Click: cargar en la calculadora
  item.addEventListener("click", (e) => {
    if (e.target.classList.contains("history-item-del")) return;
    loadFromHistory(record);
  });

  // Teclado: Enter/Espacio
  item.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      loadFromHistory(record);
    }
  });

  return item;
}

/* ─────────────────────────────────────────────────────────────────
   CARGAR DESDE HISTORIAL
   ───────────────────────────────────────────────────────────────── */
function loadFromHistory(record) {
  // Animar salida del display actual
  gsap
    .timeline()
    .to(DOM.display, { opacity: 0, y: -6, duration: 0.18, ease: "power2.in" })
    .call(() => {
      setExpression(record.expr);
      updatePreview();
      if (record.mode && record.mode !== STATE.currentMode)
        switchMode(record.mode);
    })
    .to(DOM.display, { opacity: 1, y: 0, duration: 0.28, ease: "power3.out" });

  showToast(`Cargado: ${record.expr.slice(0, 40)}`, "info");

  // Cerrar drawer en móvil
  if (window.innerWidth < 900) toggleHistoryPanel();
}

/* ─────────────────────────────────────────────────────────────────
   ELIMINAR ITEM / LIMPIAR TODO
   ───────────────────────────────────────────────────────────────── */
function deleteHistoryItem(id, event) {
  event.stopPropagation();
  const item = event.target.closest(".history-item");
  if (!item) return;

  gsap.to(item, {
    opacity: 0,
    x: 20,
    height: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    duration: 0.3,
    ease: "power2.in",
    onComplete: () => {
      HIST.records = HIST.records.filter((r) => r.id !== id);
      persistHistory();
      renderHistoryList(HIST.filterText);
      updateHistoryBadge();
    },
  });
}

function clearHistory() {
  if (HIST.records.length === 0) {
    showToast("El historial ya está vacío", "info");
    return;
  }

  const items = HISTDOM.list.querySelectorAll(".history-item");
  gsap.to(items, {
    opacity: 0,
    x: 30,
    stagger: 0.03,
    duration: 0.25,
    ease: "power2.in",
    onComplete: () => {
      HIST.records = [];
      persistHistory();
      renderHistoryList();
      updateHistoryBadge();
      showToast("Historial eliminado", "info");
    },
  });
}

/* ─────────────────────────────────────────────────────────────────
   FILTRO DE BÚSQUEDA
   ───────────────────────────────────────────────────────────────── */
function filterHistory(query) {
  HIST.filterText = query;
  renderHistoryList(query);
}

/* ─────────────────────────────────────────────────────────────────
   BADGE DE CONTEO
   ───────────────────────────────────────────────────────────────── */
function updateHistoryBadge(bump) {
  const badge = HISTDOM.badge;
  if (!badge) return;
  const n = HIST.records.length;
  badge.textContent = n > 99 ? "99+" : String(n);
  badge.style.display = n === 0 ? "none" : "";
  if (bump) {
    badge.classList.remove("bump");
    void badge.offsetWidth;
    badge.classList.add("bump");
  }
}

/* ─────────────────────────────────────────────────────────────────
   TOGGLE DEL PANEL DE HISTORIAL
   ───────────────────────────────────────────────────────────────── */
function toggleHistoryPanel() {
  HIST.isOpen = !HIST.isOpen;
  const drawer = HISTDOM.drawer;
  const backdrop = HISTDOM.backdrop;
  const btn = HISTDOM.toggleBtn;

  drawer.classList.toggle("open", HIST.isOpen);
  backdrop.classList.toggle("visible", HIST.isOpen);
  drawer.setAttribute("aria-hidden", String(!HIST.isOpen));
  btn && btn.classList.toggle("active", HIST.isOpen);
  btn && btn.setAttribute("aria-expanded", String(HIST.isOpen));

  if (HIST.isOpen) {
    // Animar items de la lista al abrir
    const items = drawer.querySelectorAll(".history-item");
    if (items.length > 0) {
      gsap.fromTo(
        items,
        { opacity: 0, x: 20 },
        {
          opacity: 1,
          x: 0,
          stagger: 0.04,
          duration: 0.3,
          ease: "power3.out",
          delay: 0.15,
        },
      );
    }
    // Enfocar el buscador
    setTimeout(() => HISTDOM.search && HISTDOM.search.focus(), 400);
  }

  // Evitar scroll del body cuando el drawer está abierto en móvil
  document.body.style.overflow =
    HIST.isOpen && window.innerWidth < 900 ? "hidden" : "";
}

/* Cerrar con Escape */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && HIST.isOpen) toggleHistoryPanel();
});

/* ─────────────────────────────────────────────────────────────────
   HOOK: interceptar calculate() para guardar en historial
   Reemplazamos el final del cálculo con una versión que llama a saveToHistory
   ───────────────────────────────────────────────────────────────── */
const _originalCalculate = calculate;

// Parche: el hook se inyecta a través de animateStepsSequentially
// Guardamos al final de cada cálculo exitoso
const _origAnimateSteps = animateStepsSequentially;
window.animateStepsSequentially = function (steps) {
  _origAnimateSteps(steps);
  // Buscar el último valor calculado
  const lastWithValue = [...steps]
    .reverse()
    .find((s) => s.value !== null && s.value !== undefined);
  if (lastWithValue) {
    const expr = getExpression();
    if (expr) saveToHistory(expr, lastWithValue.value, STATE.currentMode);
  }
};

/* Parche para derivada, integral, simplify, solve */
function _histSave(expr, value, mode) {
  if (expr && value) saveToHistory(expr, value, mode);
}

/* ═══════════════════════════════════════════════════════════════════
   EXPORTACIÓN PDF — jsPDF + AutoTable
   ═══════════════════════════════════════════════════════════════════ */
function exportPDF() {
  if (HIST.records.length === 0) {
    showToast("No hay registros en el historial para exportar", "info");
    return;
  }

  const spinner = showExportSpinner("Generando PDF...");

  setTimeout(() => {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      /* ── PALETA ── */
      const C = {
        bg: [5, 10, 15],
        panel: [13, 24, 40],
        cyan: [0, 212, 255],
        green: [0, 255, 136],
        orange: [255, 107, 43],
        purple: [168, 85, 247],
        yellow: [255, 215, 0],
        textPrimary: [200, 230, 245],
        textDim: [90, 138, 170],
        border: [30, 64, 112],
        white: [255, 255, 255],
        red: [255, 68, 102],
      };

      /* ── FONDO DE PÁGINA ── */
      doc.setFillColor(...C.bg);
      doc.rect(0, 0, pageW, pageH, "F");

      /* ── HEADER BAND ── */
      doc.setFillColor(...C.panel);
      doc.rect(0, 0, pageW, 28, "F");

      // Línea superior cyan
      doc.setDrawColor(...C.cyan);
      doc.setLineWidth(0.8);
      doc.line(0, 0, pageW, 0);

      // Título
      doc.setTextColor(...C.cyan);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("QuantumCalc", 14, 12);

      doc.setFontSize(7);
      doc.setTextColor(...C.textDim);
      doc.setFont("helvetica", "normal");
      doc.text("CALCULADORA CIENTÍFICA AVANZADA  ·  v2.5.0", 14, 18);

      // Fecha de exportación
      const now = new Date().toLocaleString("es-CO", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      doc.setFontSize(7);
      doc.setTextColor(...C.textDim);
      doc.text(`Exportado: ${now}`, pageW - 14, 12, { align: "right" });
      doc.text(`${HIST.records.length} registro(s)`, pageW - 14, 18, {
        align: "right",
      });

      // Línea inferior del header
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.line(0, 28, pageW, 28);

      /* ── SUBTÍTULO ── */
      doc.setFillColor(...C.panel);
      doc.rect(0, 28, pageW, 10, "F");
      doc.setFontSize(8);
      doc.setTextColor(...C.green);
      doc.setFont("helvetica", "bold");
      doc.text("// HISTORIAL DE OPERACIONES", 14, 35);

      /* ── TABLA ── */
      const rows = HIST.records.map((r, i) => [
        String(i + 1),
        r.expr,
        r.result,
        r.mode.toUpperCase(),
        r.date,
      ]);

      doc.autoTable({
        startY: 40,
        head: [["#", "EXPRESIÓN", "RESULTADO", "MODO", "FECHA"]],
        body: rows,
        theme: "plain",
        styles: {
          font: "courier",
          fontSize: 7.5,
          cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
          textColor: C.textPrimary,
          lineColor: C.border,
          lineWidth: 0.2,
          overflow: "linebreak",
          halign: "left",
        },
        headStyles: {
          fillColor: C.panel,
          textColor: C.cyan,
          fontStyle: "bold",
          fontSize: 7,
          lineColor: C.cyan,
          lineWidth: 0.4,
          cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
        },
        columnStyles: {
          0: { cellWidth: 8, halign: "center", textColor: C.textDim },
          1: { cellWidth: 55, textColor: C.cyan },
          2: { cellWidth: 38, textColor: C.green, fontStyle: "bold" },
          3: { cellWidth: 16, halign: "center", textColor: C.orange },
          4: { cellWidth: "auto", textColor: C.textDim, fontSize: 6.5 },
        },
        alternateRowStyles: { fillColor: [9, 14, 21] },
        bodyStyles: { fillColor: C.bg },
        willDrawCell: (data) => {
          // Resaltar resultado con color de fondo sutil
          if (data.section === "body" && data.column.index === 2) {
            doc.setFillColor(0, 40, 20);
            doc.rect(
              data.cell.x,
              data.cell.y,
              data.cell.width,
              data.cell.height,
              "F",
            );
          }
        },
        didDrawPage: (data) => {
          // Footer en cada página
          const pg = doc.internal.getCurrentPageInfo().pageNumber;
          const total = doc.internal.getNumberOfPages();
          doc.setFillColor(...C.panel);
          doc.rect(0, pageH - 10, pageW, 10, "F");
          doc.setDrawColor(...C.border);
          doc.setLineWidth(0.2);
          doc.line(0, pageH - 10, pageW, pageH - 10);
          doc.setFontSize(6.5);
          doc.setTextColor(...C.textDim);
          doc.text("QuantumCalc — Exportación Automática", 14, pageH - 3.5);
          doc.text(`Página ${pg} de ${total}`, pageW - 14, pageH - 3.5, {
            align: "right",
          });
        },
        margin: { top: 40, right: 10, bottom: 14, left: 10 },
      });

      /* ── ESTADÍSTICAS AL FINAL ── */
      const finalY = doc.lastAutoTable.finalY + 8;
      if (finalY < pageH - 30) {
        doc.setFillColor(...C.panel);
        doc.roundedRect(10, finalY, pageW - 20, 22, 2, 2, "F");
        doc.setDrawColor(...C.border);
        doc.roundedRect(10, finalY, pageW - 20, 22, 2, 2, "S");

        doc.setFontSize(7);
        doc.setTextColor(...C.cyan);
        doc.setFont("courier", "bold");
        doc.text("// RESUMEN", 14, finalY + 7);

        doc.setFont("courier", "normal");
        doc.setTextColor(...C.textPrimary);
        doc.text(
          `Total de operaciones: ${HIST.records.length}`,
          14,
          finalY + 14,
        );

        const modes = HIST.records.reduce((acc, r) => {
          acc[r.mode] = (acc[r.mode] || 0) + 1;
          return acc;
        }, {});
        const modeStr = Object.entries(modes)
          .map(([m, n]) => `${m.toUpperCase()}: ${n}`)
          .join("  ·  ");
        doc.text(modeStr, 14, finalY + 20);
      }

      const filename = `QuantumCalc_Historial_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);

      hideExportSpinner(spinner);
      showToast("PDF exportado correctamente", "success");
    } catch (e) {
      hideExportSpinner(spinner);
      showToast("Error generando PDF: " + e.message, "error");
      console.error(e);
    }
  }, 120);
}

/* ═══════════════════════════════════════════════════════════════════
   EXPORTACIÓN EXCEL — SheetJS (xlsx)
   ═══════════════════════════════════════════════════════════════════ */
function exportExcel() {
  if (HIST.records.length === 0) {
    showToast("No hay registros en el historial para exportar", "info");
    return;
  }

  const spinner = showExportSpinner("Generando Excel...");

  setTimeout(() => {
    try {
      const XLSX = window.XLSX;

      /* ── HOJA PRINCIPAL: HISTORIAL ── */
      const histData = [
        // Fila de título (combinada visualmente por estilos)
        ["QuantumCalc — Historial de Cálculos", "", "", "", ""],
        [`Exportado: ${new Date().toLocaleString("es-CO")}`, "", "", "", ""],
        ["", "", "", "", ""],
        // Encabezados de columna
        ["#", "EXPRESIÓN", "RESULTADO", "MODO", "FECHA Y HORA"],
        // Datos
        ...HIST.records.map((r, i) => [
          i + 1,
          r.expr,
          r.result,
          r.mode.toUpperCase(),
          r.date,
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(histData);

      /* ── ANCHOS DE COLUMNA ── */
      ws["!cols"] = [
        { wch: 5 }, // #
        { wch: 50 }, // Expresión
        { wch: 28 }, // Resultado
        { wch: 12 }, // Modo
        { wch: 24 }, // Fecha
      ];

      /* ── COMBINAR CELDAS para el título ── */
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
      ];

      /* ── ESTILOS con xlsx-style (disponible en SheetJS full) ── */
      const styleTitle = {
        font: {
          bold: true,
          sz: 16,
          color: { rgb: "00D4FF" },
          name: "Courier New",
        },
        fill: { fgColor: { rgb: "050A0F" }, patternType: "solid" },
        alignment: { horizontal: "left", vertical: "center" },
        border: { bottom: { style: "medium", color: { rgb: "1E4070" } } },
      };
      const styleSubtitle = {
        font: { sz: 9, color: { rgb: "5A8AAA" }, name: "Courier New" },
        fill: { fgColor: { rgb: "050A0F" }, patternType: "solid" },
        alignment: { horizontal: "left" },
      };
      const styleHeader = {
        font: {
          bold: true,
          sz: 9,
          color: { rgb: "00D4FF" },
          name: "Courier New",
        },
        fill: { fgColor: { rgb: "0D1828" }, patternType: "solid" },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "medium", color: { rgb: "00D4FF" } },
          bottom: { style: "medium", color: { rgb: "00D4FF" } },
          left: { style: "thin", color: { rgb: "1E4070" } },
          right: { style: "thin", color: { rgb: "1E4070" } },
        },
      };

      const applyStyle = (cellAddr, style) => {
        if (!ws[cellAddr]) return;
        ws[cellAddr].s = style;
      };

      // Estilos en título y subtítulo
      applyStyle("A1", styleTitle);
      applyStyle("A2", styleSubtitle);

      // Estilos en encabezados (fila 4, índice 3)
      ["A4", "B4", "C4", "D4", "E4"].forEach((addr) =>
        applyStyle(addr, styleHeader),
      );

      // Estilos en filas de datos
      const dataStart = 5; // fila 5 (índice 4)
      HIST.records.forEach((r, i) => {
        const row = dataStart + i;
        const isEven = i % 2 === 0;
        const fillColor = isEven ? "050A0F" : "090E15";
        const borderColor = "1A2D45";

        const baseStyle = {
          font: { sz: 8.5, color: { rgb: "C8E6F5" }, name: "Courier New" },
          fill: { fgColor: { rgb: fillColor }, patternType: "solid" },
          border: {
            top: { style: "hair", color: { rgb: borderColor } },
            bottom: { style: "hair", color: { rgb: borderColor } },
            left: { style: "hair", color: { rgb: borderColor } },
            right: { style: "hair", color: { rgb: borderColor } },
          },
          alignment: { vertical: "center" },
        };

        // # — centrado, tenue
        applyStyle(`A${row}`, {
          ...baseStyle,
          font: { ...baseStyle.font, color: { rgb: "5A8AAA" } },
          alignment: { ...baseStyle.alignment, horizontal: "center" },
        });

        // Expresión — cyan
        applyStyle(`B${row}`, {
          ...baseStyle,
          font: { ...baseStyle.font, color: { rgb: "00D4FF" }, bold: true },
        });

        // Resultado — verde + fondo oscuro especial
        applyStyle(`C${row}`, {
          ...baseStyle,
          font: { ...baseStyle.font, color: { rgb: "00FF88" }, bold: true },
          fill: { fgColor: { rgb: "002A14" }, patternType: "solid" },
          alignment: { ...baseStyle.alignment, horizontal: "center" },
        });

        // Modo — naranja, centrado
        const modeColors = {
          BASIC: "FF6B2B",
          ALGEBRA: "A855F7",
          STATS: "FFD700",
          DERIVE: "FF6B2B",
          INTEGRAL: "00D4FF",
        };
        const modeColor = modeColors[r.mode.toUpperCase()] || "C8E6F5";
        applyStyle(`D${row}`, {
          ...baseStyle,
          font: { ...baseStyle.font, color: { rgb: modeColor }, bold: true },
          alignment: { ...baseStyle.alignment, horizontal: "center" },
        });

        // Fecha — tenue
        applyStyle(`E${row}`, {
          ...baseStyle,
          font: { ...baseStyle.font, color: { rgb: "5A8AAA" }, sz: 7.5 },
        });
      });

      /* ── HOJA 2: ESTADÍSTICAS ── */
      const modes = HIST.records.reduce((acc, r) => {
        acc[r.mode] = (acc[r.mode] || 0) + 1;
        return acc;
      }, {});
      const statsData = [
        ["QuantumCalc — Estadísticas del Historial"],
        [""],
        ["MÉTRICA", "VALOR"],
        ["Total de operaciones", HIST.records.length],
        [
          "Primera operación",
          HIST.records.length > 0
            ? HIST.records[HIST.records.length - 1].date
            : "-",
        ],
        [
          "Última operación",
          HIST.records.length > 0 ? HIST.records[0].date : "-",
        ],
        [""],
        ["DISTRIBUCIÓN POR MODO", ""],
        ...Object.entries(modes).map(([m, n]) => [m.toUpperCase(), n]),
      ];

      const ws2 = XLSX.utils.aoa_to_sheet(statsData);
      ws2["!cols"] = [{ wch: 30 }, { wch: 20 }];
      ws2["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
      applyStyleOnSheet(ws2, "A1", styleTitle);
      applyStyleOnSheet(ws2, "A3", styleHeader);
      applyStyleOnSheet(ws2, "B3", styleHeader);

      /* ── WORKBOOK ── */
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Historial");
      XLSX.utils.book_append_sheet(wb, ws2, "Estadísticas");

      /* Propiedades del archivo */
      wb.Props = {
        Title: "QuantumCalc — Historial de Cálculos",
        Author: "QuantumCalc v2.5.0",
        Company: "QuantumCalc",
        CreatedDate: new Date(),
      };

      const filename = `QuantumCalc_Historial_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);

      hideExportSpinner(spinner);
      showToast("Excel exportado correctamente", "success");
    } catch (e) {
      hideExportSpinner(spinner);
      showToast("Error generando Excel: " + e.message, "error");
      console.error(e);
    }
  }, 120);
}

/* Helper para aplicar estilo en hoja distinta */
function applyStyleOnSheet(ws, addr, style) {
  if (ws[addr]) ws[addr].s = style;
}

/* ─────────────────────────────────────────────────────────────────
   OVERLAY DE EXPORTACIÓN (spinner)
   ───────────────────────────────────────────────────────────────── */
function showExportSpinner(text) {
  const el = document.createElement("div");
  el.className = "export-spinner";
  el.id = "export-spinner";
  el.innerHTML = `
    <div class="export-spinner-ring"></div>
    <div class="export-spinner-text">${escHtml(text)}</div>
  `;
  document.body.appendChild(el);
  gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2 });
  return el;
}

function hideExportSpinner(el) {
  if (!el) return;
  gsap.to(el, { opacity: 0, duration: 0.25, onComplete: () => el.remove() });
}
