/* =========================================================
   LAZZAR-1 — modello 3D procedurale (Three.js)
   Il muso punta verso +X. Lunghezza ~10 unità.
   ========================================================= */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const stage = document.querySelector('.lazzar-stage');
const canvas = document.querySelector('.lazzar-3d');
if (!stage || !canvas) throw new Error('LAZZAR stage missing');

/* ---------- Renderer, scena, camera ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  throw new Error('WebGL non disponibile');
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
camera.position.set(0, 2.4, 15);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x0b0d10, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(6, 10, 8);
scene.add(key);
const rim = new THREE.DirectionalLight(0x63acd2, 3);
rim.position.set(-8, 3, -6);
scene.add(rim);

/* ---------- Materiali ---------- */
const M = {
  skin: new THREE.MeshPhysicalMaterial({ color: 0xb4bcc3, metalness: 0.55, roughness: 0.32, clearcoat: 0.4, clearcoatRoughness: 0.25 }),
  dark: new THREE.MeshPhysicalMaterial({ color: 0x2b2e30, metalness: 0.6, roughness: 0.45 }),
  black: new THREE.MeshStandardMaterial({ color: 0x0c0e11, metalness: 0.3, roughness: 0.8 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x0d2233, metalness: 0.1, roughness: 0.04, clearcoat: 1, transmission: 0, reflectivity: 1, envMapIntensity: 2 }),
  nozzle: new THREE.MeshStandardMaterial({ color: 0x3d4247, metalness: 0.9, roughness: 0.35 }),
  glow: new THREE.MeshBasicMaterial({ color: 0x9fe3ff }),
  edge: new THREE.LineBasicMaterial({ color: 0x63acd2, transparent: true, opacity: 0.0 }),
};

const jet = new THREE.Group();     // contiene l'aereo
const rig = new THREE.Group();     // posizione / volo
rig.add(jet);
scene.add(rig);

const add = (geo, mat, cfg = {}) => {
  const m = new THREE.Mesh(geo, mat);
  if (cfg.p) m.position.set(...cfg.p);
  if (cfg.r) m.rotation.set(...cfg.r);
  if (cfg.s) m.scale.set(...cfg.s);
  jet.add(m);
  return m;
};
const edges = [];
const withEdges = (mesh) => {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), M.edge);
  l.position.copy(mesh.position); l.rotation.copy(mesh.rotation); l.scale.copy(mesh.scale);
  jet.add(l); edges.push(l);
  return mesh;
};

