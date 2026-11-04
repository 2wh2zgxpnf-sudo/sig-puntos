// Panel de la junta directiva: otorgar puntos y administrar la liga.
import { api, MODO } from "./data.js";
import * as S from "./stats.js";
import { lanzarConfeti } from "./confeti.js";

const $ = (s) => document.querySelector(s);
let estado = null, sesion = null;
let actSel = null;
const marcados = new Set();

if (MODO === "demo") { $("#demo").hidden = false; $("#demo-reset").hidden = false; }

/* ── utilidades ── */
let toastT;
function toast(msg, error = false) {
  const t = $("#toast"); t.textContent = msg; t.classList.toggle("error", error); t.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 3200);
}
async function seguro(fn, ok) {
  try { await fn(); if (ok) toast(ok); }
  catch (e) {
    console.error(e);
    toast(e?.code === "permission-denied" ? "Sin permiso: tu cuenta no está autorizada" : "No se pudo guardar. Revisa la conexión.", true);
  }
}
const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
function fechaTs(iso) {
  if (!iso || iso === hoyISO()) return Date.now();
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}
const ordenNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es");

/* ── pestañas ── */
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  document.querySelectorAll(".panel").forEach((p) => { p.hidden = p.id !== `tab-${b.dataset.tab}`; });
}));

/* ── sesión ── */
$("#btn-login").onclick = () => seguro(() => api.login());
api.onAuth((s) => {
  sesion = s;
  const dentro = s.user && s.esAdmin;
  $("#login").hidden = dentro; $("#panel").hidden = !dentro;
  $("#usuario").innerHTML = s.user ? `<span>${S.esc(s.user.nombre.split(" ")[0])}</span><button class="btn sec mini-btn" id="btn-salir">Salir</button>` : "";
  if (s.user) $("#btn-salir").onclick = () => api.logout();
  $("#login-msg").textContent = s.user && !s.esAdmin
    ? `La cuenta ${s.user.email} no está en la lista de la junta. Pídele a Secretaría que la agregue.`
    : "Inicia sesión con tu cuenta de Google autorizada para registrar puntos.";
  $("#btn-login").textContent = s.user && !s.esAdmin ? "Probar con otra cuenta" : "Entrar con Google";
  if (s.user && !s.esAdmin) $("#btn-login").onclick = async () => { await api.logout(); seguro(() => api.login()); };
  if (dentro && !estado) api.suscribir((e) => { estado = e; render(); });
});

/* ── render ── */
function render() {
  renderDar(); renderPersonas(); renderActs(); renderRegistros();
  if (document.activeElement?.id !== "c-premio") $("#c-premio").value = estado.config.premio || "";
  if (document.activeElement?.id !== "c-mensaje") $("#c-mensaje").value = estado.config.mensaje || "";
}

