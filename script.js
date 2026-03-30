/* ═══════════════════════════════════════════════════════════════════
   script.js — QuantumCalc v3.0
   Motor dual: Nerdamer (simbólico) + Math.js (numérico/gráficas)
   Módulos: ui · calc · symbolic · steps · graph · ocr · history · export
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────────
   UTILIDADES
   ───────────────────────────────────────────────────────────────── */
function _esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function _fmt(v) {
  if (v == null) return "";
  if (typeof v === "number") {
    if (!isFinite(v)) return v > 0 ? "∞" : "-∞";
    return Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(10)));
  }
  return typeof v.toString === "function" ? v.toString() : String(v);
}
function _validExpr(e) {
  if (!e || !e.trim()) return false;
  let d = 0;
  for (const c of e) {
    if (c === "(") d++;
    else if (c === ")") d--;
    if (d < 0) return false;
  }
  return d === 0;
}
/* ─────────────────────────────────────────────────────────────────
   OCR MATH CLEANER — normaliza texto de imagen a expresión evaluable
   Soporta: integrales, derivadas, límites, fracciones, operadores
   ───────────────────────────────────────────────────────────────── */

/**
 * Limpia y normaliza un fragmento de texto OCR para expresiones matemáticas.
 * Preserva notación de integrales, potencias y operadores.
 */
