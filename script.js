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
function _cleanOCR(raw) {
  let s = (raw || "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, "")
    .replace(/[×xX✕]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\|/g, "")
    .trim();
  for (const c of [
    s,
    s.replace(/[^0-9+\-*/()^.=xyπsincostalogexpabssqrt]/g, ""),
  ]) {
    try {
      if (c.length > 0 && window.math) {
        math.parse(c);
        return c;
      }
    } catch (_) {}
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

    /* ── INTEGRAL INDEFINIDA ─────────────────────────── */
    indefiniteIntegral(f, variable = "x") {
      if (!f) {
        ui.toast("Formato: integrate(f(x), x)", "warn");
        return;
      }

      const stps = [];
      stps.push({
        label: "INTEGRAL INDEFINIDA — PLANTEAMIENTO",
        content: `Calcular: <span class="integral-sym">∫</span> <code>${_esc(f)}</code> d${_esc(variable)}<br>
               <span class="engine-badge engine-nerdamer">NERDAMER</span>`,
        type: "step-integral",
        value: null,
      });

      // Detectar método de integración
      const method = this._detectIntegrationMethod(f, variable);
      stps.push({
        label: "MÉTODO DETECTADO",
        content: `<span class="highlight">${_esc(method.name)}</span><br>${_esc(method.description)}`,
        type: "step-info",
        value: null,
      });

      // Agregar pasos específicos del método
      method.steps.forEach((s) => stps.push(s));

      // Calcular con Nerdamer
      try {
        let result;
        if (method.type === "partial_fractions") {
          result = this._integrateWithPartialFractions(f, variable, stps);
        } else {
          const raw = nerdamer(`integrate(${f}, ${variable})`).toString();
          result = this._cleanNerdResult(raw);

          if (method.type === "substitution" && method.substDetails) {
            stps.push({
              label: "SUSTITUCIÓN APLICADA",
              content: method.substDetails,
              type: "step-nerd",
              value: null,
            });
          }

          stps.push({
            label: "INTEGRACIÓN",
            content: `<span class="integral-sym">∫</span> <code>${_esc(f)}</code> d${_esc(variable)} <span class="arrow-right">→</span><br>
                   <span class="result-box">${_esc(result)} + C</span>`,
            type: "step-result",
            value: result + " + C",
          });
        }

        // Verificación: derivar el resultado
        try {
          const resultNoC = result.replace(/\s*\+\s*C\s*$/, "");
          const check = nerdamer(`diff(${resultNoC}, ${variable})`).toString();
          const checkSimp = this._cleanNerdResult(check);
          stps.push({
            label: "VERIFICACIÓN (d/dx del resultado)",
            content: `d/d${_esc(variable)} [${_esc(resultNoC)}] = <code>${_esc(checkSimp)}</code>`,
            type: "step-info",
            value: null,
          });
        } catch (_) {}

        this._commitSteps(stps, result + " + C", "integral");
        hist.save(
          `∫(${f})d${variable}`,
          result + " + C",
          "integral",
          "nerdamer",
        );
      } catch (err) {
        stps.push({
          label: "ERROR",
          content: `⚠ Nerdamer: ${_esc(err.message)}<br>Intenta reformatear la expresión.`,
          type: "step-error",
          value: null,
        });
        this._commitSteps(stps, null, "integral");
      }
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

    /* ── DETECCIÓN DEL MÉTODO DE INTEGRACIÓN ─────── */
    _detectIntegrationMethod(f, variable) {
      const expr = f.toLowerCase().replace(/\s/g, "");

      // ¿Fracción racional? numerador sin x, denominador polinomial grado ≥ 2
      if (this._isRationalFraction(f, variable)) {
        return {
          type: "partial_fractions",
          name: "FRACCIONES PARCIALES",
          description:
            "El integrando es una fracción racional. Se descompondrá en fracciones parciales.",
          steps: [],
        };
      }

      // ¿Contiene ln, log, arctan, arcsin → por partes?
      if (/\bln\b|\blog\b|arctan|arcsin|arccos/.test(expr) && /\*/.test(expr)) {
        return {
          type: "by_parts",
          name: "INTEGRACIÓN POR PARTES",
          description: "∫u·dv = u·v − ∫v·du. Identificar u y dv.",
          steps: [
            {
              label: "REGLA DE INTEGRACIÓN",
              content:
                "∫ u dv = u·v − ∫ v du<br>Elegir u de forma que simplifique al derivar.",
              type: "step-info",
              value: null,
            },
          ],
        };
      }

      // Sustitución lineal: función de (ax+b)
      const substMatch = f.match(/\(([0-9a-z/*+\-]+)[xX]([+\-][^)]+)?\)/);
      if (substMatch) {
        const u = substMatch[0].slice(1, -1);
        const substDetails = `<span class="substitution-box">Sea u = <code>${_esc(u)}</code><br>du = d(${_esc(u)})/${_esc(variable)} · d${_esc(variable)}</span>`;
        return {
          type: "substitution",
          name: "SUSTITUCIÓN LINEAL",
          description: `Se aplica sustitución u = ${u}`,
          substDetails,
          steps: [
            {
              label: "CAMBIO DE VARIABLE",
              content: substDetails,
              type: "step-info",
              value: null,
            },
          ],
        };
      }

      // Directa
      return {
        type: "direct",
        name: "INTEGRACIÓN DIRECTA",
        description:
          "Aplicar reglas básicas de integración (potencias, funciones elementales).",
        steps: [
          {
            label: "REGLAS APLICADAS",
            content:
              "∫xⁿ dx = xⁿ⁺¹/(n+1) + C<br>∫sin(x) dx = −cos(x) + C<br>∫cos(x) dx = sin(x) + C<br>∫1/x dx = ln|x| + C<br>∫eˣ dx = eˣ + C",
            type: "step-info",
            value: null,
          },
        ],
      };
    },

    /** Detecta si f es una fracción racional en 'variable' */
    _isRationalFraction(f, variable) {
      if (!f.includes("/")) return false;
      const parts = f.split("/");
      if (parts.length < 2) return false;
      const denominator = parts.slice(1).join("/");
      // Si el denominador tiene x² o productos de lineales
      return (
        /[xX]\^2|\([^)]+[xX][^)]*\)\s*\*\s*\(/.test(denominator) ||
        /[xX]\s*\*\s*[xX]/.test(denominator) ||
        /[0-9][xX]\^2/.test(denominator)
      );
    },

    /* ── INTEGRACIÓN CON FRACCIONES PARCIALES ─────── */
    _integrateWithPartialFractions(f, variable, stps) {
      stps.push({
        label: "PASO 1 · FRACCIONES PARCIALES",
        content: "Descomponiendo la fracción racional en términos más simples.",
        type: "step-factor",
        value: null,
      });

      let decomposed = null;
      try {
        // Usar nerdamer para la descomposición
        decomposed = nerdamer(`partfrac(${f}, ${variable})`).toString();
        decomposed = this._cleanNerdResult(decomposed);
        stps.push({
          label: "DESCOMPOSICIÓN EN FRACCIONES PARCIALES",
          content: `<span class="partial-frac-box">${_esc(f)} = ${_esc(decomposed)}</span>`,
          type: "step-nerd",
          value: null,
        });
      } catch (_) {
        // Fallback: intentar factorizar el denominador manualmente
        stps.push({
          label: "NOTA",
          content:
            "Procediendo con integración directa (descomposición manual no disponible).",
          type: "step-info",
          value: null,
        });
      }

      // Integrar la expresión descompuesta (o la original)
      const toIntegrate = decomposed || f;
      const raw = nerdamer(`integrate(${toIntegrate}, ${variable})`).toString();
      const result = this._cleanNerdResult(raw);

      stps.push({
        label: "PASO 2 · INTEGRACIÓN TÉRMINO A TÉRMINO",
        content: `<span class="integral-sym">∫</span> [${_esc(toIntegrate)}] d${_esc(variable)}<br>= <span class="result-box">${_esc(result)}</span> + C`,
        type: "step-result",
        value: result + " + C",
      });

      // Intentar simplificar logaritmos: ln|a| + ln|b| → ln|a·b|
      if (result.includes("log") || result.includes("ln")) {
        try {
          const simplified = nerdamer(`simplify(${result})`).toString();
          const simpClean = this._cleanNerdResult(simplified);
          if (simpClean !== result) {
            stps.push({
              label: "PASO 3 · SIMPLIFICACIÓN",
              content: `Usando propiedades de logaritmos:<br><span class="result-box">${_esc(simpClean)} + C</span>`,
              type: "step-result",
              value: simpClean + " + C",
            });
            return simpClean + " + C";
          }
        } catch (_) {}
      }

      return result + " + C";
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
   MÓDULO: steps
   ════════════════════════════════════════════════════ */
  const steps = {
    _card(label, body, type = "") {
      const box = D("steps-container");
      if (!box) return null;
      const card = document.createElement("div");
      card.className = `step-card ${type}`;
      card.innerHTML = `<div class="step-number">${_esc(label)}</div><div class="step-content">${body}</div>`;
      box.appendChild(card);
      return card;
    },
    animate(stps) {
      if (!stps?.length) return;
      if (!gsap) {
        stps.forEach((s) => this._card(s.label, s.content, s.type || ""));
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      stps.forEach((s, i) => {
        const card = this._card(s.label, s.content, s.type || "");
        if (!card) return;
        tl.fromTo(
          card,
          { opacity: 0, x: -26, scale: 0.97, filter: "blur(3px)" },
          { opacity: 1, x: 0, scale: 1, filter: "blur(0)", duration: 0.36 },
          i * 0.17,
        );
        tl.call(
          () => card.scrollIntoView({ behavior: "smooth", block: "nearest" }),
          [],
          i * 0.17 + 0.1,
        );
      });
      tl.call(() => {
        const last = D("steps-container")?.lastElementChild;
        if (last && last.id !== "steps-empty")
          gsap
            .timeline()
            .to(last, {
              boxShadow: "0 0 24px rgba(0,255,136,.3)",
              borderColor: "rgba(0,255,136,.5)",
              duration: 0.35,
            })
            .to(last, {
              boxShadow: "none",
              borderColor: "var(--border-dim)",
              duration: 0.55,
              ease: "power2.inOut",
            });
      });
    },
    clear(silent = false) {
      const box = D("steps-container");
      if (!box) return;
      const cards = [...box.children].filter((c) => c.id !== "steps-empty");
      if (!cards.length) {
        if (!silent) D("steps-empty").style.display = "";
        return;
      }
      if (gsap && !silent) {
        gsap.to(cards, {
          opacity: 0,
          x: 14,
          scale: 0.95,
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
   MÓDULO: ocr
   ════════════════════════════════════════════════════ */
  const ocr = {
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
        this.process(f);
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
      this.process(f);
    },
    async process(file) {
      const zone = D("ocr-drop-zone"),
        bar = D("ocr-bar"),
        statusEl = D("ocr-status"),
        prog = D("ocr-progress");
      if (!zone || !bar || !statusEl || !prog) return;
      zone.classList.add("processing");
      prog.style.display = "block";
      bar.style.width = "0%";
      statusEl.textContent = "Cargando Tesseract…";
      if (gsap) {
        gsap
          .timeline()
          .to(zone, { borderColor: "var(--accent-orange)", duration: 0.18 })
          .to(".ocr-icon", {
            rotation: 15,
            scale: 1.2,
            duration: 0.28,
            ease: "power2.out",
          })
          .to(".ocr-icon", {
            rotation: 0,
            scale: 1,
            duration: 0.28,
            ease: "bounce.out",
          });
      }
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
              "0123456789+-*/()^.=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ πΩ√∑∫",
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
          statusEl.textContent = "✓ Completado";

          // Intentar convertir a expresión compatible con Nerdamer/Math.js
          const cleaned = _cleanOCR(text) || this._ocrToMathExpr(text);
          if (cleaned) {
            if (gsap) {
              gsap
                .timeline()
                .to(D("input-display"), { opacity: 0, y: -6, duration: 0.18 })
                .call(() => {
                  calc.setExpr(cleaned);
                  calc.updatePreview();
                })
                .to(D("input-display"), {
                  opacity: 1,
                  y: 0,
                  duration: 0.28,
                  ease: "power3.out",
                });
            } else {
              calc.setExpr(cleaned);
              calc.updatePreview();
            }
            ui.toast("Ecuación detectada: " + cleaned, "success");
            setTimeout(() => calc.calculate(), 900);
          } else {
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
          zone.classList.remove("processing");
          if (gsap)
            gsap.to(zone, {
              borderColor: "var(--border-bright)",
              duration: 0.35,
            });
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
          }, 2800);
        }
      });
    },
    /** Intenta convertir texto OCR de notación matemática estándar */
    _ocrToMathExpr(text) {
      let s = (text || "").replace(/\n/g, " ").trim();
      // Detectar integral: ∫ ... dx
      const intMatch = s.match(/∫\s*(.+?)\s*d([a-z])/i);
      if (intMatch)
        return `integrate(${_cleanOCRRaw(intMatch[1])}, ${intMatch[2]})`;
      // Detectar límite: lim ... →
      const limMatch = s.match(/lim\s*[a-z]\s*→\s*([^\s]+)\s*(.+)/i);
      if (limMatch)
        return `limit(${_cleanOCRRaw(limMatch[2])}, x, ${limMatch[1]})`;
      return _cleanOCRRaw(s);
    },
  };

  function _cleanOCRRaw(s) {
    return (s || "")
      .replace(/[×xX✕]/g, "*")
      .replace(/÷/g, "/")
      .replace(/[−–—]/g, "-")
      .replace(/²/g, "^2")
      .replace(/³/g, "^3")
      .replace(/\s+/g, "")
      .trim();
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
   INICIALIZACIÓN
   ════════════════════════════════════════════════════ */
  function init() {
    hist.load();
    const d = D("input-display");
    if (d) d.textContent = "";
    calc.updatePreview();
    ui.init();
    ocr.initDragDrop();

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
    });

    hist.render();
    hist._badge();
    ui.toast("QuantumCalc v3.0 — Nerdamer + Math.js cargando…", "info", 3000);
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
    toast: (m, t) => ui.toast(m, t),
    state: S,
  };
})();
