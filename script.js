"use strict";

const TOTAL = 10;
const MINS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const rand = (xs) => xs[Math.floor(Math.random() * xs.length)];
const shuffle = (xs) => {
  const ys = xs.slice();
  for (let k = ys.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    const t = ys[k];
    ys[k] = ys[j];
    ys[j] = t;
  }
  return ys;
};
const fmt = (t) => String(t.h).padStart(2, "0") + ":" + String(t.m).padStart(2, "0");
const nextH = (h) => (h % 12) + 1;
const name = (x) => (x === 1 ? "la una" : "las " + x);
const phrase = (t) => {
  const h = t.h, m = t.m;
  if (m === 0) return name(h) + " en punto";
  if (m === 15) return name(h) + " y cuarto";
  if (m === 30) return name(h) + " y media";
  if (m === 45) return name(nextH(h)) + " menos cuarto";
  if (m < 30) return name(h) + " y " + m;
  return name(nextH(h)) + " menos " + (60 - m);
};
const shift = (t, dm, dh) => ({
  h: ((((t.h - 1 + (dh || 0)) % 12) + 12) % 12) + 1,
  m: (((t.m + dm) % 60) + 60) % 60,
});
const swapHm = (t) => ({
  h: Math.min(12, Math.max(1, Math.round(t.m / 5))),
  m: (t.h % 12) * 5,
});
const makeQ = () => {
  const t = { h: 1 + Math.floor(Math.random() * 12), m: rand(MINS) };
  const seen = new Map([[fmt(t), t]]);
  for (const c of [shift(t, 5), shift(t, -5), shift(t, 10), shift(t, -15), shift(t, 0, 1), shift(t, 0, -1), swapHm(t)]) {
    if (c.m % 5 === 0 && !seen.has(fmt(c))) seen.set(fmt(c), c);
  }
  while (seen.size < 4) {
    const r = { h: 1 + Math.floor(Math.random() * 12), m: rand(MINS) };
    if (!seen.has(fmt(r))) seen.set(fmt(r), r);
  }
  return { kind: rand(["d", "c", "p"]), t, opts: shuffle(Array.from(seen.values()).slice(0, 4)) };
};

let qs = [], idx = 0, ok = 0, bad = 0, secs = 0, chosen = null, msg = "", phase = "start";
let timer = null, advTimer = null;

const scoreEl = document.getElementById("score");
const panel = document.getElementById("panel");

const mmss = () =>
  String(Math.floor(secs / 60)).padStart(2, "0") + ":" + String(secs % 60).padStart(2, "0");

function clockSVG(t, cls) {
  const pt = (deg, r) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [60 + r * Math.cos(rad), 60 + r * Math.sin(rad)];
  };
  const hp = pt(((t.h % 12) + t.m / 60) * 30, 26);
  const mp = pt(t.m * 6, 38);
  let ticks = "";
  for (let k = 0; k < 60; k++) {
    const a = pt(k * 6, 54), b = pt(k * 6, k % 5 === 0 ? 48 : 51);
    ticks += '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '" class="' + (k % 5 === 0 ? "tick-b" : "tick") + '"/>';
  }
  let nums = "";
  for (let k = 1; k <= 12; k++) {
    const p = pt(k * 30, 37);
    nums += '<text x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '" text-anchor="middle" dominant-baseline="central" class="num">' + k + "</text>";
  }
  return (
    '<svg viewBox="0 0 120 120" class="' + cls + '" role="img" aria-label="Reloj que marca las ' + phrase(t) + '">' +
    '<circle cx="60" cy="60" r="56" class="face"/>' + ticks + nums +
    '<line x1="60" y1="60" x2="' + hp[0].toFixed(1) + '" y2="' + hp[1].toFixed(1) + '" class="hour"/>' +
    '<line x1="60" y1="60" x2="' + mp[0].toFixed(1) + '" y2="' + mp[1].toFixed(1) + '" class="min"/>' +
    '<circle cx="60" cy="60" r="3.5" class="pin"/></svg>'
  );
}

function renderScore() {
  scoreEl.classList.toggle("hidden", phase !== "play");
  if (phase !== "play") return;
  scoreEl.innerHTML =
    '<span class="chip ok">✓ ' + ok + "</span>" +
    '<span class="chip bad">✗ ' + bad + "</span>" +
    '<span class="chip time">⏱ ' + mmss() + "</span>" +
    '<span class="chip left">Pregunta ' + Math.min(idx + 1, TOTAL) + "/" + TOTAL + "</span>";
}