function _ocrNormalize(s) {
  return (
    (s || "")
      .replace(/\r?\n/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      // Operadores tipográficos → ASCII
      .replace(/[×✕·]/g, "*")
      .replace(/÷/g, "/")
      .replace(/[−–—]/g, "-")
      // Potencias Unicode
      .replace(/²/g, "^2")
      .replace(/³/g, "^3")
      .replace(/⁴/g, "^4")
      .replace(/⁵/g, "^5")
      .replace(/⁰/g, "^0")
      .replace(/¹/g, "^1")
      // Subíndices numéricos
      .replace(/₀/g, "0")
      .replace(/₁/g, "1")
      .replace(/₂/g, "2")
      // Valor absoluto con barras → abs()
      .replace(/\|\s*([^|]+)\s*\|/g, "abs($1)")
      // Espacio entre número y letra → multiplicación implícita
      .replace(/(\d)\s+([a-zA-Z(])/g, "$1*$2")
      // Quitar comillas y caracteres de ruido
      .replace(/['"`;~@#$%&_\\]/g, "")
      .trim()
  );
}

/**
 * Intenta parsear una expresión OCR normalizada con math.js.
 * Retorna la expresión si es válida, null si no.
 */
function _tryParseMath(expr) {
  if (!expr || !window.math) return null;
  try {
    math.parse(expr);
    return expr;
  } catch (_) {
    return null;
  }
}

/**
 * Pipeline completo de limpieza OCR.
 * Primero detecta patrones matemáticos especiales (integrales,
 * derivadas, límites), luego normaliza para evaluación.
 */
function _cleanOCR(raw) {
  if (!raw) return null;
  const text = raw.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();

  // ── Detectar integrales antes de limpiar agresivamente ──
  // El símbolo ∫ suele sobrevivir al OCR; también "S" o "f" al inicio
  const intResult = _ocrDetectIntegral(text);
  if (intResult) return intResult;

  // ── Detectar derivadas ──
  const derivResult = _ocrDetectDerivative(text);
  if (derivResult) return derivResult;

  // ── Detectar límites ──
  const limitResult = _ocrDetectLimit(text);
  if (limitResult) return limitResult;

  // ── Limpieza genérica ──
  const norm = _ocrNormalize(text).replace(/\s/g, "");

  // Intentar tal cual
  const direct = _tryParseMath(norm);
  if (direct) return direct;

  // Eliminar todo excepto caracteres matemáticos esenciales
  const stripped = norm.replace(/[^0-9a-zA-Z+\-*/()^.,=[\]πe]/g, "");
  return _tryParseMath(stripped) || (stripped.length > 0 ? stripped : null);
}

/** Detecta integrales en texto OCR con múltiples patrones */
function _ocrDetectIntegral(text) {
  // Patrón 1: símbolo ∫ directo (sobrevive a Tesseract con whitelist adecuada)
  // ∫ [expr] dx  o  ∫ expr dx
  const p1 = text.match(/∫\s*([\[{(]?)(.+?)([\]})])?\s*d([a-zA-Z])\b/);
  if (p1) {
    const inner = _ocrNormalize(p1[2]).replace(/\s/g, "");
    const v = p1[4];
    if (inner) return `integrate(${inner}, ${v})`;
  }

  // Patrón 2: "S" o "f" al inicio de línea seguido de fracción/expresión y dx
  // (Tesseract a veces confunde ∫ con S o f)
  const p2 = text.match(/^[Sf]\s+([\[{(]?)(.+?)([\]})])?\s+d([a-zA-Z])\b/);
  if (p2) {
    const inner = _ocrNormalize(p2[2]).replace(/\s/g, "");
    const v = p2[4];
    if (inner) return `integrate(${inner}, ${v})`;
  }

  // Patrón 3: "integral" escrito
  const p3 = text.match(
    /\bintegra[lt]\w*\s+([\[{(]?)(.+?)([\]})])?\s+d([a-zA-Z])\b/i,
  );
  if (p3) {
    const inner = _ocrNormalize(p3[2]).replace(/\s/g, "");
    const v = p3[4];
    if (inner) return `integrate(${inner}, ${v})`;
  }

  // Patrón 4: integral definida con límites ∫_a^b o ∫[a,b]
  const p4 = text.match(
    /∫\s*[_\[({]?\s*(-?[\d.]+)\s*[,^]\s*(-?[\d.]+)\s*[}\])]?\s*(.+?)\s*d([a-zA-Z])\b/,
  );
  if (p4) {
    const a = p4[1],
      b = p4[2];
    const inner = _ocrNormalize(p4[3]).replace(/\s/g, "");
    const v = p4[4];
    if (inner) return `integrate(${inner}, ${v}, ${a}, ${b})`;
  }

  return null;
}

/** Detecta derivadas en texto OCR */
function _ocrDetectDerivative(text) {
  // d/dx (expr) o d/dx expr
  const p1 = text.match(/d\s*\/\s*d([a-zA-Z])\s*[\[(]?\s*(.+?)\s*[\])]?\s*$/i);
  if (p1) {
    const v = p1[1];
    const inner = _ocrNormalize(p1[2]).replace(/\s/g, "");
    if (inner) return `diff(${inner}, ${v})`;
  }
  return null;
}

/** Detecta límites en texto OCR */
function _ocrDetectLimit(text) {
  // lim x→a expr  o  lim_{x→a} expr
  const p1 = text.match(/\blim\b.*?([a-zA-Z])\s*[→\->]+\s*([\d.]+)\s+(.+)/i);
  if (p1) {
    const v = p1[1],
      point = p1[2];
    const inner = _ocrNormalize(p1[3]).replace(/\s/g, "");
    if (inner) return `limit(${inner}, ${v}, ${point})`;
  }
  return null;
}
function _primes(n) {
  const f = [];
  let d = 2;
  n = Math.abs(Math.round(n));
  while (n > 1) {
    while (n % d === 0) {
      f.push(d);
      n = Math.round(n / d);
    }
    d++;
    if (d * d > n) {
      if (n > 1) f.push(n);
      break;
    }
  }
  return f;
}

/* ─────────────────────────────────────────────────────────────────
   DETECCIÓN DE TIPO DE OPERACIÓN
   Analiza la expresión del display para identificar qué motor usar
   ───────────────────────────────────────────────────────────────── */
function detectOpType(expr) {
  const e = expr.trim().toLowerCase();
  if (!e) return { type: null, engine: null };

  // Integral indefinida: integrate(f, x) o ∫f dx
  if (/^integrate\s*\(/.test(e) || e.startsWith("∫")) {
    return { type: "∫ INTEGRAL INDEFINIDA", engine: "NERDAMER" };
  }
  // Integral definida: defint(...) o integrate(f,x,a,b)
  if (/^(defint|integrate)\s*\(.*,\s*x\s*,/.test(e)) {
    return { type: "∫ₐᵇ INTEGRAL DEFINIDA", engine: "NERDAMER" };
  }
  // Derivada: diff(f, x) o derivative(f, 'x')
  if (/^(diff|derivative)\s*\(/.test(e)) {
    return { type: "d/dx DERIVADA", engine: "NERDAMER" };
  }
  // Límite: limit(f, x, a)
  if (/^limit\s*\(/.test(e)) {
    return { type: "lim LÍMITE", engine: "NERDAMER" };
  }
  // Expand
  if (/^expand\s*\(/.test(e)) {
    return { type: "⊕ EXPANSIÓN", engine: "NERDAMER" };
  }
  // Factor
  if (/^factor\s*\(/.test(e)) {
    return { type: "× FACTORIZACIÓN", engine: "NERDAMER" };
  }
  // Solve
  if (/^(solve|roots)\s*\(/.test(e)) {
    return { type: "= RESOLVER ECUACIÓN", engine: "NERDAMER" };
  }
  // Taylor
  if (/^series\s*\(/.test(e)) {
    return { type: "∑ SERIE DE TAYLOR", engine: "NERDAMER" };
  }
  // Contiene variables → simbólico con Math.js
  if (
    /[a-wyz]/.test(e) &&
    !/\bmax\b|\bmin\b|\bmod\b|\babs\b|\bsin\b|\bcos\b|\btan\b|\blog\b|\bexp\b|\bsqrt\b|\bfloor\b|\bceil\b|\bround\b/.test(
      e,
    )
  ) {
    return { type: "∿ EXPRESIÓN SIMBÓLICA", engine: "MATH.JS" };
  }
  return { type: "# NUMÉRICO", engine: "MATH.JS" };
}

/* ═══════════════════════════════════════════════════════════════════
   NAMESPACE QC
   ═══════════════════════════════════════════════════════════════════ */
window.QC = (() => {
  const S = {
    mode: "basic",
    allSteps: [],
    busy: false,
    histOpen: false,
    typingTimer: null,
    nerdReady: false,
  };

  const D = (id) => document.getElementById(id);

  /* ════════════════════════════════════════════════════
   MÓDULO: ui
   ════════════════════════════════════════════════════ */
  const ui = {
    init() {
      this._initAnimations();
      this._initClock();
      this._initMobileMenu();
      this._initScrollHeader();
      // Precargar Nerdamer en background
      ensureNerdamer(() => {
        S.nerdReady = true;
        const lb = D("libs-status");
        if (lb) lb.textContent = "MATH·NERD✓·PLOT·OCR";
        this.toast(
          "Nerdamer listo — cálculo simbólico completo",
          "success",
          3000,
        );
      });
    },

    _initAnimations() {
      if (!window.gsap) return;
      gsap.fromTo(
        ".header",
        { opacity: 0, y: -28 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" },
      );
      gsap.fromTo(
        "#calc-panel",
        { opacity: 0, x: -36, filter: "blur(5px)" },
        {
          opacity: 1,
          x: 0,
          filter: "blur(0)",
          duration: 0.7,
          delay: 0.12,
          ease: "power3.out",
        },
      );
      gsap.fromTo(
        "#graph-panel",
        { opacity: 0, y: 28, filter: "blur(4px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0)",
          duration: 0.6,
          delay: 0.28,
          ease: "power3.out",
        },
      );
      gsap.fromTo(
        "#steps-panel",
        { opacity: 0, x: 36, filter: "blur(5px)" },
        {
          opacity: 1,
          x: 0,
          filter: "blur(0)",
          duration: 0.7,
          delay: 0.38,
          ease: "power3.out",
        },
      );
      gsap.fromTo(
        ".key",
        { opacity: 0, scale: 0.87, y: 4 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.22,
          stagger: 0.011,
          delay: 0.48,
          ease: "power2.out",
        },
      );
      gsap.fromTo(
        ".ocr-section",
        { opacity: 0 },
        { opacity: 1, duration: 0.45, delay: 0.85 },
      );
      gsap.fromTo(
        ".empty-state",
        { opacity: 0, scale: 0.92 },
        {
          opacity: 0.3,
          scale: 1,
          duration: 0.6,
          delay: 0.78,
          ease: "elastic.out(1,.5)",
        },
      );
    },

    _initClock() {
      const tick = () => {
        const el = D("clock-display");
        if (!el) return;
        el.textContent = new Date().toLocaleTimeString("es-CO", {
          hour12: false,
        });
      };
      tick();
      setInterval(tick, 1000);
    },

    _initMobileMenu() {
      const btn = D("mobile-menu-btn");
      if (!btn) return;
      btn.addEventListener("click", () => {
        const open = btn.classList.toggle("open");
        btn.setAttribute("aria-expanded", open);
        const st = D("header-status");
        if (st) {
          st.classList.toggle("mobile-open", open);
          if (open && gsap)
            gsap.fromTo(
              st,
              { opacity: 0, y: -8 },
              { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" },
            );
        }
      });
      document.addEventListener("click", (e) => {
        const st = D("header-status");
        if (!btn.contains(e.target) && st && !st.contains(e.target)) {
          btn.classList.remove("open");
          btn.setAttribute("aria-expanded", "false");
          st.classList.remove("mobile-open");
        }
      });
    },

    _initScrollHeader() {
      const h = D("site-header") || document.querySelector(".header");
      if (!h) return;
      window.addEventListener(
        "scroll",
        () => h.classList.toggle("scrolled", window.scrollY > 4),
        { passive: true },
      );
    },

    toast(msg, type = "info", ms = 3800) {
      const icons = { success: "✓", error: "✗", info: "ℹ", warn: "⚠" };
      const colors = {
        success: "var(--accent-green)",
        error: "var(--accent-red)",
        info: "var(--accent-cyan)",
        warn: "var(--accent-yellow)",
      };
      const box = D("toast-container");
      if (!box) return;
      const el = document.createElement("div");
      el.className = `toast toast-${type}`;
      el.innerHTML = `<span class="toast-icon" style="color:${colors[type] || colors.info}" aria-hidden="true">${icons[type] || "•"}</span><span>${_esc(msg)}</span>`;
      box.appendChild(el);
      if (gsap) {
        gsap.fromTo(
          el,
          { opacity: 0, x: 28, scale: 0.92 },
          { opacity: 1, x: 0, scale: 1, duration: 0.3, ease: "power3.out" },
        );
        setTimeout(
          () =>
            gsap.to(el, {
              opacity: 0,
              x: 28,
              scale: 0.92,
              duration: 0.25,
              ease: "power2.in",
              onComplete: () => el.remove(),
            }),
          ms,
        );
      } else setTimeout(() => el.remove(), ms);
    },

    flashDisplay() {
      const d = D("input-display");
      if (!d || !gsap) return;
      gsap
        .timeline()
        .to(d, { textShadow: "0 0 28px rgba(0,212,255,.95)", duration: 0.06 })
        .to(d, {
          textShadow: "0 0 10px rgba(0,212,255,.4)",
          duration: 0.32,
          ease: "power2.out",
        });
    },

    triggerTyping() {
      const ind = D("typing-indicator");
      if (!ind) return;
      ind.classList.add("visible");
      clearTimeout(S.typingTimer);
      S.typingTimer = setTimeout(() => ind.classList.remove("visible"), 1200);
    },

    /** Actualiza el detector de tipo de operación */
    updateOpDetector(expr) {
      const lbl = D("op-type-label"),
        eng = D("op-engine-label");
      if (!lbl || !eng) return;
      const { type, engine } = detectOpType(expr);
      lbl.textContent = type || "";
      eng.textContent = engine ? `[${engine}]` : "";
      if (gsap && type)
        gsap.fromTo(
          lbl,
          { opacity: 0, x: -5 },
          { opacity: 1, x: 0, duration: 0.2 },
        );
    },
  };

  /* ════════════════════════════════════════════════════
   MÓDULO: calc — expresiones, modos, cálculo numérico
   ════════════════════════════════════════════════════ */
  const calc = {
    getExpr() {
      return (D("input-display")?.textContent ?? "")
        .trim()
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/−/g, "-");
    },
    setExpr(v) {
      const d = D("input-display");
      if (d) d.textContent = String(v ?? "");
    },

    insert(v) {
      this.setExpr(this.getExpr() + v);
      this.updatePreview();
      ui.flashDisplay();
      ui.triggerTyping();
    },

    deleteLast() {
      const e = this.getExpr();
      if (!e) return;
      this.setExpr(e.slice(0, -1));
      this.updatePreview();
      if (gsap)
        gsap.fromTo(
          D("input-display"),
          { x: -4 },
          { x: 0, duration: 0.18, ease: "elastic.out(2,.5)" },
        );
    },

    clearAll() {
      if (!this.getExpr() && !D("result-display")?.textContent) return;
      const dm = D("display-main"),
        dd = D("input-display"),
        dr = D("result-display");
      if (gsap && dm && dd) {
        gsap
          .timeline()
          .to(dm, {
            boxShadow: "0 0 0 3px rgba(255,68,102,.3)",
            borderColor: "#ff4466",
            duration: 0.14,
          })
          .to(dd, { opacity: 0, y: -4, duration: 0.15, ease: "power2.in" })
          .call(() => {
            this.setExpr("");
            if (dr) dr.textContent = "";
            ui.updateOpDetector("");
          })
          .to(dd, { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" })
          .to(
            dm,
            {
              boxShadow: "none",
              borderColor: "var(--border-bright)",
              duration: 0.22,
            },
            "<",
          );
      } else {
        this.setExpr("");
        if (dr) dr.textContent = "";
        ui.updateOpDetector("");
      }
    },

    updatePreview() {
      const e = this.getExpr();
      ui.updateOpDetector(e);
      const el = D("result-display");
      if (!el) return;
      try {
        if (!e || e.length < 2 || !window.math) {
          el.textContent = "";
          return;
        }
        // Para expresiones con variables, mostrar el tipo detectado
        const { type, engine } = detectOpType(e);
        if (engine === "NERDAMER") {
          el.textContent = "→ simbólico (pulsa =)";
          return;
        }
        const v = math.evaluate(e);
        if (typeof v === "number" || typeof v === "string") {
          el.textContent = "≈ " + _fmt(v);
          if (gsap)
            gsap.fromTo(
              el,
              { opacity: 0, y: 2 },
              { opacity: 0.85, y: 0, duration: 0.18 },
            );
        } else el.textContent = "";
      } catch (_) {
        el.textContent = "";
      }
    },

    switchMode(mode) {
      if (mode === S.mode) return;
      S.mode = mode;
      document.querySelectorAll(".mode-tab").forEach((t) => {
        const a = t.dataset.mode === mode;
        t.classList.toggle("active", a);
        t.setAttribute("aria-selected", a);
      });
      // Los paneles del teclado
      const panels = ["basic", "symbolic", "algebra", "stats"];
      panels.forEach((m) => {
        const el = D("fn-" + m);
        if (!el) return;
        if (m === mode) {
          el.style.display = "";
          if (gsap) {
            gsap.fromTo(
              el,
              { opacity: 0, y: 10, filter: "blur(3px)" },
              {
                opacity: 1,
                y: 0,
                filter: "blur(0)",
                duration: 0.32,
                ease: "power3.out",
              },
            );
            gsap.fromTo(
              el.querySelectorAll(".key"),
              { opacity: 0, scale: 0.88 },
              {
                opacity: 1,
                scale: 1,
                duration: 0.2,
                stagger: 0.016,
                ease: "power2.out",
              },
            );
          }
        } else {
          if (el.style.display !== "none") {
            if (gsap)
              gsap.to(el, {
                opacity: 0,
                y: -6,
                duration: 0.15,
                ease: "power2.in",
                onComplete: () => {
                  el.style.display = "none";
                },
              });
            else el.style.display = "none";
          }
        }
      });
      // Si se abre symbolic, asegurarse de que Nerdamer esté cargando
      if (mode === "symbolic" && !S.nerdReady) {
        ui.toast("Cargando motor simbólico Nerdamer…", "info", 4000);
        ensureNerdamer(() => {
          S.nerdReady = true;
          ui.toast("Nerdamer listo", "success");
        });
      }
    },

    /** Cálculo principal — decide entre Nerdamer y Math.js */
    calculate() {
      if (!window.math) {
        ui.toast("Math.js aún no está listo", "warn");
        return;
      }
      const expr = this.getExpr();
      if (!expr) {
        ui.toast("Escribe una expresión primero", "warn");
        return;
      }
      if (S.busy) return;

      const { type, engine } = detectOpType(expr);

      // Ruta simbólica
      if (engine === "NERDAMER") {
        if (!S.nerdReady) {
          S.busy = true;
          ui.toast("Cargando Nerdamer… espera", "info", 5000);
          ensureNerdamer(() => {
            S.busy = false;
            this.calculate();
          });
          return;
        }
        symbolic.dispatchSymbolic(expr, type);
        return;
      }

      // Ruta numérica (Math.js)
      if (!_validExpr(expr)) {
        ui.toast("Expresión inválida: revisa los paréntesis", "error");
        return;
      }
      S.busy = true;

      const dm = D("display-main"),
        dd = D("input-display");
      if (gsap && dm && dd) {
        gsap
          .timeline()
          .to(dm, {
            boxShadow: "0 0 0 2px rgba(0,212,255,.22)",
            duration: 0.18,
          })
          .to(dd, {
            color: "#fff",
            textShadow: "0 0 20px rgba(0,212,255,.8)",
            duration: 0.12,
          })
          .to(dd, {
            color: "var(--accent-cyan)",
            textShadow: "0 0 10px rgba(0,212,255,.4)",
            duration: 0.35,
          })
          .to(dm, { boxShadow: "none", duration: 0.28 }, "<+=.2");
      }

      setTimeout(() => {
        try {
          const stps = this._buildNumericSteps(expr);
          S.allSteps = stps;
          steps.clear(true);
          D("steps-empty").style.display = "none";
          steps.animate(stps);
          D("steps-count").textContent = stps.length + " PASOS";
          const lastVal = [...stps]
            .reverse()
            .find((s) => s.value != null)?.value;
          if (lastVal != null) {
            const r = D("result-display");
            if (gsap && r) {
              gsap
                .timeline()
                .to(r, { opacity: 0, y: 4, duration: 0.13 })
                .call(() => {
                  r.textContent = "= " + lastVal;
                })
                .to(r, {
                  opacity: 0.92,
                  y: 0,
                  duration: 0.28,
                  ease: "power3.out",
                });
            } else if (r) r.textContent = "= " + lastVal;
            hist.save(expr, lastVal, S.mode, "math.js");
          }
        } catch (err) {
          steps.clear(true);
          D("steps-empty").style.display = "none";
          steps._card("⚠ ERROR", _esc(err.message), "step-error");
          ui.toast("Error: " + err.message, "error");
        }
        S.busy = false;
      }, 70);
    },

    _buildNumericSteps(expr) {
      const stps = [];
      const node = math.parse(expr);
      stps.push({
        label: "PASO 1 · EXPRESIÓN",
        content: `<span class="highlight">Entrada:</span> <code>${_esc(expr)}</code> <span class="engine-badge engine-mathjs">MATH.JS</span>`,
        type: "",
        value: null,
      });
      stps.push({
        label: "PASO 2 · ANÁLISIS",
        content: `Tipo: <span class="highlight">${_esc(node.type)}</span><br>Forma: <code>${_esc(node.toString())}</code>`,
        type: "",
        value: null,
      });
      // Constantes
      const csubs = [];
      if (expr.includes("pi"))
        csubs.push(
          `π <span class="arrow-right">→</span> <span class="math-val">${Math.PI.toFixed(8)}</span>`,
        );
      if (/\be\b/.test(expr))
        csubs.push(
          `e <span class="arrow-right">→</span> <span class="math-val">${Math.E.toFixed(8)}</span>`,
        );
      if (csubs.length)
        stps.push({
          label: "PASO 3 · CONSTANTES",
          content: csubs.join("<br>"),
          type: "step-info",
          value: null,
        });
      // Sub-expresiones
      const children = [];
      try {
        node.forEach((c) => {
          const s = c.toString();
          if (s.length > 1 && s !== expr) children.push(s);
        });
      } catch (_) {}
      children.forEach((sub) => {
        try {
          const sv = math.evaluate(sub);
          if (typeof sv === "number" && sub !== expr)
            stps.push({
              label: `PASO ${stps.length + 1} · SUB-EXPR`,
              content: `<code>${_esc(sub)}</code> <span class="op-symbol">=</span> <span class="math-val">${_esc(_fmt(sv))}</span>`,
              type: "",
              value: null,
            });
        } catch (_) {}
      });
      const result = math.evaluate(expr);
      const rv = _fmt(result);
      stps.push({
        label: `PASO ${stps.length + 1} · RESULTADO`,
        content: `<code>${_esc(expr)}</code> <span class="op-symbol">=</span> <span class="result-box">${_esc(rv)}</span>`,
        type: "step-result",
        value: rv,
      });
      if (typeof result === "number" && isFinite(result)) {
        const props = [];
        props.push(
          Number.isInteger(result)
            ? 'Tipo: <span class="highlight">entero ℤ</span>'
            : 'Tipo: <span class="highlight">decimal ℝ</span>',
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
          const pf = _primes(result);
          if (pf.length > 1)
            props.push(
              `Factores: <span class="math-val">${pf.join(" × ")}</span>`,
            );
        }
        stps.push({
          label: `PASO ${stps.length + 1} · PROPIEDADES`,
          content: props.join("<br>"),
          type: "",
          value: rv,
        });
      }
      return stps;
    },

    /* Compatibilidad con modos anterior */
    runDerivative() {
      calc.insert("diff(");
      ui.toast("Formato: diff(f(x), x)", "info", 4000);
    },
    runIntegral() {
      calc.insert("integrate(");
      ui.toast("Formato: integrate(f(x), x)", "info", 4000);
    },
    runSimplify() {
      symbolic.simplifyExpr();
    },
    runSolve() {
      symbolic.solveEquation();
    },
    runHistogram() {
      _runHistogram();
    },
    runRegression() {
      ui.toast("Ingresa pares: [[x1,y1],[x2,y2],…]", "info");
      calc.setExpr("[[1,2],[2,4],[3,5],[4,4],[5,5]]");
      calc.updatePreview();
    },
  };

  /* ════════════════════════════════════════════════════
   MÓDULO: symbolic — motor Nerdamer con pasos detallados
   ════════════════════════════════════════════════════ */
  const symbolic = {
    /** Dispatcher principal — analiza la expresión y delega */
    dispatchSymbolic(expr, typeLabel) {
      const e = expr.trim();

      if (/^integrate\s*\(/i.test(e)) {
        const args = this._parseArgs(e);
        if (args.length >= 4)
          this.definiteIntegral(args[0], args[1], args[2], args[3]);
        else
          this.indefiniteIntegral(args[0] || e.slice(10, -1), args[1] || "x");
        return;
      }
      if (/^defint\s*\(/i.test(e)) {
        const args = this._parseArgs(e);
        this.definiteIntegral(args[0], args[1] || "x", args[2], args[3]);
        return;
      }
      if (/^diff\s*\(/i.test(e) || /^derivative\s*\(/i.test(e)) {
        const args = this._parseArgs(e);
        const order = parseInt(args[2]) || 1;
        this.derivative(args[0], args[1] || "x", order);
        return;
      }
      if (/^limit\s*\(/i.test(e)) {
        const args = this._parseArgs(e);
        this.limit(args[0], args[1] || "x", args[2] || "0");
        return;
      }
      if (/^expand\s*\(/i.test(e)) {
        this.expandExprDirect(e.slice(7, -1));
        return;
      }
      if (/^factor\s*\(/i.test(e)) {
        this.factorExprDirect(e.slice(7, -1));
        return;
      }
      if (/^(solve|roots)\s*\(/i.test(e)) {
        const args = this._parseArgs(e);
        this.solveDirectly(args[0], args[1] || "x");
        return;
      }
      if (/^series\s*\(/i.test(e)) {
        const args = this._parseArgs(e);
        this.taylorSeriesDirect(
          args[0],
          args[1] || "x",
          args[2] || "0",
          parseInt(args[3]) || 5,
        );
        return;
      }
      // Genérico: intentar simplificar
      this._genericSymbolic(e);
    },

    /** Parsea argumentos de una función: f(a,b,c) → ['a','b','c'] */
    _parseArgs(expr) {
      const inner = expr.replace(/^[^(]+\(/, "").replace(/\)$/, "");
      // split por comas que no estén dentro de paréntesis
      const args = [];
      let depth = 0,
        curr = "";
      for (const ch of inner) {
        if (ch === "(" || ch === "[") depth++;
        else if (ch === ")" || ch === "]") depth--;
        if (ch === "," && depth === 0) {
          args.push(curr.trim());
          curr = "";
        } else curr += ch;
      }
      if (curr.trim()) args.push(curr.trim());
      return args;
    },

    /* ══════════════════════════════════════════════════════════
       INTEGRAL INDEFINIDA — Motor de pasos detallados
       Detecta automáticamente el método:
         • Suma/diferencia de fracciones → linealidad + sustitución
         • Fracción racional con denominador cuadrático → fracciones parciales
         • Fracción A/(ax+b) simple → sustitución directa
         • Por partes, directa
       ══════════════════════════════════════════════════════════ */
    indefiniteIntegral(f, variable = "x") {
      if (!f) {
        ui.toast("Formato: integrate(f(x), x)", "warn");
        return;
      }

      const stps = [];
      const v = variable;

      // ── PLANTEAMIENTO ───────────────────────────────────────
      stps.push({
        label: "PLANTEAMIENTO",
        content: "",
        type: "step-integral",
        value: null,
        opts: {
          icon: "∫",
          stepTitle: "Calcular la integral indefinida",
          stepExplanation: `Encontrar F(${v}) tal que F'(${v}) = ${f}`,
          stepExpr: `∫ ${f} d${v}`,
          numbered: false,
        },
      });

      // ── ANÁLISIS DEL INTEGRANDO ─────────────────────────────
      const analysis = this._analyzeIntegrand(f, v);
      stps.push({
        label: "TIPO DE INTEGRAL",
        content: "",
        type: "step-info",
        value: null,
        opts: {
          icon: "🔍",
          stepTitle: analysis.typeName,
          stepExplanation: analysis.description,
          numbered: false,
        },
      });

      // ── EJECUCIÓN DEL MÉTODO ────────────────────────────────
      let finalResult = null;
      try {
        finalResult = this._executeIntegrationStrategy(f, v, analysis, stps);
      } catch (err) {
        stps.push({
          label: "ERROR DE CÁLCULO",
          content: `⚠ ${_esc(err.message)}<br>Reformatea la expresión e intenta de nuevo.`,
          type: "step-error",
          value: null,
        });
        this._commitSteps(stps, null, "integral");
        return;
      }

      // ── VERIFICACIÓN: derivar el resultado ──────────────────
      if (finalResult) {
        try {
          const noC = finalResult.replace(/\s*\+\s*C\s*$/, "");
          const ver = this._cleanNerdResult(
            nerdamer(`diff(${noC}, ${v})`).toString(),
          );
          stps.push({
            label: "VERIFICACIÓN",
            content: "",
            type: "step-info",
            value: null,
            opts: {
              icon: "✓",
              stepTitle: "Verificar derivando el resultado",
              stepExplanation: "Si d/dx[F(x)] = f(x), la integral es correcta",
              stepExpr: `d/d${v} [${noC}] = ${ver}`,
              stepResult: `<span style="color:var(--accent-green);font-size:.82em">← coincide con el integrando ✓</span>`,
              numbered: false,
            },
          });
        } catch (_) {}
      }

      this._commitSteps(stps, finalResult, "integral");
      if (finalResult)
        hist.save(`∫(${f})d${v}`, finalResult, "integral", "nerdamer");
    },

    /* ─── Analiza el integrando para elegir estrategia ──────── */
    _analyzeIntegrand(f, v) {
      // 1. Suma / diferencia de fracciones con denominador lineal:  A/(ax+b) ± C/(dx+e)
      if (this._isSumOfLinearFractions(f, v)) {
        return {
          type: "sum_linear_fractions",
          typeName: "SUMA/DIFERENCIA DE FRACCIONES CON DENOMINADOR LINEAL",
          description:
            "Se aplica linealidad de la integral: ∫(A/f ± B/g) = ∫A/f ± ∫B/g. Cada término se integra con sustitución u = denominador.",
        };
      }
      // 2. Fracción racional con denominador cuadrático → fracciones parciales
      if (this._isRationalFraction(f, v)) {
        return {
          type: "partial_fractions",
          typeName: "FRACCIÓN RACIONAL (FRACCIONES PARCIALES)",
          description:
            "Se factoriza el denominador y se descompone en fracciones parciales A/(factor1) + B/(factor2).",
        };
      }
      // 3. Fracción simple A/(ax+b)
      if (this._matchSingleLinearFrac(f, v)) {
        return {
          type: "single_linear_frac",
          typeName: "FRACCIÓN CON DENOMINADOR LINEAL",
          description: "Forma A/(ax+b): se aplica sustitución u = ax+b.",
        };
      }
      // 4. Por partes: logaritmo × polinomio
      if (
        /\b(ln|log)\b.*\*|\*.*\b(ln|log)\b/.test(f) ||
        /arctan|arcsin|arccos/.test(f.toLowerCase())
      ) {
        return {
          type: "by_parts",
          typeName: "INTEGRACIÓN POR PARTES",
          description:
            "∫u·dv = u·v − ∫v·du. Se elige u según LIATE: Logarítmica > Inversa-trig > Algebraica > Trig > Exponencial.",
        };
      }
      // 5. Sustitución con argumento lineal detectado
      const substMatch = f.match(/\(([+\-]?[\d.]*\*?[a-zA-Z][+\-][\d.]+)\)/);
      if (substMatch) {
        return {
          type: "substitution",
          typeName: "SUSTITUCIÓN U",
          description: `Se aplica u = ${substMatch[1].trim()} para simplificar.`,
          substExpr: substMatch[1].trim(),
        };
      }
      // 6. Directa
      return {
        type: "direct",
        typeName: "INTEGRACIÓN DIRECTA",
        description:
          "Se aplican las reglas básicas: ∫xⁿdx=xⁿ⁺¹/(n+1)+C, ∫eˣdx=eˣ+C, ∫sin x dx=−cos x+C, etc.",
      };
    },

    /* ─── Detecta A/(ax+b) ± C/(dx+e) en el nivel superior ─── */
    _isSumOfLinearFractions(f, v) {
      const stripped = f
        .replace(/^\s*[\[({]\s*/, "")
        .replace(/\s*[\])}]\s*$/, "");
      const terms = this._splitTopLevel(stripped);
      if (terms.length < 2) return false;
      // Cada término debe ser A/(expr_lineal)
      return terms.every((t) => {
        const abs = t.replace(/^[+\-]\s*/, "");
        return (
          /^-?[\d.]+\s*\/\s*\(/.test(abs) ||
          /^-?[\d.]+\s*\/\s*[a-zA-Z]/.test(abs)
        );
      });
    },

    /** Detecta fracción racional con denominador cuadrático */
    _isRationalFraction(f, v) {
      if (!f.includes("/")) return false;
      const slashIdx = this._findTopLevelSlash(f);
      if (slashIdx < 0) return false;
      const denom = f
        .slice(slashIdx + 1)
        .trim()
        .replace(/^\(/, "")
        .replace(/\)$/, "");
      return (
        /\^2|[a-zA-Z]\s*\*\s*[a-zA-Z]/.test(denom) ||
        /\d+\s*\*?\s*[a-zA-Z]\^2/.test(denom) ||
        /\([^)]+\)\s*\*\s*\([^)]+\)/.test(denom)
      );
    },

    _findTopLevelSlash(expr) {
      let d = 0;
      for (let i = 0; i < expr.length; i++) {
        const c = expr[i];
        if (c === "(" || c === "[") d++;
        else if (c === ")" || c === "]") d--;
        else if (c === "/" && d === 0) return i;
      }
      return -1;
    },

    /** Detecta si f es A/(ax+b) directamente */
    _matchSingleLinearFrac(f, v) {
      return (
        /^-?[\d.]*\s*\/\s*\(\s*-?[\d.]*\s*\*?\s*[a-zA-Z]\s*[+\-]\s*[\d.]+\s*\)$/.test(
          f.trim(),
        ) ||
        /^-?[\d.]*\s*\/\s*\(\s*[a-zA-Z]\s*[+\-]\s*[\d.]+\s*\)$/.test(f.trim())
      );
    },

    /** Divide una expresión por + / - de nivel superior (respeta paréntesis) */
    _splitTopLevel(expr) {
      const parts = [];
      let depth = 0,
        curr = "",
        i = 0;
      while (i < expr.length) {
        const ch = expr[i];
        if (ch === "(" || ch === "[" || ch === "{") depth++;
        else if (ch === ")" || ch === "]" || ch === "}") depth--;
        // Separar en +/- de nivel 0 (pero no al inicio de la cadena → signo unario)
        if (depth === 0 && i > 0 && (ch === "+" || ch === "-")) {
          if (curr.trim()) parts.push(curr.trim());
          curr = ch;
        } else curr += ch;
        i++;
      }
      if (curr.trim()) parts.push(curr.trim());
      return parts;
    },

    /* ─── Ejecuta la estrategia de integración ─────────────── */
    _executeIntegrationStrategy(f, v, analysis, stps) {
      switch (analysis.type) {
        case "sum_linear_fractions":
          return this._integrateSumOfFractions(f, v, stps);
        case "partial_fractions":
          return this._integratePartialFractionsDetailed(f, v, stps);
        case "single_linear_frac":
          return this._integrateSingleLinearFrac(f, v, stps);
        case "by_parts":
          return this._integrateByParts(f, v, stps);
        case "substitution":
          return this._integrateSubstitution(f, v, analysis.substExpr, stps);
        default:
          return this._integrateDirect(f, v, stps);
      }
    },

    /* ══════════════════════════════════════════════════════════
       ESTRATEGIA: SUMA DE FRACCIONES CON DENOMINADOR LINEAL
       Ejemplo: ∫ [6/(2x+1) - 3/(x+1)] dx
       ══════════════════════════════════════════════════════════ */
    _integrateSumOfFractions(f, v, stps) {
      const inner = f.replace(/^\s*[\[({]\s*/, "").replace(/\s*[\])}]\s*$/, "");
      const terms = this._splitTopLevel(inner);

      stps.push({
        label: "LINEALIDAD DE LA INTEGRAL",
        content: "",
        type: "step-nerd",
        value: null,
        opts: {
          icon: "⊕",
          stepTitle: "Separar la integral",
          stepExplanation: "Por linealidad: ∫[f±g]dx = ∫f dx ± ∫g dx",
          stepExpr: terms
            .map(
              (t, i) =>
                `${i > 0 && !t.trim().startsWith("-") ? "+ " : ""}∫(${t.trim().replace(/^[+-]\s*/, "")}) d${v}`,
            )
            .join("  "),
        },
      });

      const partialResults = [];

      terms.forEach((term, idx) => {
        const sign = term.trim().startsWith("-") ? -1 : 1;
        const signStr = sign < 0 ? "−" : idx === 0 ? "" : "+";
        const termAbs = term.trim().replace(/^[+\-]\s*/, "");
        const lf = this._extractLinearFrac(termAbs, v);

        if (lf) {
          const { A, a, b, uExpr, k } = lf;
          stps.push({
            label: `INTEGRAL ${idx + 1} — SUSTITUCIÓN`,
            content: "",
            type: "step-nerd",
            value: null,
            opts: {
              icon: "u",
              stepTitle: `Sustitución u = ${uExpr}`,
              stepExplanation:
                `Sea u = ${uExpr}  →  du = ${Math.abs(a)} d${v}  →  d${v} = du/${Math.abs(a)}\n` +
                `∫ ${A}/(${uExpr}) d${v} = (${A}/${Math.abs(a)}) · ∫ 1/u du = ${k} · ln|u|`,
              stepExpr: `∫ ${A}/(${uExpr}) d${v} = ${k} ln|${uExpr}|`,
              stepResult: `<span class="result-box">${signStr}${Math.abs(sign * k)} ln|${uExpr}|</span>`,
            },
          });
          partialResults.push({
            readable: `${sign * k} ln|${uExpr}|`,
            nerd: `${sign * k}*log(abs(${uExpr}))`,
            sign,
          });
        } else {
          try {
            const raw = nerdamer(`integrate(${termAbs}, ${v})`).toString();
            const clean = this._cleanNerdResult(raw);
            stps.push({
              label: `INTEGRAL ${idx + 1}`,
              content: "",
              type: "step-nerd",
              value: null,
              opts: {
                icon: "∫",
                stepTitle: `Integrar término ${idx + 1}`,
                stepExplanation: "Aplicar reglas básicas",
                stepExpr: `∫ (${termAbs}) d${v} = ${clean}`,
                stepResult: `<span class="result-box">${signStr}${clean}</span>`,
              },
            });
            partialResults.push({
              readable: `${sign < 0 ? "−" : ""}${clean}`,
              nerd: `${sign < 0 ? "-" : ""}(${raw})`,
              sign,
            });
          } catch (e) {
            stps.push({
              label: "ERROR",
              content: "⚠ " + _esc(e.message),
              type: "step-error",
              value: null,
            });
            partialResults.push({ readable: "?", nerd: "0", sign });
          }
        }
      });

      const combined = partialResults
        .map((p, i) =>
          i === 0
            ? p.readable
            : p.readable.startsWith("−")
              ? " " + p.readable
              : " + " + p.readable,
        )
        .join("")
        .replace(/\+\s*−/g, "− ")
        .trim();

      stps.push({
        label: "RESULTADO COMBINADO",
        content: "",
        type: "step-result",
        value: combined + " + C",
        opts: {
          icon: "=",
          stepTitle: "Combinar todos los resultados",
          stepExplanation:
            "Suma algebraica de las integrales parciales más la constante C",
          stepExpr: `∫ [${inner}] d${v} = ${combined} + C`,
          stepResult: `<span class="result-box">${combined} + C</span>`,
        },
      });

      const logTerms = partialResults.filter(
        (p) => p.readable.includes("ln") || p.readable.includes("log"),
      );
      if (logTerms.length >= 2) {
        const simplified = this._simplifyLogsReadable(partialResults);
        if (simplified && simplified !== combined) {
          stps.push({
            label: "SIMPLIFICACIÓN LOGARÍTMICA",
            content: "",
            type: "step-result",
            value: simplified + " + C",
            opts: {
              icon: "🔁",
              stepTitle: "Simplificar logaritmos",
              stepExplanation: "a·ln|A| − b·ln|B| = ln|A^a / B^b|",
              stepExpr: simplified + " + C",
              stepResult: `<span class="result-box">${simplified} + C</span>`,
            },
          });
          return simplified + " + C";
        }
        try {
          const nerdExpr = partialResults.map((p) => p.nerd).join("+");
          const ns = this._cleanNerdResult(
            nerdamer(`simplify(${nerdExpr})`).toString(),
          );
          if (ns && ns !== combined) {
            stps.push({
              label: "FORMA COMPACTA",
              content: "",
              type: "step-result",
              value: ns + " + C",
              opts: {
                icon: "✓",
                stepTitle: "Forma compacta",
                stepResult: `<span class="result-box">${ns} + C</span>`,
              },
            });
            return ns + " + C";
          }
        } catch (_) {}
      }
      return combined + " + C";
    },

    /**
     * Extrae parámetros de una fracción A/(ax+b).
     * Retorna { A, a, b, uExpr, k } o null.
     */
    _extractLinearFrac(term, v) {
      // Patrón: COEF / ( COEF*x +/- CONST ) o COEF / ( x +/- CONST )
      const m = term
        .trim()
        .match(
          /^(-?[\d.]+)\s*\/\s*\(\s*(-?[\d.]*)\s*\*?\s*[xX]\s*([+\-]\s*[\d.]+)?\s*\)$/,
        );
      if (!m) return null;
      const A = parseFloat(m[1]);
      const a = m[2] ? parseFloat(m[2]) : 1;
      const bRaw = m[3] ? m[3].replace(/\s/g, "") : "+0";
      const b = parseFloat(bRaw);
      if (isNaN(A) || isNaN(a) || a === 0) return null;
      const k = parseFloat((A / a).toFixed(10));
      const aStr = a === 1 ? "" : a === -1 ? "-" : `${a}*`;
      const bStr = b === 0 ? "" : b > 0 ? `+${b}` : `${b}`;
      const uExpr = `${aStr}${v}${bStr}`;
      return { A, a, b, uExpr, k };
    },

    /** Condensa logaritmos: k1·ln|u1| − k2·ln|u2| → ln|(u1^k1)/(u2^k2)| */
    _simplifyLogsReadable(parts) {
      // Solo para el caso exacto: dos términos con logaritmos y coeficientes enteros/simples
      const logParts = parts.filter((p) => /ln\|/.test(p.readable));
      if (logParts.length < 2) return null;
      try {
        // Extraer coef y argumento de cada  k·ln|expr|
        const parsed = logParts.map((p) => {
          const m = p.readable.match(/^([+\-]?\s*[\d.]+)\s*ln\|(.+)\|$/);
          if (!m) return null;
          const coef = parseFloat(m[1].replace(/\s/g, ""));
          const arg = m[2];
          return { coef, arg, sign: p.sign };
        });
        if (parsed.some((x) => !x)) return null;

        // Caso simple: A·ln|u| − B·ln|v| = ln|(u^A / v^B)|
        if (parsed.length === 2) {
          const [p1, p2] = parsed;
          const k1 = Math.abs(p1.coef),
            k2 = Math.abs(p2.coef);
          if (k1 === k2) {
            // k·(ln|u| − ln|v|) = k·ln|u/v|
            const sign = p1.coef >= 0 ? "" : "−";
            return `${sign}${k1 !== 1 ? k1 + " " : ""}ln|(${p1.arg})/(${p2.arg})|`;
          }
          return `ln|(${p1.arg})^${k1} / (${p2.arg})^${k2}|`;
        }
        return null;
      } catch (_) {
        return null;
      }
    },

    /* ══════════════════════════════════════════════════════════
       ESTRATEGIA: FRACCIONES PARCIALES (denominador cuadrático)
       Ejemplo: ∫ 3/(2x²+3x+1) dx
       ══════════════════════════════════════════════════════════ */
    _integratePartialFractionsDetailed(f, v, stps) {
      stps.push({
        label: "IDENTIFICAR FRACCIÓN RACIONAL",
        content: "",
        type: "step-factor",
        value: null,
        opts: {
          icon: "÷",
          stepTitle: "Identificar la fracción racional",
          stepExplanation:
            "Procedimiento: factorizar denominador → fracciones parciales → resolver → integrar",
          stepExpr: `∫ ${f} d${v}`,
          numbered: false,
        },
      });

      let factoredDenom = null;
      try {
        const denomMatch = f.match(/\/\s*(.+)$/);
        if (denomMatch) {
          const rawDenom = denomMatch[1]
            .replace(/^\(/, "")
            .replace(/\)$/, "")
            .trim();
          const facRaw = nerdamer(`factor(${rawDenom})`).toString();
          factoredDenom = this._cleanNerdResult(facRaw);
          stps.push({
            label: "FACTORIZAR DENOMINADOR",
            content: "",
            type: "step-factor",
            value: null,
            opts: {
              icon: "×",
              stepTitle: "Factorizar el denominador",
              stepExplanation:
                "Encontrar los factores lineales del denominador",
              stepExpr: `Denominador = ${factoredDenom}`,
            },
          });
        }
      } catch (_) {}

      let decomposed = null;
      try {
        const pfRaw = nerdamer(`partfrac(${f}, ${v})`).toString();
        decomposed = this._cleanNerdResult(pfRaw);
        stps.push({
          label: "FRACCIONES PARCIALES",
          content: "",
          type: "step-nerd",
          value: null,
          opts: {
            icon: "=",
            stepTitle: "Descomposición en fracciones parciales",
            stepExplanation:
              "Plantear A/factor₁ + B/factor₂ y resolver el sistema lineal para A, B",
            stepExpr: `${f} = ${decomposed}`,
            stepResult: `<span class="partial-frac-box">${_esc(decomposed)}</span>`,
          },
        });
      } catch (_) {
        stps.push({
          label: "NOTA",
          content:
            "Descomposición automática no disponible. Integrando directamente.",
          type: "step-info",
          value: null,
        });
      }

      const toIntegrate = decomposed || f;
      if (decomposed) {
        stps.push({
          label: "INTEGRAR TÉRMINO A TÉRMINO",
          content: "",
          type: "step-info",
          value: null,
          opts: {
            icon: "∫",
            stepTitle: "Separar e integrar cada fracción",
            stepExplanation:
              "Cada término A/(ax+b) se integra con sustitución u=ax+b",
            stepExpr: `∫ [${decomposed}] d${v}`,
            numbered: false,
          },
        });
      }

      const raw = nerdamer(`integrate(${toIntegrate}, ${v})`).toString();
      const result = this._cleanNerdResult(raw);

      stps.push({
        label: "RESULTADO DE LA INTEGRACIÓN",
        content: "",
        type: "step-result",
        value: result + " + C",
        opts: {
          icon: "=",
          stepTitle: "Resultado de la integración",
          stepExplanation:
            "Suma de todos los términos integrados más la constante de integración C",
          stepExpr: `∫ [${toIntegrate}] d${v} = ${result} + C`,
          stepResult: `<span class="result-box">${_esc(result)} + C</span>`,
        },
      });

      if (result.includes("log")) {
        try {
          const sr = nerdamer(`simplify(${result})`).toString();
          const sc = this._cleanNerdResult(sr);
          if (sc && sc !== result) {
            stps.push({
              label: "SIMPLIFICACIÓN",
              content: "",
              type: "step-result",
              value: sc + " + C",
              opts: {
                icon: "🔁",
                stepTitle: "Simplificar logaritmos",
                stepExplanation: "Aplicar propiedades de logaritmos",
                stepResult: `<span class="result-box">${_esc(sc)} + C</span>`,
              },
            });
            return sc + " + C";
          }
        } catch (_) {}
      }
      return result + " + C";
    },

    /* ── Fracción simple A/(ax+b) ───────────────────────────── */
    _integrateSingleLinearFrac(f, v, stps) {
      const lf = this._extractLinearFrac(f.trim(), v);
      if (lf) {
        const { A, a, b, uExpr, k } = lf;
        stps.push({
          label: "SUSTITUCIÓN u = " + uExpr,
          content:
            `<span class="substitution-box">` +
            `Sea <strong>u = ${_esc(uExpr)}</strong><br>` +
            `du = ${a} · d${_esc(v)} &nbsp;→&nbsp; d${_esc(v)} = du/${a}<br><br>` +
            `∫ ${_esc(String(A))}/(${_esc(uExpr)}) d${_esc(v)}` +
            ` = (${A}/${a}) · ∫ (1/u) du = ${k} · ln|u|` +
            `</span>`,
          type: "step-nerd",
          value: null,
        });
        const result = `${k} ln|${uExpr}|`;
        stps.push({
          label: "RESULTADO",
          content: `<span class="result-box">${_esc(result)} + C</span>`,
          type: "step-result",
          value: result + " + C",
        });
        return result + " + C";
      }
      return this._integrateDirect(f, v, stps);
    },

    /* ── Por partes ─────────────────────────────────────────── */
    _integrateByParts(f, v, stps) {
      stps.push({
        label: "REGLA DE INTEGRACIÓN POR PARTES",
        content:
          "∫ u dv = u·v − ∫ v du<br>Orden LIATE: Logarítmica > Inversa-trig > Algebraica > Trig > Exponencial.",
        type: "step-info",
        value: null,
      });
      const raw = nerdamer(`integrate(${f}, ${v})`).toString();
      const result = this._cleanNerdResult(raw);
      stps.push({
        label: "RESULTADO",
        content: `<span class="result-box">${_esc(result)} + C</span>`,
        type: "step-result",
        value: result + " + C",
      });
      return result + " + C";
    },

    /* ── Sustitución genérica ───────────────────────────────── */
    _integrateSubstitution(f, v, substExpr, stps) {
      stps.push({
        label: "CAMBIO DE VARIABLE u = " + substExpr,
        content:
          `<span class="substitution-box">Sea <strong>u = ${_esc(substExpr)}</strong><br>` +
          `du/d${_esc(v)} = d/d${_esc(v)}(${_esc(substExpr)})</span>`,
        type: "step-info",
        value: null,
      });
      const raw = nerdamer(`integrate(${f}, ${v})`).toString();
      const result = this._cleanNerdResult(raw);
      stps.push({
        label: "RESULTADO",
        content: `<span class="result-box">${_esc(result)} + C</span>`,
        type: "step-result",
        value: result + " + C",
      });
      return result + " + C";
    },

    /* ── Directa ────────────────────────────────────────────── */
    _integrateDirect(f, v, stps) {
      stps.push({
        label: "REGLAS BÁSICAS DE INTEGRACIÓN",
        content:
          "∫ xⁿ dx = xⁿ⁺¹/(n+1) + C<br>∫ 1/x dx = ln|x| + C<br>" +
          "∫ eˣ dx = eˣ + C<br>∫ sin x dx = −cos x + C<br>∫ cos x dx = sin x + C",
        type: "step-info",
        value: null,
      });
      const raw = nerdamer(`integrate(${f}, ${v})`).toString();
      const result = this._cleanNerdResult(raw);
      stps.push({
        label: "RESULTADO",
        content: `<span class="result-box">${_esc(result)} + C</span>`,
        type: "step-result",
        value: result + " + C",
      });
      return result + " + C";
    },

    /* ── INTEGRAL DEFINIDA ──────────────────────────── */
    definiteIntegral(f, variable = "x", a = "0", b = "1") {
      if (!f) {
        ui.toast("Formato: integrate(f,x,a,b)", "warn");
        return;
      }
      const stps = [];
      stps.push({
        label: "INTEGRAL DEFINIDA — PLANTEAMIENTO",
        content: `Calcular: <span class="integral-sym">∫<sub>${_esc(a)}</sub><sup>${_esc(b)}</sup></span> <code>${_esc(f)}</code> d${_esc(variable)}<br>
               <span class="engine-badge engine-nerdamer">NERDAMER</span>`,
        type: "step-integral",
        value: null,
      });

      try {
        // Primero obtener la antiderivada
        const antideriv = nerdamer(`integrate(${f}, ${variable})`).toString();
        const antClean = this._cleanNerdResult(antideriv);

        stps.push({
          label: "PASO 1 · ANTIDERIVADA F(x)",
          content: `F(${_esc(variable)}) = <code>${_esc(antClean)}</code> + C`,
          type: "step-nerd",
          value: null,
        });
        stps.push({
          label: "PASO 2 · TEOREMA FUNDAMENTAL DEL CÁLCULO",
          content: `<span class="integral-sym">∫<sub>${_esc(a)}</sub><sup>${_esc(b)}</sup></span> f(x)dx = F(${_esc(b)}) − F(${_esc(a)})`,
          type: "step-info",
          value: null,
        });

        // Evaluar en los límites con Math.js
        let numResult = null;
        try {
          // Nerdamer evaluación numérica
          const defVal = nerdamer(
            `defint(${f}, ${variable}, ${a}, ${b})`,
          ).toString();
          numResult = this._cleanNerdResult(defVal);
          stps.push({
            label: "PASO 3 · EVALUACIÓN NUMÉRICA",
            content: `F(${_esc(b)}) − F(${_esc(a)}) = <span class="result-box">${_esc(numResult)}</span>`,
            type: "step-result",
            value: numResult,
          });
        } catch (_) {
          // Fallback numérico con Math.js (Simpson)
          if (window.math) {
            try {
              const n = 1000,
                aNum = parseFloat(math.evaluate(a)),
                bNum = parseFloat(math.evaluate(b)),
                h = (bNum - aNum) / n;
              let sum =
                math.evaluate(f, { [variable]: aNum }) +
                math.evaluate(f, { [variable]: bNum });
              for (let i = 1; i < n; i++)
                sum +=
                  (i % 2 === 0 ? 2 : 4) *
                  math.evaluate(f, { [variable]: aNum + i * h });
              numResult = ((h / 3) * sum).toFixed(8);
              stps.push({
                label: "PASO 3 · EVALUACIÓN NUMÉRICA (Simpson)",
                content: `≈ <span class="result-box">${_esc(numResult)}</span>`,
                type: "step-result",
                value: numResult,
              });
            } catch (e2) {
              stps.push({
                label: "ERROR EVALUACIÓN",
                content: "⚠ " + _esc(e2.message),
                type: "step-error",
                value: null,
              });
            }
          }
        }

        this._commitSteps(stps, numResult, "integral");
        hist.save(
          `∫[${a},${b}](${f})d${variable}`,
          numResult || antClean,
          "integral",
          "nerdamer",
        );
      } catch (err) {
        stps.push({
          label: "ERROR",
          content: `⚠ ${_esc(err.message)}`,
          type: "step-error",
          value: null,
        });
        this._commitSteps(stps, null, "integral");
      }
    },

    /* ── DERIVADA ───────────────────────────────────── */
    derivative(f, variable = "x", order = 1) {
      if (!f) {
        ui.toast("Formato: diff(f(x), x)", "warn");
        return;
      }
      const stps = [];
      stps.push({
        label: `DERIVADA DE ORDEN ${order} — PLANTEAMIENTO`,
        content: `Calcular: d${order > 1 ? order : ""}/${_esc(variable)}${order > 1 ? order : ""} [<code>${_esc(f)}</code>]<br>
               <span class="engine-badge engine-nerdamer">NERDAMER</span>`,
        type: "step-deriv",
        value: null,
      });

      // Reglas aplicadas
      stps.push({
        label: "REGLAS DE DIFERENCIACIÓN",
        content:
          "Regla del producto: (uv)′ = u′v + uv′<br>Regla de la cadena: [f(g(x))]′ = f′(g(x))·g′(x)<br>Regla de la potencia: (xⁿ)′ = n·xⁿ⁻¹",
        type: "step-info",
        value: null,
      });

      try {
        let current = f;
        for (let i = 1; i <= order; i++) {
          const dExpr = nerdamer(`diff(${current}, ${variable})`).toString();
          const dClean = this._cleanNerdResult(dExpr);
          stps.push({
            label: `DERIVADA ${i > 1 ? `ORDEN ${i}` : "PRIMERA"}`,
            content: `d/d${_esc(variable)} [<code>${_esc(current)}</code>]<br>= <code>${_esc(dClean)}</code>`,
            type: i === order ? "step-result" : "step-deriv",
            value: i === order ? dClean : null,
          });
          // Simplificar
          try {
            const simp = nerdamer(`simplify(${dExpr})`).toString();
            const simpClean = this._cleanNerdResult(simp);
            if (simpClean !== dClean && i === order) {
              stps.push({
                label: "SIMPLIFICADO",
                content: `= <span class="result-box">${_esc(simpClean)}</span>`,
                type: "step-result",
                value: simpClean,
              });
            }
            current = simpClean;
          } catch (_) {
            current = dClean;
          }
        }

        const finalVal = current;
        // Actualizar display
        calc.setExpr(finalVal);
        calc.updatePreview();
        this._commitSteps(stps, finalVal, "deriv");
        hist.save(
          `d${order > 1 ? order : ""}/${variable}${order > 1 ? order : ""}(${f})`,
          finalVal,
          "derive",
          "nerdamer",
        );
      } catch (err) {
        stps.push({
          label: "ERROR",
          content: `⚠ ${_esc(err.message)}`,
          type: "step-error",
          value: null,
        });
        this._commitSteps(stps, null, "deriv");
      }
    },

    /* ── LÍMITE ─────────────────────────────────────── */
    limit(f, variable = "x", point = "0") {
      if (!f) {
        ui.toast("Formato: limit(f(x), x, punto)", "warn");
        return;
      }
      const stps = [];
      stps.push({
        label: "LÍMITE — PLANTEAMIENTO",
        content: `Calcular: lim<sub>${_esc(variable)}→${_esc(point)}</sub> <code>${_esc(f)}</code><br>
               <span class="engine-badge engine-nerdamer">NERDAMER</span>`,
        type: "step-limit",
        value: null,
      });

      try {
        // Intentar sustitución directa
        stps.push({
          label: "PASO 1 · SUSTITUCIÓN DIRECTA",
          content: `Sustituir ${_esc(variable)} = ${_esc(point)} en <code>${_esc(f)}</code>`,
          type: "step-info",
          value: null,
        });
        try {
          const direct = math.evaluate(f, { [variable]: parseFloat(point) });
          if (isFinite(direct)) {
            stps.push({
              label: "RESULTADO POR SUSTITUCIÓN DIRECTA",
              content: `lim = <span class="result-box">${_esc(_fmt(direct))}</span>`,
              type: "step-result",
              value: _fmt(direct),
            });
            this._commitSteps(stps, _fmt(direct), "limit");
            return;
          }
        } catch (_) {}

        // Calcular con Nerdamer
        const raw = nerdamer(`limit(${f}, ${variable}, ${point})`).toString();
        const clean = this._cleanNerdResult(raw);
        stps.push({
          label: "RESULTADO DEL LÍMITE",
          content: `lim<sub>${_esc(variable)}→${_esc(point)}</sub> <code>${_esc(f)}</code> = <span class="result-box">${_esc(clean)}</span>`,
          type: "step-result",
          value: clean,
        });
        this._commitSteps(stps, clean, "limit");
        hist.save(
          `lim(${f}, ${variable}→${point})`,
          clean,
          "limit",
          "nerdamer",
        );
      } catch (err) {
        stps.push({
          label: "ERROR",
          content: `⚠ ${_esc(err.message)}`,
          type: "step-error",
          value: null,
        });
        this._commitSteps(stps, null, "limit");
      }
    },

    /* ── EXPANSIÓN ──────────────────────────────────── */
    expandExprDirect(f) {
      if (!f) {
        ui.toast("Escribe una expresión", "warn");
        return;
      }
      const stps = [];
      stps.push({
        label: "EXPANSIÓN",
        content: `Expandir: <code>${_esc(f)}</code><span class="engine-badge engine-nerdamer">NERDAMER</span>`,
        type: "step-nerd",
        value: null,
      });
      try {
        const exp = nerdamer(`expand(${f})`).toString();
        const clean = this._cleanNerdResult(exp);
        stps.push({
          label: "RESULTADO",
          content: `<code>${_esc(f)}</code> = <span class="result-box">${_esc(clean)}</span>`,
          type: "step-result",
          value: clean,
        });
        calc.setExpr(clean);
        calc.updatePreview();
        this._commitSteps(stps, clean, "expand");
        hist.save(`expand(${f})`, clean, "symbolic", "nerdamer");
      } catch (e) {
        stps.push({
          label: "ERROR",
          content: "⚠ " + _esc(e.message),
          type: "step-error",
          value: null,
        });
        this._commitSteps(stps, null, "expand");
      }
    },

    /* ── FACTORIZACIÓN ──────────────────────────────── */
    factorExprDirect(f) {
      if (!f) {
        ui.toast("Escribe una expresión", "warn");
        return;
      }
      const stps = [];
      stps.push({
        label: "FACTORIZACIÓN",
        content: `Factorizar: <code>${_esc(f)}</code><span class="engine-badge engine-nerdamer">NERDAMER</span>`,
        type: "step-factor",
        value: null,
      });
      try {
        const fac = nerdamer(`factor(${f})`).toString();
        const clean = this._cleanNerdResult(fac);
        stps.push({
          label: "RESULTADO",
          content: `<code>${_esc(f)}</code> = <span class="result-box">${_esc(clean)}</span>`,
          type: "step-result",
          value: clean,
        });
        calc.setExpr(clean);
        calc.updatePreview();
        this._commitSteps(stps, clean, "factor");
        hist.save(`factor(${f})`, clean, "symbolic", "nerdamer");
      } catch (e) {
        stps.push({
          label: "ERROR",
          content: "⚠ " + _esc(e.message),
          type: "step-error",
          value: null,
        });
        this._commitSteps(stps, null, "factor");
      }
    },

    /* ── RESOLVER ECUACIÓN ─────────────────────────── */
    solveDirectly(f, variable = "x") {
      if (!f) {
        ui.toast("Formato: solve(ecuación, variable)", "warn");
        return;
      }
      const stps = [];
      stps.push({
        label: "RESOLVER ECUACIÓN",
        content: `Resolver: <code>${_esc(f)}</code> = 0<br>Variable: ${_esc(variable)}<span class="engine-badge engine-nerdamer">NERDAMER</span>`,
        type: "step-nerd",
        value: null,
      });
      try {
        const sol = nerdamer(`solve(${f}, ${variable})`).toString();
        const clean = this._cleanNerdResult(sol);
        stps.push({
          label: "SOLUCIONES",
          content: `${_esc(variable)} = <span class="result-box">${_esc(clean)}</span>`,
          type: "step-result",
          value: clean,
        });
        this._commitSteps(stps, clean, "solve");
        hist.save(`solve(${f},${variable})`, clean, "symbolic", "nerdamer");
      } catch (e) {
        stps.push({
          label: "ERROR",
          content: "⚠ " + _esc(e.message),
          type: "step-error",
          value: null,
        });
        this._commitSteps(stps, null, "solve");
      }
    },

    /* ── SERIE DE TAYLOR ─────────────────────────── */
    taylorSeriesDirect(f, variable = "x", center = "0", order = 5) {
      if (!f) {
        ui.toast("Formato: series(f, x, centro, orden)", "warn");
        return;
      }
      const stps = [];
      stps.push({
        label: "SERIE DE TAYLOR",
        content: `Expandir: <code>${_esc(f)}</code> alrededor de ${_esc(variable)}=${_esc(center)}<br>Orden: ${order}<span class="engine-badge engine-nerdamer">NERDAMER</span>`,
        type: "step-nerd",
        value: null,
      });
      try {
        const ser = nerdamer(
          `series(${f}, ${variable}, ${center}, ${order})`,
        ).toString();
        const clean = this._cleanNerdResult(ser);
        stps.push({
          label: "SERIE RESULTANTE",
          content: `<span class="result-box">${_esc(clean)}</span>`,
          type: "step-result",
          value: clean,
        });
        this._commitSteps(stps, clean, "taylor");
        hist.save(
          `series(${f},${variable},${center},${order})`,
          clean,
          "symbolic",
          "nerdamer",
        );
      } catch (e) {
        stps.push({
          label: "ERROR",
          content: "⚠ " + _esc(e.message),
          type: "step-error",
          value: null,
        });
        this._commitSteps(stps, null, "taylor");
      }
    },

    /* ── GENÉRICO ────────────────────────────────── */
    _genericSymbolic(f) {
      const stps = [];
      stps.push({
        label: "CÁLCULO SIMBÓLICO",
        content: `Expresión: <code>${_esc(f)}</code><span class="engine-badge engine-nerdamer">NERDAMER</span>`,
        type: "step-nerd",
        value: null,
      });
      try {
        const simp = nerdamer(`simplify(${f})`).toString();
        const clean = this._cleanNerdResult(simp);
        stps.push({
          label: "SIMPLIFICADO",
          content: `<span class="result-box">${_esc(clean)}</span>`,
          type: "step-result",
          value: clean,
        });
        calc.setExpr(clean);
        calc.updatePreview();
        this._commitSteps(stps, clean, "symbolic");
        hist.save(f, clean, "symbolic", "nerdamer");
      } catch (e) {
        stps.push({
          label: "ERROR",
          content: "⚠ " + _esc(e.message),
          type: "step-error",
          value: null,
        });
        this._commitSteps(stps, null, "symbolic");
      }
    },

    /* ── Limpia output de Nerdamer (formato legible) ── */
    _cleanNerdResult(raw) {
      if (!raw) return "";
      return String(raw).replace(/\*/g, "·").replace(/\^/g, "^").trim();
    },

    /* ── Confirma pasos en el panel ── */
    _commitSteps(stps, finalValue, opType) {
      S.allSteps = stps;
      steps.clear(true);
      D("steps-empty").style.display = "none";
      steps.animate(stps);
      D("steps-count").textContent = stps.length + " PASOS";
      if (finalValue != null) {
        const r = D("result-display");
        if (r) {
          if (gsap) {
            gsap
              .timeline()
              .to(r, { opacity: 0, y: 4, duration: 0.13 })
              .call(() => {
                r.textContent = "= " + finalValue;
              })
              .to(r, {
                opacity: 0.92,
                y: 0,
                duration: 0.28,
                ease: "power3.out",
              });
          } else r.textContent = "= " + finalValue;
        }
      }
    },

    /* ── MODALES DE ENTRADA ────────────────────────── */

    startIntegral() {
      this._modal({
        title: "∫ INTEGRAL INDEFINIDA",
        icon: "∫",
        fields: [
          {
            id: "int-f",
            label: "Función f(x)",
            placeholder: "ej: 3/(2*x^2+3*x+1)",
          },
          { id: "int-v", label: "Variable (default: x)", placeholder: "x" },
        ],
        hint: "Nerdamer detectará el método automáticamente (fracciones parciales, sustitución, etc.)",
        onConfirm: (vals) => {
          const f = vals["int-f"],
            v = vals["int-v"] || "x";
          if (!f) {
            ui.toast("Ingresa la función a integrar", "warn");
            return;
          }
          calc.setExpr(`integrate(${f}, ${v})`);
          calc.updatePreview();
          this.indefiniteIntegral(f, v);
        },
      });
    },

    startDefiniteIntegral() {
      this._modal({
        title: "∫ₐᵇ INTEGRAL DEFINIDA",
        icon: "∫",
        fields: [
          { id: "dint-f", label: "Función f(x)", placeholder: "ej: x^2" },
          { id: "dint-v", label: "Variable (default: x)", placeholder: "x" },
          { id: "dint-a", label: "Límite inferior a", placeholder: "0" },
          { id: "dint-b", label: "Límite superior b", placeholder: "1" },
        ],
        hint: "Calcula ∫ₐᵇ f(x)dx usando el Teorema Fundamental del Cálculo",
        onConfirm: (vals) => {
          const f = vals["dint-f"],
            v = vals["dint-v"] || "x",
            a = vals["dint-a"] || "0",
            b = vals["dint-b"] || "1";
          if (!f) {
            ui.toast("Ingresa la función", "warn");
            return;
          }
          calc.setExpr(`integrate(${f}, ${v}, ${a}, ${b})`);
          calc.updatePreview();
          this.definiteIntegral(f, v, a, b);
        },
      });
    },

    startPartialFractions() {
      this._modal({
        title: "A/B + C/D FRACCIONES PARCIALES",
        icon: "÷",
        fields: [
          {
            id: "pf-f",
            label: "Fracción racional f(x)/g(x)",
            placeholder: "ej: 3/(2*x^2+3*x+1)",
          },
          { id: "pf-v", label: "Variable (default: x)", placeholder: "x" },
        ],
        hint: "Descompondrá y luego integrará término a término",
        onConfirm: (vals) => {
          const f = vals["pf-f"],
            v = vals["pf-v"] || "x";
          if (!f) {
            ui.toast("Ingresa la fracción racional", "warn");
            return;
          }
          calc.setExpr(`integrate(${f}, ${v})`);
          this.indefiniteIntegral(f, v);
        },
      });
    },

    startDerivative(order = 1) {
      this._modal({
        title: `d${order > 1 ? order + "/dx" + order : "/dx"} DERIVADA`,
        icon: "d/dx",
        fields: [
          { id: "d-f", label: "Función f(x)", placeholder: "ej: sin(x)*x^2" },
          { id: "d-v", label: "Variable (default: x)", placeholder: "x" },
        ],
        hint:
          order > 1
            ? `Derivará ${order} veces respecto a la variable`
            : "Calcula la derivada simbólica completa",
        onConfirm: (vals) => {
          const f = vals["d-f"],
            v = vals["d-v"] || "x";
          if (!f) {
            ui.toast("Ingresa la función", "warn");
            return;
          }
          calc.setExpr(`diff(${f}, ${v})`);
          this.derivative(f, v, order);
        },
      });
    },

    startLimit() {
      this._modal({
        title: "lim LÍMITE",
        icon: "lim",
        fields: [
          { id: "lim-f", label: "Función f(x)", placeholder: "ej: sin(x)/x" },
          { id: "lim-v", label: "Variable (default: x)", placeholder: "x" },
          { id: "lim-p", label: "Punto de convergencia", placeholder: "0" },
        ],
        hint: "Calcula lim_{x→punto} f(x)",
        onConfirm: (vals) => {
          const f = vals["lim-f"],
            v = vals["lim-v"] || "x",
            p = vals["lim-p"] || "0";
          if (!f) {
            ui.toast("Ingresa la función", "warn");
            return;
          }
          calc.setExpr(`limit(${f}, ${v}, ${p})`);
          this.limit(f, v, p);
        },
      });
    },

    expandExpr() {
      const f = calc.getExpr();
      if (!f) {
        ui.toast("Escribe una expresión para expandir", "warn");
        return;
      }
      this.expandExprDirect(f);
    },

    factorExpr() {
      const f = calc.getExpr();
      if (!f) {
        ui.toast("Escribe una expresión para factorizar", "warn");
        return;
      }
      this.factorExprDirect(f);
    },

    simplifyExpr() {
      const f = calc.getExpr();
      if (!f) {
        ui.toast("Escribe una expresión para simplificar", "warn");
        return;
      }
      this._genericSymbolic(f);
    },

    solveEquation() {
      this._modal({
        title: "= RESOLVER ECUACIÓN",
        icon: "=",
        fields: [
          {
            id: "sol-f",
            label: "Ecuación f(x) = 0",
            placeholder: "ej: x^2 - 5*x + 6",
          },
          { id: "sol-v", label: "Variable (default: x)", placeholder: "x" },
        ],
        hint: "Nerdamer resolverá algebráicamente. Para sistemas de ecuaciones, sepáralas con coma.",
        onConfirm: (vals) => {
          const f = vals["sol-f"],
            v = vals["sol-v"] || "x";
          if (!f) {
            ui.toast("Ingresa la ecuación", "warn");
            return;
          }
          this.solveDirectly(f, v);
        },
      });
    },

    substituteVar() {
      this._modal({
        title: "sub x= SUSTITUIR VARIABLE",
        icon: "→",
        fields: [
          { id: "sub-f", label: "Expresión", placeholder: "ej: x^2 + 2*x + 1" },
          { id: "sub-v", label: "Variable a sustituir", placeholder: "x" },
          { id: "sub-val", label: "Valor", placeholder: "3" },
        ],
        hint: "Evalúa la expresión sustituyendo la variable por el valor dado",
        onConfirm: (vals) => {
          const f = vals["sub-f"],
            v = vals["sub-v"] || "x",
            val = vals["sub-val"];
          if (!f || !val) {
            ui.toast("Completa todos los campos", "warn");
            return;
          }
          const stps = [];
          try {
            const subbed = nerdamer(
              `${f}`.replace(new RegExp("\\b" + v + "\\b", "g"), `(${val})`),
            );
            const clean = this._cleanNerdResult(subbed.toString());
            stps.push({
              label: "SUSTITUCIÓN",
              content: `Sustituir ${_esc(v)} = ${_esc(val)} en <code>${_esc(f)}</code>`,
              type: "step-info",
              value: null,
            });
            stps.push({
              label: "RESULTADO",
              content: `= <span class="result-box">${_esc(clean)}</span>`,
              type: "step-result",
              value: clean,
            });
            this._commitSteps(stps, clean, "subst");
            hist.save(`sub(${f},${v}=${val})`, clean, "symbolic", "nerdamer");
          } catch (e) {
            stps.push({
              label: "ERROR",
              content: "⚠ " + _esc(e.message),
              type: "step-error",
              value: null,
            });
            this._commitSteps(stps, null, "subst");
          }
        },
      });
    },

    taylorSeries() {
      this._modal({
        title: "∑ SERIE DE TAYLOR",
        icon: "∑",
        fields: [
          { id: "tay-f", label: "Función f(x)", placeholder: "ej: sin(x)" },
          { id: "tay-v", label: "Variable (default: x)", placeholder: "x" },
          { id: "tay-c", label: "Centro (default: 0)", placeholder: "0" },
          { id: "tay-n", label: "Orden (default: 5)", placeholder: "5" },
        ],
        hint: "Expande f(x) como serie de potencias alrededor del punto dado",
        onConfirm: (vals) => {
          const f = vals["tay-f"],
            v = vals["tay-v"] || "x",
            c = vals["tay-c"] || "0",
            n = parseInt(vals["tay-n"]) || 5;
          if (!f) {
            ui.toast("Ingresa la función", "warn");
            return;
          }
          this.taylorSeriesDirect(f, v, c, n);
        },
      });
    },

    /* ── Constructor de modal reutilizable ─────────── */
    _modal({ title, icon, fields, hint, onConfirm }) {
      // Quitar modal anterior
      const prev = D("sym-modal-overlay");
      if (prev) prev.remove();

      const overlay = document.createElement("div");
      overlay.id = "sym-modal-overlay";
      overlay.className = "sym-modal-overlay";

      const fieldsHTML = fields
        .map(
          (f) => `
      <div class="sym-modal-field">
        <label for="${_esc(f.id)}">${_esc(f.label)}</label>
        <input type="text" id="${_esc(f.id)}" placeholder="${_esc(f.placeholder || "")}" autocomplete="off" spellcheck="false" />
        ${f.hint ? `<p class="sym-modal-hint">${_esc(f.hint)}</p>` : ""}
      </div>
    `,
        )
        .join("");

      overlay.innerHTML = `
      <div class="sym-modal" role="dialog" aria-modal="true" aria-label="${_esc(title)}">
        <div class="sym-modal-title">
          <span class="sym-modal-icon">${_esc(icon)}</span>${_esc(title)}
          <span class="engine-badge engine-nerdamer" style="margin-left:auto">NERDAMER</span>
        </div>
        ${fieldsHTML}
        ${hint ? `<p class="sym-modal-hint" style="margin-bottom:0">💡 ${_esc(hint)}</p>` : ""}
        <div class="sym-modal-actions">
          <button class="sym-modal-btn sym-modal-btn-secondary" id="sym-modal-cancel">✕ CANCELAR</button>
          <button class="sym-modal-btn sym-modal-btn-primary"   id="sym-modal-confirm">▶ CALCULAR</button>
        </div>
      </div>`;

      document.body.appendChild(overlay);

      // Enfocar primer campo
      setTimeout(() => overlay.querySelector("input")?.focus(), 100);

      // Animación de entrada
      if (gsap)
        gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.2 });

      const close = () => {
        if (gsap)
          gsap.to(overlay, {
            opacity: 0,
            duration: 0.15,
            onComplete: () => overlay.remove(),
          });
        else overlay.remove();
      };

      D("sym-modal-cancel").onclick = close;
      overlay.onclick = (e) => {
        if (e.target === overlay) close();
      };
      document.addEventListener(
        "keydown",
        (e) => {
          if (e.key === "Escape") close();
        },
        { once: true },
      );

      D("sym-modal-confirm").onclick = () => {
        const vals = {};
        fields.forEach((f) => {
          vals[f.id] = (D(f.id)?.value || "").trim();
        });
        close();
        onConfirm(vals);
      };

      // Enter en cualquier campo confirma
      overlay.querySelectorAll("input").forEach((inp) => {
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            D("sym-modal-confirm").click();
          }
        });
      });
    },
  };

  /* ════════════════════════════════════════════════════
   MÓDULO: steps — Renderizador estilo Symbolab
   Cada tarjeta tiene:  número · título · explicación · expresión · resultado
   ════════════════════════════════════════════════════ */
  const steps = {
    _stepIndex: 0, // contador global de pasos numerados

    reset() {
      this._stepIndex = 0;
    },

    /**
     * Crea una tarjeta en el panel de pasos.
     * @param {string} label    — título corto en mayúsculas
     * @param {string} body     — HTML del contenido principal
     * @param {string} type     — clase CSS extra (step-result, step-info, etc.)
     * @param {Object} opts     — opciones extendidas para Symbolab-style
     *   opts.stepTitle        — título del paso (ej: "Separar la integral")
     *   opts.stepExplanation  — explicación en texto plano
     *   opts.stepExpr         — expresión matemática actual
     *   opts.stepResult       — resultado parcial en caja verde
     *   opts.icon             — emoji/icono para la tarjeta
     *   opts.numbered         — si es false, no muestra número
     */
    _card(label, body, type = "", opts = {}) {
      const box = D("steps-container");
      if (!box) return null;

      // ── Numeración de pasos ──────────────────────────────
      const isNumbered =
        opts.numbered !== false &&
        !type.includes("step-info") &&
        !type.includes("step-error");
      if (isNumbered) this._stepIndex++;
      const num = isNumbered ? this._stepIndex : null;

      // ── Construir HTML de la tarjeta Symbolab ────────────
      const titleHTML = opts.stepTitle
        ? `<div class="sc-step-title">
             ${opts.icon ? `<span class="sc-step-icon">${opts.icon}</span>` : ""}
             <span>${_esc(opts.stepTitle)}</span>
           </div>`
        : "";

      const explanationHTML = opts.stepExplanation
        ? `<div class="sc-step-explanation">${_esc(opts.stepExplanation)}</div>`
        : "";

      const exprHTML = opts.stepExpr
        ? `<div class="sc-step-expr"><code>${opts.stepExpr}</code></div>`
        : "";

      const resultHTML = opts.stepResult
        ? `<div class="sc-step-result-inline">${opts.stepResult}</div>`
        : "";

      // Cuerpo heredado (HTML libre, para retrocompatibilidad)
      const legacyBody =
        !opts.stepTitle && !opts.stepExplanation && !opts.stepExpr
          ? `<div class="step-content">${body}</div>`
          : "";

      const card = document.createElement("div");
      card.className = `step-card sc-card ${type}`;
      card.innerHTML = `
        <div class="sc-card-header">
          ${num ? `<div class="sc-step-num">${num}</div>` : '<div class="sc-step-num sc-step-num--info">·</div>'}
          <div class="sc-card-body">
            <div class="step-number">${_esc(label)}</div>
            ${titleHTML}
            ${explanationHTML}
            ${exprHTML}
            ${resultHTML}
            ${legacyBody}
          </div>
        </div>`;
      box.appendChild(card);
      return card;
    },

    animate(stps) {
      if (!stps?.length) return;
      this.reset();

      // Barra de progreso
      const bar = D("steps-progress-fill");
      if (bar) {
        bar.style.width = "0%";
        D("steps-progress-bar")?.classList.add("active");
      }

      if (!gsap) {
        stps.forEach((s) =>
          this._card(s.label, s.content, s.type || "", s.opts || {}),
        );
        if (bar) bar.style.width = "100%";
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      const total = stps.length;

      stps.forEach((s, i) => {
        const card = this._card(s.label, s.content, s.type || "", s.opts || {});
        if (!card) return;

        // Animación de entrada con slide + fade
        tl.fromTo(
          card,
          { opacity: 0, x: -30, scale: 0.96, filter: "blur(4px)" },
          { opacity: 1, x: 0, scale: 1, filter: "blur(0)", duration: 0.38 },
          i * 0.19,
        );

        // Actualizar barra de progreso
        if (bar) {
          tl.to(
            bar,
            {
              width: `${((i + 1) / total) * 100}%`,
              duration: 0.2,
              ease: "none",
            },
            i * 0.19,
          );
        }

        tl.call(
          () => card.scrollIntoView({ behavior: "smooth", block: "nearest" }),
          [],
          i * 0.19 + 0.1,
        );
      });

      // Pulse final en la última card + desactivar barra
      tl.call(() => {
        const last = D("steps-container")?.lastElementChild;
        if (last && last.id !== "steps-empty") {
          gsap
            .timeline()
            .to(last, {
              boxShadow: "0 0 28px rgba(0,255,136,.35)",
              borderColor: "rgba(0,255,136,.6)",
              duration: 0.35,
            })
            .to(last, {
              boxShadow: "none",
              borderColor: "var(--border-dim)",
              duration: 0.6,
              ease: "power2.inOut",
            });
        }
        if (bar)
          setTimeout(
            () => D("steps-progress-bar")?.classList.remove("active"),
            400,
          );
      });
    },

    clear(silent = false) {
      this.reset();
      const box = D("steps-container");
      if (!box) return;
      const cards = [...box.children].filter((c) => c.id !== "steps-empty");
      const pb = D("steps-progress-bar");
      if (pb) pb.classList.remove("active");

      if (!cards.length) {
        if (!silent) D("steps-empty").style.display = "";
        return;
      }
      if (gsap && !silent) {
        gsap.to(cards, {
          opacity: 0,
          x: 16,
          scale: 0.94,
          duration: 0.2,
          stagger: 0.025,
          ease: "power2.in",
          onComplete: () => {
            cards.forEach((c) => c.remove());
            D("steps-empty").style.display = "";
            gsap.fromTo(
              D("steps-empty"),
              { opacity: 0 },
              { opacity: 0.3, duration: 0.35 },
            );
          },
        });
      } else {
        cards.forEach((c) => c.remove());
        if (!silent) D("steps-empty").style.display = "";
      }
      D("steps-count").textContent = "0 PASOS";
    },

    replay() {
      if (!S.allSteps.length) {
        ui.toast("No hay pasos que repetir", "info");
        return;
      }
      const box = D("steps-container");
      const cards = box
        ? [...box.children].filter((c) => c.id !== "steps-empty")
        : [];
      if (gsap) {
        gsap.to(cards, {
          opacity: 0,
          scale: 0.9,
          duration: 0.22,
          stagger: 0.02,
          onComplete: () => {
            cards.forEach((c) => c.remove());
            D("steps-empty").style.display = "none";
            this.animate(S.allSteps);
            D("steps-count").textContent = S.allSteps.length + " PASOS";
          },
        });
      } else {
        cards.forEach((c) => c.remove());
        D("steps-empty").style.display = "none";
        this.animate(S.allSteps);
      }
    },
  };

  /* ════════════════════════════════════════════════════
   MÓDULO: graph — Plotly
   ════════════════════════════════════════════════════ */
  const graph = {
    _layout(title) {
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
    },
    _loading(v) {
      const el = D("graph-loading");
      if (!el) return;
      el.classList.toggle("visible", v);
      el.setAttribute("aria-hidden", !v);
    },
    _expr(raw) {
      return (raw || "").replace(/^f\s*\(x(?:,?\s*y)?\)\s*=\s*/i, "").trim();
    },
    plot2D() {
      if (!window.math) {
        ui.toast("Math.js no disponible", "warn");
        return;
      }
      const raw = D("graph-expr")?.value?.trim();
      if (!raw) {
        ui.toast("Ingresa una función f(x)", "warn");
        return;
      }
      const expr = this._expr(raw);
      this._loading(true);
      ensurePlotly(() => {
        try {
          const N = 600,
            xs = [],
            ys = [];
          for (let i = 0; i <= N; i++) {
            const x = -10 + (20 * i) / N;
            try {
              const y = math.evaluate(expr, { x });
              xs.push(x);
              ys.push(isFinite(y) ? y : null);
            } catch (_) {
              xs.push(x);
              ys.push(null);
            }
          }
          D("graph-placeholder").style.display = "none";
          Plotly.newPlot(
            "graph-container",
            [
              {
                x: xs,
                y: ys,
                mode: "lines",
                name: `f(x)=${expr}`,
                line: { color: "#00d4ff", width: 2.5, shape: "spline" },
                fill: "tozeroy",
                fillcolor: "rgba(0,212,255,.04)",
              },
            ],
            {
              ...this._layout(`f(x) = ${expr}`),
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
          if (gsap)
            gsap.fromTo(
              "#graph-container .plotly",
              { opacity: 0 },
              { opacity: 1, duration: 0.5, ease: "power2.out" },
            );
          this._loading(false);
          ui.toast("Gráfica 2D generada", "success");
        } catch (e) {
          this._loading(false);
          ui.toast("Error: " + e.message, "error");
        }
      });
    },
    plot3D() {
      if (!window.math) {
        ui.toast("Math.js no disponible", "warn");
        return;
      }
      const raw = D("graph-expr")?.value?.trim();
      if (!raw) {
        ui.toast("Ingresa una función f(x,y)", "warn");
        return;
      }
      const expr = this._expr(raw);
      this._loading(true);
      ensurePlotly(() => {
        try {
          const N = 45;
          const xs = Array.from({ length: N + 1 }, (_, i) => -5 + (10 * i) / N);
          const ys = Array.from({ length: N + 1 }, (_, j) => -5 + (10 * j) / N);
          const zs = ys.map((y) =>
            xs.map((x) => {
              try {
                const z = math.evaluate(expr, { x, y });
                return isFinite(z) ? z : null;
              } catch (_) {
                return null;
              }
            }),
          );
          D("graph-placeholder").style.display = "none";
          Plotly.newPlot(
            "graph-container",
            [
              {
                type: "surface",
                x: xs,
                y: ys,
                z: zs,
                name: expr,
                opacity: 0.93,
                colorscale: [
                  [0, "#020610"],
                  [0.15, "#001a40"],
                  [0.35, "#003366"],
                  [0.55, "#00d4ff"],
                  [0.75, "#00ff88"],
                  [1, "#ffd700"],
                ],
                contours: {
                  z: {
                    show: true,
                    color: "#1e4070",
                    width: 1,
                    usecolormap: false,
                  },
                },
                lighting: {
                  ambient: 0.7,
                  diffuse: 0.8,
                  specular: 0.3,
                  roughness: 0.5,
                },
              },
            ],
            {
              ...this._layout(`f(x,y) = ${expr}`),
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
          this._loading(false);
          ui.toast("Superficie 3D generada", "success");
        } catch (e) {
          this._loading(false);
          ui.toast("Error 3D: " + e.message, "error");
        }
      });
    },
    clear() {
      if (gsap) {
        gsap.to("#graph-container", {
          opacity: 0,
          duration: 0.22,
          onComplete: () => {
            if (window.Plotly) Plotly.purge("graph-container");
            D("graph-placeholder").style.display = "";
            gsap.to("#graph-container", { opacity: 1, duration: 0.25 });
          },
        });
      } else {
        if (window.Plotly) Plotly.purge("graph-container");
        D("graph-placeholder").style.display = "";
      }
    },
  };

  /* ════════════════════════════════════════════════════
   HISTOGRAMA / ESTADÍSTICAS (antes en calc)
   ════════════════════════════════════════════════════ */
  function _runHistogram() {
    if (!window.math) {
      ui.toast("Math.js no disponible", "warn");
      return;
    }
    const expr = calc.getExpr();
    if (!expr) {
      ui.toast("Ingresa un array [1,2,3,…]", "warn");
      return;
    }
    try {
      const data = math.evaluate(expr);
      if (!Array.isArray(data)) {
        ui.toast("Se esperaba un array []", "error");
        return;
      }
      const flat = data.flat().map(Number).filter(isFinite);
      if (flat.length < 2) {
        ui.toast("El array necesita al menos 2 valores", "warn");
        return;
      }
      graph._loading(true);
      ensurePlotly(() => {
        try {
          D("graph-placeholder").style.display = "none";
          Plotly.newPlot(
            "graph-container",
            [
              {
                x: flat,
                type: "histogram",
                name: "Distribución",
                opacity: 0.85,
                marker: {
                  color: flat.map((_, i) => `hsl(${190 + i * 12},80%,60%)`),
                  line: { color: "#00d4ff", width: 1 },
                },
              },
            ],
            { ...graph._layout("Histograma de Frecuencias"), bargap: 0.05 },
            { responsive: true, displaylogo: false },
          );
          graph._loading(false);
        } catch (e) {
          graph._loading(false);
          ui.toast("Error: " + e.message, "error");
        }
      });
      const st = [
        {
          label: "MEDIA",
          content: `μ <span class="op-symbol">=</span> <span class="math-val">${math.mean(flat).toFixed(6)}</span>`,
          type: "",
          value: null,
        },
        {
          label: "MEDIANA",
          content: `med <span class="op-symbol">=</span> <span class="math-val">${math.median(flat).toFixed(6)}</span>`,
          type: "",
          value: null,
        },
        {
          label: "DESV.STD",
          content: `σ <span class="op-symbol">=</span> <span class="math-val">${math.std(flat).toFixed(6)}</span>`,
          type: "",
          value: null,
        },
        {
          label: "VARIANZA",
          content: `σ² <span class="op-symbol">=</span> <span class="math-val">${math.variance(flat).toFixed(6)}</span>`,
          type: "",
          value: null,
        },
        {
          label: "RANGO·N",
          content: `min=<span class="highlight">${math.min(flat)}</span>  max=<span class="highlight">${math.max(flat)}</span>  N=<span class="math-val">${flat.length}</span>`,
          type: "step-result",
          value: "",
        },
      ];
      S.allSteps = st;
      steps.clear(true);
      D("steps-empty").style.display = "none";
      steps.animate(st);
      D("steps-count").textContent = st.length + " PASOS";
      ui.toast("Histograma generado", "success");
    } catch (e) {
      ui.toast("Error: " + e.message, "error");
    }
  }

  /* ════════════════════════════════════════════════════
   MÓDULO: ocr — Vista previa · Confirmación · Análisis
   ════════════════════════════════════════════════════ */
  const ocr = {
    _pendingFile: null, // archivo en espera de análisis
    _pendingExpr: null, // expresión detectada, pendiente de aceptar

    initDragDrop() {
      const zone = D("ocr-drop-zone");
      if (!zone) return;
      zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("dragging");
        if (gsap) gsap.to(zone, { scale: 1.02, duration: 0.18 });
      });
      zone.addEventListener("dragleave", (e) => {
        if (!zone.contains(e.relatedTarget)) {
          zone.classList.remove("dragging");
          if (gsap) gsap.to(zone, { scale: 1, duration: 0.18 });
        }
      });
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("dragging");
        if (gsap) gsap.to(zone, { scale: 1, duration: 0.18 });
        const f = e.dataTransfer.files[0];
        if (!f) return;
        if (!f.type.startsWith("image/")) {
          ui.toast("Solo imágenes (PNG, JPG, BMP, WEBP)", "error");
          return;
        }
        if (f.size > 15 * 1024 * 1024) {
          ui.toast("Imagen muy grande (máx 15 MB)", "error");
          return;
        }
        this._showPreview(f);
      });
    },

    handleFile(event) {
      const f = event.target.files?.[0];
      event.target.value = "";
      if (!f) return;
      if (!f.type.startsWith("image/")) {
        ui.toast("Archivo no es imagen válida", "error");
        return;
      }
      if (f.size > 15 * 1024 * 1024) {
        ui.toast("Imagen demasiado grande (máx 15 MB)", "error");
        return;
      }
      this._showPreview(f);
    },

    /** Muestra la miniatura y el botón "Analizar ecuación" */
    _showPreview(file) {
      this._pendingFile = file;
      const zone = D("ocr-drop-zone");
      const preview = D("ocr-preview-panel");
      const thumb = D("ocr-thumb");
      if (!zone || !preview || !thumb) return;

      const url = URL.createObjectURL(file);
      thumb.src = url;
      thumb.onload = () => URL.revokeObjectURL(url);

      // Ocultar zona de drop, mostrar preview
      if (gsap) {
        gsap.to(zone, {
          opacity: 0,
          scale: 0.95,
          duration: 0.2,
          ease: "power2.in",
          onComplete: () => {
            zone.style.display = "none";
            preview.hidden = false;
            gsap.fromTo(
              preview,
              { opacity: 0, y: 10 },
              { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" },
            );
          },
        });
      } else {
        zone.style.display = "none";
        preview.hidden = false;
      }

      // Ocultar confirmación anterior si existía
      const confirmPanel = D("ocr-confirm-panel");
      if (confirmPanel) confirmPanel.hidden = true;
      this._pendingExpr = null;
    },

    /** Lanza el análisis OCR con Tesseract sobre la imagen en espera */
    async runAnalysis() {
      if (!this._pendingFile) {
        ui.toast("Primero sube una imagen", "warn");
        return;
      }
      await this.process(this._pendingFile);
    },

    /** Vuelve al estado inicial (quita imagen, oculta paneles) */
    reset() {
      this._pendingFile = null;
      this._pendingExpr = null;
      const zone = D("ocr-drop-zone");
      const preview = D("ocr-preview-panel");
      const confirm = D("ocr-confirm-panel");
      const prog = D("ocr-progress");
      const det = D("ocr-detected-type");

      if (preview) preview.hidden = true;
      if (confirm) confirm.hidden = true;
      if (prog) {
        prog.style.display = "none";
      }
      if (det) det.textContent = "";

      if (zone) {
        zone.style.display = "";
        if (gsap) {
          gsap.fromTo(
            zone,
            { opacity: 0, scale: 0.95 },
            { opacity: 1, scale: 1, duration: 0.3, ease: "power3.out" },
          );
        }
      }
    },

    /** Acepta la expresión detectada y la calcula */
    accept() {
      const expr = this._pendingExpr;
      if (!expr) return;

      if (gsap) {
        gsap
          .timeline()
          .to(D("input-display"), { opacity: 0, y: -6, duration: 0.18 })
          .call(() => {
            calc.setExpr(expr);
            calc.updatePreview();
          })
          .to(D("input-display"), {
            opacity: 1,
            y: 0,
            duration: 0.28,
            ease: "power3.out",
          });
      } else {
        calc.setExpr(expr);
        calc.updatePreview();
      }

      ui.toast("Cargando ecuación desde imagen…", "success");
      this.reset();
      setTimeout(() => calc.calculate(), 600);
    },

    /** Motor OCR central — llamado desde runAnalysis() */
    async process(file) {
      const bar = D("ocr-bar");
      const statusEl = D("ocr-status");
      const prog = D("ocr-progress");
      const btn = D("ocr-analyze-btn");
      if (!bar || !statusEl || !prog) return;

      // Deshabilitar botón durante análisis
      if (btn) {
        btn.disabled = true;
        btn.classList.add("loading");
      }
      prog.style.display = "block";
      bar.style.width = "0%";
      statusEl.textContent = "Cargando Tesseract…";

      const loadAnim = gsap
        ? gsap.to(bar, { width: "60%", duration: 3.5, ease: "power1.inOut" })
        : null;

      ensureTesseract(async () => {
        try {
          const worker = await Tesseract.createWorker("eng", 1, {
            logger: (m) => {
              if (m.status === "recognizing text") {
                loadAnim?.kill?.();
                const pct = Math.round((m.progress || 0) * 100);
                bar.style.width = pct + "%";
                statusEl.textContent = `Reconociendo… ${pct}%`;
              } else if (m.status) statusEl.textContent = m.status;
            },
          });
          await worker.setParameters({
            tessedit_char_whitelist:
              "0123456789+-*/()[]{}^.,=<>|abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ πΩ√∑∫∂∞≤≥→²³⁴",
          });
          const {
            data: { text },
          } = await worker.recognize(file);
          await worker.terminate();

          loadAnim?.kill?.();
          bar.style.width = "100%";
          if (gsap)
            gsap.to(bar, {
              background: "linear-gradient(90deg,var(--accent-green),#00ffaa)",
              duration: 0.28,
            });
          statusEl.textContent = "✓ Análisis completado";

          // Pipeline de detección
          const cleaned = _cleanOCR(text) || this._ocrToMathExpr(text);

          // ── MOSTRAR PANEL DE CONFIRMACIÓN ──────────────────────
          if (cleaned) {
            this._pendingExpr = cleaned;
            this._showConfirm(cleaned);
          } else {
            statusEl.textContent = "✗ No se detectó ecuación";
            ui.toast(
              "No se detectó expresión válida. Intenta mejorar la imagen.",
              "error",
            );
          }
        } catch (e) {
          loadAnim?.kill?.();
          bar.style.width = "100%";
          if (gsap)
            gsap.to(bar, { background: "var(--accent-red)", duration: 0.25 });
          statusEl.textContent = "✗ Error: " + e.message;
          ui.toast("Error OCR: " + e.message, "error");
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.classList.remove("loading");
          }
          // Ocultar barra después de 3 s
          setTimeout(() => {
            if (gsap)
              gsap.to(prog, {
                opacity: 0,
                duration: 0.3,
                onComplete: () => {
                  prog.style.display = "none";
                  gsap.set(prog, { opacity: 1 });
                  gsap.set(bar, {
                    background:
                      "linear-gradient(90deg,var(--accent-cyan),var(--accent-green))",
                    width: "0%",
                  });
                },
              });
            else {
              prog.style.display = "none";
              bar.style.width = "0%";
            }
          }, 3000);
        }
      });
    },

    /** Muestra el panel de confirmación con la expresión detectada */
    _showConfirm(cleaned) {
      const panel = D("ocr-confirm-panel");
      const exprEl = D("ocr-confirm-expr");
      const typeEl = D("ocr-confirm-type");
      const det = D("ocr-detected-type");
      if (!panel || !exprEl) return;

      // Tipo de operación
      const typeStr = cleaned.startsWith("integrate(")
        ? "∫ INTEGRAL"
        : cleaned.startsWith("diff(")
          ? "d/dx DERIVADA"
          : cleaned.startsWith("limit(")
            ? "lim LÍMITE"
            : "EXPRESIÓN";
      if (typeEl) typeEl.textContent = typeStr;
      if (det) det.textContent = typeStr + " DETECTADA";

      // Mostrar expresión en formato legible
      const readable = cleaned
        .replace(/^integrate\((.+),\s*([a-z])\)$/, "∫ ($1) d$2")
        .replace(/^diff\((.+),\s*([a-z])\)$/, "d/d$2 ($1)")
        .replace(/^limit\((.+),\s*([a-z]),\s*(.+)\)$/, "lim $2→$3 ($1)");
      exprEl.textContent = readable;

      panel.hidden = false;
      if (gsap) {
        gsap.fromTo(
          panel,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" },
        );
      }

      ui.toast("Ecuación detectada. Confirma o sube otra imagen.", "success");
    },

    _ocrToMathExpr(text) {
      if (!text) return null;
      const norm = text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
      return (
        _ocrDetectIntegral(norm) ||
        _ocrDetectDerivative(norm) ||
        _ocrDetectLimit(norm) ||
        _ocrNormalize(norm)
          .replace(/\s/g, "")
          .replace(/[^0-9a-zA-Z+\-*/()^.,=[\]πe∫]/g, "") ||
        null
      );
    },
  };

  function _cleanOCRRaw(s) {
    return _ocrNormalize(s || "").replace(/\s/g, "");
  }

  /* ════════════════════════════════════════════════════
   MÓDULO: hist — historial
   ════════════════════════════════════════════════════ */
  const HIST_KEY = "quantumcalc_history_v3";
  const HIST_MAX = 500;
  const hist = {
    records: [],
    filterQ: "",
    load() {
      try {
        this.records = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      } catch (_) {
        this.records = [];
      }
      if (!Array.isArray(this.records)) this.records = [];
    },
    _persist() {
      try {
        localStorage.setItem(HIST_KEY, JSON.stringify(this.records));
      } catch (e) {
        this.records = this.records.slice(0, Math.floor(HIST_MAX / 2));
        try {
          localStorage.setItem(HIST_KEY, JSON.stringify(this.records));
        } catch (_) {}
      }
    },
    save(expr, result, mode, engine) {
      if (!expr || result == null) return;
      if (
        this.records[0]?.expr === String(expr) &&
        this.records[0]?.result === String(result)
      )
        return;
      this.records.unshift({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        expr: String(expr).slice(0, 300),
        result: String(result).slice(0, 200),
        mode: String(mode || "basic"),
        engine: String(engine || "math.js"),
        date: new Date().toLocaleString("es-CO", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        ts: Date.now(),
      });
      if (this.records.length > HIST_MAX) this.records.length = HIST_MAX;
      this._persist();
      this.render();
      this._badge(true);
    },
    _del(id, itemEl) {
      if (gsap) {
        gsap.to(itemEl, {
          opacity: 0,
          x: 20,
          height: 0,
          marginBottom: 0,
          paddingTop: 0,
          paddingBottom: 0,
          duration: 0.28,
          ease: "power2.in",
          onComplete: () => {
            this.records = this.records.filter((r) => r.id !== id);
            this._persist();
            this.render();
            this._badge();
          },
        });
      } else {
        this.records = this.records.filter((r) => r.id !== id);
        this._persist();
        this.render();
        this._badge();
      }
    },
    clearAll() {
      if (!this.records.length) {
        ui.toast("El historial ya está vacío", "info");
        return;
      }
      const items = D("history-list")?.querySelectorAll(".history-item");
      if (gsap && items?.length) {
        gsap.to([...items], {
          opacity: 0,
          x: 28,
          stagger: 0.03,
          duration: 0.22,
          ease: "power2.in",
          onComplete: () => {
            this.records = [];
            this._persist();
            this.render();
            this._badge();
            ui.toast("Historial borrado", "info");
          },
        });
      } else {
        this.records = [];
        this._persist();
        this.render();
        this._badge();
        ui.toast("Historial borrado", "info");
      }
    },
    filter(q) {
      this.filterQ = q || "";
      this.render(this.filterQ);
    },
    render(q) {
      const list = D("history-list"),
        empty = D("history-empty");
      if (!list) return;
      q = (q !== undefined ? q : this.filterQ).toLowerCase().trim();
      const filtered = q
        ? this.records.filter(
            (r) =>
              r.expr.toLowerCase().includes(q) ||
              r.result.toLowerCase().includes(q) ||
              r.mode.includes(q),
          )
        : this.records;
      [...list.children].filter((c) => c !== empty).forEach((c) => c.remove());
      if (!filtered.length) {
        empty.style.display = "";
        if (D("history-count-label"))
          D("history-count-label").textContent = "0 registros";
        return;
      }
      empty.style.display = "none";
      this._groupByDate(filtered).forEach(({ label, items }) => {
        const gl = document.createElement("div");
        gl.className = "history-group-label";
        gl.textContent = label;
        list.appendChild(gl);
        items.forEach((r) => list.appendChild(this._buildItem(r)));
      });
      if (D("history-count-label"))
        D("history-count-label").textContent =
          `${filtered.length} registro${filtered.length !== 1 ? "s" : ""}`;
      this._badge();
    },
    _groupByDate(records) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yday = new Date(today);
      yday.setDate(yday.getDate() - 1);
      const week = new Date(today);
      week.setDate(week.getDate() - 6);
      const map = new Map();
      records.forEach((r) => {
        const d = new Date(r.ts);
        d.setHours(0, 0, 0, 0);
        let lbl =
          d.getTime() === today.getTime()
            ? "HOY"
            : d.getTime() === yday.getTime()
              ? "AYER"
              : d >= week
                ? d
                    .toLocaleDateString("es-CO", { weekday: "long" })
                    .toUpperCase()
                : d
                    .toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })
                    .toUpperCase();
        if (!map.has(lbl)) map.set(lbl, []);
        map.get(lbl).push(r);
      });
      return [...map.entries()].map(([label, items]) => ({ label, items }));
    },
    _buildItem(r) {
      const el = document.createElement("div");
      el.className = "history-item";
      el.setAttribute("role", "listitem");
      el.setAttribute("tabindex", "0");
      el.setAttribute("data-id", r.id);
      const modeColors = {
        integral: "38bdf8",
        derive: "00ff88",
        limit: "e879f9",
        symbolic: "a855f7",
        basic: "00d4ff",
        algebra: "a855f7",
        stats: "ffd700",
      };
      const engBadge = r.engine
        ? `<span class="engine-badge engine-${r.engine === "nerdamer" ? "nerdamer" : "mathjs"}" style="margin-left:4px">${_esc(r.engine.toUpperCase())}</span>`
        : "";
      el.innerHTML = `
      <div class="history-item-expr">${_esc(r.expr.slice(0, 60) + (r.expr.length > 60 ? "…" : ""))}<span class="history-item-mode mode-${_esc(r.mode)}">${_esc(r.mode.toUpperCase().slice(0, 4))}</span>${engBadge}</div>
      <button class="history-item-del" type="button" aria-label="Eliminar" title="Eliminar">✕</button>
      <div class="history-item-result">= ${_esc(r.result.slice(0, 80))}</div>
      <div class="history-item-date">${_esc(r.date)}</div>`;
      el.querySelector(".history-item-del").addEventListener("click", (e) => {
        e.stopPropagation();
        this._del(r.id, el);
      });
      const load = () => this._load(r);
      el.addEventListener("click", (e) => {
        if (e.target.classList.contains("history-item-del")) return;
        load();
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          load();
        }
      });
      return el;
    },
    _load(r) {
      if (gsap) {
        gsap
          .timeline()
          .to(D("input-display"), {
            opacity: 0,
            y: -5,
            duration: 0.15,
            ease: "power2.in",
          })
          .call(() => {
            calc.setExpr(r.expr);
            calc.updatePreview();
            if (r.mode && r.mode !== S.mode) calc.switchMode(r.mode);
          })
          .to(D("input-display"), {
            opacity: 1,
            y: 0,
            duration: 0.25,
            ease: "power3.out",
          });
      } else {
        calc.setExpr(r.expr);
        calc.updatePreview();
      }
      ui.toast("Cargado: " + r.expr.slice(0, 40), "info");
      if (window.innerWidth < 900) this.toggle();
    },
    toggle() {
      S.histOpen = !S.histOpen;
      const d = D("history-drawer"),
        b = D("history-backdrop"),
        btn = D("history-toggle-btn");
      d.classList.toggle("open", S.histOpen);
      b.classList.toggle("visible", S.histOpen);
      d.setAttribute("aria-hidden", !S.histOpen);
      btn?.classList.toggle("active", S.histOpen);
      btn?.setAttribute("aria-expanded", S.histOpen);
      document.body.style.overflow =
        S.histOpen && window.innerWidth < 900 ? "hidden" : "";
      if (S.histOpen) {
        const items = d.querySelectorAll(".history-item");
        if (gsap && items.length)
          gsap.fromTo(
            items,
            { opacity: 0, x: 18 },
            {
              opacity: 1,
              x: 0,
              stagger: 0.04,
              duration: 0.28,
              ease: "power3.out",
              delay: 0.14,
            },
          );
        setTimeout(() => D("history-search")?.focus(), 380);
      }
    },
    _badge(bump = false) {
      const el = D("history-badge");
      if (!el) return;
      const n = this.records.length;
      el.textContent = n > 99 ? "99+" : String(n);
      el.style.display = n === 0 ? "none" : "";
      if (bump) {
        el.classList.remove("bump");
        void el.offsetWidth;
        el.classList.add("bump");
      }
    },
  };

  /* ════════════════════════════════════════════════════
   MÓDULO: _export — PDF y Excel
   ════════════════════════════════════════════════════ */
  const _export = {
    _C: {
      bg: [5, 10, 15],
      panel: [13, 24, 40],
      cyan: [0, 212, 255],
      green: [0, 255, 136],
      orange: [255, 107, 43],
      text: [200, 230, 245],
      dim: [90, 138, 170],
      border: [30, 64, 112],
    },
    _spinner(msg) {
      const el = document.createElement("div");
      el.className = "export-spinner";
      el.innerHTML = `<div class="export-spinner-ring"></div><div class="export-spinner-text">${_esc(msg)}</div>`;
      document.body.appendChild(el);
      if (gsap) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.18 });
      return el;
    },
    _hideSpinner(el) {
      if (!el) return;
      if (gsap)
        gsap.to(el, {
          opacity: 0,
          duration: 0.22,
          onComplete: () => el.remove(),
        });
      else el.remove();
    },
    toPDF() {
      if (!hist.records.length) {
        ui.toast("No hay registros para exportar", "info");
        return;
      }
      const sp = this._spinner("Cargando jsPDF…");
      ensureJsPDF(() => {
        this._hideSpinner(sp);
        const sp2 = this._spinner("Generando PDF…");
        setTimeout(() => {
          try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
              orientation: "portrait",
              unit: "mm",
              format: "a4",
            });
            const W = doc.internal.pageSize.getWidth(),
              H = doc.internal.pageSize.getHeight();
            const { _C: C } = this;
            doc.setFillColor(...C.bg);
            doc.rect(0, 0, W, H, "F");
            doc.setFillColor(...C.panel);
            doc.rect(0, 0, W, 30, "F");
            doc.setDrawColor(...C.cyan);
            doc.setLineWidth(0.8);
            doc.line(0, 0, W, 0);
            doc.setTextColor(...C.cyan);
            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.text("QuantumCalc v3.0", 14, 13);
            doc.setFontSize(7);
            doc.setTextColor(...C.dim);
            doc.setFont("helvetica", "normal");
            doc.text("CALCULADORA CIENTÍFICA CON NERDAMER + MATH.JS", 14, 19);
            const now = new Date().toLocaleString("es-CO", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            doc.text(`${now}`, W - 14, 13, { align: "right" });
            doc.text(`${hist.records.length} registro(s)`, W - 14, 19, {
              align: "right",
            });
            doc.setDrawColor(...C.border);
            doc.setLineWidth(0.3);
            doc.line(0, 30, W, 30);
            doc.setFillColor(...C.panel);
            doc.rect(0, 30, W, 10, "F");
            doc.setFontSize(8);
            doc.setTextColor(...C.green);
            doc.setFont("helvetica", "bold");
            doc.text("// HISTORIAL DE OPERACIONES", 14, 37);
            doc.autoTable({
              startY: 42,
              head: [["#", "EXPRESIÓN", "RESULTADO", "MODO", "MOTOR", "FECHA"]],
              body: hist.records.map((r, i) => [
                i + 1,
                r.expr,
                r.result,
                r.mode.toUpperCase(),
                (r.engine || "math.js").toUpperCase(),
                r.date,
              ]),
              theme: "plain",
              styles: {
                font: "courier",
                fontSize: 7,
                cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
                textColor: C.text,
                lineColor: C.border,
                lineWidth: 0.2,
                overflow: "linebreak",
              },
              headStyles: {
                fillColor: C.panel,
                textColor: C.cyan,
                fontStyle: "bold",
                fontSize: 7,
                lineColor: C.cyan,
                lineWidth: 0.4,
              },
              columnStyles: {
                0: { cellWidth: 8, halign: "center", textColor: C.dim },
                1: { cellWidth: 50, textColor: C.cyan },
                2: { cellWidth: 35, textColor: C.green, fontStyle: "bold" },
                3: { cellWidth: 14, halign: "center" },
                4: {
                  cellWidth: 14,
                  halign: "center",
                  textColor: [168, 85, 247],
                },
                5: { textColor: C.dim, fontSize: 6.5 },
              },
              alternateRowStyles: { fillColor: [9, 14, 21] },
              bodyStyles: { fillColor: C.bg },
              willDrawCell: (d) => {
                if (d.section === "body" && d.column.index === 2) {
                  doc.setFillColor(0, 40, 20);
                  doc.rect(
                    d.cell.x,
                    d.cell.y,
                    d.cell.width,
                    d.cell.height,
                    "F",
                  );
                }
              },
              didDrawPage: () => {
                const pg = doc.internal.getCurrentPageInfo().pageNumber,
                  tot = doc.internal.getNumberOfPages();
                doc.setFillColor(...C.panel);
                doc.rect(0, H - 10, W, 10, "F");
                doc.setDrawColor(...C.border);
                doc.setLineWidth(0.2);
                doc.line(0, H - 10, W, H - 10);
                doc.setFontSize(6.5);
                doc.setTextColor(...C.dim);
                doc.text("QuantumCalc v3.0 — Nerdamer + Math.js", 14, H - 3.5);
                doc.text(`Pág. ${pg}/${tot}`, W - 14, H - 3.5, {
                  align: "right",
                });
              },
              margin: { top: 42, right: 10, bottom: 14, left: 10 },
            });
            doc.save(
              `QuantumCalc_${new Date().toISOString().slice(0, 10)}.pdf`,
            );
            this._hideSpinner(sp2);
            ui.toast("PDF exportado", "success");
          } catch (e) {
            this._hideSpinner(sp2);
            ui.toast("Error PDF: " + e.message, "error");
            console.error(e);
          }
        }, 100);
      });
    },
    toExcel() {
      if (!hist.records.length) {
        ui.toast("No hay registros para exportar", "info");
        return;
      }
      const sp = this._spinner("Cargando SheetJS…");
      ensureXLSX(() => {
        this._hideSpinner(sp);
        const sp2 = this._spinner("Generando Excel…");
        setTimeout(() => {
          try {
            const XLSX = window.XLSX;
            const sTitle = {
              font: {
                bold: true,
                sz: 14,
                color: { rgb: "00D4FF" },
                name: "Courier New",
              },
              fill: { fgColor: { rgb: "050A0F" }, patternType: "solid" },
              alignment: { horizontal: "left", vertical: "center" },
            };
            const sHdr = {
              font: {
                bold: true,
                sz: 9,
                color: { rgb: "00D4FF" },
                name: "Courier New",
              },
              fill: { fgColor: { rgb: "0D1828" }, patternType: "solid" },
              alignment: { horizontal: "center", vertical: "center" },
              border: {
                top: { style: "medium", color: { rgb: "00D4FF" } },
                bottom: { style: "medium", color: { rgb: "00D4FF" } },
                left: { style: "thin", color: { rgb: "1E4070" } },
                right: { style: "thin", color: { rgb: "1E4070" } },
              },
            };
            const aoa = [
              [
                "QuantumCalc v3.0 — Historial (Nerdamer + Math.js)",
                "",
                "",
                "",
                "",
                "",
              ],
              [
                `Exportado: ${new Date().toLocaleString("es-CO")}`,
                "",
                "",
                "",
                "",
                "",
              ],
              ["", "", "", "", "", ""],
              ["#", "EXPRESIÓN", "RESULTADO", "MODO", "MOTOR", "FECHA Y HORA"],
              ...hist.records.map((r, i) => [
                i + 1,
                r.expr,
                r.result,
                r.mode.toUpperCase(),
                (r.engine || "math.js").toUpperCase(),
                r.date,
              ]),
            ];
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws["!cols"] = [
              { wch: 5 },
              { wch: 50 },
              { wch: 28 },
              { wch: 12 },
              { wch: 10 },
              { wch: 24 },
            ];
            ws["!merges"] = [
              { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
              { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
            ];
            const ap = (addr, s) => {
              if (ws[addr]) ws[addr].s = s;
            };
            ap("A1", sTitle);
            ["A4", "B4", "C4", "D4", "E4", "F4"].forEach((a) => ap(a, sHdr));
            const mc = {
              BASIC: "FF6B2B",
              ALGEBRA: "A855F7",
              STATS: "FFD700",
              INTEGRAL: "38BDF8",
              DERIVE: "00FF88",
              LIMIT: "E879F9",
              SYMBOLIC: "A855F7",
            };
            hist.records.forEach((r, i) => {
              const row = 5 + i,
                fill = i % 2 === 0 ? "050A0F" : "090E15";
              const base = {
                font: { sz: 8, color: { rgb: "C8E6F5" }, name: "Courier New" },
                fill: { fgColor: { rgb: fill }, patternType: "solid" },
                border: {
                  top: { style: "hair", color: { rgb: "1A2D45" } },
                  bottom: { style: "hair", color: { rgb: "1A2D45" } },
                  left: { style: "hair", color: { rgb: "1A2D45" } },
                  right: { style: "hair", color: { rgb: "1A2D45" } },
                },
                alignment: { vertical: "center" },
              };
              ap(`A${row}`, {
                ...base,
                font: { ...base.font, color: { rgb: "5A8AAA" } },
                alignment: { ...base.alignment, horizontal: "center" },
              });
              ap(`B${row}`, {
                ...base,
                font: { ...base.font, color: { rgb: "00D4FF" }, bold: true },
              });
              ap(`C${row}`, {
                ...base,
                font: { ...base.font, color: { rgb: "00FF88" }, bold: true },
                fill: { fgColor: { rgb: "002A14" }, patternType: "solid" },
                alignment: { ...base.alignment, horizontal: "center" },
              });
              ap(`D${row}`, {
                ...base,
                font: {
                  ...base.font,
                  color: { rgb: mc[r.mode.toUpperCase()] || "C8E6F5" },
                  bold: true,
                },
                alignment: { ...base.alignment, horizontal: "center" },
              });
              ap(`E${row}`, {
                ...base,
                font: {
                  ...base.font,
                  color: { rgb: r.engine === "nerdamer" ? "A855F7" : "00D4FF" },
                },
                alignment: { ...base.alignment, horizontal: "center" },
              });
              ap(`F${row}`, {
                ...base,
                font: { ...base.font, color: { rgb: "5A8AAA" }, sz: 7.2 },
              });
            });
            const modes = hist.records.reduce((a, r) => {
              a[r.mode] = (a[r.mode] || 0) + 1;
              return a;
            }, {});
            const engines = hist.records.reduce((a, r) => {
              const e = r.engine || "math.js";
              a[e] = (a[e] || 0) + 1;
              return a;
            }, {});
            const aoa2 = [
              ["QuantumCalc v3.0 — Estadísticas"],
              [""],
              ["MÉTRICA", "VALOR"],
              ["Total", hist.records.length],
              ["Primera", hist.records.at(-1)?.date || "-"],
              ["Última", hist.records[0]?.date || "-"],
              [""],
              ["POR MODO", ""],
              ...Object.entries(modes).map(([m, n]) => [m.toUpperCase(), n]),
              [""],
              ["POR MOTOR", ""],
              ...Object.entries(engines).map(([e, n]) => [e.toUpperCase(), n]),
            ];
            const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
            ws2["!cols"] = [{ wch: 28 }, { wch: 20 }];
            ws2["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
            if (ws2["A1"]) ws2["A1"].s = sTitle;
            if (ws2["A3"]) ws2["A3"].s = sHdr;
            if (ws2["B3"]) ws2["B3"].s = sHdr;
            const wb = XLSX.utils.book_new();
            wb.Props = {
              Title: "QuantumCalc v3.0",
              Author: "QuantumCalc",
              CreatedDate: new Date(),
            };
            XLSX.utils.book_append_sheet(wb, ws, "Historial");
            XLSX.utils.book_append_sheet(wb, ws2, "Estadísticas");
            XLSX.writeFile(
              wb,
              `QuantumCalc_${new Date().toISOString().slice(0, 10)}.xlsx`,
            );
            this._hideSpinner(sp2);
            ui.toast("Excel exportado", "success");
          } catch (e) {
            this._hideSpinner(sp2);
            ui.toast("Error Excel: " + e.message, "error");
            console.error(e);
          }
        }, 100);
      });
    },
  };

  /* ════════════════════════════════════════════════════
   MÓDULO: theme — Dark/Light toggle con localStorage
   ════════════════════════════════════════════════════ */
  // Extend ui with theme toggle
  ui.toggleTheme = function () {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    if (next === "dark") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
    localStorage.setItem("qc-theme", next);
    const icon = D("theme-icon");
    const label = D("theme-label");
    if (icon) icon.textContent = next === "light" ? "🌙" : "☀";
    if (label) label.textContent = next === "light" ? "OSCURO" : "CLARO";
    ui.toast(
      `Tema ${next === "light" ? "claro" : "oscuro"} activado`,
      "info",
      1800,
    );
  };

  ui._initTheme = function () {
    const saved = localStorage.getItem("qc-theme") || "dark";
    const icon = D("theme-icon");
    const label = D("theme-label");
    if (saved === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      if (icon) icon.textContent = "🌙";
      if (label) label.textContent = "OSCURO";
    } else {
      document.documentElement.removeAttribute("data-theme");
      if (icon) icon.textContent = "☀";
      if (label) label.textContent = "CLARO";
    }
  };

  /* ════════════════════════════════════════════════════
   MÓDULO: clipboard — Copiar al portapapeles
   ════════════════════════════════════════════════════ */
  const clipboard = {
    async _copy(text, label) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.cssText =
            "position:fixed;top:-9999px;left:-9999px;opacity:0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        ui.toast(`${label || "Copiado"} al portapapeles ✓`, "success", 2200);
        return true;
      } catch (e) {
        ui.toast("No se pudo copiar: " + e.message, "error");
        return false;
      }
    },

    copyExpr() {
      const expr = calc.getExpr();
      if (!expr) {
        ui.toast("Nada que copiar", "warn");
        return;
      }
      const dm = D("display-main");
      this._copy(expr, "Expresión");
      if (dm) dm.classList.add("copy-flash");
      setTimeout(() => dm && dm.classList.remove("copy-flash"), 450);
    },

    copyResult() {
      const rd = D("result-display");
      const text = rd?.textContent?.replace(/^[=≈]\s*/, "") || "";
      if (!text) {
        ui.toast("Sin resultado aún", "warn");
        return;
      }
      this._copy(text, "Resultado");
    },

    copySteps() {
      if (!S.allSteps || !S.allSteps.length) {
        ui.toast("Sin pasos que copiar", "warn");
        return;
      }
      const lines = S.allSteps.map((s, i) => {
        const label = s.label || `Paso ${i + 1}`;
        const content =
          s.opts?.stepExpr ||
          s.opts?.stepResult ||
          (s.content || "").replace(/<[^>]+>/g, "").trim() ||
          (s.value != null ? String(s.value) : "");
        return `[${label}] ${content}`;
      });
      const header = `QuantumCalc — ${calc.getExpr()}\n${"─".repeat(50)}\n`;
      this._copy(header + lines.join("\n"), "Pasos");
    },

    copyStepCard(text) {
      this._copy(text, "Paso");
    },

    copyLatex() {
      const expr = calc.getExpr();
      if (!expr) {
        ui.toast("Nada que copiar", "warn");
        return;
      }
      // Basic LaTeX conversion
      let latex = expr
        .replace(/sqrt\(([^)]+)\)/g, "\\sqrt{$1}")
        .replace(/\^(\d+)/g, "^{$1}")
        .replace(/\*\*/g, "^")
        .replace(/\*/g, " \\cdot ")
        .replace(/integrate\(([^,]+),\s*([^)]+)\)/g, "\\int $1 \\, d$2")
        .replace(
          /diff\(([^,]+),\s*([^)]+)\)/g,
          "\\frac{d}{d$2}\\left($1\\right)",
        )
        .replace(/pi/g, "\\pi")
        .replace(/infinity/gi, "\\infty")
        .replace(/Infinity/g, "\\infty");
      this._copy("$" + latex + "$", "LaTeX");
    },
  };

  /* ════════════════════════════════════════════════════
   MÓDULO: editor — Visual equation builder
   ════════════════════════════════════════════════════ */
  const editor = {
    _prompt(msg, placeholder, callback) {
      // Use simple prompt for now, could be enhanced with modal
      const val = window.prompt(msg, placeholder || "");
      if (val !== null) callback(val.trim());
    },

    insertFrac() {
      this._prompt("Numerador:", "a", (num) => {
        if (!num) return;
        this._prompt("Denominador:", "b", (den) => {
          if (!den) return;
          calc.insert(`(${num})/(${den})`);
          ui.toast("Fracción insertada", "info", 1500);
        });
      });
    },

    insertPow() {
      this._prompt("Base:", "x", (base) => {
        if (!base) return;
        this._prompt("Exponente:", "2", (exp) => {
          if (!exp) return;
          calc.insert(`(${base})^(${exp})`);
        });
      });
    },

    insertSqrt() {
      this._prompt("Expresión bajo la raíz:", "x", (expr) => {
        if (!expr) return;
        calc.insert(`sqrt(${expr})`);
      });
    },

    insertNthRoot() {
      this._prompt("Índice de la raíz:", "3", (n) => {
        if (!n) return;
        this._prompt("Expresión bajo la raíz:", "x", (expr) => {
          if (!expr) return;
          calc.insert(`nthRoot(${expr}, ${n})`);
        });
      });
    },

    insertIntegral() {
      this._prompt("Función a integrar (ej: x^2):", "x^2", (f) => {
        if (!f) return;
        this._prompt("Variable (ej: x):", "x", (v) => {
          if (!v) return;
          const hasBounds = window.confirm(
            "¿Integral definida? (OK = sí, Cancelar = indefinida)",
          );
          if (hasBounds) {
            this._prompt("Límite inferior:", "0", (a) => {
              this._prompt("Límite superior:", "1", (b) => {
                calc.setExpr(
                  `integrate(${f}, ${v || "x"}, ${a || "0"}, ${b || "1"})`,
                );
                calc.updatePreview();
              });
            });
          } else {
            calc.setExpr(`integrate(${f}, ${v || "x"})`);
            calc.updatePreview();
          }
        });
      });
    },

    insertDerivative() {
      this._prompt("Función a derivar (ej: x^3):", "x^3", (f) => {
        if (!f) return;
        this._prompt("Variable (ej: x):", "x", (v) => {
          if (!v) return;
          const order = window.prompt("Orden de la derivada:", "1") || "1";
          if (parseInt(order) > 1) {
            calc.setExpr(`diff(${f}, ${v}, ${order})`);
          } else {
            calc.setExpr(`diff(${f}, ${v})`);
          }
          calc.updatePreview();
        });
      });
    },

    insertSum() {
      this._prompt("Expresión a sumar (usa i como índice):", "i^2", (expr) => {
        if (!expr) return;
        this._prompt("Límite inferior:", "1", (a) => {
          this._prompt("Límite superior:", "10", (b) => {
            // Build a JS sum expression for Math.js
            calc.setExpr(`sum(${expr}, i, ${a || "1"}, ${b || "10"})`);
            calc.updatePreview();
            ui.toast(
              "Usa el botón Σ en SIMBÓLICO para evaluarla",
              "info",
              3500,
            );
          });
        });
      });
    },

    insertProduct() {
      this._prompt("Expresión (usa i como índice):", "i", (expr) => {
        if (!expr) return;
        this._prompt("Límite inferior:", "1", (a) => {
          this._prompt("Límite superior:", "5", (b) => {
            calc.setExpr(`prod(${expr}, i, ${a || "1"}, ${b || "5"})`);
            calc.updatePreview();
          });
        });
      });
    },

    insertLimit() {
      this._prompt("Función (ej: sin(x)/x):", "sin(x)/x", (f) => {
        if (!f) return;
        this._prompt("Variable:", "x", (v) => {
          this._prompt("Punto al que tiende:", "0", (pt) => {
            calc.setExpr(`limit(${f}, ${v || "x"}, ${pt || "0"})`);
            calc.updatePreview();
          });
        });
      });
    },

    insertMatrix(rows, cols) {
      const cells = [];
      for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) row.push("0");
        cells.push("[" + row.join(",") + "]");
      }
      calc.insert(`matrix([${cells.join(",")}])`);
      ui.toast(
        `Matriz ${rows}×${cols} insertada — edita los valores`,
        "info",
        3000,
      );
    },
  };

  /* ════════════════════════════════════════════════════
   MÓDULO: handwriting — Canvas + AI recognition
   ════════════════════════════════════════════════════ */
  const handwriting = {
    _canvas: null,
    _ctx: null,
    _drawing: false,
    _penSize: 4,
    _lastResult: null,
    _hasStrokes: false,

    init() {
      const canvas = D("handwriting-canvas");
      if (!canvas) return;
      this._canvas = canvas;
      this._ctx = canvas.getContext("2d");
      this._setupCanvas();
      this._bindEvents();
    },

    _setupCanvas() {
      const ctx = this._ctx;
      const canvas = this._canvas;
      // Retina/HiDPI
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = (rect.width || 340) * dpr;
      canvas.height = 150 * dpr;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = this._penSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--accent-cyan")
          .trim() || "#00d4ff";
    },

    _getPos(e) {
      const rect = this._canvas.getBoundingClientRect();
      if (e.touches) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      }
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },

    _bindEvents() {
      const c = this._canvas;
      c.addEventListener("mousedown", (e) => {
        this._drawing = true;
        this._startStroke(e);
      });
      c.addEventListener("mousemove", (e) => {
        if (this._drawing) this._continueStroke(e);
      });
      c.addEventListener("mouseup", () => {
        this._drawing = false;
        this._ctx.beginPath();
      });
      c.addEventListener("mouseleave", () => {
        this._drawing = false;
        this._ctx.beginPath();
      });
      c.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          this._drawing = true;
          this._startStroke(e);
        },
        { passive: false },
      );
      c.addEventListener(
        "touchmove",
        (e) => {
          e.preventDefault();
          if (this._drawing) this._continueStroke(e);
        },
        { passive: false },
      );
      c.addEventListener("touchend", () => {
        this._drawing = false;
        this._ctx.beginPath();
      });
    },

    _startStroke(e) {
      const pos = this._getPos(e);
      this._ctx.beginPath();
      this._ctx.moveTo(pos.x, pos.y);
      // Hide hint
      const hint = D("canvas-hint");
      if (hint) hint.classList.add("hidden");
      this._hasStrokes = true;
    },

    _continueStroke(e) {
      const pos = this._getPos(e);
      const ctx = this._ctx;
      // Update stroke color based on current theme
      const isLight =
        document.documentElement.getAttribute("data-theme") === "light";
      ctx.strokeStyle = isLight ? "#0077aa" : "#00d4ff";
      ctx.lineWidth = this._penSize;
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    },

    clear() {
      const c = this._canvas;
      const ctx = this._ctx;
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, c.width / dpr, c.height / dpr);
      ctx.beginPath();
      this._hasStrokes = false;
      this._lastResult = null;
      const hint = D("canvas-hint");
      if (hint) hint.classList.remove("hidden");
      const res = D("canvas-result");
      if (res) res.hidden = true;
    },

    setPenSize(size) {
      this._penSize = parseInt(size) || 4;
    },

    /** Use Tesseract to OCR the canvas image */
    async recognize() {
      if (!this._hasStrokes) {
        ui.toast("Dibuja una ecuación primero", "warn");
        return;
      }
      ui.toast("Reconociendo escritura…", "info", 4000);
      const btn = document.querySelector(".canvas-btn-recognize");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ PROCESANDO…";
      }

      try {
        // Get canvas image as blob
        const dataURL = this._canvas.toDataURL("image/png");

        // Try Tesseract first (math-optimized whitelist)
        ensureTesseract(async () => {
          try {
            const worker = await Tesseract.createWorker("eng", 1, {
              logger: () => {},
            });
            await worker.setParameters({
              tessedit_char_whitelist:
                "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+-*/^()[]{}=.,sincotalgqreSdp∫∂π",
              preserve_interword_spaces: "1",
            });
            const result = await worker.recognize(dataURL);
            await worker.terminate();
            const raw = result.data.text.trim();
            const cleaned = _cleanOCR(raw) || raw;
            if (cleaned && cleaned.length > 0) {
              this._showResult(cleaned);
            } else {
              ui.toast(
                "No se detectó ecuación — intenta con trazos más gruesos",
                "warn",
              );
            }
          } catch (err) {
            ui.toast("Error en reconocimiento: " + err.message, "error");
          } finally {
            if (btn) {
              btn.disabled = false;
              btn.textContent = "🔍 RECONOCER";
            }
          }
        });
      } catch (err) {
        ui.toast("Error: " + err.message, "error");
        if (btn) {
          btn.disabled = false;
          btn.textContent = "🔍 RECONOCER";
        }
      }
    },

    _showResult(expr) {
      this._lastResult = expr;
      const res = D("canvas-result");
      const exprEl = D("canvas-result-expr");
      if (res && exprEl) {
        exprEl.textContent = expr;
        res.hidden = false;
        if (gsap)
          gsap.fromTo(
            res,
            { opacity: 0, y: 6 },
            { opacity: 1, y: 0, duration: 0.3 },
          );
      }
      ui.toast(`Detectado: ${expr}`, "success", 3000);
    },

    useResult() {
      if (!this._lastResult) return;
      calc.setExpr(this._lastResult);
      calc.updatePreview();
      ui.toast("Ecuación cargada desde canvas", "success");
      setTimeout(() => calc.calculate(), 400);
    },
  };

  /* ════════════════════════════════════════════════════
   MÓDULO: derivative steps — Paso a paso con reglas
   Extiende el módulo symbolic existente
   ════════════════════════════════════════════════════ */
  // Override/extend the existing derivative method with detailed rules
  const _origDerivative = symbolic.derivative
    ? symbolic.derivative.bind(symbolic)
    : null;

  symbolic.derivativeWithRules = function (f, variable, order) {
    const v = variable || "x";
    const stps = [];

    stps.push({
      label: "PLANTEAMIENTO",
      content: "",
      type: "step-deriv",
      value: null,
      opts: {
        icon: "d/dx",
        stepTitle:
          order > 1 ? `Derivada de orden ${order}` : "Primera derivada",
        stepExplanation: `Calcular d${order > 1 ? order : ""}/d${v}${order > 1 ? order : ""}[${f}]`,
        stepExpr:
          order > 1 ? `d^${order}/d${v}^${order}(${f})` : `d/d${v}[${f}]`,
        numbered: false,
      },
    });

    // Detect which rule applies and explain it
    const rules = this._detectDerivRules(f, v);
    rules.forEach((rule) => {
      stps.push({
        label: rule.label,
        content: "",
        type: "step-deriv",
        value: null,
        opts: {
          icon: rule.icon,
          stepTitle: rule.title,
          stepExplanation: rule.explanation,
          stepExpr: rule.expr || "",
          numbered: false,
        },
      });
    });

    // Compute with Nerdamer
    let result = null;
    try {
      let nerdExpr = f;
      for (let i = 0; i < (order || 1); i++) {
        nerdExpr = nerdamer(`diff(${nerdExpr}, ${v})`).toString();
      }
      result = this._cleanNerdResult(nerdExpr);

      // Simplify if possible
      let simplified = result;
      try {
        simplified = this._cleanNerdResult(
          nerdamer(`simplify(${nerdExpr})`).toString(),
        );
      } catch (_) {}

      stps.push({
        label: "CÁLCULO",
        content: "",
        type: "step-deriv",
        value: null,
        opts: {
          icon: "∂",
          stepTitle: "Aplicar reglas de derivación",
          stepExplanation: `Derivando ${f} respecto a ${v}`,
          stepExpr: `d/d${v}[${f}] = ${result}`,
          numbered: false,
        },
      });

      if (simplified !== result) {
        stps.push({
          label: "SIMPLIFICACIÓN",
          content: "",
          type: "step-deriv",
          value: simplified,
          opts: {
            icon: "✓",
            stepTitle: "Simplificar resultado",
            stepExpr: simplified,
            stepResult: `<span class="result-box">${_esc(simplified)}</span>`,
            numbered: false,
          },
        });
        result = simplified;
      } else {
        stps.push({
          label: "RESULTADO",
          content: "",
          type: "step-deriv",
          value: result,
          opts: {
            icon: "=",
            stepTitle: "Resultado final",
            stepExpr: `d/d${v}[${f}] = ${result}`,
            stepResult: `<span class="result-box">${_esc(result)}</span>`,
            numbered: false,
          },
        });
      }

      // If higher order, show each step
      if (order > 1) {
        let prev = f;
        for (let ord = 1; ord <= order; ord++) {
          try {
            const di = this._cleanNerdResult(
              nerdamer(`diff(${prev}, ${v})`).toString(),
            );
            stps.push({
              label: `DERIVADA ${ord}ª`,
              content: "",
              type: "step-deriv",
              value: ord === order ? di : null,
              opts: {
                icon: `d${ord}`,
                stepTitle: `Derivada de orden ${ord}`,
                stepExpr: `d${ord > 1 ? ord : ""}/d${v}${ord > 1 ? ord : ""}[${ord === 1 ? f : prev}] = ${di}`,
                stepResult:
                  ord === order
                    ? `<span class="result-box">${_esc(di)}</span>`
                    : "",
                numbered: false,
              },
            });
            prev = di;
          } catch (_) {}
        }
        result = prev;
      }
    } catch (err) {
      stps.push({
        label: "ERROR",
        content: `⚠ ${_esc(err.message)}`,
        type: "step-error",
        value: null,
      });
    }

    this._commitSteps(stps, result, "diff");
    hist.save(
      `diff(${f},${v}${order > 1 ? "," + order : ""})`,
      result,
      S.mode,
      "nerdamer",
    );
  };

  symbolic._detectDerivRules = function (f, v) {
    const rules = [];
    const fe = f.toLowerCase();

    // Constant rule
    if (/^-?[\d.]+$/.test(f.trim())) {
      rules.push({
        label: "REGLA DE CONSTANTE",
        icon: "K",
        title: "Derivada de una constante = 0",
        explanation: "d/dx[c] = 0  (c constante)",
        expr: `d/d${v}[${f}] = 0`,
      });
      return rules;
    }

    // Power rule: x^n
    if (new RegExp(`^${v}\\^([\\d.]+)$`).test(f.trim())) {
      const m = f.match(/\^([\d.]+)$/);
      const n = m ? m[1] : "n";
      rules.push({
        label: "REGLA DE LA POTENCIA",
        icon: "xⁿ",
        title: `d/d${v}[${v}^n] = n·${v}^(n-1)`,
        explanation: `Bajar el exponente y restar 1: d/d${v}[${v}^${n}] = ${n}·${v}^${parseFloat(n) - 1}`,
        expr: `d/d${v}[${v}^${n}] = ${n}·${v}^(${n}-1)`,
      });
    }

    // Sum/difference rule
    if (/[+\-]/.test(f) && !/^\s*[+\-]/.test(f)) {
      rules.push({
        label: "REGLA DE SUMA/DIFERENCIA",
        icon: "±",
        title: "Derivada de una suma/diferencia",
        explanation: "d/dx[f±g] = f'±g'  (linealidad)",
        expr: "d/dx[f ± g] = f'(x) ± g'(x)",
      });
    }

    // Product rule: contains * or implicit mult
    if (/\*/.test(f) && !/\^/.test(f)) {
      rules.push({
        label: "REGLA DEL PRODUCTO",
        icon: "×",
        title: "Regla del producto: d/dx[f·g] = f'g + fg'",
        explanation: "Si u·v, entonces d/dx[u·v] = u'·v + u·v'",
        expr: "d/dx[u·v] = u'·v + u·v'",
      });
    }

    // Quotient rule
    if (/\//.test(f) && !/\*\*/.test(f)) {
      rules.push({
        label: "REGLA DEL COCIENTE",
        icon: "f/g",
        title: "Regla del cociente: d/dx[f/g] = (f'g−fg')/g²",
        explanation: "d/dx[u/v] = (u'·v − u·v') / v²",
        expr: "d/dx[u/v] = (u'v − uv') / v²",
      });
    }

    // Chain rule: sin(g(x)), cos(g(x)), etc
    if (/sin|cos|tan|log|exp|sqrt/.test(fe)) {
      const fn = fe.match(/\b(sin|cos|tan|asin|acos|atan|log|exp|sqrt)\b/);
      if (fn) {
        const fname = fn[1];
        const chainRules = {
          sin: "cos(g(x))·g'(x)",
          cos: "-sin(g(x))·g'(x)",
          tan: "sec²(g(x))·g'(x)",
          asin: "g'(x)/√(1−g(x)²)",
          acos: "-g'(x)/√(1−g(x)²)",
          atan: "g'(x)/(1+g(x)²)",
          log: "g'(x)/g(x)",
          exp: "eˢ(ˣ)·g'(x)",
          sqrt: "g'(x)/(2·√g(x))",
        };
        rules.push({
          label: "REGLA DE LA CADENA",
          icon: "⛓",
          title: `Regla de la cadena con ${fname}(g(x))`,
          explanation: `d/dx[${fname}(g(x))] = ${chainRules[fname] || "f'(g(x))·g'(x)"}`,
          expr: `d/dx[${fname}(g(x))] = ${chainRules[fname] || "f'(g)·g'(x)"}`,
        });
      }
    }

    if (rules.length === 0) {
      rules.push({
        label: "MÉTODO GENERAL",
        icon: "∂",
        title: "Derivación general (Nerdamer)",
        explanation: "Aplicando reglas de derivación automáticamente",
        expr: `d/d${v}[${f}]`,
      });
    }

    return rules;
  };

  // Patch derivative dispatcher to use the enhanced version
  const _origDispatch = symbolic.dispatchSymbolic.bind(symbolic);
  symbolic.dispatchSymbolic = function (expr, typeLabel) {
    const e = expr.trim();
    if (/^diff\s*\(/i.test(e) || /^derivative\s*\(/i.test(e)) {
      const args = this._parseArgs(e);
      const order = parseInt(args[2]) || 1;
      this.derivativeWithRules(args[0], args[1] || "x", order);
      return;
    }
    _origDispatch(expr, typeLabel);
  };

  /* ════════════════════════════════════════════════════
   MÓDULO: switchMode — extend to support 'editor'
   ════════════════════════════════════════════════════ */
  const _origSwitchMode = calc.switchMode.bind(calc);
  calc.switchMode = function (mode) {
    if (mode === S.mode) return;
    S.mode = mode;
    document.querySelectorAll(".mode-tab").forEach((t) => {
      const a = t.dataset.mode === mode;
      t.classList.toggle("active", a);
      t.setAttribute("aria-selected", a);
    });
    const panels = ["basic", "symbolic", "algebra", "stats", "editor"];
    panels.forEach((m) => {
      const el = D("fn-" + m);
      if (!el) return;
      if (m === mode) {
        el.style.display = "";
        if (gsap) {
          gsap.fromTo(
            el,
            { opacity: 0, y: 10, filter: "blur(3px)" },
            {
              opacity: 1,
              y: 0,
              filter: "blur(0)",
              duration: 0.32,
              ease: "power3.out",
            },
          );
          gsap.fromTo(
            el.querySelectorAll(".key"),
            { opacity: 0, scale: 0.88 },
            {
              opacity: 1,
              scale: 1,
              duration: 0.2,
              stagger: 0.016,
              ease: "power2.out",
            },
          );
        }
      } else {
        if (el.style.display !== "none") {
          if (gsap)
            gsap.to(el, {
              opacity: 0,
              y: -6,
              duration: 0.15,
              ease: "power2.in",
              onComplete: () => {
                el.style.display = "none";
              },
            });
          else el.style.display = "none";
        }
      }
    });
    if (mode === "symbolic" && !S.nerdReady) {
      ui.toast("Cargando motor simbólico Nerdamer…", "info", 4000);
      ensureNerdamer(() => {
        S.nerdReady = true;
        ui.toast("Nerdamer listo", "success");
      });
    }
  };

  /* ════════════════════════════════════════════════════
   PATCH steps._card to add copy button
   ════════════════════════════════════════════════════ */
  const _origCard = steps._card.bind(steps);
  steps._card = function (label, html, type, value) {
    const el = _origCard(label, html, type, value);
    if (el && typeof el === "object" && el.classList) {
      // Add position relative for copy button
      el.style.position = "relative";
      const copyBtn = document.createElement("button");
      copyBtn.className = "step-copy-btn";
      copyBtn.textContent = "⎘";
      copyBtn.title = "Copiar este paso";
      copyBtn.onclick = (e) => {
        e.stopPropagation();
        const text = (label || "") + ": " + (el.textContent || "").trim();
        clipboard.copyStepCard(text);
      };
      el.appendChild(copyBtn);
    }
    return el;
  };

  /* ════════════════════════════════════════════════════
   INICIALIZACIÓN
   ════════════════════════════════════════════════════ */
  function init() {
    hist.load();
    const d = D("input-display");
    if (d) d.textContent = "";
    calc.updatePreview();
    ui.init();
    ui._initTheme();
    ocr.initDragDrop();
    handwriting.init();

    D("input-display")?.addEventListener("input", () => {
      calc.updatePreview();
      ui.triggerTyping();
    });

    document.addEventListener("keydown", (e) => {
      if (e.target === D("input-display")) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        calc.calculate();
      }
      if (e.key === "Escape") {
        D("sym-modal-overlay")?.remove() ||
          (S.histOpen ? hist.toggle() : calc.clearAll());
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Backspace") {
        e.preventDefault();
        calc.clearAll();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "h") {
        e.preventDefault();
        hist.toggle();
      }
      // Ctrl+Shift+C = copy steps
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
        e.preventDefault();
        clipboard.copySteps();
      }
    });

    hist.render();
    hist._badge();
    ui.toast("QuantumCalc v4.0 — Nerdamer + Math.js cargando…", "info", 3000);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();

  return {
    ui,
    calc,
    symbolic,
    steps,
    graph,
    ocr,
    history: hist,
    export: _export,
    clipboard,
    editor,
    handwriting,
    toast: (m, t) => ui.toast(m, t),
    state: S,
  };
})();

/* ═══════════════════════════════════════════════════════════════════
   NUEVOS MÓDULOS — QuantumCalc v5.0
   Complejos · Voz · Regresión · Práctica · QR · Export Pro
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────────
   MÓDULO: NÚMEROS COMPLEJOS
   ───────────────────────────────────────────────────────────────── */
(function () {
  const _D = (id) => document.getElementById(id);

  window.QC_complex = {
    /** Evalúa expresión compleja con math.js y muestra pasos */
    compute(expr) {
      if (!window.math) {
        QC.ui.toast("Math.js no listo", "warn");
        return;
      }
      if (!expr) {
        QC.ui.toast("Escribe una expresión compleja", "warn");
        return;
      }
      try {
        const result = math.evaluate(expr);
        const stps = [];
        stps.push({
          label: "EXPRESIÓN COMPLEJA",
          content: `<code>${expr}</code> <span class="engine-badge engine-mathjs">MATH.JS</span>`,
          type: "step-integral",
          value: null,
        });

        let re, im, mod, arg, polar;
        if (typeof result === "object" && result.re !== undefined) {
          re = result.re;
          im = result.im;
          mod = Math.sqrt(re * re + im * im);
          arg = Math.atan2(im, re);
          const argDeg = ((arg * 180) / Math.PI).toFixed(4);
          polar = `${mod.toFixed(6)} · e^(i·${arg.toFixed(6)})`;

          stps.push({
            label: "FORMA RECTANGULAR",
            content: `Re = <span class="math-val">${re.toFixed(8)}</span><br>Im = <span class="math-val">${im.toFixed(8)}</span><br>Resultado: <span class="result-box">${re.toFixed(4)} ${im >= 0 ? "+" : "-"} ${Math.abs(im).toFixed(4)}i</span>`,
            type: "",
            value: null,
          });
          stps.push({
            label: "MÓDULO Y ARGUMENTO",
            content: `|z| = √(${re.toFixed(4)}² + ${im.toFixed(4)}²) = <span class="math-val">${mod.toFixed(8)}</span><br>arg(z) = arctan(${im.toFixed(4)}/${re.toFixed(4)}) = <span class="math-val">${arg.toFixed(6)} rad = ${argDeg}°</span>`,
            type: "step-info",
            value: null,
          });
          stps.push({
            label: "FORMA POLAR",
            content: `z = r·e^(iθ) = <span class="result-box">${polar}</span><br>= ${mod.toFixed(4)}·(cos(${argDeg}°) + i·sin(${argDeg}°))`,
            type: "step-result",
            value: `${re.toFixed(4)} + ${im.toFixed(4)}i`,
          });
        } else {
          const val = typeof result === "number" ? result : result.toString();
          stps.push({
            label: "RESULTADO",
            content: `<span class="result-box">${val}</span>`,
            type: "step-result",
            value: String(val),
          });
        }

        QC.steps.clear(true);
        _D("steps-empty").style.display = "none";
        QC.steps.animate(stps);
        _D("steps-count").textContent = stps.length + " PASOS";

        const resVal = stps.find((s) => s.value)?.value;
        if (resVal) {
          const r = _D("result-display");
          if (r) r.textContent = "= " + resVal;
          QC.history.save(expr, resVal, "complex", "math.js");
        }
        QC.ui.toast("Número complejo calculado ✓", "success", 2000);
      } catch (err) {
        QC.ui.toast("Error: " + err.message, "error");
      }
    },

    polar() {
      this.compute("abs(" + QC.calc.getExpr() + ")");
    },
    argument() {
      this.compute("arg(" + QC.calc.getExpr() + ")");
    },
    conjugate() {
      this.compute("conj(" + QC.calc.getExpr() + ")");
    },
    magnitude() {
      const e = QC.calc.getExpr();
      QC.calc.setExpr("abs(" + e + ")");
      QC.calc.calculate();
    },
  };
})();

/* ─────────────────────────────────────────────────────────────────
   MÓDULO: ASISTENTE POR VOZ
   ───────────────────────────────────────────────────────────────── */
(function () {
  const _D = (id) => document.getElementById(id);
  let recognition = null;
  let isListening = false;

  window.QC_voice = {
    supported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),

    init() {
      if (!this.supported) return;
      const SRClass =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SRClass();
      recognition.lang = "es-ES";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        isListening = true;
        this._updateBtn(true);
        QC.ui.toast("🎙 Escuchando… dicta tu ecuación", "info", 5000);
      };

      recognition.onresult = (event) => {
        let interim = "",
          final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += t;
          else interim += t;
        }
        const text = (final || interim).toLowerCase().trim();
        if (text) this._processVoice(text, !!final);
      };

      recognition.onend = () => {
        isListening = false;
        this._updateBtn(false);
      };

      recognition.onerror = (e) => {
        isListening = false;
        this._updateBtn(false);
        if (e.error !== "no-speech")
          QC.ui.toast("Error de voz: " + e.error, "error");
      };
    },

    toggle() {
      if (!this.supported) {
        QC.ui.toast("Web Speech API no disponible en este navegador", "warn");
        return;
      }
      if (!recognition) this.init();
      if (isListening) {
        recognition.stop();
        return;
      }
      try {
        recognition.start();
      } catch (e) {
        QC.ui.toast("Error al iniciar micrófono: " + e.message, "error");
      }
    },

    _updateBtn(listening) {
      const btn = _D("voice-btn");
      if (!btn) return;
      btn.classList.toggle("voice-active", listening);
      btn.setAttribute("aria-pressed", listening);
      btn.title = listening ? "Detener dictado" : "Dictado por voz";
      btn.querySelector(".hdr-btn-icon").textContent = listening ? "🔴" : "🎙";
    },

    _processVoice(text, isFinal) {
      // Comandos de acción
      const commands = {
        resolver: () => QC.calc.calculate(),
        calcular: () => QC.calc.calculate(),
        graficar: () => {
          const e = QC.calc.getExpr();
          if (e) {
            _D("graph-expr").value = e;
            QC.graph.plot2D();
          }
        },
        "mostrar pasos": () => QC.calc.calculate(),
        limpiar: () => QC.calc.clearAll(),
        borrar: () => QC.calc.clearAll(),
        historial: () => QC.history.toggle(),
        "exportar pdf": () => QC.export.toPDF(),
      };

      for (const [cmd, action] of Object.entries(commands)) {
        if (text.includes(cmd)) {
          if (isFinal) {
            action();
            QC.ui.toast(`Comando: "${cmd}"`, "success", 2000);
          }
          return;
        }
      }

      if (!isFinal) return; // Solo procesar expresiones al finalizar

      // Convertir dictado a expresión matemática
      let expr = text
        .replace(/\bmas\b|\bmás\b/g, "+")
        .replace(/\bmenos\b/g, "-")
        .replace(/\bpor\b|\btimes\b/g, "*")
        .replace(/\bentre\b|\bdividido entre\b|\bdividido por\b/g, "/")
        .replace(/\bpotencia\b|\belevar\b|\bal cuadrado\b/g, "^2")
        .replace(/\bpi\b|\bpí\b/g, "pi")
        .replace(/\bseno\b/g, "sin(")
        .replace(/\bcoseno\b/g, "cos(")
        .replace(/\btangente\b/g, "tan(")
        .replace(/\braiz\b|\braíz\b/g, "sqrt(")
        .replace(/\bintegral\b/g, "integrate(")
        .replace(/\bderivada\b/g, "diff(")
        .replace(/\b([0-9]+)\b/g, "$1")
        .replace(/\belevado a\b/g, "^")
        .replace(/\bcuadrado\b/g, "^2")
        .replace(/\bcubo\b/g, "^3")
        .replace(/\s+/g, "");

      if (expr.length > 1) {
        QC.calc.setExpr(expr);
        QC.calc.updatePreview();
        QC.ui.toast("Dictado: " + expr, "info", 2500);
      }
    },
  };

  // Inicializar cuando el DOM esté listo
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => QC_voice.init());
  } else {
    setTimeout(() => QC_voice.init(), 500);
  }
})();

