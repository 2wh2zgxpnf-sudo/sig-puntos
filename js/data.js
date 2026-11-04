// Capa de datos: Firestore (modo real) o localStorage (modo demostración).
// Ambas implementaciones exponen la misma API para que la interfaz no sepa cuál usa.
import { CONFIG } from "./config.js";

export const MODO = CONFIG.firebase ? "firebase" : "demo";
const COLS = ["participantes", "actividades", "puntos"];

/* ───────────────────────── Firebase ───────────────────────── */
const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
let fb = null; // { db, auth, fs, au }

async function fbInit() {
  if (fb) return fb;
  const { initializeApp } = await import(FB + "firebase-app.js");
  const fs = await import(FB + "firebase-firestore.js");
  const au = await import(FB + "firebase-auth.js");
  const app = initializeApp(CONFIG.firebase);
  fb = { db: fs.getFirestore(app), auth: au.getAuth(app), fs, au };
  return fb;
}

const firebaseApi = {
  async suscribir(cb) {
    const { db, fs } = await fbInit();
    const estado = { participantes: [], actividades: [], puntos: [], config: {} };
    const listos = new Set();
    const emitir = () => { if (listos.size === 4) cb({ ...estado }); };
    for (const c of COLS) {
      fs.onSnapshot(fs.collection(db, c), (snap) => {
        estado[c] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        listos.add(c); emitir();
      }, (e) => console.error(c, e));
    }
    fs.onSnapshot(fs.doc(db, "config", "general"), (d) => {
      estado.config = d.exists() ? d.data() : {};
      listos.add("config"); emitir();
    }, (e) => { console.error("config", e); listos.add("config"); emitir(); });
  },
  async onAuth(cb) {
    const { auth, au, db, fs } = await fbInit();
    au.onAuthStateChanged(auth, async (user) => {
      if (!user) return cb({ user: null, esAdmin: false });
      let esAdmin = false;
      try {
        const d = await fs.getDoc(fs.doc(db, "admins", (user.email || "").toLowerCase()));
        esAdmin = d.exists();
      } catch { esAdmin = false; }
      cb({ user: { nombre: user.displayName || user.email, email: user.email }, esAdmin });
    });
  },
  async login() {
    const { auth, au } = await fbInit();
    const prov = new au.GoogleAuthProvider();
    prov.setCustomParameters({ prompt: "select_account" });
    try { await au.signInWithPopup(auth, prov); }
    catch (e) {
      if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")
        await au.signInWithRedirect(auth, prov);
      else throw e;
    }
  },
  async logout() { const { auth, au } = await fbInit(); await au.signOut(auth); },
  async crear(col, data) { const { db, fs } = await fbInit(); await fs.addDoc(fs.collection(db, col), data); },
  async actualizar(col, id, data) { const { db, fs } = await fbInit(); await fs.updateDoc(fs.doc(db, col, id), data); },
  async borrar(col, id) { const { db, fs } = await fbInit(); await fs.deleteDoc(fs.doc(db, col, id)); },
  async otorgar(registros) {
    const { db, fs } = await fbInit();
    const b = fs.writeBatch(db);
    for (const r of registros) b.set(fs.doc(fs.collection(db, "puntos")), r);
    await b.commit();
  },
  async guardarConfig(data) {
    const { db, fs } = await fbInit();
    await fs.setDoc(fs.doc(db, "config", "general"), data, { merge: true });
  },
};

/* ───────────────────────── Demo ───────────────────────── */
const KEY = "ligasig-demo-v1";
const oyentes = new Set();
const uid = () => Math.random().toString(36).slice(2, 10);

