/* =========================================================
   DOGFIGHT — interazioni e animazioni
   GSAP + ScrollTrigger + Lenis (con fallback se non disponibili)
   ========================================================= */
(() => {
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const hasGsap = !!(window.gsap && window.ScrollTrigger);
const animate = hasGsap && !reduced;

/* ---------- 1. Logo animabili: sostituisce <use> con i tracciati reali ---------- */
$$('[data-logo]').forEach(svg => {
  const src = $(svg.dataset.logo === 'badge' ? '#logo-badge g' : '#logo-word g');
  svg.innerHTML = '';
  svg.appendChild(src.cloneNode(true));
});

/* ---------- 2. Utility ---------- */
const fmt = (v, dec) => {
  const [int, frac] = v.toFixed(dec).split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (frac ? ',' + frac : '');
};
const toast = (() => {
  const el = $('.toast'); let t;
  return msg => { el.textContent = msg; el.classList.add('show'); clearTimeout(t); t = setTimeout(() => el.classList.remove('show'), 1800); };
})();

// Split di titoli in parole mascherate
function splitWords(el) {
  const frag = document.createDocumentFragment();
  [...el.childNodes].forEach(node => {
    if (node.nodeType === 3) {
      node.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span'); w.className = 'sw';
        const i = document.createElement('span'); i.textContent = part;
        w.appendChild(i); frag.appendChild(w);
      });
    } else frag.appendChild(node.cloneNode(true));
  });
  el.innerHTML = ''; el.appendChild(frag);
  return $$('.sw > span', el);
}
// Split dello statement in parole (per l'effetto "accensione")
function splitPlain(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map(w => `<span class="w">${w}</span>`).join(' ');
  return $$('.w', el);
}

/* ---------- 3. UI che funziona sempre ---------- */
// Menu mobile
const toggle = $('.menu-toggle');
const setMenu = open => {
  document.body.classList.toggle('menu-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Chiudi menu' : 'Apri menu');
  if (window.__lenis) open ? window.__lenis.stop() : window.__lenis.start();
};
toggle.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

// Copia colori palette
$$('.swatch').forEach(b => b.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(b.dataset.copy); toast(`Copiato ${b.dataset.copy}`); }
  catch { toast(b.dataset.copy); }
}));