/* ---------- Fusoliera (corpo portante schiacciato) ---------- */
{
  const prof = [
    [0, 5.3], [0.05, 5.1], [0.16, 4.6], [0.3, 3.9], [0.46, 3.0], [0.6, 2.0],
    [0.7, 1.0], [0.74, 0], [0.73, -1.2], [0.66, -2.6], [0.56, -3.8], [0.48, -4.5], [0.44, -4.75], [0, -4.75]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(prof, 64);
  geo.rotateZ(-Math.PI / 2);          // asse Y -> X, muso verso +X
  const body = add(geo, M.skin, { s: [1, 0.55, 1.25] });
  body.name = 'body';

  // Punta radome scura
  const nose = new THREE.LatheGeometry(prof.slice(0, 4).concat([new THREE.Vector2(0, 3.9)]), 48);
  nose.rotateZ(-Math.PI / 2);
  add(nose, M.dark, { s: [1.002, 0.556, 1.256] });
}

/* ---------- Chine / corpo piatto (bordo affilato laterale) ---------- */
{
  const s = new THREE.Shape();
  s.moveTo(4.9, 0);
  s.quadraticCurveTo(2.2, 0.9, 0.4, 1.35);
  s.lineTo(-3.6, 1.45);
  s.lineTo(-4.6, 0.9);
  s.lineTo(-4.6, -0.9);
  s.lineTo(-3.6, -1.45);
  s.lineTo(0.4, -1.35);
  s.quadraticCurveTo(2.2, -0.9, 4.9, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
  geo.translate(0, 0, -0.025);
  withEdges(add(geo, M.skin, { r: [-Math.PI / 2, 0, 0], p: [0, -0.02, 0] }));
}

/* ---------- Ali a delta ---------- */
const wingShape = (side) => {
  const s = new THREE.Shape();
  s.moveTo(0.8, 1.2 * side);
  s.lineTo(-3.5, 3.9 * side);
  s.lineTo(-4.15, 3.9 * side);
  s.lineTo(-4.4, 1.2 * side);
  s.closePath();
  return s;
};
[1, -1].forEach(side => {
  const geo = new THREE.ExtrudeGeometry(wingShape(side), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.05, bevelSegments: 2 });
  geo.translate(0, 0, -0.03);
  withEdges(add(geo, M.skin, { r: [-Math.PI / 2, 0, 0], p: [0, -0.06, 0] }));
  // estremità alari scure
  const tip = new THREE.BoxGeometry(0.75, 0.07, 0.06);
  add(tip, M.dark, { p: [-3.82, -0.06, -3.92 * side] });
});

/* ---------- Derive gemelle inclinate ---------- */
[1, -1].forEach(side => {
  const s = new THREE.Shape();
  s.moveTo(-2.7, 0); s.lineTo(-4.55, 0); s.lineTo(-4.85, 1.55); s.lineTo(-4.05, 1.55); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.03, bevelSegments: 2 });
  geo.translate(0, 0, -0.025);
  withEdges(add(geo, M.dark, { p: [0, 0.18, 0.62 * side], r: [0.42 * side, 0, 0] }));
});

/* ---------- Abitacolo ---------- */
{
  const geo = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  add(geo, M.glass, { p: [2.55, 0.27, 0], s: [1.05, 0.3, 0.33] });
  const frame = new THREE.TorusGeometry(1, 0.03, 8, 48, Math.PI);
  add(frame, M.dark, { p: [2.55, 0.27, 0], r: [0, Math.PI / 2, 0], s: [0.33, 0.3, 1] });
}

/* ---------- Gondola motori ventrale + prese d'aria ---------- */
{
  const w = 1.3, h = 0.36, r = 0.12;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const len = 5.2;
  const geo = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  geo.translate(0, 0, -len / 2);
  geo.rotateY(Math.PI / 2);
  add(geo, M.dark, { p: [-1.95, -0.33, 0] });
  // bocche di presa (nere, inclinate)
  [0.32, -0.32].forEach(z => add(new THREE.BoxGeometry(0.05, 0.26, 0.52), M.black, { p: [0.66, -0.33, z], r: [0, 0, -0.35] }));
  add(new THREE.BoxGeometry(0.6, 0.3, 0.04), M.dark, { p: [0.5, -0.33, 0] }); // splitter
}

/* ---------- Ugelli + postbruciatori ---------- */
const flames = [];
[0.34, -0.34].forEach(z => {
  const noz = new THREE.CylinderGeometry(0.2, 0.17, 0.5, 32, 1, true);
  noz.rotateZ(Math.PI / 2);
  add(noz, M.nozzle, { p: [-4.75, -0.33, z] }).material.side = THREE.DoubleSide;
  const disk = new THREE.CircleGeometry(0.16, 32);
  disk.rotateY(-Math.PI / 2);
  add(disk, M.glow, { p: [-4.62, -0.33, z] });

  const mk = (rad, len, color, op) => {
    const g = new THREE.ConeGeometry(rad, len, 24, 1, true);
    g.rotateZ(Math.PI / 2);          // punta verso -X
    g.translate(-len / 2, 0, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(-5.0, -0.33, z);
    jet.add(m); flames.push(m);
    return m;
  };
  mk(0.17, 2.6, 0x63acd2, 0.35);
  mk(0.12, 1.6, 0xbfefff, 0.55);
  mk(0.2, 3.4, 0xff8a3d, 0.12);
});

/* ---------- Coccarde tricolori ---------- */
const roundel = (x, y, z, rot, scale = 1) => {
  [[0.34, 0x1f8a4c], [0.23, 0xffffff], [0.12, 0xd2232a]].forEach(([r, c], i) => {
    const g = new THREE.CircleGeometry(r * scale, 40);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 - i }));
    m.position.set(x, y + i * 0.001, z); m.rotation.set(...rot);
    jet.add(m);
  });
};
roundel(-2.75, 0.04, 2.55, [-Math.PI / 2, 0, 0]);
roundel(-2.75, 0.04, -2.55, [-Math.PI / 2, 0, 0]);
roundel(-2.75, -0.135, 2.55, [Math.PI / 2, 0, 0]);
roundel(-2.75, -0.135, -2.55, [Math.PI / 2, 0, 0]);