function semilla() {
  // Nombres inventados (no son miembros reales del SIG).
  const nombres = [
    ["Valentina R.", "🦋"], ["Samuel O.", ""], ["Mariana T.", "🌻"], ["Juan Pablo G.", ""],
    ["Isabella C.", ""], ["Tomás H.", "🦊"], ["Sara L.", ""], ["Daniel M.", ""],
    ["Camila P.", "🫀"], ["Mateo V.", ""], ["Antonia B.", ""], ["Nicolás E.", "🔬"],
  ];
  const participantes = nombres.map(([nombre, emoji]) => ({ id: uid(), nombre, emoji, activo: true, creado: Date.now() }));
  const actividades = [
    { id: uid(), nombre: "Lunes de caso clínico", emoji: "🩺", puntos: 10 },
    { id: uid(), nombre: "Perla quirúrgica", emoji: "💎", puntos: 5 },
    { id: uid(), nombre: "Quiz relámpago", emoji: "⚡", puntos: 8 },
    { id: uid(), nombre: "Dato random", emoji: "🎲", puntos: 3 },
    { id: uid(), nombre: "Asistencia a charla", emoji: "🎤", puntos: 4 },
  ];
  // Pseudoaleatorio determinista para que el demo se vea igual en cada carga.
  let s = 7; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const puntos = [];
  const ahora = Date.now(), DIA = 864e5;
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const diasMes = Math.max(1, (ahora - inicioMes) / DIA);
  for (let d = 75; d >= 0; d -= 1) {
    let ts = ahora - d * DIA - Math.floor(rnd() * 8) * 36e5;
    let n = rnd() < 0.55 ? Math.floor(rnd() * 3) : 0;
    // En el demo, el mes en curso siempre se ve "jugado": se comprimen los últimos 14 días dentro de él.
    if (d < 14) { ts = inicioMes + ((14 - d) / 14) * diasMes * DIA * 0.98; n += 1; if (ts > ahora) ts = ahora - 6e4; }
    for (let i = 0; i < n; i++) {
      // Sesgo para que haya líderes claros y competencia arriba.
      const idx = Math.min(participantes.length - 1, Math.floor(Math.pow(rnd(), 1.6) * participantes.length));
      const a = actividades[Math.floor(rnd() * actividades.length)];
      puntos.push({
        id: uid(), participanteId: participantes[idx].id, actividadId: a.id, puntos: a.puntos,
        fecha: ts, nota: rnd() < 0.2 ? "¡Respuesta más rápida!" : "", otorgadoPor: "Junta SIG",
      });
    }
  }
  return { participantes, actividades, puntos, config: { premio: CONFIG.premioPorDefecto, mensaje: "Cada semana una actividad nueva en el grupo. ¡Suma, sube y llévate el premio del mes!" } };
}

function leer() {
  try { const e = JSON.parse(localStorage.getItem(KEY)); if (e) return e; } catch {}
  const e = semilla(); localStorage.setItem(KEY, JSON.stringify(e)); return e;
}
function escribir(fn) {
  const e = leer(); fn(e); localStorage.setItem(KEY, JSON.stringify(e));
  oyentes.forEach((cb) => cb({ ...e }));
}
window.addEventListener("storage", (ev) => { if (ev.key === KEY) oyentes.forEach((cb) => cb({ ...leer() })); });

const demoApi = {
  async suscribir(cb) { oyentes.add(cb); cb({ ...leer() }); },
  async onAuth(cb) {
    const on = sessionStorage.getItem("ligasig-demo-admin") === "1";
    demoApi._cb = cb;
    cb(on ? { user: { nombre: "Admin demo", email: "demo" }, esAdmin: true } : { user: null, esAdmin: false });
  },
  async login() { sessionStorage.setItem("ligasig-demo-admin", "1"); demoApi.onAuth(demoApi._cb); },
  async logout() { sessionStorage.removeItem("ligasig-demo-admin"); demoApi.onAuth(demoApi._cb); },
  async crear(col, data) { escribir((e) => e[col].push({ id: uid(), ...data })); },
  async actualizar(col, id, data) { escribir((e) => { const x = e[col].find((r) => r.id === id); if (x) Object.assign(x, data); }); },
  async borrar(col, id) { escribir((e) => { e[col] = e[col].filter((r) => r.id !== id); }); },
  async otorgar(registros) { escribir((e) => registros.forEach((r) => e.puntos.push({ id: uid(), ...r }))); },
  async guardarConfig(data) { escribir((e) => { e.config = { ...e.config, ...data }; }); },
  reiniciar() { localStorage.removeItem(KEY); escribir(() => {}); },
};

export const api = MODO === "firebase" ? firebaseApi : demoApi;
