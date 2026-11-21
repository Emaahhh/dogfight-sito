/* =========================================================
   LAZZAR-1 — modello 3D procedurale (Three.js)
   Superfici "lofted": fusoliera a chine, ali e derive con
   profilo NACA, texture dipinte via canvas.
   Il muso punta verso +X. Lunghezza ~10,3 unità.
   ========================================================= */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const stage = document.querySelector('.lazzar-stage');
const canvas = document.querySelector('.lazzar-3d');
if (!stage || !canvas) throw new Error('LAZZAR stage missing');

/* ---------- Renderer, scena, camera ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);

scene.add(new THREE.HemisphereLight(0xd6ecff, 0x101418, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(5, 10, 7);
scene.add(key);
const rim = new THREE.DirectionalLight(0x63acd2, 3.2);
rim.position.set(-9, 2, -7);
scene.add(rim);
const under = new THREE.DirectionalLight(0x336488, 1.2);
under.position.set(0, -8, 3);
scene.add(under);

const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

/* ---------- Utility geometria ---------- */
// Griglia (rows x cols) -> BufferGeometry, con orientamento automatico delle normali
function grid(rows, cols, pos, uv, outward) {
  const P = [], U = [], I = [];
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
    P.push(...pos(i, j)); U.push(...(uv ? uv(i, j) : [j / cols, i / rows]));
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * (cols + 1) + j, b = a + cols + 1, c = a + 1, d = b + 1;
    I.push(a, b, c, b, d, c);
  }
  if (outward) {
    const i = Math.floor(rows / 2), j = Math.floor(cols / 2);
    const a = i * (cols + 1) + j, b = a + cols + 1, c = a + 1;
    const va = new THREE.Vector3().fromArray(P, a * 3), vb = new THREE.Vector3().fromArray(P, b * 3), vc = new THREE.Vector3().fromArray(P, c * 3);
    const n = vb.clone().sub(va).cross(vc.clone().sub(va));
    if (n.dot(outward(va)) < 0) for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}
const naca = (c, tc) => 5 * tc * (0.2969 * Math.sqrt(c) - 0.126 * c - 0.3516 * c * c + 0.2843 * c ** 3 - 0.1036 * c ** 4);
const cosSpace = (j, n) => (1 - Math.cos(Math.PI * j / n)) / 2;
const clamp01 = v => Math.min(Math.max(v, 0), 1);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = MAX_ANISO;
  t.userData.redraw = () => { g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true; };
  return t;
}
const noise = (g, w, h, n, a) => {
  for (let k = 0; k < n; k++) {
    g.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 30, 1 + Math.random() * 3);
  }
};
const roundelAt = (g, x, y, r) => {
  [[1, '#1f8a4c'], [0.68, '#f4f4f4'], [0.36, '#d2232a']].forEach(([k, col]) => {
    g.beginPath(); g.arc(x, y, r * k, 0, Math.PI * 2); g.fillStyle = col; g.fill();
  });
};
const FONT = '"Josefin Sans", "Segoe UI", sans-serif';

/* =========================================================
   FUSOLIERA
   ========================================================= */
const X0 = 5.6, L = 10.3, X1 = X0 - L;
const W = t => {
  const a = clamp01(t / 0.7);
  let w = 1.3 * (1 - Math.pow(1 - a, 1.9));
  if (t > 0.8) w *= 1 - (t - 0.8) / 0.2 * 0.22;
  return w;
};
const HT = t => {
  const a = clamp01(t / 0.58);
  let h = 0.44 * (1 - Math.pow(1 - a, 2.1));
  if (t > 0.8) h *= 1 - (t - 0.8) / 0.2 * 0.4;
  return h;
};
const HB = t => {
  const a = clamp01(t / 0.5);
  let h = 0.24 * (1 - Math.pow(1 - a, 2));
  if (t > 0.82) h *= 1 - (t - 0.82) / 0.18 * 0.3;
  return h;
};
const PT = 1.15, PB = 1.3;
const topY = (x, z) => {
  const t = (X0 - x) / L, w = W(t);
  const u = Math.min(Math.abs(z) / Math.max(w, 1e-4), 1);
  return HT(t) * Math.pow(1 - u * u, PT);
};

