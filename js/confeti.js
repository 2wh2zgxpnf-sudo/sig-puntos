// Confeti ligero en canvas con los colores del SIG. Respeta "reducir movimiento".
const COLORES = ["#f0ca00", "#f6dc5a", "#66b1d6", "#eef5f7", "#eaa65f", "#22677f"];

export function lanzarConfeti(intensidad = 1) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.getElementById("confeti");
  if (!c) return;
  const ctx = c.getContext("2d");
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const n = Math.round(140 * intensidad);
  const piezas = Array.from({ length: n }, (_, i) => {
    const izq = i % 2 === 0;
    return {
      x: izq ? -10 : innerWidth + 10, y: innerHeight * (0.55 + Math.random() * 0.2),
      vx: (izq ? 1 : -1) * (4 + Math.random() * 7), vy: -(9 + Math.random() * 9),
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 10, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      color: COLORES[i % COLORES.length], vida: 0,
    };
  });
  const t0 = performance.now();
  function cuadro(t) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of piezas) {
      p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      ctx.restore();
    }
    if (t - t0 < 3800) requestAnimationFrame(cuadro); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  }
  requestAnimationFrame(cuadro);
}