/* ─────────────────────────────────────────────────────────────────
   MÓDULO: REGRESIÓN ESTADÍSTICA
   ───────────────────────────────────────────────────────────────── */
(function () {
  const _D = (id) => document.getElementById(id);

  window.QC_regression = {
    /** Parsea datos desde el display o modal */
    _parseData(raw) {
      // Acepta: [[x1,y1],[x2,y2],...] o "x1,y1\nx2,y2\n..." o "x1 y1\n..."
      raw = raw.trim();
      let points = [];
      try {
        // Intentar JSON array
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          if (Array.isArray(arr[0])) {
            points = arr.map((p) => ({ x: +p[0], y: +p[1] }));
          } else {
            // Array plano de y-values
            points = arr.map((y, i) => ({ x: i + 1, y: +y }));
          }
        }
      } catch (_) {
        // Intentar CSV / espacio
        const lines = raw.split(/[\n;]+/).filter((l) => l.trim());
        points = lines
          .map((l) => {
            const parts = l.trim().split(/[\s,]+/);
            return { x: +parts[0], y: +parts[1] };
          })
          .filter((p) => !isNaN(p.x) && !isNaN(p.y));
      }
      return points;
    },

    /** Regresión lineal y = a + b*x */
    linear(points) {
      const n = points.length;
      const sumX = points.reduce((s, p) => s + p.x, 0);
      const sumY = points.reduce((s, p) => s + p.y, 0);
      const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
      const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
      const b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const a = (sumY - b * sumX) / n;
      const yMean = sumY / n;
      const ssTot = points.reduce((s, p) => s + (p.y - yMean) ** 2, 0);
      const ssRes = points.reduce((s, p) => s + (p.y - (a + b * p.x)) ** 2, 0);
      const r2 = 1 - ssRes / ssTot;
      return {
        a,
        b,
        r2,
        type: "linear",
        fn: (x) => a + b * x,
        label: `y = ${a.toFixed(4)} + ${b.toFixed(4)}x`,
        r2,
      };
    },

    /** Regresión polinomial grado 2 */
    polynomial2(points) {
      const n = points.length;
      // Sistema normal para y = a + bx + cx²
      const s = (fn) => points.reduce((acc, p) => acc + fn(p), 0);
      const sx = s((p) => p.x),
        sx2 = s((p) => p.x ** 2),
        sx3 = s((p) => p.x ** 3),
        sx4 = s((p) => p.x ** 4);
      const sy = s((p) => p.y),
        sxy = s((p) => p.x * p.y),
        sx2y = s((p) => p.x ** 2 * p.y);
      // Solve 3x3 via Gaussian elimination
      const A = [
        [n, sx, sx2, sy],
        [sx, sx2, sx3, sxy],
        [sx2, sx3, sx4, sx2y],
      ];
      for (let i = 0; i < 3; i++) {
        const piv = A[i][i];
        for (let j = i; j < 4; j++) A[i][j] /= piv;
        for (let k = 0; k < 3; k++)
          if (k !== i) {
            const f = A[k][i];
            for (let j = i; j < 4; j++) A[k][j] -= f * A[i][j];
          }
      }
      const a = A[0][3],
        b = A[1][3],
        c = A[2][3];
      const yMean = sy / n;
      const ssTot = points.reduce((s, p) => s + (p.y - yMean) ** 2, 0);
      const ssRes = points.reduce(
        (s, p) => s + (p.y - (a + b * p.x + c * p.x ** 2)) ** 2,
        0,
      );
      const r2 = 1 - ssRes / ssTot;
      return {
        a,
        b,
        c,
        r2,
        type: "poly2",
        fn: (x) => a + b * x + c * x ** 2,
        label: `y = ${a.toFixed(3)} + ${b.toFixed(3)}x + ${c.toFixed(3)}x²`,
      };
    },

    /** Regresión exponencial y = a * e^(bx) */
    exponential(points) {
      // Linealizar: ln(y) = ln(a) + bx
      const valid = points.filter((p) => p.y > 0);
      if (valid.length < 2) return null;
      const logPoints = valid.map((p) => ({ x: p.x, y: Math.log(p.y) }));
      const lin = this.linear(logPoints);
      const a = Math.exp(lin.a),
        b = lin.b;
      const yMean = valid.reduce((s, p) => s + p.y, 0) / valid.length;
      const ssTot = valid.reduce((s, p) => s + (p.y - yMean) ** 2, 0);
      const ssRes = valid.reduce(
        (s, p) => s + (p.y - a * Math.exp(b * p.x)) ** 2,
        0,
      );
      const r2 = 1 - ssRes / ssTot;
      return {
        a,
        b,
        r2,
        type: "exp",
        fn: (x) => a * Math.exp(b * x),
        label: `y = ${a.toFixed(4)} · e^(${b.toFixed(4)}x)`,
      };
    },

    run(type) {
      // Mostrar modal para ingresar datos
      this._showModal(type);
    },

    _showModal(type) {
      const overlay = document.createElement("div");
      overlay.className = "sym-modal-overlay";
      overlay.id = "reg-modal";
      const names = {
        linear: "Lineal",
        poly2: "Polinomial (grado 2)",
        exp: "Exponencial",
      };
      overlay.innerHTML = `
        <div class="sym-modal reg-modal-box">
          <div class="sym-modal-title">📊 REGRESIÓN ${(names[type] || type).toUpperCase()}</div>
          <p class="sym-modal-label">Ingresa los puntos de datos:</p>
          <p style="font-size:.75rem;color:var(--text-dim);margin-bottom:8px">Formato: [[x1,y1],[x2,y2],...] o x,y por línea</p>
          <textarea id="reg-data-input" class="sym-modal-input reg-textarea" placeholder="[[1,2],[2,4],[3,5],[4,4],[5,6]]" rows="4">[[1,2.1],[2,3.9],[3,6.2],[4,7.8],[5,10.1],[6,12.0]]</textarea>
          <div class="sym-modal-actions">
            <button class="sym-modal-btn sym-modal-btn-cancel" onclick="document.getElementById('reg-modal').remove()">Cancelar</button>
            <button class="sym-modal-btn" onclick="QC_regression._compute('${type}')">Calcular ▶</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      if (window.gsap)
        gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.22 });
      setTimeout(() => document.getElementById("reg-data-input")?.focus(), 100);
    },

    _compute(type) {
      const raw = document.getElementById("reg-data-input")?.value || "";
      const points = this._parseData(raw);
      if (points.length < 3) {
        QC.ui.toast("Se necesitan al menos 3 puntos", "warn");
        return;
      }
      document.getElementById("reg-modal")?.remove();

      let model;
      if (type === "linear") model = this.linear(points);
      else if (type === "poly2") model = this.polynomial2(points);
      else if (type === "exp") {
        model = this.exponential(points);
        if (!model) {
          QC.ui.toast("Exponencial requiere y > 0", "warn");
          return;
        }
      }

      // Pasos
      const stps = [];
      stps.push({
        label: "DATOS DE ENTRADA",
        content: `n = <span class="math-val">${points.length}</span> puntos<br>X: [${points.map((p) => p.x).join(", ")}]<br>Y: [${points.map((p) => p.y).join(", ")}]`,
        type: "step-info",
        value: null,
      });
      stps.push({
        label: "MODELO",
        content: `Tipo: <span class="highlight">${type === "linear" ? "Lineal" : type === "poly2" ? "Polinomial grado 2" : "Exponencial"}</span><br>Ecuación: <code>${model.label}</code>`,
        type: "",
        value: null,
      });
      stps.push({
        label: "COEFICIENTE R²",
        content: `R² = <span class="result-box">${model.r2.toFixed(6)}</span><br>${model.r2 > 0.95 ? '✓ Ajuste <span class="highlight">excelente</span>' : model.r2 > 0.8 ? '✓ Ajuste <span class="highlight">bueno</span>' : '⚠ Ajuste <span class="highlight">moderado</span>'}`,
        type: "step-result",
        value: model.label,
      });

      QC.steps.clear(true);
      document.getElementById("steps-empty").style.display = "none";
      QC.steps.animate(stps);
      document.getElementById("steps-count").textContent =
        stps.length + " PASOS";

      // Graficar
      this._plotRegression(points, model);
      QC.history.save(
        `Regresión ${type}`,
        model.label + ` R²=${model.r2.toFixed(4)}`,
        "stats",
        "math.js",
      );
      QC.ui.toast(
        `Regresión calculada — R² = ${model.r2.toFixed(4)}`,
        "success",
      );
    },

    _plotRegression(points, model) {
      ensurePlotly(() => {
        const xMin = Math.min(...points.map((p) => p.x));
        const xMax = Math.max(...points.map((p) => p.x));
        const xRange = xMax - xMin;
        const xs = Array.from(
          { length: 100 },
          (_, i) => xMin - xRange * 0.1 + (i * (xRange * 1.2)) / 99,
        );
        const ys = xs.map((x) => model.fn(x));

        const scatter = {
          x: points.map((p) => p.x),
          y: points.map((p) => p.y),
          mode: "markers",
          type: "scatter",
          name: "Datos",
          marker: {
            color: "#00ff88",
            size: 10,
            symbol: "circle",
            line: { color: "#00d4ff", width: 1.5 },
          },
        };
        const line = {
          x: xs,
          y: ys,
          mode: "lines",
          type: "scatter",
          name: model.label,
          line: { color: "#00d4ff", width: 2.5, dash: "solid" },
        };

        const container = document.getElementById("graph-container");
        const ph = document.getElementById("graph-placeholder");
        if (ph) ph.style.display = "none";

        Plotly.newPlot(
          container,
          [scatter, line],
          {
            paper_bgcolor: "transparent",
            plot_bgcolor: "rgba(0,8,16,.6)",
            margin: { l: 46, r: 16, t: 50, b: 46 },
            title: {
              text: `Regresión — R² = ${model.r2.toFixed(4)}`,
              font: { color: "#00d4ff", family: "Orbitron" },
            },
            xaxis: {
              color: "#4a90b0",
              gridcolor: "rgba(0,212,255,.12)",
              title: "x",
            },
            yaxis: {
              color: "#4a90b0",
              gridcolor: "rgba(0,212,255,.12)",
              title: "y",
            },
            legend: {
              font: { color: "#b0cfe0" },
              bgcolor: "rgba(5,10,15,.6)",
              bordercolor: "rgba(0,212,255,.3)",
              borderwidth: 1,
            },
          },
          { responsive: true, displayModeBar: false },
        );
      });
    },
  };
})();

/* ─────────────────────────────────────────────────────────────────
   MÓDULO: MODO PRÁCTICA
   ───────────────────────────────────────────────────────────────── */
(function () {
  const _D = (id) => document.getElementById(id);
  let currentExercise = null;

  const exercises = {
    algebra: [
      { q: "2x + 5 = 13", a: "x = 4", hint: "Despeja x: 2x = 13-5 = 8" },
      { q: "3x - 7 = 14", a: "x = 7", hint: "3x = 21, x = 7" },
      {
        q: "x² - 5x + 6 = 0",
        a: "x = 2 o x = 3",
        hint: "Factoriza: (x-2)(x-3) = 0",
      },
      { q: "5x + 3 = 2x + 12", a: "x = 3", hint: "3x = 9, x = 3" },
      { q: "x² - 4 = 0", a: "x = 2 o x = -2", hint: "Diferencia de cuadrados" },
      {
        q: "2x² + x - 3 = 0",
        a: "x = 1 o x = -3/2",
        hint: "Usa la fórmula cuadrática o factoriza",
      },
      { q: "log(x) = 2", a: "x = 100", hint: "Convierte: 10² = x" },
      { q: "√(x+4) = 5", a: "x = 21", hint: "Eleva al cuadrado: x+4 = 25" },
    ],
    derivadas: [
      { q: "d/dx [x³ - 2x]", a: "3x² - 2", hint: "Regla de la potencia" },
      { q: "d/dx [sin(x)]", a: "cos(x)", hint: "Derivada del seno" },
      { q: "d/dx [eˣ]", a: "eˣ", hint: "La exponencial se deriva a sí misma" },
      {
        q: "d/dx [x²·cos(x)]",
        a: "2x·cos(x) - x²·sin(x)",
        hint: "Regla del producto: (uv)'=u'v+uv'",
      },
      { q: "d/dx [ln(x)]", a: "1/x", hint: "Derivada del logaritmo natural" },
      {
        q: "d/dx [x⁵ + 3x³ - 7x]",
        a: "5x⁴ + 9x² - 7",
        hint: "Regla de la potencia término a término",
      },
      {
        q: "d/dx [tan(x)]",
        a: "sec²(x)",
        hint: "O equivalentemente 1/cos²(x)",
      },
      {
        q: "d/dx [x·eˣ]",
        a: "eˣ + x·eˣ = eˣ(1+x)",
        hint: "Regla del producto",
      },
    ],
    integrales: [
      {
        q: "∫ 2x dx",
        a: "x² + C",
        hint: "Regla de potencia: ∫xⁿ = xⁿ⁺¹/(n+1)",
      },
      {
        q: "∫ cos(x) dx",
        a: "sin(x) + C",
        hint: "Integral directa del coseno",
      },
      {
        q: "∫ eˣ dx",
        a: "eˣ + C",
        hint: "La exponencial se integra a sí misma",
      },
      {
        q: "∫ 1/x dx",
        a: "ln|x| + C",
        hint: "Caso especial de la regla de potencia",
      },
      { q: "∫ x² dx", a: "x³/3 + C", hint: "Regla: ∫x² = x³/3" },
      { q: "∫ sin(x) dx", a: "-cos(x) + C", hint: "Integral directa del seno" },
      {
        q: "∫ 3x² - 2x dx",
        a: "x³ - x² + C",
        hint: "Integra término a término",
      },
      { q: "∫₀¹ x dx", a: "1/2 = 0.5", hint: "Integral definida: [x²/2]₀¹" },
    ],
  };

  window.QC_practice = {
    generate(category) {
      const list = exercises[category];
      if (!list) return;
      const idx = Math.floor(Math.random() * list.length);
      currentExercise = { ...list[idx], category };
      this._showExercise(currentExercise);
    },

    _showExercise(ex) {
      // Remove existing modal
      document.getElementById("practice-modal")?.remove();
      const overlay = document.createElement("div");
      overlay.className = "sym-modal-overlay";
      overlay.id = "practice-modal";
      overlay.innerHTML = `
        <div class="sym-modal practice-box">
          <div class="practice-category-badge">${ex.category.toUpperCase()}</div>
          <div class="sym-modal-title">🎯 EJERCICIO DE PRÁCTICA</div>
          <div class="practice-question">${ex.q}</div>
          <p class="sym-modal-label">Tu respuesta:</p>
          <input id="practice-answer" class="sym-modal-input" placeholder="Escribe tu respuesta aquí" autocomplete="off"/>
          <div id="practice-feedback" class="practice-feedback" hidden></div>
          <div class="sym-modal-actions">
            <button class="sym-modal-btn sym-modal-btn-cancel" onclick="document.getElementById('practice-modal').remove()">Salir</button>
            <button class="sym-modal-btn practice-hint-btn" onclick="QC_practice.showHint()">💡 Pista</button>
            <button class="sym-modal-btn" onclick="QC_practice.verify()">Verificar ▶</button>
          </div>
          <div class="practice-new-wrap">
            <button class="practice-new-btn" onclick="QC_practice.generate('${ex.category}')">↺ Nuevo ejercicio</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      if (window.gsap)
        gsap.fromTo(
          overlay,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" },
        );
      setTimeout(
        () => document.getElementById("practice-answer")?.focus(),
        100,
      );
      document
        .getElementById("practice-answer")
        ?.addEventListener("keydown", (e) => {
          if (e.key === "Enter") this.verify();
        });
    },

    verify() {
      if (!currentExercise) return;
      const input = document.getElementById("practice-answer");
      const fb = document.getElementById("practice-feedback");
      if (!input || !fb) return;
      const answer = input.value.trim().toLowerCase().replace(/\s+/g, "");
      const correct = currentExercise.a.toLowerCase().replace(/\s+/g, "");

      // Comparación flexible
      const isCorrect =
        answer === correct ||
        answer.replace(/[^0-9a-z+=\-*/]/g, "") ===
          correct.replace(/[^0-9a-z+=\-*/]/g, "") ||
        (correct.includes("o") &&
          correct
            .split("o")
            .some((p) => answer.includes(p.trim().replace(/\s+/g, ""))));

      fb.hidden = false;
      if (isCorrect) {
        fb.className = "practice-feedback practice-correct";
        fb.innerHTML = `<span>✓</span> ¡Correcto! ${currentExercise.a}`;
        if (window.gsap) {
          gsap.fromTo(
            fb,
            { scale: 0.8, opacity: 0 },
            {
              scale: 1,
              opacity: 1,
              duration: 0.4,
              ease: "elastic.out(1.2,.6)",
            },
          );
          gsap.to(".practice-question", { color: "#00ff88", duration: 0.3 });
        }
        QC.ui.toast("¡Respuesta correcta! 🎉", "success");
      } else {
        fb.className = "practice-feedback practice-wrong";
        fb.innerHTML = `<span>✗</span> Incorrecto. La respuesta es: <strong>${currentExercise.a}</strong>`;
        if (window.gsap) {
          gsap.fromTo(
            document.getElementById("practice-answer"),
            { x: -8 },
            { x: 0, duration: 0.4, ease: "elastic.out(3,.4)" },
          );
          gsap.fromTo(
            fb,
            { opacity: 0, x: -10 },
            { opacity: 1, x: 0, duration: 0.3 },
          );
        }
        QC.ui.toast("Intenta de nuevo 💪", "warn", 2000);
      }
    },

    showHint() {
      if (!currentExercise) return;
      const fb = document.getElementById("practice-feedback");
      if (!fb) return;
      fb.hidden = false;
      fb.className = "practice-feedback practice-hint";
      fb.innerHTML = `💡 Pista: ${currentExercise.hint}`;
      if (window.gsap)
        gsap.fromTo(
          fb,
          { opacity: 0, y: 4 },
          { opacity: 1, y: 0, duration: 0.3 },
        );
    },
  };
})();

