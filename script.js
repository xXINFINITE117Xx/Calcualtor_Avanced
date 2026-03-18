/* ═══════════════════════════════════════════════════════════════════
   script.js — QuantumCalc v2.6
   Arquitectura: namespace window.QC con módulos (ui, calc, steps,
   graph, ocr, history, export). Sin variables globales sueltas.
   Todos los métodos tienen try/catch y validación de entradas.
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────────
   UTILIDADES PURAS (sin efectos secundarios)
   ───────────────────────────────────────────────────────────────── */

/** Escapa HTML para prevenir XSS */
function _esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Formatea un valor numérico o de math.js */
function _fmt(v) {
  if (v == null) return "";
  if (typeof v === "number") {
    if (!isFinite(v)) return v > 0 ? "∞" : "-∞";
    return Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(10)));
  }
  return typeof v.toString === "function" ? v.toString() : String(v);
}

/** Valida expresión: no vacía, paréntesis balanceados */
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

/** Normaliza texto OCR → expresión math.js evaluable */
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
  for (const candidate of [
    s,
    s.replace(/[^0-9+\-*/()^.=xyπsincostalogexpabssqrt]/g, ""),
  ]) {
    try {
      if (candidate.length > 0 && window.math) {
        math.parse(candidate);
        return candidate;
      }
    } catch (_) {
      /* continuar */
    }
  }
  return null;
}

/** Factores primos para enteros pequeños */
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

/** Aproximación de fracción (fracciones continuas) */
function _frac(x, tol = 1e-6, maxD = 1000) {
  let h1 = 1,
    h2 = 0,
    k1 = 0,
    k2 = 1,
    b = Math.abs(x);
  const sign = x < 0 ? "-" : "";
  do {
    const a = Math.floor(b),
      aux = h1;
    h1 = a * h1 + h2;
    h2 = aux;
    const ak = k1;
    k1 = a * k1 + k2;
    k2 = ak;
    b = 1 / (b - a);
  } while (Math.abs(Math.abs(x) - h1 / k1) > Math.abs(x) * tol && k1 <= maxD);
  return k1 === 1 ? null : `${sign}${h1}/${k1}`;
}

/* ─────────────────────────────────────────────────────────────────
   NAMESPACE QC
   ───────────────────────────────────────────────────────────────── */