const fuselageTex = canvasTex(2048, 1024, (g, w, h) => {
  // base: dorso chiaro, ventre più scuro
  g.fillStyle = '#b9c1c8'; g.fillRect(0, 0, w, h / 2);
  g.fillStyle = '#8f989f'; g.fillRect(0, h / 2, w, h / 2);
  noise(g, w, h, 2600, 0.025);
  // radome
  g.fillStyle = '#2b2e30'; g.fillRect(0, 0, w * 0.075, h);
  // linee pannelli
  g.strokeStyle = 'rgba(30,35,40,.45)'; g.lineWidth = 2;
  [0.13, 0.2, 0.28, 0.37, 0.46, 0.55, 0.63, 0.72, 0.81, 0.9].forEach(u => { g.beginPath(); g.moveTo(u * w, 0); g.lineTo(u * w, h); g.stroke(); });
  [0.1, 0.4, 0.62, 0.88].forEach(v => { g.beginPath(); g.moveTo(w * 0.2, v * h); g.lineTo(w * 0.95, v * h); g.stroke(); });
  // portelli e rivetti
  g.strokeStyle = 'rgba(30,35,40,.5)';
  [[0.3, 0.2, 60, 40], [0.52, 0.3, 90, 30], [0.66, 0.16, 50, 50], [0.5, 0.72, 120, 60], [0.75, 0.78, 80, 40]].forEach(([u, v, ww, hh]) => g.strokeRect(u * w, v * h, ww, hh));
  g.fillStyle = 'rgba(30,35,40,.35)';
  for (let u = 0.2; u < 0.92; u += 0.006) { g.fillRect(u * w, 0.1 * h - 6, 2, 2); g.fillRect(u * w, 0.4 * h + 4, 2, 2); }
  // pannello antiriflesso davanti al tettuccio
  g.fillStyle = '#353a3f';
  g.beginPath(); g.moveTo(w * 0.075, h * 0.25); g.lineTo(w * 0.16, h * 0.19); g.lineTo(w * 0.16, h * 0.31); g.closePath(); g.fill();
  // scritte LAZZAR-1 lungo i fianchi del dorso
  // sx/sy: specchiature per leggere la scritta dal lato giusto
  const label = (y, sx, sy) => {
    g.save(); g.translate(w * 0.43, y); g.scale(sx, sy);
    g.fillStyle = '#23272b'; g.font = `700 44px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('LAZZAR-1', 0, 0);
    g.fillStyle = '#336488'; g.fillRect(130, -18, 10, 36); g.fillRect(148, -18, 10, 36);
    g.restore();
  };
  label(h * 0.07, 1, -1);  // lato sinistro (z negativo)
  label(h * 0.43, -1, 1);  // lato destro
  // tricolore dorsale e codice
  g.fillStyle = '#1f8a4c'; g.fillRect(w * 0.84, h * 0.225, 70, 18);
  g.fillStyle = '#f4f4f4'; g.fillRect(w * 0.84, h * 0.243, 70, 18);
  g.fillStyle = '#d2232a'; g.fillRect(w * 0.84, h * 0.261, 70, 18);
  g.save(); g.translate(w * 0.66, h * 0.25); g.scale(-1, 1);
  g.fillStyle = 'rgba(35,39,43,.8)'; g.font = `600 26px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('DOGFIGHT · DSDAI', 0, 0);
  g.restore();
  // ventre: linee di servizio
  g.strokeStyle = 'rgba(20,24,28,.4)';
  [0.6, 0.9].forEach(v => { g.beginPath(); g.moveTo(w * 0.1, v * h); g.lineTo(w * 0.95, v * h); g.stroke(); });
});

const M = {
  skin: new THREE.MeshPhysicalMaterial({ map: fuselageTex, metalness: 0.45, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
  dark: new THREE.MeshPhysicalMaterial({ color: 0x2c3034, metalness: 0.6, roughness: 0.45, clearcoat: 0.2 }),
  black: new THREE.MeshStandardMaterial({ color: 0x07090b, metalness: 0.2, roughness: 0.9, side: THREE.DoubleSide }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x0a1a28, metalness: 0.05, roughness: 0.04, clearcoat: 1, iridescence: 0.6, iridescenceIOR: 1.6, envMapIntensity: 2.6 }),
  nozzle: new THREE.MeshPhysicalMaterial({ color: 0x4a4f55, metalness: 0.95, roughness: 0.3, side: THREE.DoubleSide }),
  glow: new THREE.MeshBasicMaterial({ color: 0xbff0ff }),
};

const jet = new THREE.Group();
const rig = new THREE.Group();
rig.add(jet); scene.add(rig);
const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); jet.add(m); return m; };