/* ---------- Scritta laterale LAZZAR-1 ---------- */
{
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2e30';
  g.font = '700 110px "Josefin Sans", sans-serif';
  g.textBaseline = 'middle';
  g.fillText('LAZZAR-1', 20, 88);
  g.fillStyle = '#336488';
  g.fillRect(700, 40, 18, 90); g.fillRect(730, 40, 18, 90);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const geo = new THREE.PlaneGeometry(1.7, 0.27);
  [1, -1].forEach(side => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(-0.6, 0.1, 0.875 * side);
    m.rotation.set(-0.42 * side, side === 1 ? 0 : Math.PI, 0);
    jet.add(m);
  });
  document.fonts && document.fonts.ready.then(() => {
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = '#2b2e30'; g.font = '700 110px "Josefin Sans", sans-serif';
    g.fillText('LAZZAR-1', 20, 88);
    g.fillStyle = '#336488'; g.fillRect(700, 40, 18, 90); g.fillRect(730, 40, 18, 90);
    tex.needsUpdate = true;
  });
}

/* ---------- Ombra/alone sotto ---------- */
{
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(99,172,210,.35)'); grd.addColorStop(1, 'rgba(99,172,210,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = -2.2;
  rig.add(halo);
}

/* ---------- Interazione: trascina per ruotare ---------- */
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
  velYaw = dx * 0.008;
  dragYaw += velYaw;
  dragPitch = THREE.MathUtils.clamp(dragPitch + dy * 0.005, -0.6, 0.6);
});
const endDrag = () => { dragging = false; stage.classList.remove('is-dragging'); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

/* ---------- Resize & visibilità ---------- */
const resize = () => {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // su schermi stretti allontana la camera per far stare l'aereo
  // distanza tale che ~13 unità (aereo + margine) stiano in larghezza
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.z = Math.max(15, 6.8 / (tanHalf * camera.aspect));
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
  const p = ease(Math.min(Math.max(smoothP, 0), 1));
  const extra = Math.max(smoothP - 1, 0); // dopo l'arrivo: deriva lenta

  // traiettoria d'ingresso: da lontano in basso a sinistra fino al centro
  rig.position.set(lerp(-22, 0, p) + extra * 1.5, lerp(-5, 0, p) + Math.sin(t * 1.3) * 0.12, lerp(-14, 0, p));
  rig.rotation.set(0, lerp(1.1, -0.55, p), lerp(0.55, -0.06, p) + Math.sin(t * 0.9) * 0.03);

  // trascinamento con inerzia
  if (!dragging) { velYaw *= 0.94; dragYaw += velYaw; dragPitch *= 0.95; }
  jet.rotation.set(dragPitch * 0.6, dragYaw, -dragPitch * 0.2 + Math.sin(t * 0.7) * 0.02);

  // linee pannelli che compaiono all'arrivo
  M.edge.opacity = 0.35 * p;

  // fiamme che tremolano
  flames.forEach((f, i) => {
    const k = 0.85 + Math.sin(t * 40 + i * 1.7) * 0.08 + Math.random() * 0.07;
    f.scale.set(k * (0.6 + 0.4 * p), 1, 1);
  });

  renderer.render(scene, camera);
});

stage.classList.add('has-3d');
window.LAZZAR3D = { scene, camera, renderer, jet };
