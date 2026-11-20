if (window.top !== window.self) { document.documentElement.style.display = 'none'; throw new Error('framed'); }
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex = h => { h = h.replace('#',''); return [0,2,4].map(i => parseInt(h.slice(i,i+2),16)); };
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return A.map((v,i)=>Math.round(lerp(v,B[i],t))); };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const ACC = '#38D6FF', VIO = '#8B6CFF', LIVE = '#3DDC97', DANGER = '#FF5C6C';
  const HUES = ['#38D6FF','#4D8DFF','#8B6CFF','#2EC4C4','#6FA8FF','#B48CFF'];

  /* ---------- Neural sphere: Fibonacci shell, near-neighbour links, real-looking pulses ---------- */
  const HUBS = ['Claude Code','Codex','Cursor','Antigravity','Ollama','ComfyUI','OmniRoute','Agent HQ','Vault'];
  function Sphere(canvas, opt = {}) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, t = 0, rot = 0, last = performance.now(), visible = true;
    const s = { form: 1, pulse: 1, halt: 0, zoom: 1, cx: .5, cy: .5, spin: 1, labels: true, ...opt.state };
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const N = opt.nodes ?? 190, nodes = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i + .5) / N * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963 + rnd() * .25, rad = .9 + rnd() * .14;
      nodes.push({ x: Math.cos(th) * r * rad, y: y * rad, z: Math.sin(th) * r * rad, sx: (rnd() * 2 - 1) * 1.9, sy: (rnd() * 2 - 1) * 1.2, sz: rnd() * 2 - 1, hub: -1, hue: HUES[(rnd() * HUES.length) | 0], sz0: .6 + rnd() * .9 });
    }
    HUBS.forEach((name, k) => { const n = nodes[Math.floor((k + .5) / HUBS.length * N)]; n.hub = k; n.name = name; n.hue = k === 6 || k === 7 ? VIO : ACC; });
    const edges = [], adj = nodes.map(() => []);
    nodes.forEach((a, i) => {
      const d = nodes.map((b, j) => [j, (a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2]).filter(e => e[0] !== i).sort((p, q) => p[1] - q[1]);
      for (let k = 0; k < (a.hub >= 0 ? 5 : 3); k++) { const j = d[k][0]; if (!adj[i].includes(j)) { adj[i].push(j); adj[j].push(i); edges.push([i, j]); } }
    });
    const pulses = [];
    const fit = () => { const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); w = r.width; h = r.height; canvas.width = w * dpr; canvas.height = h * dpr; };
    new ResizeObserver(fit).observe(canvas); fit();
    new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(canvas);
    const P = nodes.map(() => ({ x: 0, y: 0, z: 0, k: 1 }));

    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (!visible || !w) return;
      const live = 1 - s.halt;
      t += dt * live; rot += dt * .12 * s.spin * live * (reduce ? .2 : 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const cx = w * s.cx, cy = h * s.cy, R = Math.min(w, h) * .38 * s.zoom, f = ease(clamp(s.form));
      const cosR = Math.cos(rot), sinR = Math.sin(rot), tilt = -.32, cT = Math.cos(tilt), sT = Math.sin(tilt);
      const acc = mix(ACC, DANGER, s.halt), vio = mix(VIO, DANGER, s.halt);
      nodes.forEach((n, i) => {
        const x0 = lerp(n.sx, n.x, f), y0 = lerp(n.sy, n.y, f), z0 = lerp(n.sz, n.z, f);
        const x1 = x0 * cosR - z0 * sinR, z1 = x0 * sinR + z0 * cosR;
        const y2 = y0 * cT - z1 * sT, z2 = y0 * sT + z1 * cT;
        const k = 2.6 / (2.6 - z2);
        P[i].x = cx + x1 * R * k; P[i].y = cy + y2 * R * k; P[i].z = z2; P[i].k = k;
      });
      // core glow
      const g0 = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.1);
      g0.addColorStop(0, rgba(acc, .16 * (.4 + .6 * f))); g0.addColorStop(.55, rgba(vio, .05)); g0.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g0; ctx.beginPath(); ctx.arc(cx, cy, R * 1.1, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      // links
      ctx.lineWidth = 1;
      const ea = f * f;
      for (const [i, j] of edges) {
        const a = P[i], b = P[j], d = (a.z + b.z) / 2;
        ctx.strokeStyle = rgba(d > 0 ? acc : vio, (.05 + .16 * (d + 1) / 2) * ea);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      // pulses hop along links from a hub
      if (s.pulse > .02 && s.halt < .5 && Math.random() < dt * 7 * s.pulse) {
        const hubs = nodes.map((n, i) => n.hub >= 0 ? i : -1).filter(i => i >= 0), a = hubs[(Math.random() * hubs.length) | 0];
        pulses.push({ a, b: adj[a][(Math.random() * adj[a].length) | 0], k: 0, hops: 3 + (Math.random() * 4 | 0), c: Math.random() < .7 ? ACC : VIO });
      }
      for (let q = pulses.length - 1; q >= 0; q--) {
        const u = pulses[q]; u.k += dt * 1.6 * live;
        if (u.k >= 1) { if (--u.hops <= 0) { pulses.splice(q, 1); continue; } const nx = adj[u.b].filter(j => j !== u.a); u.a = u.b; u.b = nx.length ? nx[(Math.random() * nx.length) | 0] : adj[u.b][0]; u.k = 0; }
        const A = P[u.a], B = P[u.b], x = lerp(A.x, B.x, u.k), y = lerp(A.y, B.y, u.k), col = mix(u.c, DANGER, s.halt), al = clamp(s.pulse) * f;
        ctx.strokeStyle = rgba(col, .5 * al); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(x, y); ctx.stroke();
        const gg = ctx.createRadialGradient(x, y, 0, x, y, 10); gg.addColorStop(0, rgba(col, al)); gg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fill();
      }
      // nodes
      nodes.forEach((n, i) => {
        const p = P[i], depth = (p.z + 1) / 2, hub = n.hub >= 0;
        const c = mix(hub ? n.hue : n.hue, DANGER, s.halt);
        const r = (hub ? 3.2 : 1.1 * n.sz0) * p.k * Math.max(.8, s.zoom);
        const al = (.25 + .75 * depth) * (hub ? 1 : .8);
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * (hub ? 7 : 5));
        gr.addColorStop(0, rgba(c, al * (hub ? .9 : .6))); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, r * (hub ? 7 : 5), 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(240,250,255,${al})`; ctx.beginPath(); ctx.arc(p.x, p.y, r * .6, 0, 7); ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
      if (s.labels && w > 420 && f > .6) {
        ctx.font = '500 11px -apple-system, BlinkMacSystemFont, sans-serif';
        nodes.forEach((n, i) => { if (n.hub < 0) return; const p = P[i]; if (p.z < -.15) return;
          ctx.fillStyle = `rgba(174,191,211,${(.25 + .7 * (p.z + 1) / 2) * (f - .6) / .4})`; ctx.fillText(n.name, p.x + 9, p.y + 4); });
      }
    }
    requestAnimationFrame(frame);
    return s;
  }

  const heroSky = Sphere(document.getElementById('heroSky'), { state: { cx: .74, cy: .48, pulse: .8 } });
  const whySky = Sphere(document.getElementById('whySky'), { state: { form: 0, pulse: 0, zoom: .9 } });
  const phoneSky = Sphere(document.getElementById('phoneSky'), { nodes: 110, state: { cy: .3, zoom: .95, labels: false, pulse: .7 } });
  const mq = matchMedia('(max-width: 900px)');
  const placeHero = () => { heroSky.cx = mq.matches ? .5 : .74; heroSky.cy = mq.matches ? .2 : .48; heroSky.zoom = mq.matches ? .75 : 1; };
  mq.addEventListener('change', placeHero); placeHero();

  /* ---------- imagine: split words ---------- */
  const imagine = document.getElementById('imagineText');
  const parts = imagine.textContent.split(/\s+/); imagine.textContent = '';
  parts.forEach((word, i) => { const sp = document.createElement('span'); sp.className = 'w' + (word.startsWith('*') ? ' hl' : ''); sp.textContent = word.replace(/\*/g, ''); imagine.append(sp, i < parts.length - 1 ? ' ' : ''); });
  const words = [...imagine.querySelectorAll('.w')];

  /* ---------- reveal (rests visible) ---------- */
  if (!reduce) {
    const rvs = [...document.querySelectorAll('.rv')];
    rvs.forEach(el => { if (el.getBoundingClientRect().top > innerHeight) el.classList.add('pre'); });
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
    rvs.forEach(el => io.observe(el));
  }

  /* ---------- counters (rest at final value) ---------- */
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting || reduce) return; cio.unobserve(e.target);
    const el = e.target, end = +el.dataset.count, t0 = performance.now();
    const step = now => { const k = clamp((now - t0) / 1400); el.textContent = Math.round(end * ease(k)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: .6 });
  document.querySelectorAll('[data-count]').forEach(el => cio.observe(el));

  /* ---------- scroll engine ---------- */
  const $ = id => document.getElementById(id);
  const hero = $('top'), heroCopy = $('heroCopy'), heroTitle = $('heroTitle');
  const whyScene = $('whyScene'), whyStage = $('whyStage'), whyState = $('whyState'), steps = [...document.querySelectorAll('.why .step')], dots = [...$('whyDots').children];
  const orbitScene = $('orbitScene'), track = $('track'), orbitBar = $('orbitBar'), orbitCount = $('orbitCount');
  const useItems = [...document.querySelectorAll('.use li')], screens = [...document.querySelectorAll('.scr')], side = [...$('mockSide').children], mockTitle = $('mockTitle');
  const useNames = ['Home', 'Router', 'AI Apps', 'Voice', 'Approvals'];
  const radial = [...$('radial').children], pocket = $('pocket'), progress = $('progress');
  const railLinks = [...document.querySelectorAll('.rail a')], chSecs = [...document.querySelectorAll('[data-ch-sec]')];
  const STATES = [['idle', 'Scattered'], ['', 'Connected'], ['', 'Live traffic'], ['stop', 'Stopped · waiting for you']];

  const sizeOrbit = () => { orbitScene.style.height = (track.scrollWidth - innerWidth + innerHeight) + 'px'; };
  new ResizeObserver(sizeOrbit).observe(track); addEventListener('resize', sizeOrbit); sizeOrbit();
  const prog = el => { const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight)); };
  let ticking = false, lastState = -1;

  function update() {
    ticking = false;
    const total = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${clamp(scrollY / Math.max(1, total))})`;

    // hero: sphere zooms and spins faster, copy lifts and softens
    const hr = hero.getBoundingClientRect(), hp = clamp(-hr.top / hr.height);
    heroSky.zoom = (mq.matches ? .75 : 1) * lerp(1, 1.55, hp); heroSky.spin = 1 + hp * 4;
    if (!reduce) { heroCopy.style.transform = `translateY(${hp * -70}px)`; heroCopy.style.opacity = 1 - hp * .85; heroTitle.style.letterSpacing = `${lerp(-.045, -.01, hp)}em`; }

    // imagine words
    const ip = prog($('imagine'));
    words.forEach((wd, i) => wd.classList.toggle('on', reduce || ip * (words.length + 4) > i));

    // why: scatter → connect → pulses → stop
    const sIdx = prog(whyScene) * 4;
    whySky.form = clamp(sIdx - .5); whySky.pulse = clamp(sIdx - 1.6); whySky.halt = clamp((sIdx - 3.05) * 3);
    const active = Math.min(3, Math.floor(sIdx));
    steps.forEach((el, i) => el.classList.toggle('on', i === active));
    dots.forEach((d, i) => { d.classList.toggle('on', i <= active); d.classList.toggle('cur', i === active); });
    if (active !== lastState) { lastState = active; whyState.className = 'pill ' + STATES[active][0]; whyState.replaceChildren(document.createElement('i'), STATES[active][1]); whyStage.classList.toggle('halted', active === 3); }

    // horizontal track
    const op = prog(orbitScene), max = Math.max(0, track.scrollWidth - innerWidth);
    track.style.transform = `translate3d(${-op * max}px,0,0)`;
    orbitBar.style.width = (op * 100) + '%';
    orbitCount.textContent = String(Math.min(9, 1 + Math.floor(op * 9))).padStart(2, '0') + ' / 09';

    // use: step nearest the reading line drives the pinned window
    let best = 0, bd = 1e9; const line = innerHeight * (mq.matches ? .72 : .55);
    useItems.forEach((li, i) => { const r = li.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - line); if (d < bd) { bd = d; best = i; } });
    useItems.forEach((li, i) => li.classList.toggle('on', i === best));
    screens.forEach((p, i) => p.classList.toggle('on', i === best));
    side.forEach((el, i) => el.classList.toggle('on', i === best));
    mockTitle.textContent = 'Nerve · ' + useNames[best];

    // phone radial menu blooms
    const pr = pocket.getBoundingClientRect(), pp = clamp((innerHeight - pr.top) / (innerHeight * .9)), rad = lerp(0, 92, ease(pp));
    radial.forEach(el => { const a = +el.dataset.a * Math.PI / 180; el.style.transform = `translate(calc(-50% + ${Math.cos(a) * rad}px), calc(-50% + ${Math.sin(a) * rad}px))`; });

    // chapter rail
    let cur = 'top'; chSecs.forEach(sec => { if (sec.getBoundingClientRect().top < innerHeight * .45) cur = sec.dataset.chSec; });
    railLinks.forEach(a => a.classList.toggle('on', a.dataset.ch === cur));
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
})();