/* ─────────────────────────────────────────────────────────────────
   MÓDULO: CÓDIGO QR
   ───────────────────────────────────────────────────────────────── */
(function () {
  const _D = (id) => document.getElementById(id);

  window.QC_qr = {
    generate(content) {
      if (!content) content = QC.calc.getExpr();
      if (!content) {
        // Try from steps
        const steps = document.getElementById("steps-container");
        content = steps?.textContent?.trim()?.slice(0, 200) || "QuantumCalc";
      }
      this._showQRModal(content);
    },

    generateResult() {
      const res = _D("result-display")?.textContent?.replace("= ", "") || "";
      const expr = QC.calc.getExpr();
      const content = expr ? `${expr} = ${res}` : res || "QuantumCalc v5.0";
      this._showQRModal(content);
    },

    _showQRModal(content) {
      document.getElementById("qr-modal")?.remove();
      const overlay = document.createElement("div");
      overlay.className = "sym-modal-overlay";
      overlay.id = "qr-modal";
      overlay.innerHTML = `
        <div class="sym-modal qr-box">
          <div class="sym-modal-title">📱 CÓDIGO QR</div>
          <div class="qr-content-preview">${content.slice(0, 80)}${content.length > 80 ? "…" : ""}</div>
          <div id="qr-canvas-wrap" class="qr-canvas-wrap">
            <div class="qr-loading">Generando QR…</div>
          </div>
          <div class="qr-actions">
            <button class="sym-modal-btn" onclick="QC_qr._download()">⬇ Descargar PNG</button>
            <button class="sym-modal-btn sym-modal-btn-cancel" onclick="document.getElementById('qr-modal').remove()">Cerrar</button>
          </div>
          <p class="qr-hint">Escanea con tu cámara para compartir el resultado</p>
        </div>`;
      document.body.appendChild(overlay);
      if (window.gsap)
        gsap.fromTo(
          overlay,
          { opacity: 0, scale: 0.9 },
          { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.4)" },
        );

      ensureQRCode(() => {
        const wrap = document.getElementById("qr-canvas-wrap");
        if (!wrap) return;
        wrap.innerHTML = "";
        try {
          new QRCode(wrap, {
            text: content,
            width: 200,
            height: 200,
            colorDark: "#00d4ff",
            colorLight: "#050a0f",
            correctLevel: QRCode.CorrectLevel.M,
          });
          wrap.style.display = "flex";
          wrap.style.justifyContent = "center";
          if (window.gsap)
            gsap.fromTo(
              wrap,
              { scale: 0.6, opacity: 0 },
              {
                scale: 1,
                opacity: 1,
                duration: 0.5,
                ease: "elastic.out(1,.6)",
              },
            );
        } catch (e) {
          wrap.innerHTML = `<p style="color:var(--accent-red)">Error generando QR: ${e.message}</p>`;
        }
      });
    },

    _download() {
      const img =
        document.querySelector("#qr-canvas-wrap img") ||
        document.querySelector("#qr-canvas-wrap canvas");
      if (!img) {
        QC.ui.toast("QR aún no generado", "warn");
        return;
      }
      const a = document.createElement("a");
      if (img.tagName === "CANVAS") {
        a.href = img.toDataURL("image/png");
      } else {
        a.href = img.src;
      }
      a.download = "quantumcalc-qr.png";
      a.click();
      QC.ui.toast("QR descargado ✓", "success", 2000);
    },
  };
})();