{
  const N = 160, K = 56;
  const tAt = i => Math.pow(i / N, 1.25);
  const ux = (i) => tAt(i);              // coordinata u = posizione lungo la fusoliera
  const uz = j => -Math.cos(Math.PI * j / K);
  // dorso
  mesh(grid(N, K, (i, j) => {
    const t = tAt(i), x = X0 - t * L, u = uz(j);
    return [x, HT(t) * Math.pow(Math.max(1 - u * u, 0), PT), W(t) * u];
  }, (i, j) => [ux(i), 0.5 * j / K], () => new THREE.Vector3(0, 1, 0)), M.skin);
  // ventre
  mesh(grid(N, K, (i, j) => {
    const t = tAt(i), x = X0 - t * L, u = uz(j);
    return [x, -HB(t) * Math.pow(Math.max(1 - u * u, 0), PB), W(t) * u];
  }, (i, j) => [ux(i), 0.5 + 0.5 * j / K], () => new THREE.Vector3(0, -1, 0)), M.skin);
  // chiusura posteriore
  const s = new THREE.Shape();
  for (let j = 0; j <= K; j++) { const u = uz(j); const p = [W(1) * u, HT(1) * Math.pow(1 - u * u, PT)]; j ? s.lineTo(...p) : s.moveTo(...p); }
  for (let j = K; j >= 0; j--) { const u = uz(j); s.lineTo(W(1) * u, -HB(1) * Math.pow(1 - u * u, PB)); }
  const cap = new THREE.ShapeGeometry(s); cap.rotateY(Math.PI / 2); cap.translate(X1, 0, 0);
  mesh(cap, M.black);
  // sonda di Pitot
  const pitot = new THREE.CylinderGeometry(0.008, 0.014, 0.6, 8); pitot.rotateZ(Math.PI / 2); pitot.translate(X0 + 0.28, 0, 0);
  mesh(pitot, M.dark);
}

/* =========================================================
   TETTUCCIO
   ========================================================= */
{
  const N = 40, K = 28, xa = 1.35, xb = 3.95;
  mesh(grid(N, K, (i, j) => {
    const s = i / N, x = xa + s * (xb - xa);
    const q = Math.sin(Math.PI * Math.pow(s, 0.72));
    const hc = 0.24 * Math.pow(q, 0.75), wc = 0.29 * Math.pow(q, 0.5);
    const th = Math.PI * j / K, z = wc * Math.cos(th);
    return [x, topY(x, z) - 0.004 + hc * Math.sin(th), z];
  }, null, () => new THREE.Vector3(0, 1, 0)), M.glass);
  // montante centrale
  const bow = grid(30, 4, (i, j) => {
    const s = 0.28 + (i / 30) * 0.5, x = xa + s * (xb - xa);
    const q = Math.sin(Math.PI * Math.pow(s, 0.72));
    const hc = 0.24 * Math.pow(q, 0.75), wc = 0.29 * Math.pow(q, 0.5);
    const th = Math.PI / 2 + (j / 4 - 0.5) * 0.08;
    return [x, topY(x, wc * Math.cos(th)) + 0.004 + hc * Math.sin(th), wc * Math.cos(th)];
  }, null, () => new THREE.Vector3(0, 1, 0));
  mesh(bow, M.dark);
}

