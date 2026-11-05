// Vista pública de la Liga SIG.
import { api, MODO } from "./data.js";
import { CONFIG } from "./config.js";
import * as S from "./stats.js";
import { lanzarConfeti } from "./confeti.js";

const $ = (s) => document.querySelector(s);
const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
let estado = null;
let conteoPrevio = 0;   // nº de registros de puntos (para detectar llegadas en vivo)
let liderPrevio = null;

if (MODO === "demo") $("#demo").hidden = false;

/* ── Pestañas ── */
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  document.querySelectorAll(".panel").forEach((p) => { p.hidden = p.id !== `tab-${b.dataset.tab}`; });
}));

/* ── Cuenta regresiva ── */
function tic() {
  let ms = Math.max(0, S.finDeMes() - Date.now());
  const v = { d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60, s: Math.floor(ms / 1e3) % 60 };
  for (const [u, n] of Object.entries(v)) { const el = document.querySelector(`[data-u="${u}"]`); const t = String(n).padStart(2, "0"); if (el.textContent !== t) el.textContent = t; }
}
tic(); setInterval(tic, 1000);

/* ── Animación de números ── */
function contar(el, hasta) {
  const desde = Number(el.dataset.v || 0);
  el.dataset.v = hasta;
  if (reducido || desde === hasta) { el.textContent = hasta; return; }
  const t0 = performance.now(), dur = 900;
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(desde + (hasta - desde) * e);
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/* ── Render ── */
function render() {
  const e = estado;
  const mes = S.mesActual();
  $("#premio-mes").textContent = `Premio de ${S.nombreMes(mes).split(" ")[0]}`;
  $("#premio").textContent = e.config.premio || CONFIG.premioPorDefecto;
  $("#mensaje").textContent = e.config.mensaje || "";
  $("#mensaje").hidden = !e.config.mensaje;

  const filas = S.rankingConTendencia(e);
  const conPuntos = filas.filter((f) => f.total > 0);
  renderPodio(conPuntos);
  renderTabla(conPuntos.slice(3), conPuntos[0]?.total || 1);
  const ceros = filas.filter((f) => f.total <= 0);
  $("#sin-puntos").innerHTML = ceros.length
    ? `<p>Aún sin puntos este mes</p><div>${ceros.map((f) => `<button class="chip" data-pid="${f.p.id}">${S.avatar(f.p, "xs")}${S.esc(f.p.nombre)}</button>`).join("")}</div>`
    : "";
  renderFeed();
  renderHistorico();
  renderReglas();
}

function renderPodio(f) {
  const lugar = (i) => {
    const x = f[i];
    const clase = ["oro", "plata", "bronce"][i];
    if (!x) return `<div class="escalon ${clase} vacio"><div class="persona"><span class="avatar xl fantasma">?</span><p class="nombre">¿Quién será?</p></div><div class="base"><span>${i + 1}</span></div></div>`;
    return `<button class="escalon ${clase}" data-pid="${x.p.id}" style="--i:${i}">
      <div class="persona">
        ${i === 0 ? '<span class="corona" aria-hidden="true">👑</span>' : ""}
        ${S.avatar(x.p, "xl")}
        <p class="nombre">${S.esc(x.p.nombre)}</p>
        <p class="pts"><b class="num" data-pid-num="${x.p.id}">${x.total}</b> pts</p>
      </div>
      <div class="base"><span>${x.rank}</span></div>
    </button>`;
  };
  const podio = $("#podio");
  const viejos = new Map([...podio.querySelectorAll("[data-pid-num]")].map((n) => [n.dataset.pidNum, n.dataset.v]));
  podio.innerHTML = lugar(1) + lugar(0) + lugar(2);
  podio.querySelectorAll("[data-pid-num]").forEach((n) => {
    const fin = Number(n.textContent);
    n.dataset.v = viejos.get(n.dataset.pidNum) ?? 0;
    contar(n, fin);
  });
}

function tendencia(f) {
  if (f.sinTendencia) return "";
  if (f.nuevo) return `<span class="tend nuevo">nuevo</span>`;
  if (f.delta > 0) return `<span class="tend sube" title="Subió ${f.delta}">▲${f.delta}</span>`;
  if (f.delta < 0) return `<span class="tend baja" title="Bajó ${-f.delta}">▼${-f.delta}</span>`;
  return `<span class="tend igual" title="Sin cambios">–</span>`;
}

function renderTabla(filas, max) {
  $("#tabla").innerHTML = filas.map((f, i) => `
    <li style="--i:${i}">
      <button class="fila" data-pid="${f.p.id}">
        <span class="pos">${f.rank}</span>
        ${S.avatar(f.p)}
        <span class="quien">
          <span class="nombre">${S.esc(f.p.nombre)} ${S.insignias(estado, f.p.id).map((b) => `<span class="mini" title="${S.esc(b.titulo)}">${b.icono}</span>`).join("")}</span>
          <span class="barra"><i style="width:${Math.max(4, (f.total / max) * 100)}%"></i></span>
        </span>
        <span class="total"><b>${f.total}</b><small>pts</small></span>
        ${tendencia(f)}
      </button>
    </li>`).join("");
}

function renderFeed() {
  const ult = [...estado.puntos].sort((a, b) => b.fecha - a.fecha).slice(0, 12);
  if (!ult.length) { $("#feed").innerHTML = `<li class="vacio">Todavía no hay puntos registrados. ¡La liga está por arrancar!</li>`; return; }
  $("#feed").innerHTML = ult.map((r) => {
    const p = estado.participantes.find((x) => x.id === r.participanteId);
    const a = estado.actividades.find((x) => x.id === r.actividadId);
    if (!p) return "";
    const neg = r.puntos < 0;
    return `<li>
      ${S.avatar(p, "sm")}
      <div><p><b>${S.esc(p.nombre)}</b> ${neg ? "ajuste en" : "sumó en"} ${a ? `${S.esc(a.emoji || "")} ${S.esc(a.nombre)}` : "una actividad"}</p>
      <p class="meta">${S.haceCuanto(r.fecha)}${r.nota ? ` · ${S.esc(r.nota)}` : ""}</p></div>
      <span class="mas ${neg ? "neg" : ""}">${neg ? "" : "+"}${r.puntos}</span>
    </li>`;
  }).join("");
}

function renderHistorico() {
  const g = S.ganadores(estado);
  $("#campeones").innerHTML = g.length ? g.map((x) => `
    <article class="campeon">
      <p class="kicker">${S.nombreMes(x.mes)}</p>
      <div class="campeon-top">
        ${x.campeones.map((c) => `<button class="campeon-p" data-pid="${c.p.id}">${S.avatar(c.p, "lg")}<span>${S.esc(c.p.nombre)}</span></button>`).join("")}
      </div>
      <p class="campeon-pts">🏆 ${x.campeones[0].total} pts · ${x.participantes} participantes</p>
    </article>`).join("")
    : `<p class="nota">El primer campeón se corona al cierre de este mes.</p>`;

  const h = S.historico(estado).filter((f) => f.total > 0);
  const max = h[0]?.total || 1;
  $("#tabla-historica").innerHTML = h.map((f, i) => `
    <li style="--i:${i}">
      <button class="fila" data-pid="${f.p.id}">
        <span class="pos">${f.rank}</span>
        ${S.avatar(f.p)}
        <span class="quien">
          <span class="nombre">${S.esc(f.p.nombre)} ${"🏆".repeat(Math.min(f.copas, 5))}</span>
          <span class="barra"><i style="width:${Math.max(4, (f.total / max) * 100)}%"></i></span>
          <span class="meta">${f.meses} ${f.meses === 1 ? "mes" : "meses"} activo</span>
        </span>
        <span class="total"><b>${f.total}</b><small>pts</small></span>
      </button>
    </li>`).join("");
}

function renderReglas() {
  const acts = [...estado.actividades].sort((a, b) => b.puntos - a.puntos);
  $("#reglas").innerHTML = acts.length ? acts.map((a) => `
    <li><span class="regla-ico">${S.esc(a.emoji || "✨")}</span><span>${S.esc(a.nombre)}</span><b>+${a.puntos}</b></li>`).join("")
    : `<li class="vacio">La junta publicará pronto las actividades.</li>`;
}

/* ── Ficha de participante ── */
function abrirFicha(pid) {
  const p = estado.participantes.find((x) => x.id === pid); if (!p) return;
  const mes = S.mesActual();
  const fila = S.rankingConTendencia(estado).find((f) => f.p.id === pid);
  const hist = S.historico(estado).find((f) => f.p.id === pid);
  const ins = S.insignias(estado, pid);
  const des = S.desglose(estado, pid, mes);
  const d = $("#ficha");
  d.innerHTML = `
    <button class="cerrar" aria-label="Cerrar">✕</button>
    <div class="ficha-top">${S.avatar(p, "xl")}<h2 id="ficha-nombre">${S.esc(p.nombre)}</h2></div>
    <div class="ficha-stats">
      <div><b>${fila && fila.total > 0 ? `#${fila.rank}` : "—"}</b><span>este mes</span></div>
      <div><b>${fila?.total || 0}</b><span>pts del mes</span></div>
      <div><b>${hist?.total || 0}</b><span>pts históricos</span></div>
    </div>
    ${ins.length ? `<h3>Insignias</h3><ul class="insignias">${ins.map((b) => `<li><span>${b.icono}</span><div><b>${S.esc(b.titulo)}</b><small>${S.esc(b.desc)}</small></div></li>`).join("")}</ul>` : ""}
    <h3>Puntos de ${S.nombreMes(mes).split(" ")[0]}</h3>
    ${des.length ? `<ul class="desglose">${des.map((x) => `<li><span>${S.esc(x.a?.emoji || "✨")} ${S.esc(x.a?.nombre || "Actividad eliminada")}</span><b>${x.total}</b></li>`).join("")}</ul>` : `<p class="nota">Todavía no suma este mes. ¡Hay tiempo!</p>`}`;
  d.querySelector(".cerrar").onclick = () => d.close();
  d.showModal();
}
document.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-pid]");
  if (b && !b.closest("dialog")) abrirFicha(b.dataset.pid);
});
$("#ficha").addEventListener("click", (ev) => { if (ev.target.id === "ficha") ev.target.close(); });

/* ── Toast ── */
let toastT;
function toast(html) {
  const t = $("#toast"); t.innerHTML = html; t.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 4200);
}

/* ── Datos en vivo ── */
let completoPrevio = false;
const aviso = setTimeout(() => {
  if (!completoPrevio) $("#feed").innerHTML = `<li class="vacio">La conexión está tardando más de lo normal. Si no carga, recarga la página.</li>`;
}, 12000);
api.suscribir((e) => {
  estado = e;
  render();
  if (!e.completo) return;               // aún llegan datos: solo pintar, sin celebrar
  clearTimeout(aviso);
  const lider = S.rankingConTendencia(e).find((f) => f.total > 0 && f.rank === 1)?.p.id || null;
  if (!completoPrevio) {
    if (lider && !sessionStorage.getItem("ligasig-confeti")) { sessionStorage.setItem("ligasig-confeti", "1"); setTimeout(() => lanzarConfeti(), 500); }
  } else if (e.puntos.length > conteoPrevio) {
    const nuevo = [...e.puntos].sort((a, b) => b.fecha - a.fecha)[0];
    const p = e.participantes.find((x) => x.id === nuevo?.participanteId);
    if (p && nuevo.puntos > 0) toast(`${S.avatar(p, "sm")}<span><b>${S.esc(p.nombre)}</b> +${nuevo.puntos} pts</span>`);
    lanzarConfeti(lider !== liderPrevio ? 1 : 0.4);
  }
  completoPrevio = true;
  conteoPrevio = e.puntos.length;
  liderPrevio = lider;
});

// Refresca los "hace X min" cada minuto.
setInterval(() => estado && renderFeed(), 60000);
