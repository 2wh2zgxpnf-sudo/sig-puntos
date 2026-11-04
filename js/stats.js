// Cálculos de la liga: rankings, ganadores, rachas e insignias.
// Todo se deriva de los registros de puntos, así no hay que "cerrar" meses a mano.

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export const mesKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
export const mesActual = () => mesKey(Date.now());
export const nombreMes = (key) => { const [y, m] = key.split("-").map(Number); return `${MESES[m - 1]} ${y}`; };
export const finDeMes = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); };

// Lunes (00:00) de la semana del timestamp, como clave numérica.
export const semanaKey = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const SEMANA = 7 * 864e5;

export function activos(estado) { return estado.participantes.filter((p) => p.activo !== false); }

/** Ranking de un mes. `hasta` permite reconstruir el ranking en una fecha pasada. */
export function ranking(estado, mes, hasta = Infinity) {
  const tot = new Map(), ult = new Map();
  for (const r of estado.puntos) {
    if (mesKey(r.fecha) !== mes || r.fecha > hasta) continue;
    tot.set(r.participanteId, (tot.get(r.participanteId) || 0) + Number(r.puntos || 0));
    ult.set(r.participanteId, Math.max(ult.get(r.participanteId) || 0, r.fecha));
  }
  const filas = activos(estado).map((p) => ({ p, total: tot.get(p.id) || 0, ultimo: ult.get(p.id) || 0 }));
  filas.sort((a, b) => b.total - a.total || a.p.nombre.localeCompare(b.p.nombre, "es"));
  let rank = 0, prev = null;
  filas.forEach((f, i) => { if (f.total !== prev) { rank = i + 1; prev = f.total; } f.rank = rank; });
  return filas;
}

/** Ranking del mes en curso con el cambio de posición frente a hace 7 días. */
export function rankingConTendencia(estado) {
  const mes = mesActual();
  const hoy = ranking(estado, mes);
  const hace7 = Date.now() - SEMANA;
  // En la primera semana del mes no hay con qué comparar: no se muestra tendencia.
  if (mesKey(hace7) !== mes) { hoy.forEach((f) => { f.sinTendencia = true; }); return hoy; }
  const antes = new Map(ranking(estado, mes, hace7).map((f) => [f.p.id, f]));
  for (const f of hoy) {
    const a = antes.get(f.p.id);
    f.nuevo = f.total > 0 && (!a || a.total === 0);
    f.delta = !f.nuevo && a && f.total > 0 ? a.rank - f.rank : 0;
  }
  return hoy;
}

export function mesesConPuntos(estado) {
  return [...new Set(estado.puntos.map((r) => mesKey(r.fecha)))].sort().reverse();
}

/** Ganadores de cada mes ya terminado (empates incluidos). */
export function ganadores(estado) {
  const actual = mesActual();
  return mesesConPuntos(estado).filter((m) => m < actual).map((mes) => {
    const r = ranking(estado, mes).filter((f) => f.total > 0);
    const top = r.length ? r[0].total : 0;
    return { mes, campeones: r.filter((f) => f.total === top), podio: r.slice(0, 3), participantes: r.length };
  }).filter((g) => g.campeones.length);
}

/** Acumulado de todos los tiempos (útil para la selección de líderes). */
export function historico(estado) {
  const tot = new Map(), meses = new Map();
  for (const r of estado.puntos) {
    tot.set(r.participanteId, (tot.get(r.participanteId) || 0) + Number(r.puntos || 0));
    if (!meses.has(r.participanteId)) meses.set(r.participanteId, new Set());
    meses.get(r.participanteId).add(mesKey(r.fecha));
  }
  const campeonatos = new Map();
  for (const g of ganadores(estado)) for (const c of g.campeones) campeonatos.set(c.p.id, (campeonatos.get(c.p.id) || 0) + 1);
  const filas = estado.participantes.map((p) => ({
    p, total: tot.get(p.id) || 0, meses: meses.get(p.id)?.size || 0, copas: campeonatos.get(p.id) || 0,
  })).filter((f) => f.total !== 0 || f.p.activo !== false);
  filas.sort((a, b) => b.total - a.total || a.p.nombre.localeCompare(b.p.nombre, "es"));
  let rank = 0, prev = null;
  filas.forEach((f, i) => { if (f.total !== prev) { rank = i + 1; prev = f.total; } f.rank = rank; });
  return filas;
}