/* =========================================================
   ALI (profilo NACA, freccia a delta)
   ========================================================= */
const WING = { zr: 0.5, zt: 4.0, ler: 0.8, let: -3.5, ter: -4.55, tet: -4.3, y0: 0.0 };
const wingTex = canvasTex(1024, 720, (g, w, h) => {
  const U = x => (WING.ler - x) / (WING.ler - WING.ter) * w;
  const V = z => (z - WING.zr) / (WING.zt - WING.zr) * h;
  g.fillStyle = '#b9c1c8'; g.fillRect(0, 0, w, h);
  noise(g, w, h, 900, 0.03);
  // bordo d'attacco scuro (RAM)
  g.strokeStyle = '#33383d'; g.lineWidth = 34; g.lineCap = 'round';
  g.beginPath(); g.moveTo(U(WING.ler) + 14, V(WING.zr)); g.lineTo(U(WING.let) + 14, V(WING.zt)); g.stroke();
  g.lineWidth = 60; g.beginPath(); g.moveTo(U(WING.let), V(WING.zt) - 6); g.lineTo(U(WING.tet), V(WING.zt) - 6); g.stroke();
  // pannelli paralleli al bordo d'attacco
  g.lineCap = 'butt'; g.strokeStyle = 'rgba(30,35,40,.4)'; g.lineWidth = 2;
  [0.25, 0.5, 0.72].forEach(k => {
    g.beginPath();
    g.moveTo(U(WING.ler + (WING.ter - WING.ler) * k), V(WING.zr));
    g.lineTo(U(WING.let + (WING.tet - WING.let) * k), V(WING.zt) - 30);
    g.stroke();
  });
  [0.3, 0.6].forEach(k => { g.beginPath(); g.moveTo(0, k * h); g.lineTo(w, k * h); g.stroke(); });
  // elevoni
  g.strokeStyle = 'rgba(20,24,28,.6)'; g.lineWidth = 3;
  const ev = (s0, s1) => {
    const z0 = WING.zr + (WING.zt - WING.zr) * s0, z1 = WING.zr + (WING.zt - WING.zr) * s1;
    const te0 = WING.ter + (WING.tet - WING.ter) * s0, te1 = WING.ter + (WING.tet - WING.ter) * s1;
    g.beginPath(); g.moveTo(U(te0), V(z0)); g.lineTo(U(te0 + 0.55), V(z0)); g.lineTo(U(te1 + 0.5), V(z1)); g.lineTo(U(te1), V(z1)); g.stroke();
  };
  ev(0.18, 0.5); ev(0.53, 0.86);
  // coccarda
  roundelAt(g, U(-2.75), V(2.45), 0.36 / (WING.zt - WING.zr) * h);
  // scritta piccola
  g.fillStyle = 'rgba(35,39,43,.7)'; g.font = `600 18px ${FONT}`;
  g.fillText('NO STEP', U(-1.4), V(1.35));
});
M.wing = new THREE.MeshPhysicalMaterial({ map: wingTex, metalness: 0.45, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 });

function wing(side) {
  const S = 32, C = 56;
  const geom = (sign) => grid(S, C, (i, j) => {
    const s = i / S, c = cosSpace(j, C);
    const z = WING.zr + s * (WING.zt - WING.zr);
    const le = WING.ler + s * (WING.let - WING.ler), te = WING.ter + s * (WING.tet - WING.ter), ch = le - te;
    const tc = 0.045 - 0.017 * s;
    return [le - c * ch, WING.y0 + sign * naca(c, tc) * ch, z * side];
  }, (i, j) => {
    const s = i / S, c = cosSpace(j, C);
    const z = WING.zr + s * (WING.zt - WING.zr);
    const le = WING.ler + s * (WING.let - WING.ler), te = WING.ter + s * (WING.tet - WING.ter);
    const x = le - c * (le - te);
    return [(WING.ler - x) / (WING.ler - WING.ter), (z - WING.zr) / (WING.zt - WING.zr)];
  }, () => new THREE.Vector3(0, sign, 0));
  mesh(geom(1), M.wing); mesh(geom(-1), M.wing);
  // chiusura estremità
  const C2 = 56;
  mesh(grid(1, C2, (i, j) => {
    const c = cosSpace(j, C2), ch = WING.let - WING.tet;
    return [WING.let - c * ch, WING.y0 + (i ? -1 : 1) * naca(c, 0.028) * ch, WING.zt * side];
  }, null, () => new THREE.Vector3(0, 0, side)), M.dark);
}
wing(1); wing(-1);