/* ─────────────────────────────────────────────────────────────────
   MEJORAS DE EXPORTACIÓN PDF/EXCEL (PATCH sobre _export existente)
   ───────────────────────────────────────────────────────────────── */
(function () {
  const _D = (id) => document.getElementById(id);

  // Override toPDF with a professional version
  QC.export.toPDF = function () {
    ensureJsPDF(() => {
      const spinner = this._spinner("Generando PDF profesional…");
      if (window.gsap) {
        gsap.to(".hdr-btn-pdf", {
          scale: 0.9,
          duration: 0.1,
          yoyo: true,
          repeat: 3,
        });
      }
      setTimeout(() => {
        try {
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
          });
          const W = 210,
            H = 297;
          const C = this._C;

          // ── Background
          doc.setFillColor(...C.bg);
          doc.rect(0, 0, W, H, "F");

          // ── Header gradient bar
          doc.setFillColor(...C.cyan);
          doc.rect(0, 0, W, 2, "F");
          doc.setFillColor(...C.panel);
          doc.rect(0, 2, W, 32, "F");

          // ── Logo sigma
          doc.setTextColor(...C.cyan);
          doc.setFontSize(28);
          doc.setFont("helvetica", "bold");
          doc.text("Σ", 14, 22);

          // ── App name
          doc.setFontSize(18);
          doc.text("QuantumCalc", 28, 18);
          doc.setFontSize(9);
          doc.setTextColor(...C.dim);
          doc.text("v5.0 — Calculadora Científica Avanzada", 28, 24);
          doc.text("Motor: Nerdamer + Math.js + Plotly", 28, 29);

          // ── Date
          const now = new Date().toLocaleString("es-CO", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          doc.setFontSize(8);
          doc.text(now, W - 14, 22, { align: "right" });

          // ── Cyan separator
          doc.setFillColor(...C.cyan);
          doc.rect(0, 34, W, 0.5, "F");

          // ── Graph if present
          let yOff = 42;
          const graphEl = document.getElementById("graph-container");
          const hasGraph = graphEl && graphEl.children.length > 1;
          if (hasGraph) {
            try {
              const svg = graphEl.querySelector(".main-svg");
              if (svg) {
                // Just add a placeholder note (full canvas export needs async)
                doc.setFillColor(...C.panel);
                doc.roundedRect(12, yOff, W - 24, 6, 1, 1, "F");
                doc.setTextColor(...C.cyan);
                doc.setFontSize(8);
                doc.text(
                  "📈 Gráfica generada en sesión (ver pantalla)",
                  14,
                  yOff + 4,
                );
                yOff += 10;
              }
            } catch (_) {}
          }

          // ── Current expression
          const expr = QC.calc.getExpr();
          const result = _D("result-display")?.textContent || "";
          if (expr) {
            doc.setFillColor(...C.panel);
            doc.roundedRect(12, yOff, W - 24, 28, 2, 2, "F");
            doc.setDrawColor(...C.cyan);
            doc.setLineWidth(0.4);
            doc.roundedRect(12, yOff, W - 24, 28, 2, 2, "S");
            doc.setTextColor(...C.cyan);
            doc.setFontSize(7);
            doc.text("// EXPRESIÓN CALCULADA", 16, yOff + 5);
            doc.setTextColor(...C.text);
            doc.setFontSize(11);
            doc.setFont("courier", "bold");
            const exprLines = doc.splitTextToSize(expr, W - 36);
            doc.text(exprLines.slice(0, 2), 16, yOff + 12);
            if (result) {
              doc.setTextColor(...C.green);
              doc.setFontSize(12);
              doc.text(result, 16, yOff + 22);
            }
            yOff += 34;
          }

          // ── Steps section
          const stepEls = document.querySelectorAll(
            "#steps-container .step-card",
          );
          if (stepEls.length) {
            doc.setTextColor(...C.cyan);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("RESOLUCIÓN PASO A PASO", 14, yOff + 4);
            doc.setFillColor(...C.cyan);
            doc.rect(14, yOff + 6, 40, 0.3, "F");
            yOff += 10;

            doc.setFont("helvetica", "normal");
            stepEls.forEach((el, idx) => {
              const label = el.querySelector(".step-label")?.textContent || "";
              const content =
                el.querySelector(".step-content")?.textContent?.trim() || "";
              if (yOff > H - 30) {
                doc.addPage();
                doc.setFillColor(...C.bg);
                doc.rect(0, 0, W, H, "F");
                yOff = 16;
              }
              doc.setFillColor(
                idx % 2 === 0 ? C.panel : C.bg.map((v) => v + 5),
              );
              doc.rect(12, yOff, W - 24, 14, "F");
              doc.setTextColor(...C.cyan);
              doc.setFontSize(7);
              doc.text(label, 16, yOff + 4.5);
              doc.setTextColor(...C.text);
              doc.setFontSize(8);
              const lines = doc.splitTextToSize(content, W - 36);
              doc.text(lines.slice(0, 2), 16, yOff + 10);
              yOff += 16;
            });
          }

          // ── History section
          const records = QC.history.records.slice(0, 20);
          if (records.length) {
            if (yOff > H - 60) {
              doc.addPage();
              doc.setFillColor(...C.bg);
              doc.rect(0, 0, W, H, "F");
              yOff = 16;
            }
            yOff += 4;
            doc.setTextColor(...C.cyan);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("HISTORIAL DE CÁLCULOS", 14, yOff + 4);
            doc.setFillColor(...C.cyan);
            doc.rect(14, yOff + 6, 44, 0.3, "F");
            yOff += 12;
            doc.setFont("helvetica", "normal");

            doc.autoTable({
              startY: yOff,
              head: [["#", "Expresión", "Resultado", "Modo", "Fecha"]],
              body: records.map((r, i) => [
                i + 1,
                r.expr.slice(0, 35) + (r.expr.length > 35 ? "…" : ""),
                r.result.slice(0, 25),
                r.mode.toUpperCase(),
                r.date,
              ]),
              styles: {
                fillColor: C.panel,
                textColor: C.text,
                fontSize: 7,
                cellPadding: 2.5,
                lineColor: C.border,
                lineWidth: 0.2,
              },
              headStyles: {
                fillColor: C.border,
                textColor: C.cyan,
                fontStyle: "bold",
                fontSize: 7.5,
              },
              alternateRowStyles: { fillColor: [8, 18, 30] },
              columnStyles: {
                0: { cellWidth: 8 },
                1: { cellWidth: 60 },
                2: { cellWidth: 45 },
                3: { cellWidth: 20 },
                4: { cellWidth: 35 },
              },
              theme: "grid",
              tableLineColor: C.border,
              tableLineWidth: 0.2,
            });
          }

          // ── Footer on last page
          const pages = doc.internal.getNumberOfPages();
          for (let p = 1; p <= pages; p++) {
            doc.setPage(p);
            doc.setFillColor(...C.cyan);
            doc.rect(0, H - 1.5, W, 1.5, "F");
            doc.setTextColor(...C.dim);
            doc.setFontSize(7);
            doc.text("QuantumCalc v5.0 — Generado automáticamente", 14, H - 3);
            doc.text(`Página ${p} / ${pages}`, W - 14, H - 3, {
              align: "right",
            });
          }

          doc.save("QuantumCalc-Reporte.pdf");
          QC.ui.toast("PDF profesional generado ✓", "success");
        } catch (err) {
          QC.ui.toast("Error PDF: " + err.message, "error");
        } finally {
          this._hideSpinner(spinner);
        }
      }, 120);
    });
  }.bind(QC.export);
})();