/** Semanas seguidas con puntos, contando hasta esta semana (o la anterior si esta aún no suma). */
export function racha(estado, pid) {
  const semanas = new Set(estado.puntos.filter((r) => r.participanteId === pid && r.puntos > 0).map((r) => semanaKey(r.fecha)));
  let s = semanaKey(Date.now());
  if (!semanas.has(s)) s -= SEMANA;
  let n = 0;
  // Ajuste por horario de verano no aplica en Colombia, pero redondeamos por seguridad.
  while ([...semanas].some((k) => Math.abs(k - s) < 36e5 * 2)) { n++; s -= SEMANA; }
  return n;
}

export function insignias(estado, pid) {
  const out = [];
  const copas = ganadores(estado).filter((g) => g.campeones.some((c) => c.p.id === pid)).length;
  if (copas) out.push({ icono: "🏆", titulo: copas > 1 ? `${copas}× campeón del mes` : "Campeón del mes", desc: "Ganó la liga de un mes" });
  const r = racha(estado, pid);
  if (r >= 2) out.push({ icono: "🔥", titulo: `Racha de ${r} semanas`, desc: "Suma puntos semana tras semana" });
  const acts = new Set(estado.puntos.filter((x) => x.participanteId === pid && x.puntos > 0).map((x) => x.actividadId));
  if (acts.size >= 3) out.push({ icono: "🎯", titulo: "Todoterreno", desc: `Ha puntuado en ${acts.size} actividades distintas` });
  const mes = mesActual();
  const delMes = estado.puntos.filter((x) => mesKey(x.fecha) === mes && x.puntos > 0).sort((a, b) => a.fecha - b.fecha);
  if (delMes[0]?.participanteId === pid) out.push({ icono: "⚡", titulo: "Abrió el mes", desc: "Primeros puntos del mes" });
  const propios = estado.puntos.filter((x) => x.participanteId === pid && x.puntos > 0);
  if (propios.length && propios.every((x) => mesKey(x.fecha) === mes)) out.push({ icono: "⭐", titulo: "Debut", desc: "Su primer mes en la liga" });
  return out;
}

export function desglose(estado, pid, mes) {
  const m = new Map();
  for (const r of estado.puntos) {
    if (r.participanteId !== pid || (mes && mesKey(r.fecha) !== mes)) continue;
    m.set(r.actividadId, (m.get(r.actividadId) || 0) + Number(r.puntos || 0));
  }
  return [...m.entries()].map(([aid, total]) => ({ a: estado.actividades.find((a) => a.id === aid), total })).sort((a, b) => b.total - a.total);
}

/* ── utilidades de presentación ── */
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function iniciales(nombre) {
  const partes = String(nombre || "?").replace(/\./g, "").trim().split(/\s+/);
  return ((partes[0]?.[0] || "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}
const TONOS = [["#22677f", "#66b1d6"], ["#7a4e1c", "#eaa65f"], ["#2d5f4a", "#7fcfa3"], ["#5b3b7a", "#c3a1e6"], ["#7a2f3b", "#ef9aa8"], ["#2f4b7a", "#9cb8ef"], ["#6b6216", "#f0ca00"]];
export function tono(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return TONOS[h % TONOS.length]; }

export function avatar(p, clase = "") {
  const [fondo, borde] = tono(p.id);
  const contenido = p.emoji ? `<span class="av-emoji">${esc(p.emoji)}</span>` : esc(iniciales(p.nombre));
  return `<span class="avatar ${clase}" style="--av-bg:${fondo};--av-ring:${borde}" aria-hidden="true">${contenido}</span>`;
}

export function haceCuanto(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "hace un momento";
  const m = Math.round(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24); if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  return new Date(ts).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}