function optCls(q, o) {
  if (chosen === null) return "opt";
  if (fmt(o) === fmt(q.t)) return "opt ok";
  if (fmt(o) === fmt(chosen)) return "opt bad";
  return "opt dim";
}

function render() {
  clearTimeout(advTimer);
  renderScore();
  if (phase === "start") {
    panel.innerHTML =
      '<div class="start">' + clockSVG({ h: 7, m: 30 }, "clock-start") +
      '<p class="lead">Aprende a leer las horas: <b>en punto</b>, <b>y media</b>, <b>y cuarto</b> y <b>menos cuarto</b>.</p>' +
      '<p class="sub">Hay ' + TOTAL + ' preguntas: unas veces miras el reloj de aguja y otras eliges el reloj correcto. ¡Consigue las 3 estrellas!</p>' +
      '<button id="btn-start" class="big">¡Empezar!</button></div>';
    document.getElementById("btn-start").onclick = start;
    return;
  }
  if (phase === "end") {
    const stars = ok >= 9 ? "⭐⭐⭐" : ok >= 6 ? "⭐⭐" : ok >= 3 ? "⭐" : "Sigue practicando";
    panel.innerHTML =
      '<div class="end"><p class="end-title">¡Fin del juego!</p><p class="stars">' + stars + "</p>" +
      '<p class="end-score">Has acertado ' + ok + " de " + TOTAL + "</p>" +
      '<p class="end-sub">Tiempo: ' + mmss() + " · Fallos: " + bad + "</p>" +
      '<button id="btn-again" class="big">Jugar otra vez</button></div>';
    document.getElementById("btn-again").onclick = start;
    return;
  }
  const q = qs[Math.min(idx, TOTAL - 1)];
  let html = "";
  if (q.kind === "d") {
    html = '<p class="q">¿Qué hora marca el reloj?</p>' + clockSVG(q.t, "clock-big") +
      '<div class="grid2">' + q.opts.map((o) =>
        '<button class="' + optCls(q, o) + ' big-text" data-f="' + fmt(o) + '">' + fmt(o) + "</button>"
      ).join("") + "</div>";
  } else if (q.kind === "c") {
    html = '<p class="q">¿Cuál es el reloj correcto?</p><p class="big-time">' + fmt(q.t) + "</p>" +
      '<div class="grid2">' + q.opts.map((o) =>
        '<button class="' + optCls(q, o) + '" data-f="' + fmt(o) + '">' + clockSVG(o, "clock-mini") + "</button>"
      ).join("") + "</div>";
  } else {
    html = '<p class="q">¿Cómo se dice?</p>' + clockSVG(q.t, "clock-big") +
      '<div class="list">' + q.opts.map((o) =>
        '<button class="' + optCls(q, o) + '" data-f="' + fmt(o) + '">' + phrase(o) + "</button>"
      ).join("") + "</div>";
  }
  html += '<p class="msg">' + msg + "</p>";
  panel.innerHTML = html;
  panel.querySelectorAll("button[data-f]").forEach((b) => {
    b.disabled = chosen !== null;
    b.onclick = () => pick(b.dataset.f);
  });
}

function pick(f) {
  if (chosen !== null) return;
  const q = qs[Math.min(idx, TOTAL - 1)];
  const good = f === fmt(q.t);
  if (good) {
    ok++;
    msg = "¡Correcto!";
  } else {
    bad++;
    msg = "Era " + fmt(q.t) + " · " + phrase(q.t);
  }
  chosen = q.opts.find((o) => fmt(o) === f) || { h: 0, m: 0 };
  render();
  advTimer = setTimeout(advance, 1300);
}

function advance() {
  if (idx + 1 >= TOTAL) {
    phase = "end";
    clearInterval(timer);
    timer = null;
  } else {
    idx++;
    chosen = null;
    msg = "";
  }
  render();
}

function start() {
  clearInterval(timer);
  clearTimeout(advTimer);
  qs = [];
  for (let k = 0; k < TOTAL; k++) qs.push(makeQ());
  idx = 0; ok = 0; bad = 0; secs = 0; chosen = null; msg = "";
  phase = "play";
  timer = setInterval(() => { secs++; renderScore(); }, 1000);
  render();
}

render();