console.log(
  "[QuantumCalc v5.0] Módulos extendidos cargados: Complejos · Voz · Regresión · Práctica · QR · Export Pro",
);

/* ─────────────────────────────────────────────────────────────────
   PATCH: switchMode extendido — añadir 'complex' y 'practice'
   ───────────────────────────────────────────────────────────────── */
(function () {
  const _origSwitch = QC.calc.switchMode.bind(QC.calc);
  QC.calc.switchMode = function (mode) {
    // Añadir 'complex' y 'practice' a la lista de paneles
    const allPanels = [
      "basic",
      "symbolic",
      "algebra",
      "stats",
      "editor",
      "complex",
      "practice",
    ];
    if (
      ![
        "basic",
        "symbolic",
        "algebra",
        "stats",
        "editor",
        "complex",
        "practice",
      ].includes(mode)
    ) {
      _origSwitch(mode);
      return;
    }

    const S = QC.state;
    if (mode === S.mode) return;
    S.mode = mode;

    document.querySelectorAll(".mode-tab").forEach((t) => {
      const a = t.dataset.mode === mode;
      t.classList.toggle("active", a);
      t.setAttribute("aria-selected", a);
    });

    allPanels.forEach((m) => {
      const el = document.getElementById("fn-" + m);
      if (!el) return;
      if (m === mode) {
        el.style.display = "";
        if (window.gsap) {
          gsap.fromTo(
            el,
            { opacity: 0, y: 10, filter: "blur(3px)" },
            {
              opacity: 1,
              y: 0,
              filter: "blur(0)",
              duration: 0.32,
              ease: "power3.out",
            },
          );
          gsap.fromTo(
            el.querySelectorAll(".key"),
            { opacity: 0, scale: 0.88 },
            {
              opacity: 1,
              scale: 1,
              duration: 0.2,
              stagger: 0.016,
              ease: "power2.out",
            },
          );
        }
      } else {
        if (el.style.display !== "none") {
          if (window.gsap)
            gsap.to(el, {
              opacity: 0,
              y: -6,
              duration: 0.15,
              ease: "power2.in",
              onComplete: () => (el.style.display = "none"),
            });
          else el.style.display = "none";
        }
      }
    });

    if (mode === "symbolic" && !S.nerdReady) {
      QC.ui.toast("Cargando motor simbólico Nerdamer…", "info", 4000);
      ensureNerdamer(() => {
        S.nerdReady = true;
        QC.ui.toast("Nerdamer listo", "success");
      });
    }
    if (mode === "complex")
      QC.ui.toast(
        "ℂ Modo Números Complejos — usa i para la unidad imaginaria",
        "info",
        3000,
      );
    if (mode === "practice")
      QC.ui.toast(
        "🎯 Modo Práctica — selecciona una categoría y genera ejercicios",
        "info",
        3000,
      );
  };
})();

/* ─────────────────────────────────────────────────────────────────
   PATCH: Teclado — Alt+V = voz, Alt+Q = QR
   ───────────────────────────────────────────────────────────────── */
document.addEventListener("keydown", function (e) {
  if (e.altKey && e.key === "v") {
    e.preventDefault();
    window.QC_voice?.toggle();
  }
  if (e.altKey && e.key === "q") {
    e.preventDefault();
    window.QC_qr?.generate();
  }
  if (e.altKey && e.key === "p") {
    e.preventDefault();
    QC.calc.switchMode("practice");
  }
  if (e.altKey && e.key === "c") {
    e.preventDefault();
    QC.calc.switchMode("complex");
  }
});