/* =========================================================
   DERIVE INCLINATE
   ========================================================= */
const TAIL = { h: 1.55, ler: -2.7, let: -4.25, ter: -4.65, tet: -4.95 };
const tailTex = canvasTex(512, 352, (g, w, h) => {
  const U = x => (TAIL.ler - x) / (TAIL.ler - TAIL.tet) * w;
  const V = s => (1 - s) * h;   // s=0 radice, s=1 punta
  g.fillStyle = '#3b4045'; g.fillRect(0, 0, w, h);
  noise(g, w, h, 300, 0.035);
  g.strokeStyle = '#262a2e'; g.lineWidth = 22; g.lineCap = 'round';
  g.beginPath(); g.moveTo(U(TAIL.ler) + 8, V(0)); g.lineTo(U(TAIL.let) + 8, V(1)); g.stroke();
  // timone
  g.lineCap = 'butt'; g.strokeStyle = 'rgba(15,18,20,.7)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(U(-4.12), V(0.12)); g.lineTo(U(-4.5), V(0.85)); g.stroke();
  // bandiera tricolore
  const s0 = 0.66, s1 = 0.86;
  const xs = [-3.92, -4.12, -4.32, -4.52];
  [['#1f8a4c', 0], ['#f4f4f4', 1], ['#d2232a', 2]].forEach(([col, k]) => {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(U(xs[k]), V(s0)); g.lineTo(U(xs[k + 1]), V(s0)); g.lineTo(U(xs[k + 1] - 0.08), V(s1)); g.lineTo(U(xs[k] - 0.08), V(s1)); g.closePath(); g.fill();
  });
  // numero
  g.fillStyle = '#e8ecef'; g.font = `700 64px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('01', U(-4.0), V(0.38));
  g.fillStyle = '#63acd2'; g.font = `600 18px ${FONT}`;
  g.fillText('LAZZAR', U(-4.0), V(0.2));
});
M.tail = new THREE.MeshPhysicalMaterial({ map: tailTex, metalness: 0.55, roughness: 0.45, clearcoat: 0.25 });

function tail(side) {
  const S = 20, C = 40, grp = new THREE.Group();
  const geom = (sign) => grid(S, C, (i, j) => {
    const s = i / S, c = cosSpace(j, C);
    const le = TAIL.ler + s * (TAIL.let - TAIL.ler), te = TAIL.ter + s * (TAIL.tet - TAIL.ter), ch = le - te;
    return [le - c * ch, s * TAIL.h, sign * naca(c, 0.05 - 0.015 * s) * ch];
  }, (i, j) => {
    const s = i / S, c = cosSpace(j, C);
    const le = TAIL.ler + s * (TAIL.let - TAIL.ler), te = TAIL.ter + s * (TAIL.tet - TAIL.ter);
    const u = (TAIL.ler - (le - c * (le - te))) / (TAIL.ler - TAIL.tet);
    return [sign > 0 ? 1 - u : u, 1 - s];   // faccia +z: texture specchiata così il numero resta leggibile
  }, () => new THREE.Vector3(0, 0, sign));
  [1, -1].forEach(sign => grp.add(new THREE.Mesh(geom(sign), M.tail)));
  grp.add(new THREE.Mesh(grid(1, C, (i, j) => {
    const c = cosSpace(j, C), ch = TAIL.let - TAIL.tet;
    return [TAIL.let - c * ch, TAIL.h, (i ? -1 : 1) * naca(c, 0.035) * ch];
  }, null, () => new THREE.Vector3(0, 1, 0)), M.dark));
  grp.position.set(0, 0.12, 0.6 * side);
  grp.rotation.x = 0.42 * side;
  jet.add(grp);
  return grp;
}
tail(1); tail(-1);

/* =========================================================
   GONDOLA MOTORI, PRESA D'ARIA, UGELLI
   ========================================================= */
{
  const NW = 1.34, NH = 0.34, YC = -0.3, XA = 0.75, XB = -4.42, M2 = 48, N = 30;
  const ring = k => {
    const a = (k / M2) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    return [NW / 2 * Math.sign(c) * Math.pow(Math.abs(c), 0.3), NH / 2 * Math.sign(s) * Math.pow(Math.abs(s), 0.3)];
  };
  mesh(grid(N, M2, (i, j) => {
    const s = i / N, x = XA + s * (XB - XA);
    const sc = s > 0.88 ? 1 - (s - 0.88) / 0.12 * 0.1 : 1;
    const [z, y] = ring(j);
    return [x, YC + y * sc, z * sc];
  }, null, p => new THREE.Vector3(0, p.y - YC, p.z)), M.dark);
  // bocca della presa d'aria (nera) con labbro
  const s = new THREE.Shape();
  for (let k = 0; k <= M2; k++) { const [z, y] = ring(k); k ? s.lineTo(z * 0.93, y * 0.86) : s.moveTo(z * 0.93, y * 0.86); }
  const inlet = new THREE.ShapeGeometry(s); inlet.rotateY(Math.PI / 2); inlet.translate(XA + 0.002, YC, 0);
  mesh(inlet, M.black);
  // setto centrale e rampa di compressione
  mesh(new THREE.BoxGeometry(0.5, NH * 0.8, 0.03).translate(XA - 0.2, YC, 0), M.dark);
  const ramp = new THREE.Shape(); ramp.moveTo(1.9, -0.18); ramp.lineTo(XA, -0.18); ramp.lineTo(XA, -0.36); ramp.closePath();
  const rg = new THREE.ExtrudeGeometry(ramp, { depth: NW * 0.86, bevelEnabled: false }); rg.translate(0, 0, -NW * 0.43);
  mesh(rg, M.dark);

  // ugelli convergenti-divergenti
  const prof = [[0.15, 0], [0.175, 0.08], [0.19, 0.3], [0.185, 0.34], [0.17, 0.33], [0.15, 0.12], [0.13, 0.02]].map(([r, y]) => new THREE.Vector2(r, y));
  [0.34, -0.34].forEach(z => {
    const g = new THREE.LatheGeometry(prof, 40); g.rotateZ(Math.PI / 2); g.translate(XB + 0.02, YC, z);
    mesh(g, M.nozzle);
    const disk = new THREE.CircleGeometry(0.13, 32); disk.rotateY(-Math.PI / 2); disk.translate(XB - 0.12, YC, z);
    mesh(disk, M.glow);
  });
}

/* ---------- Postbruciatori ---------- */
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(160,225,255,.8)'); gr.addColorStop(1, 'rgba(99,172,210,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const flames = [], sprites = [];
[0.34, -0.34].forEach(z => {
  const mk = (rad, len, color, op) => {
    const g = new THREE.ConeGeometry(rad, len, 28, 1, true);
    g.rotateZ(Math.PI / 2); g.translate(-len / 2, 0, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(-4.75, -0.3, z); jet.add(m); flames.push(m);
  };
  mk(0.15, 2.8, 0x63acd2, 0.32);
  mk(0.1, 1.5, 0xd6f6ff, 0.6);
  mk(0.18, 3.8, 0xff8a3d, 0.1);
  // anelli "shock diamond"
  for (let k = 1; k <= 3; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x9fe3ff, transparent: true, opacity: 0.5 / k, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.position.set(-4.75 - k * 0.55, -0.3, z); sp.scale.setScalar(0.42 - k * 0.07);
    jet.add(sp); sprites.push(sp);
  }
});

/* ---------- Luci di navigazione ---------- */
const navLight = (color, pos, size = 0.35) => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sp.position.set(...pos); sp.scale.setScalar(size); jet.add(sp);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshBasicMaterial({ color }));
  b.position.set(...pos); jet.add(b);
  return sp;
};
const navR = navLight(0xff3b3b, [-3.85, 0.0, -4.02]);
const navG = navLight(0x3bff7a, [-3.85, 0.0, 4.02]);
const strobe = navLight(0xffffff, [-4.6, 0.05, 0], 0.5);

/* ---------- Alone sotto ---------- */
{
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(99,172,210,.32)'); grd.addColorStop(1, 'rgba(99,172,210,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(15, 10), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = -2.3;
  rig.add(halo);
}

// ridisegna le texture quando il font del sito è caricato
document.fonts && document.fonts.ready.then(() => [fuselageTex, wingTex, tailTex].forEach(t => t.userData.redraw()));

/* =========================================================
   INTERAZIONE: trascina per ruotare
   ========================================================= */
let dragYaw = 0, dragPitch = 0, velYaw = 0, dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse') return;
  dragging = true; lastX = e.clientX; lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
  stage.classList.add('is-dragging');
});
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  velYaw = dx * 0.008; dragYaw += velYaw;
  dragPitch = THREE.MathUtils.clamp(dragPitch + dy * 0.005, -0.7, 0.7);
});
const endDrag = () => { dragging = false; stage.classList.remove('is-dragging'); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

/* ---------- Resize & visibilità ---------- */
const resize = () => {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.z = Math.max(15, 7 / (tanHalf * camera.aspect));
  camera.position.y = camera.position.z * 0.3;
  camera.lookAt(0, -0.3, 0);
  camera.updateProjectionMatrix();
};
new ResizeObserver(resize).observe(stage);
resize();

let visible = true;
new IntersectionObserver(([en]) => (visible = en.isIntersecting), { rootMargin: '100px' }).observe(stage);

/* ---------- Loop ---------- */
const lerp = THREE.MathUtils.lerp;
const ease = t => 1 - Math.pow(1 - t, 3);
const clock = new THREE.Clock();
let smoothP = 0;

renderer.setAnimationLoop(() => {
  if (!visible) return;
  const t = clock.getElapsedTime();
  const target = typeof window.LAZZAR_P === 'number' ? window.LAZZAR_P : 1;
  smoothP = lerp(smoothP, target, 0.08);
  const p = ease(clamp01(smoothP));
  const extra = Math.max(smoothP - 1, 0);

  rig.position.set(lerp(-24, 0, p) + extra * 1.5, lerp(-5, 0, p) + Math.sin(t * 1.3) * 0.12, lerp(-15, 0, p));
  rig.rotation.set(0, lerp(1.1, -0.6, p), lerp(0.55, -0.08, p) + Math.sin(t * 0.9) * 0.03);

  if (!dragging) { velYaw *= 0.94; dragYaw += velYaw; dragPitch *= 0.95; }
  jet.rotation.set(dragPitch * 0.6, dragYaw, -dragPitch * 0.2 + Math.sin(t * 0.7) * 0.02);

  flames.forEach((f, i) => {
    const k = 0.85 + Math.sin(t * 40 + i * 1.7) * 0.08 + Math.random() * 0.07;
    f.scale.set(k * (0.6 + 0.4 * p), 1, 1);
  });
  sprites.forEach((s, i) => (s.material.opacity = (0.45 + Math.random() * 0.15) / ((i % 3) + 1)));
  const blink = (t % 1.2) < 0.08;
  strobe.material.opacity = blink ? 1 : 0.05;
  navR.material.opacity = navG.material.opacity = 0.65 + Math.sin(t * 3) * 0.25;

  renderer.render(scene, camera);
});

stage.classList.add('has-3d');
window.LAZZAR3D = { scene, camera, renderer, jet };