// Form contatti -> mailto
$('#contact-form').addEventListener('submit', e => {
  e.preventDefault();
  const d = new FormData(e.target);
  const subject = `[${d.get('argomento')}] Messaggio da ${d.get('nome')}`;
  const body = `${d.get('messaggio')}\n\n— ${d.get('nome')} (${d.get('email')})`;
  location.href = `mailto:dogfight.ita@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  toast('Apro il programma di posta…');
});

$('#year').textContent = new Date().getFullYear();

// Tilt 3D + spotlight sulle card
if (finePointer && !reduced) {
  $$('[data-tilt]').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
      card.style.transform = `rotateY(${(x - .5) * 10}deg) rotateX(${(.5 - y) * 10}deg) translateZ(0)`;
    });
    card.addEventListener('pointerleave', () => {
      card.style.transition = 'transform .7s cubic-bezier(.22,1,.36,1), box-shadow .4s';
      card.style.transform = '';
      setTimeout(() => (card.style.transition = ''), 700);
    });
  });
}

/* ---------- Fallback senza animazioni ---------- */
if (!animate) {
  root.classList.add('no-anim');
  document.body.classList.remove('is-loading');
  $$('[data-count]').forEach(el => (el.textContent = fmt(+el.dataset.count, +el.dataset.dec)));
  $$('.stat').forEach(s => s.classList.add('on'));
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', () => setMenu(false)));
  return;
}

/* =========================================================
   DA QUI: VERSIONE ANIMATA
   ========================================================= */
gsap.registerPlugin(ScrollTrigger);
document.body.classList.add('is-loading');
if (finePointer) root.classList.add('has-cursor');

/* ---------- Smooth scroll (Lenis) ---------- */
let lenis = null;
if (window.Lenis) {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
  window.__lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
const scrollTo = target => {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6 });
  else el.scrollIntoView({ behavior: 'smooth' });
};
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  e.preventDefault(); setMenu(false);
  setTimeout(() => scrollTo(id), document.body.classList.contains('menu-open') ? 300 : 0);
}));

/* ---------- Cursore personalizzato ---------- */
if (finePointer) {
  const cur = $('.cursor'), dot = $('.cursor-dot'), ring = $('.cursor-ring');
  const dx = gsap.quickTo(dot, 'x', { duration: .1 }), dy = gsap.quickTo(dot, 'y', { duration: .1 });
  const rx = gsap.quickTo(ring, 'x', { duration: .45, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: .45, ease: 'power3' });
  addEventListener('pointermove', e => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); });
  addEventListener('pointerdown', () => cur.classList.add('is-down'));
  addEventListener('pointerup', () => cur.classList.remove('is-down'));
  document.addEventListener('pointerover', e => cur.classList.toggle('is-hover', !!e.target.closest('a, button, [data-tilt], label')));
}

/* ---------- Bottoni magnetici ---------- */
if (finePointer) {
  $$('.magnetic').forEach(btn => {
    const xTo = gsap.quickTo(btn, 'x', { duration: .6, ease: 'elastic.out(1, .4)' });
    const yTo = gsap.quickTo(btn, 'y', { duration: .6, ease: 'elastic.out(1, .4)' });
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * .3); yTo((e.clientY - r.top - r.height / 2) * .4);
    });
    btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ---------- Canvas hero: stelle, scie e parallasse ---------- */
(() => {
  const c = $('.hero-canvas'), ctx = c.getContext('2d');
  let w, h, dpr, stars = [], jets = [], mx = 0, my = 0, visible = true;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = c.clientWidth; h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.round(w * h / 5000) }, () => ({
      x: Math.random() * w, y: Math.random() * h, z: Math.random() * .9 + .1, tw: Math.random() * Math.PI * 2
    }));
  };
  const spawnJet = () => {
    const fromLeft = Math.random() > .4;
    jets.push({ x: fromLeft ? -200 : w + 200, y: h * (.15 + Math.random() * .55), vx: (fromLeft ? 1 : -1) * (5 + Math.random() * 5), vy: -(Math.random() * 1.2), trail: [], life: 0 });
  };
  addEventListener('resize', resize); resize();
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });
  ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom top', onToggle: s => (visible = s.isActive) });
  let last = 0, nextJet = 1200;
  const loop = t => {
    requestAnimationFrame(loop);
    if (!visible) return;
    const dt = Math.min(t - last, 50); last = t;
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      s.x -= s.z * .15; if (s.x < 0) s.x = w;
      s.tw += dt * .002;
      const px = s.x + mx * 30 * s.z, py = s.y + my * 20 * s.z;
      ctx.globalAlpha = (.35 + Math.sin(s.tw) * .25) * s.z;
      ctx.fillStyle = s.z > .8 ? '#9fd3ef' : '#fff';
      ctx.fillRect(px, py, s.z * 1.6, s.z * 1.6);
    }
    nextJet -= dt;
    if (nextJet < 0) { spawnJet(); nextJet = 2200 + Math.random() * 2600; }
    jets = jets.filter(j => j.x > -400 && j.x < w + 400);
    for (const j of jets) {
      j.x += j.vx * dt / 16; j.y += j.vy * dt / 16;
      j.trail.push({ x: j.x, y: j.y }); if (j.trail.length > 90) j.trail.shift();
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        j.trail.forEach((p, i) => { const off = (k ? 3 : -3); i ? ctx.lineTo(p.x, p.y + off) : ctx.moveTo(p.x, p.y + off); });
        const g = ctx.createLinearGradient(j.trail[0].x, 0, j.x, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.45)');
        ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.stroke();
      }
      ctx.fillStyle = '#fff'; ctx.globalAlpha = .9;
      ctx.beginPath(); ctx.arc(j.x, j.y, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  requestAnimationFrame(loop);
})();

/* ---------- Preparazione split text ---------- */
$$('[data-split]').forEach(el => { el._words = splitWords(el); });
const statementWords = splitPlain($('[data-scrub-words]'));

/* ---------- Preloader + intro ---------- */
const preBadge = $$('.pre-badge .bp'), preLetters = $$('.pre-word .lt');
gsap.set('.hero-title .line > span', { yPercent: 110 });
gsap.set(['.hero-eyebrow', '.hero-lead', '.hero-actions > *', '.hero-hud span', '.scroll-cue'], { autoAlpha: 0, y: 20 });
gsap.set('.hero-badge', { autoAlpha: 0, scale: .7, rotation: -12 });
gsap.set('.site-header', { yPercent: -160 });

const counter = { v: 0 };
const pre = gsap.timeline({ defaults: { ease: 'expo.out' } });
pre.from(preBadge, {
    duration: 1.3, autoAlpha: 0, stagger: .06,
    x: () => gsap.utils.random(-160, 160), y: () => gsap.utils.random(-120, 120), rotate: () => gsap.utils.random(-90, 90), transformOrigin: '50% 50%'
  })
  .from(preLetters, { duration: 1, autoAlpha: 0, yPercent: 60, stagger: .05 }, .35)
  .to(counter, { v: 100, duration: 1.8, ease: 'power2.inOut', onUpdate: () => ($('.pre-count').textContent = String(Math.round(counter.v)).padStart(3, '0')) }, 0)
  .to('.pre-bar span', { scaleX: 1, duration: 1.8, ease: 'power2.inOut' }, 0)
  .to('.pre-logo', { scale: .9, autoAlpha: 0, duration: .6, ease: 'power2.in' }, '+=.15')
  .to('.preloader', { clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'expo.inOut' }, '-=.2')
  .add(() => { document.body.classList.remove('is-loading'); $('.preloader').remove(); lenis && lenis.start(); ScrollTrigger.refresh(); })
  .to('.hero-title .line > span', { yPercent: 0, duration: 1.3, stagger: .1 }, '-=.6')
  .to('.hero-badge', { autoAlpha: 1, scale: 1, rotation: 0, duration: 1.6 }, '<')
  .to(['.hero-eyebrow', '.hero-lead', '.hero-actions > *'], { autoAlpha: 1, y: 0, duration: 1, stagger: .08 }, '<.3')
  .to(['.hero-hud span', '.scroll-cue'], { autoAlpha: 1, y: 0, duration: 1, stagger: .05 }, '<.2')
  .to('.site-header', { yPercent: 0, duration: 1.2 }, '<');
gsap.set('.preloader', { clipPath: 'inset(0 0 0% 0)' });

/* ---------- Hero: tilt del logo e uscita in scroll ---------- */
const heroLogo = $('.hero-badge');
if (finePointer) {
  const rX = gsap.quickTo(heroLogo, 'rotationX', { duration: 1, ease: 'power3' });
  const rY = gsap.quickTo(heroLogo, 'rotationY', { duration: 1, ease: 'power3' });
  addEventListener('pointermove', e => { rY((e.clientX / innerWidth - .5) * 30); rX((.5 - e.clientY / innerHeight) * 24); });
}
gsap.to(heroLogo, { y: -16, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1 });
gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
  .to('.hero-inner', { yPercent: -18, autoAlpha: 0, ease: 'none' }, 0)
  .to('.hero-logo', { yPercent: 40, rotate: 25, scale: 1.25, ease: 'none' }, 0)
  .to('.hero-grid', { yPercent: 20, ease: 'none' }, 0);

// HUD che cambia valori
(() => {
  const alt = $('.hud-alt'), spd = $('.hud-spd');
  setInterval(() => {
    alt.textContent = fmt(70800 + Math.random() * 400, 0);
    spd.textContent = fmt(4.2 + Math.random() * .1, 2);
  }, 900);
})();

/* ---------- Marquee che reagisce alla velocità di scroll ---------- */
(() => {
  const loop = gsap.to('.marquee-track', { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
  let dir = 1;
  ScrollTrigger.create({
    onUpdate: self => {
      if (self.direction !== dir) { dir = self.direction; }
      const v = Math.min(Math.abs(self.getVelocity()) / 300, 6);
      gsap.to(loop, { timeScale: dir * (1 + v), duration: .25, overwrite: true });
      gsap.to(loop, { timeScale: dir, duration: 1.2, delay: .25, ease: 'power2.out' });
    }
  });
})();

/* ---------- Reveal generici ---------- */
$$('[data-split]').forEach(el => {
  gsap.from(el._words, {
    yPercent: 115, rotate: 4, duration: 1.1, ease: 'expo.out', stagger: .045,
    scrollTrigger: { trigger: el, start: 'top 85%' }
  });
});
$$('[data-fade]').forEach(el => {
  gsap.from(el, { y: 50, autoAlpha: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
});
$$('[data-stagger]').forEach(el => {
  gsap.from(el.children, { y: 60, autoAlpha: 0, duration: 1.1, ease: 'expo.out', stagger: .1, scrollTrigger: { trigger: el, start: 'top 85%' } });
});

/* ---------- Chi siamo: statement che si accende parola per parola ---------- */
gsap.to(statementWords, {
  opacity: 1, stagger: .05, ease: 'none',
  scrollTrigger: { trigger: '.statement', start: 'top 80%', end: 'bottom 45%', scrub: true }
});
gsap.fromTo('.about-photo', { clipPath: 'inset(18% 12% 18% 12% round 22px)' }, {
  clipPath: 'inset(0% 0% 0% 0% round 22px)', ease: 'none',
  scrollTrigger: { trigger: '.about-photo', start: 'top 90%', end: 'top 30%', scrub: true }
});
gsap.fromTo('.about-photo img', { yPercent: -10, scale: 1.15 }, {
  yPercent: 6, scale: 1, ease: 'none',
  scrollTrigger: { trigger: '.about-photo', start: 'top bottom', end: 'bottom top', scrub: true }
});
gsap.from('.pillars b', { scale: 0, rotate: -180, duration: 1, ease: 'back.out(2)', stagger: .12, scrollTrigger: { trigger: '.pillars', start: 'top 85%' } });

/* ---------- Storia: scroll orizzontale ---------- */
const mm = gsap.matchMedia();
mm.add('(min-width: 861px)', () => {
  const track = $('.story-track');
  const dist = () => Math.max(0, track.scrollWidth - innerWidth);
  const tween = gsap.to(track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: {
      trigger: '.story', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true,
      onUpdate: s => $('.story-progress span').style.setProperty('--p', s.progress)
    }
  });
  $$('.chapter, .founder-card', track).forEach(card => {
    gsap.from(card.children, {
      y: 40, autoAlpha: 0, stagger: .08, duration: .8, ease: 'expo.out',
      scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 85%' }
    });
  });
});

/* ---------- Identità: logo "esploso" che si ricompone ---------- */
(() => {
  const pieces = $$('.stage-badge .bp'), letters = $$('.stage-word .lt');
  const tl = gsap.timeline({ scrollTrigger: { trigger: '.identity-stage', start: 'top 95%', end: 'center 50%', scrub: 1 } });
  pieces.forEach((p, i) => {
    const a = (i / pieces.length) * Math.PI * 2;
    tl.from(p, { x: Math.cos(a) * 140, y: Math.sin(a) * 140, rotate: (i % 2 ? 1 : -1) * 60, autoAlpha: 0, transformOrigin: '50% 50%', ease: 'power2.out' }, 0);
  });
  tl.from(letters, { y: (i) => (i % 2 ? 80 : -80), autoAlpha: 0, stagger: .04, ease: 'power2.out' }, 0);
  tl.from('.stage-tag', { scale: 0, autoAlpha: 0, stagger: .1, ease: 'back.out(2)' }, .5);
  gsap.to('.stage-tag', { y: -8, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: .4 });
})();

/* ---------- Obiettivi: icone che si disegnano ---------- */
$$('.goal-icon path, .goal-icon circle').forEach(p => {
  const len = p.getTotalLength();
  gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, {
    strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: p.closest('.goal'), start: 'top 80%' }
  });
});

/* ---------- Vision ---------- */
$$('[data-parallax]').forEach(img => {
  const amt = parseFloat(img.dataset.parallax) || 10;
  if (img.closest('.about-photo')) return;
  gsap.fromTo(img, { yPercent: -amt }, { yPercent: amt, ease: 'none', scrollTrigger: { trigger: img.closest('section'), start: 'top bottom', end: 'bottom top', scrub: true } });
});
gsap.timeline({ scrollTrigger: { trigger: '.superior', start: 'top 85%', end: 'bottom 70%', scrub: 1 } })
  .fromTo('.superior-big', { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, ease: 'none' })
  .from('.superior-sub', { autoAlpha: 0, y: 30, ease: 'none' }, .6);

/* ---------- LAZZAR-1: il prototipo entra in volo ---------- */
(() => {
  const isMobile = innerWidth < 861;
  const tl = gsap.timeline({
    scrollTrigger: { trigger: '.lazzar-pin', start: 'top top', end: isMobile ? '+=90%' : '+=160%', pin: true, scrub: 1 }
  });
  tl.from('.lazzar-title span', { yPercent: 100, autoAlpha: 0, stagger: .05, duration: .5, ease: 'power3.out' }, 0)
    .fromTo('.lazzar-plane',
      { xPercent: -140, yPercent: 60, rotate: 14, scale: .45 },
      { xPercent: 0, yPercent: 8, rotate: -4, scale: 1, duration: 1.2, ease: 'power2.out' }, .1)
    .to('.lazzar-title', { autoAlpha: .12, duration: .6 }, .6)
    .to('.target', { autoAlpha: 1, scale: 1, duration: .3 }, 1.2)
    .from('.target', { scale: 1.6, duration: .3 }, 1.2)
    .to('.lazzar-plane', { xPercent: 6, yPercent: 0, rotate: -2, duration: .6, ease: 'none' }, 1.4)
    .to('.target', { xPercent: 10, duration: .6, ease: 'none' }, 1.4);
})();

// Contatori + barre
$$('.stat').forEach(stat => {
  const el = $('[data-count]', stat), target = +el.dataset.count, dec = +el.dataset.dec, o = { v: 0 };
  ScrollTrigger.create({
    trigger: stat, start: 'top 88%', once: true,
    onEnter: () => {
      stat.classList.add('on');
      gsap.to(o, { v: target, duration: 2, ease: 'expo.out', onUpdate: () => (el.textContent = fmt(o.v, dec)) });
    }
  });
});

/* ---------- Footer: logo gigante ---------- */
gsap.from('.footer-logo svg', { yPercent: 40, autoAlpha: 0, stagger: .15, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.footer-logo', start: 'top 92%' } });

/* ---------- Header: nascondi/mostra, tema chiaro, link attivo, progress ---------- */
const header = $('.site-header');
ScrollTrigger.create({
  start: 'top top', end: 'max',
  onUpdate: s => {
    header.classList.toggle('is-hidden', s.direction === 1 && s.scroll() > 400 && !document.body.classList.contains('menu-open'));
    gsap.set('.progress span', { scaleX: s.progress });
  }
});
$$('.about, .identity, .goals-sec, .shop').forEach(sec => {
  ScrollTrigger.create({ trigger: sec, start: 'top 50px', end: 'bottom 50px', onToggle: s => header.classList.toggle('on-light', s.isActive) });
});
const links = $$('.nav a');
$$('main section[id]').forEach(sec => {
  ScrollTrigger.create({
    trigger: sec, start: 'top 50%', end: 'bottom 50%',
    onToggle: s => s.isActive && links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + sec.id))
  });
});

// Ricalcola dopo il caricamento di font e immagini
document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
addEventListener('load', () => ScrollTrigger.refresh());
})();