function renderDar() {
  const acts = [...estado.actividades].sort(ordenNombre);
  if (actSel && !acts.some((a) => a.id === actSel)) actSel = null;
  $("#dar-acts").innerHTML = acts.map((a) => `<button class="sel act" data-act="${a.id}" aria-pressed="${a.id === actSel}">${S.esc(a.emoji || "✨")} ${S.esc(a.nombre)} <span class="pts-sel">+${a.puntos}</span></button>`).join("")
    || `<p class="nota">Primero crea una actividad en la pestaña Actividades.</p>`;
  if (!$("#dar-fecha").value) $("#dar-fecha").value = hoyISO();
  const q = $("#dar-buscar").value.trim().toLowerCase();
  const tot = new Map(S.ranking(estado, S.mesActual()).map((f) => [f.p.id, f.total]));
  const personas = S.activos(estado).sort(ordenNombre).filter((p) => !q || p.nombre.toLowerCase().includes(q));
  $("#dar-personas").innerHTML = personas.map((p) => `<button class="sel" data-per="${p.id}" aria-pressed="${marcados.has(p.id)}">${S.avatar(p, "sm")}${S.esc(p.nombre)} <span class="pts-sel">${tot.get(p.id) || 0}</span></button>`).join("")
    || `<p class="nota">No hay participantes${q ? " con ese nombre" : ""}.</p>`;
  actualizarBoton();
}
function actualizarBoton() {
  const pts = Number($("#dar-pts").value);
  const ok = actSel && marcados.size && Number.isFinite(pts) && pts !== 0;
  $("#dar-ok").disabled = !ok;
  $("#dar-ok").textContent = ok ? `Otorgar ${pts > 0 ? "+" : ""}${pts} a ${marcados.size} ${marcados.size === 1 ? "persona" : "personas"}` : "Otorgar puntos";
}
$("#dar-acts").addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  actSel = b.dataset.act;
  $("#dar-pts").value = estado.actividades.find((a) => a.id === actSel)?.puntos ?? "";
  renderDar();
});
$("#dar-personas").addEventListener("click", (e) => {
  const b = e.target.closest("[data-per]"); if (!b) return;
  const id = b.dataset.per;
  marcados.has(id) ? marcados.delete(id) : marcados.add(id);
  b.setAttribute("aria-pressed", String(marcados.has(id)));
  actualizarBoton();
});
$("#dar-buscar").addEventListener("input", renderDar);
$("#dar-pts").addEventListener("input", actualizarBoton);
$("#dar-todos").onclick = () => { document.querySelectorAll("#dar-personas [data-per]").forEach((b) => marcados.add(b.dataset.per)); renderDar(); };
$("#dar-ninguno").onclick = () => { marcados.clear(); renderDar(); };
$("#dar-ok").onclick = () => {
  const pts = Math.trunc(Number($("#dar-pts").value));
  const fecha = fechaTs($("#dar-fecha").value);
  const nota = $("#dar-nota").value.trim();
  const quien = sesion?.user?.nombre?.split(" ")[0] || "Junta";
  const regs = [...marcados].map((pid, i) => ({ participanteId: pid, actividadId: actSel, puntos: pts, fecha: fecha + i, nota, otorgadoPor: quien }));
  const n = regs.length;
  seguro(async () => {
    await api.otorgar(regs);
    marcados.clear(); $("#dar-nota").value = ""; $("#dar-buscar").value = "";
    renderDar(); if (pts > 0) lanzarConfeti(0.5);
  }, `✓ ${pts > 0 ? "+" : ""}${pts} pts a ${n} ${n === 1 ? "persona" : "personas"}`);
};

/* ── participantes ── */
function renderPersonas() {
  const lista = [...estado.participantes].sort((a, b) => (b.activo !== false) - (a.activo !== false) || ordenNombre(a, b));
  $("#p-lista").innerHTML = lista.map((p) => `
    <li class="${p.activo === false ? "inactivo" : ""}">
      ${S.avatar(p, "sm")}
      <span class="grow"><input class="campo" value="${S.esc(p.nombre)}" data-edit-nombre="${p.id}" aria-label="Nombre" maxlength="30"></span>
      <input class="campo" style="width:58px;text-align:center" value="${S.esc(p.emoji || "")}" data-edit-emoji="${p.id}" aria-label="Emoji" maxlength="4">
      <button class="btn sec mini-btn" data-toggle="${p.id}">${p.activo === false ? "Reactivar" : "Retirar"}</button>
    </li>`).join("") || `<li class="vacio">Aún no hay participantes.</li>`;
}
$("#p-agregar").onclick = () => {
  const nombre = $("#p-nombre").value.trim(); if (!nombre) return toast("Escribe un nombre", true);
  if (estado.participantes.some((p) => p.nombre.toLowerCase() === nombre.toLowerCase())) return toast("Ya existe alguien con ese nombre", true);
  seguro(async () => { await api.crear("participantes", { nombre, emoji: $("#p-emoji").value.trim(), activo: true, creado: Date.now() }); $("#p-nombre").value = ""; $("#p-emoji").value = ""; }, `✓ ${nombre} agregado`);
};
$("#p-lista").addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.editNombre) { const v = t.value.trim(); if (v) seguro(() => api.actualizar("participantes", t.dataset.editNombre, { nombre: v }), "✓ Nombre actualizado"); }
  if (t.dataset.editEmoji !== undefined) seguro(() => api.actualizar("participantes", t.dataset.editEmoji, { emoji: t.value.trim() }), "✓ Emoji actualizado");
});
$("#p-lista").addEventListener("click", (e) => {
  const b = e.target.closest("[data-toggle]"); if (!b) return;
  const p = estado.participantes.find((x) => x.id === b.dataset.toggle);
  // "Retirar" oculta a la persona del ranking sin borrar su historial.
  seguro(() => api.actualizar("participantes", p.id, { activo: p.activo === false }), p.activo === false ? "✓ Reactivado" : "✓ Retirado (su historial se conserva)");
});