window.QC = (() => {
  /* ── Estado global compartido ── */
  const S = {
    mode: "basic", // modo actual del teclado
    allSteps: [], // pasos del último cálculo
    busy: false, // bloquea cálculos dobles
    histOpen: false, // drawer abierto/cerrado
    typingTimer: null, // timeout del indicador de escritura
  };

  /* ── Acceso rápido a elementos DOM (lazy, no cachea nulos) ── */
  const D = (id) => document.getElementById(id);

  /* ════════════════════════════════════════════════════
   MÓDULO: ui — animaciones, reloj, menú, toasts
   ════════════════════════════════════════════════════ */
  const ui = {
    init() {
      this._initAnimations();
      this._initClock();
      this._initMobileMenu();
      this._initScrollHeader();
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

    /** Muestra un toast de notificación */
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
      } else {
        setTimeout(() => el.remove(), ms);
      }
    },

    /** Pulso visual en el display al insertar un carácter */
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

    /** Muestra el indicador de puntos mientras el usuario escribe */
    triggerTyping() {
      const ind = D("typing-indicator");
      if (!ind) return;
      ind.classList.add("visible");
      clearTimeout(S.typingTimer);
      S.typingTimer = setTimeout(() => ind.classList.remove("visible"), 1200);
    },
  };

  /* ════════════════════════════════════════════════════
   MÓDULO: calc — expresiones, cálculo, modos, simbólico
   ════════════════════════════════════════════════════ */
  const calc = {
    /** Lee la expresión del display y normaliza símbolos */
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

    /** Inserta texto al final de la expresión */
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
      }
    },

    /** Vista previa en tiempo real mientras se escribe */
    updatePreview() {
      const el = D("result-display");
      if (!el) return;
      try {
        const e = this.getExpr();
        if (!e || e.length < 2 || !window.math) {
          el.textContent = "";
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
        } else {
          el.textContent = "";
        }
      } catch (_) {
        el.textContent = "";
      }
    },

    /** Cambia el modo del teclado con animación */
    switchMode(mode) {
      if (mode === S.mode) return;
      S.mode = mode;
      document.querySelectorAll(".mode-tab").forEach((t) => {
        const a = t.dataset.mode === mode;
        t.classList.toggle("active", a);
        t.setAttribute("aria-selected", a);
      });
      ["basic", "algebra", "stats"].forEach((m) => {
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
      const tab = document.querySelector(`.mode-tab[data-mode="${mode}"]`);
      if (tab && gsap)
        gsap.fromTo(
          tab,
          { boxShadow: "0 0 18px rgba(0,212,255,.55)" },
          { boxShadow: "none", duration: 0.5 },
        );
    },

    /** Cálculo principal con pasos explicativos */
    calculate() {
      if (!window.math) {
        ui.toast("Math.js aún no está listo. Espera un momento.", "warn");
        return;
      }
      const expr = this.getExpr();
      if (!expr) {
        ui.toast("Escribe una expresión primero", "warn");
        return;
      }
      if (!_validExpr(expr)) {
        ui.toast("Expresión inválida: revisa los paréntesis", "error");
        return;
      }
      if (S.busy) return;
      S.busy = true;

      // Flash "procesando"
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
          const stps = this._buildSteps(expr);
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
            } else if (r) {
              r.textContent = "= " + lastVal;
            }
            hist.save(expr, lastVal, S.mode);
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

    /** Genera pasos explicativos para una expresión */
    _buildSteps(expr) {
      const stps = [];
      const node = math.parse(expr);

      stps.push({
        label: "PASO 1 · EXPRESIÓN ORIGINAL",
        content: `<span class="highlight">Entrada:</span> <span class="math-val">${_esc(expr)}</span>`,
        type: "",
        value: null,
      });
      stps.push({
        label: "PASO 2 · ANÁLISIS SINTÁCTICO",
        content: `Tipo: <span class="highlight">${_esc(node.type)}</span><br>Forma: <span class="math-val">${_esc(node.toString())}</span>`,
        type: "",
        value: null,
      });

      // Constantes
      const csubs = [];
      if (expr.includes("pi"))
        csubs.push(
          `π <span class="op-symbol">→</span> <span class="math-val">${Math.PI.toFixed(8)}</span>`,
        );
      if (/\be\b/.test(expr))
        csubs.push(
          `e <span class="op-symbol">→</span> <span class="math-val">${Math.E.toFixed(8)}</span>`,
        );
      if (csubs.length)
        stps.push({
          label: "PASO 3 · CONSTANTES",
          content: csubs.join("<br>"),
          type: "",
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
              label: `PASO ${stps.length + 1} · SUB-EXPRESIÓN`,
              content: `<span class="highlight">${_esc(sub)}</span> <span class="op-symbol">=</span> <span class="math-val">${_esc(_fmt(sv))}</span>`,
              type: "",
              value: null,
            });
        } catch (_) {}
      });

      // Resultado
      const result = math.evaluate(expr);
      const rv = _fmt(result);
      stps.push({
        label: `PASO ${stps.length + 1} · RESULTADO`,
        content: `<span class="highlight">${_esc(expr)}</span> <span class="op-symbol">=</span> <span class="math-val">${_esc(rv)}</span>`,
        type: "step-result",
        value: rv,
      });

      // Propiedades
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
              `Factores primos: <span class="math-val">${pf.join(" × ")}</span>`,
            );
        }
        if (!Number.isInteger(result)) {
          const fc = _frac(result);
          if (fc) props.push(`Fracción ≈ <span class="math-val">${fc}</span>`);
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

    /* ── Operaciones simbólicas (patrón DRY con _symbolic) ── */
    _symbolic(label, fn) {
      if (!window.math) {
        ui.toast("Math.js no disponible", "warn");
        return;
      }
      const expr = this.getExpr();
      if (!expr) {
        ui.toast(`Ingresa una expresión para ${label}`, "warn");
        return;
      }
      steps.clear(true);
      D("steps-empty").style.display = "none";
      S.allSteps = [];
      const stps = [];
      stps.push({
        label: `${label} — ENTRADA`,
        content: `<span class="math-val">${_esc(expr)}</span>`,
        type: "",
        value: null,
      });
      try {
        fn(stps, expr);
      } catch (e) {
        stps.push({
          label: "ERROR",
          content: `⚠ ${_esc(e.message)}`,
          type: "step-error",
          value: null,
        });
        ui.toast(`${label}: ${e.message}`, "error");
      }
      S.allSteps = stps;
      D("steps-count").textContent = stps.length + " PASOS";
      steps.animate(stps);
      const lv = [...stps].reverse().find((s) => s.value != null)?.value;
      if (lv) hist.save(expr, lv, label.toLowerCase().replace(/\s/g, ""));
    },

    runDerivative() {
      this._symbolic("DERIVADA", (stps, expr) => {
        stps.push({
          label: "DERIVADA — PROCESO",
          content: `<span class="op-symbol">d/dx</span> [<span class="highlight">${_esc(expr)}</span>]`,
          type: "",
          value: null,
        });
        const d = math.simplify(math.derivative(expr, "x"));
        stps.push({
          label: "DERIVADA — RESULTADO",
          content: `<span class="highlight">f′(x)</span> <span class="op-symbol">=</span> <span class="math-val">${_esc(d.toString())}</span>`,
          type: "step-result",
          value: d.toString(),
        });
        this.setExpr(d.toString());
        this.updatePreview();
        ui.toast("Derivada calculada", "success");
      });
    },

    runSimplify() {
      this._symbolic("SIMPLIFICACIÓN", (stps, expr) => {
        const s = math.simplify(expr);
        stps.push({
          label: "SIMPLIFICACIÓN — RESULTADO",
          content: `<span class="highlight">${_esc(expr)}</span> <span class="op-symbol">→</span> <span class="math-val">${_esc(s.toString())}</span>`,
          type: "step-result",
          value: s.toString(),
        });
        this.setExpr(s.toString());
        this.updatePreview();
        ui.toast("Simplificado", "success");
      });
    },

    runIntegral() {
      this._symbolic("INTEGRAL", (stps, expr) => {
        const a = 0,
          b = 1,
          n = 1000,
          h = (b - a) / n;
        let sum = math.evaluate(expr, { x: a }) + math.evaluate(expr, { x: b });
        for (let i = 1; i < n; i++)
          sum += (i % 2 === 0 ? 2 : 4) * math.evaluate(expr, { x: a + i * h });
        const res = (h / 3) * sum;
        stps.push({
          label: "INTEGRAL — MÉTODO",
          content: `Simpson 1/3 · n=<span class="highlight">1000</span> · h=<span class="math-val">${h.toFixed(8)}</span>`,
          type: "",
          value: null,
        });
        stps.push({
          label: "INTEGRAL — RESULTADO",
          content: `<span class="op-symbol">∫₀¹</span> <span class="highlight">${_esc(expr)}</span> dx <span class="op-symbol">≈</span> <span class="math-val">${res.toFixed(10)}</span>`,
          type: "step-result",
          value: res.toFixed(10),
        });
        const r = D("result-display");
        if (r) r.textContent = "∫ = " + res.toFixed(10);
        ui.toast("Integral numérica calculada", "success");
      });
    },

    runSolve() {
      this._symbolic("SOLVE", (stps, expr) => {
        let clean = expr;
        if (expr.includes("=")) {
          const [l, r] = expr.split("=");
          clean = `(${l.trim()})-(${r.trim()})`;
        }
        stps.push({
          label: "SOLVE — FORMA ESTÁNDAR",
          content: `f(x)=0: <span class="highlight">${_esc(clean)}</span>`,
          type: "",
          value: null,
        });
        stps.push({
          label: "SOLVE — MÉTODO",
          content: "Bisección iterativa en [-100, 100]",
          type: "",
          value: null,
        });
        const roots = this._bisect(clean, -100, 100);
        if (roots.length) {
          stps.push({
            label: "SOLVE — RAÍCES",
            content: roots
              .map(
                (r, i) =>
                  `<span class="highlight">x${i ? i + 1 : ""}</span> <span class="op-symbol">=</span> <span class="math-val">${r.toFixed(8)}</span>`,
              )
              .join("<br>"),
            type: "step-result",
            value: roots.map((r) => r.toFixed(6)).join(", "),
          });
          ui.toast(`${roots.length} raíz(ces) encontrada(s)`, "success");
        } else {
          stps.push({
            label: "SIN RAÍCES REALES",
            content: "No se encontraron raíces reales en [-100, 100].",
            type: "step-warning",
            value: null,
          });
          ui.toast("Sin raíces reales en el rango", "info");
        }
      });
    },

    _bisect(expr, from, to, step = 0.5) {
      const roots = [];
      let prev = null;
      for (let x = from; x <= to; x += step) {
        try {
          const v = math.evaluate(expr, { x });
          if (!isFinite(v)) {
            prev = null;
            continue;
          }
          if (prev !== null && Math.sign(v) !== Math.sign(prev.v)) {
            let lo = prev.x,
              hi = x;
            for (let i = 0; i < 60; i++) {
              const mid = (lo + hi) / 2,
                fmid = math.evaluate(expr, { x: mid });
              if (Math.abs(fmid) < 1e-10) {
                roots.push(mid);
                break;
              }
              Math.sign(fmid) === Math.sign(math.evaluate(expr, { x: lo }))
                ? (lo = mid)
                : (hi = mid);
              if (i === 59) roots.push((lo + hi) / 2);
            }
          }
          prev = { x, v };
        } catch (_) {
          prev = null;
        }
      }
      return roots
        .filter((r, i) => roots.findIndex((o) => Math.abs(o - r) < 1e-5) === i)
        .slice(0, 8);
    },

    runHistogram() {
      if (!window.math) {
        ui.toast("Math.js no disponible", "warn");
        return;
      }
      const expr = this.getExpr();
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
            ui.toast("Error al graficar: " + e.message, "error");
          }
        });

        // Stats en pasos
        steps.clear(true);
        D("steps-empty").style.display = "none";
        const st = [
          {
            label: "MEDIA",
            content: `μ <span class="op-symbol">=</span> <span class="math-val">${math.mean(flat).toFixed(6)}</span>`,
            type: "",
            value: null,
          },
          {
            label: "MEDIANA",
            content: `Mediana <span class="op-symbol">=</span> <span class="math-val">${math.median(flat).toFixed(6)}</span>`,
            type: "",
            value: null,
          },
          {
            label: "DESV.ESTÁNDAR",
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
            label: "RANGO",
            content: `min=<span class="highlight">${math.min(flat)}</span>  max=<span class="highlight">${math.max(flat)}</span>  N=<span class="math-val">${flat.length}</span>`,
            type: "step-result",
            value: "",
          },
        ];
        S.allSteps = st;
        D("steps-count").textContent = st.length + " PASOS";
        steps.animate(st);
        ui.toast("Histograma generado", "success");
      } catch (e) {
        ui.toast("Error: " + e.message, "error");
      }
    },

    runRegression() {
      ui.toast("Ingresa pares: [[x1,y1],[x2,y2],…]", "info");
      this.setExpr("[[1,2],[2,4],[3,5],[4,4],[5,5]]");
      this.updatePreview();
    },
  };

  /* ════════════════════════════════════════════════════
   MÓDULO: steps — tarjetas de resolución
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
        if (last && last.id !== "steps-empty") {
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
        }
      });
    },

    /** Limpia tarjetas. silent=true no re-muestra el empty state */
    clear(silent = false) {
      const box = D("steps-container");
      if (!box) return;
      const cards = [...box.children].filter((c) => c.id !== "steps-empty");
      if (!cards.length) {
        if (!silent) {
          D("steps-empty").style.display = "";
        }
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
   MÓDULO: graph — Plotly 2D/3D
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
          ui.toast("Error al graficar: " + e.message, "error");
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
   MÓDULO: ocr — Tesseract.js
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
          ui.toast("Solo se aceptan imágenes (PNG, JPG, BMP, WEBP)", "error");
          return;
        }
        if (f.size > 15 * 1024 * 1024) {
          ui.toast("La imagen es muy grande (máx 15 MB)", "error");
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
        ui.toast("Archivo no es una imagen válida", "error");
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
                D("ocr-progress")
                  ?.querySelector(".progress-bar-track")
                  ?.setAttribute("aria-valuenow", pct);
                statusEl.textContent = `Reconociendo… ${pct}%`;
              } else if (m.status) {
                statusEl.textContent = m.status;
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

          loadAnim?.kill?.();
          bar.style.width = "100%";
          if (gsap)
            gsap.to(bar, {
              background: "linear-gradient(90deg,var(--accent-green),#00ffaa)",
              duration: 0.28,
            });
          statusEl.textContent = "✓ Completado";

          const cleaned = _cleanOCR(text);
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
              "No se detectó una expresión válida en la imagen",
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
  };

  /* ════════════════════════════════════════════════════
   MÓDULO: hist — historial en localStorage
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
        // localStorage lleno → recortar y reintentar
        this.records = this.records.slice(0, Math.floor(HIST_MAX / 2));
        try {
          localStorage.setItem(HIST_KEY, JSON.stringify(this.records));
        } catch (_) {}
      }
    },

    save(expr, result, mode) {
      if (!expr || result == null) return;
      if (
        this.records[0]?.expr === String(expr) &&
        this.records[0]?.result === String(result)
      )
        return; // no duplicar
      this.records.unshift({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        expr: String(expr).slice(0, 300),
        result: String(result).slice(0, 200),
        mode: String(mode || "basic"),
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
      const ml = {
        basic: "BÁS",
        algebra: "ALG",
        stats: "STA",
        derive: "d/dx",
        integral: "∫",
      };
      const el = document.createElement("div");
      el.className = "history-item";
      el.setAttribute("role", "listitem");
      el.setAttribute("tabindex", "0");
      el.setAttribute("data-id", r.id);
      el.setAttribute("aria-label", `${r.expr} = ${r.result}`);
      el.innerHTML = `
      <div class="history-item-expr">
        ${_esc(r.expr.slice(0, 60) + (r.expr.length > 60 ? "…" : ""))}
        <span class="history-item-mode mode-${_esc(r.mode)}">${_esc(ml[r.mode] || r.mode.toUpperCase())}</span>
      </div>
      <button class="history-item-del" type="button" aria-label="Eliminar registro" title="Eliminar">✕</button>
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
   MÓDULO: _export — PDF (jsPDF) y Excel (SheetJS)
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

            // Fondo + header
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
            doc.text("QuantumCalc", 14, 13);
            doc.setFontSize(7);
            doc.setTextColor(...C.dim);
            doc.setFont("helvetica", "normal");
            doc.text("CALCULADORA CIENTÍFICA AVANZADA · v2.6", 14, 19);
            const now = new Date().toLocaleString("es-CO", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            doc.text(`Exportado: ${now}`, W - 14, 13, { align: "right" });
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

            // Tabla
            doc.autoTable({
              startY: 42,
              head: [["#", "EXPRESIÓN", "RESULTADO", "MODO", "FECHA"]],
              body: hist.records.map((r, i) => [
                i + 1,
                r.expr,
                r.result,
                r.mode.toUpperCase(),
                r.date,
              ]),
              theme: "plain",
              styles: {
                font: "courier",
                fontSize: 7.5,
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
                cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
              },
              columnStyles: {
                0: { cellWidth: 8, halign: "center", textColor: C.dim },
                1: { cellWidth: 55, textColor: C.cyan },
                2: { cellWidth: 38, textColor: C.green, fontStyle: "bold" },
                3: {
                  cellWidth: 16,
                  halign: "center",
                  textColor: [255, 107, 43],
                },
                4: { textColor: C.dim, fontSize: 6.5 },
              },
              alternateRowStyles: { fillColor: [9, 14, 21] },
              bodyStyles: { fillColor: C.bg },
              willDrawCell: (data) => {
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
                doc.text("QuantumCalc — Exportación Automática", 14, H - 3.5);
                doc.text(`Pág. ${pg}/${tot}`, W - 14, H - 3.5, {
                  align: "right",
                });
              },
              margin: { top: 42, right: 10, bottom: 14, left: 10 },
            });

            // Resumen al final
            const fy = doc.lastAutoTable.finalY + 8;
            if (fy < H - 32) {
              doc.setFillColor(...C.panel);
              doc.roundedRect(10, fy, W - 20, 22, 2, 2, "F");
              doc.setDrawColor(...C.border);
              doc.roundedRect(10, fy, W - 20, 22, 2, 2, "S");
              doc.setFontSize(7);
              doc.setTextColor(...C.cyan);
              doc.setFont("courier", "bold");
              doc.text("// RESUMEN", 14, fy + 7);
              doc.setFont("courier", "normal");
              doc.setTextColor(...C.text);
              doc.text(
                `Total de operaciones: ${hist.records.length}`,
                14,
                fy + 14,
              );
              const modes = hist.records.reduce((a, r) => {
                a[r.mode] = (a[r.mode] || 0) + 1;
                return a;
              }, {});
              doc.text(
                Object.entries(modes)
                  .map(([m, n]) => `${m.toUpperCase()}: ${n}`)
                  .join("  ·  "),
                14,
                fy + 20,
              );
            }

            doc.save(
              `QuantumCalc_${new Date().toISOString().slice(0, 10)}.pdf`,
            );
            this._hideSpinner(sp2);
            ui.toast("PDF exportado correctamente", "success");
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
                sz: 15,
                color: { rgb: "00D4FF" },
                name: "Courier New",
              },
              fill: { fgColor: { rgb: "050A0F" }, patternType: "solid" },
              alignment: { horizontal: "left", vertical: "center" },
            };
            const sSub = {
              font: { sz: 8, color: { rgb: "5A8AAA" }, name: "Courier New" },
              fill: { fgColor: { rgb: "050A0F" }, patternType: "solid" },
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
              ["QuantumCalc — Historial de Cálculos", "", "", "", ""],
              [
                `Exportado: ${new Date().toLocaleString("es-CO")}`,
                "",
                "",
                "",
                "",
              ],
              ["", "", "", "", ""],
              ["#", "EXPRESIÓN", "RESULTADO", "MODO", "FECHA Y HORA"],
              ...hist.records.map((r, i) => [
                i + 1,
                r.expr,
                r.result,
                r.mode.toUpperCase(),
                r.date,
              ]),
            ];
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws["!cols"] = [
              { wch: 5 },
              { wch: 50 },
              { wch: 28 },
              { wch: 12 },
              { wch: 24 },
            ];
            ws["!merges"] = [
              { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
              { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
            ];
            const ap = (addr, s) => {
              if (ws[addr]) ws[addr].s = s;
            };
            ap("A1", sTitle);
            ap("A2", sSub);
            ["A4", "B4", "C4", "D4", "E4"].forEach((a) => ap(a, sHdr));

            const mc = {
              BASIC: "FF6B2B",
              ALGEBRA: "A855F7",
              STATS: "FFD700",
              DERIVE: "FF6B2B",
              INTEGRAL: "00D4FF",
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
                font: { ...base.font, color: { rgb: "5A8AAA" }, sz: 7.2 },
              });
            });

            const modes = hist.records.reduce((a, r) => {
              a[r.mode] = (a[r.mode] || 0) + 1;
              return a;
            }, {});
            const aoa2 = [
              ["QuantumCalc — Estadísticas"],
              [""],
              ["MÉTRICA", "VALOR"],
              ["Total", hist.records.length],
              ["Primera", hist.records.at(-1)?.date || "-"],
              ["Última", hist.records[0]?.date || "-"],
              [""],
              ["DISTRIBUCIÓN POR MODO", ""],
              ...Object.entries(modes).map(([m, n]) => [m.toUpperCase(), n]),
            ];
            const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
            ws2["!cols"] = [{ wch: 28 }, { wch: 20 }];
            ws2["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
            if (ws2["A1"]) ws2["A1"].s = sTitle;
            if (ws2["A3"]) ws2["A3"].s = sHdr;
            if (ws2["B3"]) ws2["B3"].s = sHdr;

            const wb = XLSX.utils.book_new();
            wb.Props = {
              Title: "QuantumCalc — Historial",
              Author: "QuantumCalc v2.6",
              CreatedDate: new Date(),
            };
            XLSX.utils.book_append_sheet(wb, ws, "Historial");
            XLSX.utils.book_append_sheet(wb, ws2, "Estadísticas");
            XLSX.writeFile(
              wb,
              `QuantumCalc_${new Date().toISOString().slice(0, 10)}.xlsx`,
            );
            this._hideSpinner(sp2);
            ui.toast("Excel exportado correctamente", "success");
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

    // Listener de input en display editable
    D("input-display")?.addEventListener("input", () => {
      calc.updatePreview();
      ui.triggerTyping();
    });

    // Teclado físico
    document.addEventListener("keydown", (e) => {
      if (e.target === D("input-display")) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        calc.calculate();
      }
      if (e.key === "Escape") {
        S.histOpen ? hist.toggle() : calc.clearAll();
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

    ui.toast(
      "Sistema listo · Math.js + Plotly (lazy) + OCR activos",
      "success",
    );
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();

  /* API pública */
  return {
    ui,
    calc,
    steps,
    graph,
    ocr,
    history: hist,
    export: _export,
    toast: (m, t) => ui.toast(m, t),
    state: S,
  };
})(); /* fin window.QC */