/* ── actividades ── */
function renderActs() {
  const uso = new Map(); for (const r of estado.puntos) uso.set(r.actividadId, (uso.get(r.actividadId) || 0) + 1);
  $("#a-lista").innerHTML = [...estado.actividades].sort(ordenNombre).map((a) => `
    <li>
      <input class="campo" style="width:58px;text-align:center" value="${S.esc(a.emoji || "")}" data-a-emoji="${a.id}" aria-label="Emoji" maxlength="4">
      <span class="grow"><input class="campo" value="${S.esc(a.nombre)}" data-a-nombre="${a.id}" aria-label="Nombre" maxlength="40"><small>${uso.get(a.id) || 0} registros</small></span>
      <input class="campo" style="width:70px;text-align:center" type="number" value="${a.puntos}" data-a-pts="${a.id}" aria-label="Puntos">
      ${uso.get(a.id) ? "" : `<button class="btn peligro mini-btn" data-a-borrar="${a.id}" aria-label="Eliminar">✕</button>`}
    </li>`).join("") || `<li class="vacio">Aún no hay actividades.</li>`;
}
$("#a-agregar").onclick = () => {
  const nombre = $("#a-nombre").value.trim(), puntos = Math.trunc(Number($("#a-pts").value));
  if (!nombre || !puntos) return toast("Escribe nombre y puntos", true);
  seguro(async () => { await api.crear("actividades", { nombre, emoji: $("#a-emoji").value.trim(), puntos }); $("#a-nombre").value = ""; $("#a-emoji").value = ""; $("#a-pts").value = ""; }, `✓ ${nombre} creada`);
};
$("#a-lista").addEventListener("change", (e) => {
  const t = e.target, d = t.dataset;
  if (d.aNombre && t.value.trim()) seguro(() => api.actualizar("actividades", d.aNombre, { nombre: t.value.trim() }), "✓ Guardado");
  if (d.aEmoji !== undefined) seguro(() => api.actualizar("actividades", d.aEmoji, { emoji: t.value.trim() }), "✓ Guardado");
  if (d.aPts && Number(t.value)) seguro(() => api.actualizar("actividades", d.aPts, { puntos: Math.trunc(Number(t.value)) }), "✓ Guardado");
});
$("#a-lista").addEventListener("click", (e) => {
  const b = e.target.closest("[data-a-borrar]"); if (!b) return;
  if (confirm("¿Eliminar esta actividad? (solo se permite si no tiene registros)")) seguro(() => api.borrar("actividades", b.dataset.aBorrar), "✓ Actividad eliminada");
});
$("#c-guardar").onclick = () => seguro(() => api.guardarConfig({ premio: $("#c-premio").value.trim(), mensaje: $("#c-mensaje").value.trim() }), "✓ Premio y mensaje guardados");

/* ── registros ── */
function renderRegistros() {
  const regs = [...estado.puntos].sort((a, b) => b.fecha - a.fecha).slice(0, 60);
  $("#r-lista").innerHTML = regs.map((r) => {
    const p = estado.participantes.find((x) => x.id === r.participanteId);
    const a = estado.actividades.find((x) => x.id === r.actividadId);
    return `<li>
      ${p ? S.avatar(p, "sm") : ""}
      <span class="grow"><b>${S.esc(p?.nombre || "¿?")}</b> ${r.puntos > 0 ? "+" : ""}${r.puntos} · ${S.esc(a ? `${a.emoji || ""} ${a.nombre}` : "actividad eliminada")}
        <small>${new Date(r.fecha).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · por ${S.esc(r.otorgadoPor || "—")}${r.nota ? ` · ${S.esc(r.nota)}` : ""}</small></span>
      <button class="btn peligro mini-btn" data-r-borrar="${r.id}" aria-label="Eliminar registro">✕</button>
    </li>`;
  }).join("") || `<li class="vacio">Sin registros todavía.</li>`;
}
$("#r-lista").addEventListener("click", (e) => {
  const b = e.target.closest("[data-r-borrar]"); if (!b) return;
  if (confirm("¿Eliminar este registro de puntos?")) seguro(() => api.borrar("puntos", b.dataset.rBorrar), "✓ Registro eliminado");
});
$("#btn-reset").onclick = () => { if (confirm("¿Volver a los datos ficticios iniciales?")) api.reiniciar(); };
