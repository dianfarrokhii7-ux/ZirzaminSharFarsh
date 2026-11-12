
import * as THREE from 'three';
const $ = s => document.querySelector(s), S = io(), show = id => { document.querySelectorAll('.scr').forEach(e => e.classList.toggle('on', e.id === id)); };
const cfg = JSON.parse(localStorage.zsf || '{"sens":5,"q":1,"inv":false}');
$('#sens').value = cfg.sens; $('#q').value = cfg.q; $('#inv').checked = cfg.inv;
const save = () => { cfg.sens = +$('#sens').value; cfg.q = +$('#q').value; cfg.inv = $('#inv').checked; localStorage.zsf = JSON.stringify(cfg); };
['sens', 'q', 'inv'].forEach(i => $('#' + i).onchange = save);
cfg.name = cfg.name || ''; cfg.col = cfg.col || '#3a7acc'; $('#pn').value = cfg.name; $('#pc').value = cfg.col;
const prof = () => ({ name: cfg.name || 'بازیکن', col: cfg.col });
$('#chb').onclick = () => show('chr');
$('#cs').onclick = () => { cfg.name = $('#pn').value.trim(); cfg.col = $('#pc').value; localStorage.zsf = JSON.stringify(cfg); show(lobbyInfo ? 'lobby' : 'menu'); };
const isTouch = matchMedia('(pointer:coarse)').matches;
let lobbyInfo = null, prev = 'menu';
$('#set').onclick = () => { show('sets'); };
$('#mk2').onclick = () => $('#mk').click(); $('#mp').onclick = () => $('#code').focus();
$('#ab').onclick = () => show('about'); $('#ab2').onclick = () => show('menu');
$('#ex').onclick = () => { window.close(); setTimeout(() => $('#err').textContent = 'برای خروج، صفحه را ببند', 200); };
const onl = ok => { $('#dot').classList.toggle('on', ok); $('#ost').textContent = ok ? 'وضعیت: آنلاین' : 'وضعیت: آفلاین'; };
S.on('connect', () => onl(true)); S.on('disconnect', () => onl(false)); if (S.connected) onl(true); $('#back').onclick = () => show(lobbyInfo ? 'lobby' : 'menu');
$('#solo').onclick = () => { S.emit('create', prof()); S.once('lobby', () => S.emit('start')); };
$('#mk').onclick = () => S.emit('create', prof());
$('#jn').onclick = () => S.emit('join', $('#code').value.trim(), prof());
let rdy = false; $('#rd').onclick = () => { rdy = !rdy; S.emit('ready', rdy, 0); $('#rd').textContent = rdy ? 'منتظر بقیه' : 'آماده‌ام'; };
$('#go').onclick = () => S.emit('start');
S.on('err', m => $('#err').textContent = m);
S.on('lobby', i => { lobbyInfo = i; if (!started) show('lobby'); $('#rc').textContent = i.code; $('#go').style.display = i.host === S.id ? '' : 'none';
  $('#pl').innerHTML = Object.entries(i.players).map(([id, p]) => `<div><span style="color:${p.col}">●</span> ${p.name} ${p.ready ? '✔ آماده' : '…'} ${id === i.host ? '(میزبان)' : ''}</div>`).join(''); });
// ---------- audio
let AC; const beep = (f, d, g = .15) => { if (!AC) return; const o = AC.createOscillator(), v = AC.createGain(); o.frequency.value = f; v.gain.setValueAtTime(g, AC.currentTime); v.gain.exponentialRampToValueAtTime(.001, AC.currentTime + d); o.connect(v).connect(AC.destination); o.start(); o.stop(AC.currentTime + d); };
// ---------- 3D
let dust, looping = false, started = false, W, scene, cam, ren, C = 4, M, others = {}, enemy, keyMeshes = [], lockers = [], lastState = { p: {}, e: { x: -99, z: -99 }, k: [0, 0, 0] }, flash, cap = false, hidden = false;
const me = { x: 6, z: 6, ry: 0, pitch: 0, stam: 1, bat: 1, crouch: false, fl: true };
const solid = (x, z) => { const r = Math.floor(z / C), c = Math.floor(x / C); return !M[r] || M[r][c] !== '.'; };
const blocked = (x, z, r = .45) => solid(x + r, z) || solid(x - r, z) || solid(x, z + r) || solid(x, z - r);
function say(t, ms = 3500) { $('#sub').textContent = t; clearTimeout(say.t); say.t = setTimeout(() => $('#sub').textContent = '', ms); }
const flashFade = (t, ms) => { $('#fade').textContent = t || ''; $('#fade').style.opacity = 1; setTimeout(() => $('#fade').style.opacity = 0, ms); };
const tex = (base, spots, rep) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2500; i++) { const v = Math.random() * 70 | 0; x.fillStyle = `rgba(${v},${v},${v},${Math.random() * .25})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
  for (let i = 0; i < spots; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * .12})`; x.beginPath(); x.arc(Math.random() * 128, Math.random() * 128, 5 + Math.random() * 20, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; return t; };
function mkHuman(col, o = {}) { const g = new THREE.Group(), MT = c => new THREE.MeshStandardMaterial({ color: c, roughness: .8 }), skin = MT(o.skin || 0xc99a7a);
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  add(new THREE.CapsuleGeometry(.26, .55, 4, 10), MT(col), 0, 1.15, 0); add(new THREE.SphereGeometry(.2, 16, 12), skin, 0, 1.75, 0);
  add(new THREE.SphereGeometry(.21, 16, 12, 0, 7, 0, 1.5), MT(o.hair || 0x1a1410), 0, 1.78, 0);
  if (o.beard) add(new THREE.SphereGeometry(.17, 12, 10, 0, 7, 1.6, 1.5), MT(o.beard), 0, 1.7, .05);
  const lg = new THREE.CylinderGeometry(.09, .08, .8, 8); lg.translate(0, -.4, 0); const ar = new THREE.CylinderGeometry(.07, .06, .65, 8); ar.translate(0, -.32, 0);
  const legs = [-.12, .12].map(x => add(lg, MT(0x22262e), x, .8, 0)), arms = [-.36, .36].map(x => add(ar, MT(col), x, 1.5, 0));
  legs.forEach(l => { const s = new THREE.Mesh(new THREE.BoxGeometry(.14, .08, .26), MT(0x111111)); s.position.set(0, -.8, .06); l.add(s); });
  arms.forEach(a => { const h = new THREE.Mesh(new THREE.SphereGeometry(.065, 8, 8), skin); h.position.y = -.66; a.add(h); });
  g.userData.l = legs; g.userData.a = arms; return g; }
const carpetTex = (c1, c2, c3) => { const c = document.createElement('canvas'); c.width = 128; c.height = 192; const x = c.getContext('2d'); x.fillStyle = c1; x.fillRect(0, 0, 128, 192);
  x.strokeStyle = c2; x.lineWidth = 5; x.strokeRect(8, 12, 112, 168); x.strokeStyle = c3; x.lineWidth = 2; x.strokeRect(16, 20, 96, 152);
  x.fillStyle = c2; x.beginPath(); x.moveTo(64, 52); x.lineTo(98, 96); x.lineTo(64, 140); x.lineTo(30, 96); x.closePath(); x.fill(); x.fillStyle = c3; x.beginPath(); x.arc(64, 96, 14, 0, 7); x.fill(); x.fillStyle = c1; x.beginPath(); x.arc(64, 96, 6, 0, 7); x.fill();
  for (let i = 0; i < 6; i++) { x.fillStyle = c3; x.fillRect(22 + i * 17, 26, 6, 6); x.fillRect(22 + i * 17, 160, 6, 6); }
  x.strokeStyle = '#e8dcc0'; x.lineWidth = 1; for (let i = 0; i < 128; i += 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 8); x.moveTo(i, 184); x.lineTo(i, 192); x.stroke(); }
  for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * .2})`; x.fillRect(Math.random() * 128, Math.random() * 192, 1, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const PAL = [['#7a1f1a', '#c9a24a', '#e8d8a8'], ['#1f3a6a', '#d8b45a', '#e8e0c8'], ['#5a1f3a', '#c98a4a', '#f0e0b8'], ['#1f4a3a', '#d0b050', '#e8e0c0'], ['#6a3a1a', '#b08a4a', '#ecdcb0'], ['#3a1f5a', '#c0a050', '#e8dcc0']];
const cmat = i => { const t = carpetTex(...PAL[i % 6]); return new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: .8, roughness: 1 }); };
function prologue(d) { // carpet shop at night: street, sign, shop interior, stairs down
  const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  const dark = new THREE.MeshStandardMaterial({ color: 0x222222 }), wood = new THREE.MeshStandardMaterial({ map: tex('#5a3a22', 10, 1), roughness: .7 });
  const ce = scene.userData.ce; ce.scale.y = 28 / 60; ce.position.z = 14;
  const at = tex('#2a2a2e', 30, 8); mk(new THREE.PlaneGeometry(60, 24), new THREE.MeshStandardMaterial({ map: at, bumpMap: at, roughness: .9 }), 30, .02, 44).rotation.x = -Math.PI / 2;
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d'); x.fillStyle = '#160404'; x.fillRect(0, 0, 512, 160); x.font = 'bold 90px Vazirmatn, Tahoma'; x.textAlign = 'center'; x.fillStyle = '#ff3b2f'; x.shadowColor = '#f00'; x.shadowBlur = 22; x.fillText('شهر فرش', 256, 115);
  mk(new THREE.PlaneGeometry(3.8, 1.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }), 22, 2.2, 32.05);
  [18, 42].forEach(lx => { mk(new THREE.SphereGeometry(.18), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), lx, 2.6, 14); const l = new THREE.PointLight(0xffc880, 2.2, 20); l.position.set(lx, 2.5, 14); scene.add(l); });
  [12, 48].forEach(px => { mk(new THREE.CylinderGeometry(.08, .08, 4, 8), dark, px, 2, 46); const l = new THREE.PointLight(0xffd9a0, 3, 24); l.position.set(px, 4, 46); scene.add(l); mk(new THREE.SphereGeometry(.2), new THREE.MeshBasicMaterial({ color: 0xffe6b0 }), px, 4, 46); });
  mk(new THREE.BoxGeometry(5, 1, 1.2), wood, 30, .5, 17.5); mk(new THREE.BoxGeometry(.6, .4, .5), dark, 28.5, 1.2, 17.5);
  for (let i = 0; i < 6; i++) mk(new THREE.PlaneGeometry(3, 2.1), cmat(i), 8 + i * 8.8, 1.7, 4.06);
  [9, 16, 23].forEach((z, i) => mk(new THREE.PlaneGeometry(3, 2.1), cmat(i + 2), 4.06, 1.7, z).rotation.y = Math.PI / 2);
  [16, 23].forEach((z, i) => mk(new THREE.PlaneGeometry(3, 2.1), cmat(i + 4), 55.94, 1.7, z).rotation.y = -Math.PI / 2);
  [[22, 10], [38, 10], [30, 23], [12, 16], [48, 16]].forEach(([px, pz], i) => mk(new THREE.PlaneGeometry(2.6, 4), cmat(i), px, .03, pz).rotation.x = -Math.PI / 2);
  [[14, 24], [46, 24], [8, 19]].forEach(([px, pz], i) => { for (let k = 0; k < 3; k++) { const m = mk(new THREE.BoxGeometry(2.2, .22, 1.5), cmat(i + k), px, .11 + k * .23, pz); m.rotation.y = (Math.random() - .5) * .3; } });
  [[10, 10], [50, 10], [14, 23]].forEach(([px, pz], i) => mk(new THREE.CylinderGeometry(.35, .35, 2.4, 14), cmat(i), px, .35, pz).rotation.z = Math.PI / 2);
  [[6, 6], [7.2, 6.2], [52, 20], [53.2, 21]].forEach(([px, pz], i) => { const m = mk(new THREE.CylinderGeometry(.3, .3, 2.6, 14), cmat(i + 3), px, 1.3, pz); m.rotation.z = .08; });
  mk(new THREE.PlaneGeometry(3.5, 3.5), new THREE.MeshBasicMaterial({ color: 0x000000 }), 54, .03, 6).rotation.x = -Math.PI / 2;
  const sl = new THREE.PointLight(0xff2020, 2, 9); sl.position.set(54, .6, 6); scene.add(sl);
  if (d.ch === 0) { window.owner = mkHuman(0x1b1b1f, { beard: 0x8a8a8a, hair: 0x9a9a9a }); owner.position.set(30, 0, 14.3); scene.add(owner); } }
S.on('started', d => {
  const prevCh = window.LV ? window.LV.ch : -1; started = true; if (ren) { ren.domElement.remove(); ren.dispose(); others = {}; } M = d.MAP; C = d.C; show(''); $('#hud').style.display = 'block'; if (isTouch) $('#touch').style.display = 'block';
  AC = AC || new AudioContext(); if (AC.state === 'suspended') AC.resume();
  scene = new THREE.Scene(); scene.background = new THREE.Color(d.fog); scene.fog = new THREE.FogExp2(d.fog, .09);
  cam = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, .1, 60); cam.rotation.order = 'YXZ'; scene.add(cam);
  ren = new THREE.WebGLRenderer({ antialias: cfg.q > 0 }); ren.setPixelRatio(cfg.q == 0 ? .6 : cfg.q == 1 ? Math.min(devicePixelRatio, 1.25) : Math.min(devicePixelRatio, 2));
  ren.setSize(innerWidth, innerHeight); ren.shadowMap.enabled = cfg.q > 0; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.15; document.body.prepend(ren.domElement);
  addEventListener('resize', () => { ren.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });
  scene.add(new THREE.AmbientLight(d.amb, 1.2));
  // carpet-patterned floor texture
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = d.floor; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#c9a24a'; x.lineWidth = 3; x.strokeRect(6, 6, 52, 52); x.beginPath(); x.moveTo(32, 12); x.lineTo(52, 32); x.lineTo(32, 52); x.lineTo(12, 32); x.closePath(); x.stroke();
  for (let i = 0; i < 900; i++) { x.fillStyle = 'rgba(0,0,0,' + Math.random() * .3 + ')'; x.fillRect(Math.random() * 64, Math.random() * 64, 1, 1); }
  const ft = new THREE.CanvasTexture(cv); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(M[0].length * 2, M.length * 2);
  const wt = tex('#6b665f', 14, 1), wm = new THREE.MeshStandardMaterial({ map: wt, bumpMap: wt, bumpScale: 1.5, roughness: .95 }), n = M.length * C;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(n, n), new THREE.MeshStandardMaterial({ map: ft, bumpMap: ft, bumpScale: .6, roughness: .9 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; fl.position.set(n / 2, 0, n / 2); scene.add(fl);
  const ce = new THREE.Mesh(new THREE.PlaneGeometry(n, n), new THREE.MeshStandardMaterial({ color: 0x222 })); ce.rotation.x = Math.PI / 2; ce.position.set(n / 2, 3.2, n / 2); scene.add(ce); scene.userData.ce = ce;
  const wg = new THREE.BoxGeometry(C, 3.2, C);
  M.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') { const m = new THREE.Mesh(wg, wm); m.position.set((c + .5) * C, 1.6, (r + .5) * C); m.castShadow = m.receiveShadow = true; scene.add(m); } }));
  const mid = a => (a + .5) * C;
  keyMeshes = d.ITEMS.map(k => { const m = new THREE.Mesh(new THREE.BoxGeometry(.5, .2, .2), new THREE.MeshBasicMaterial({ color: d.icol })); m.position.set(mid(k[0]), 1, mid(k[1])); const l = new THREE.PointLight(d.icol, 1.5, 6); m.add(l); scene.add(m); return m; });
  if (d.ch === 0) keyMeshes.forEach(m => m.position.set(30, 2.8, 14));
  if (d.npc) { keyMeshes[0].position.y = 2.8; window.npc = mkHuman(0x1b1b1f, { beard: 0x8a8a8a, hair: 0x9a9a9a }); window.npc.position.set(keyMeshes[0].position.x, 0, keyMeshes[0].position.z); scene.add(window.npc); }
  lockers = d.LOCKERS.map(k => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 1), new THREE.MeshStandardMaterial({ color: 0x3a4a3a })); m.position.set(mid(k[0]), 1.2, mid(k[1])); scene.add(m); return m; });
  const ex = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3, .3), new THREE.MeshStandardMaterial({ color: 0x888, emissive: 0x112211 })); ex.position.set(mid(d.EXIT[0]), 1.5, mid(d.EXIT[1])); scene.add(ex);
  const el = new THREE.PointLight(0x33ff66, 2, 8); el.position.copy(ex.position); scene.add(el);
  if (d.shop) prologue(d);
  (d.PORTALS || []).forEach(pr => pr.forEach(c => { const m = new THREE.Mesh(new THREE.TorusGeometry(.8, .08, 8, 24), new THREE.MeshBasicMaterial({ color: 0xaa44ff })); m.position.set(mid(c[0]), 1.2, mid(c[1])); scene.add(m); const pl = new THREE.PointLight(0xaa44ff, 1.5, 6); pl.position.copy(m.position); scene.add(pl); }));
  scene.userData.flick = new THREE.PointLight(0xff2222, 0, 12); scene.add(scene.userData.flick);
  // tall creature
  enemy = new THREE.Group(); const bm = new THREE.MeshStandardMaterial({ color: 0x0d0d0d });
  const body = new THREE.Mesh(new THREE.BoxGeometry(.7, 2.6, .4), bm); body.position.y = 2; const head = new THREE.Mesh(new THREE.SphereGeometry(.28), bm); head.position.y = 3.5;
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(.3, .05, .05), new THREE.MeshBasicMaterial({ color: 0xff0000 })); eyes.position.set(0, 3.55, .25);
  const armG = new THREE.BoxGeometry(.12, 2.4, .12); const a1 = new THREE.Mesh(armG, bm), a2 = new THREE.Mesh(armG, bm); a1.position.set(.5, 1.6, 0); a2.position.set(-.5, 1.6, 0);
  enemy.add(body, head, eyes, a1, a2); enemy.userData.arms = [a1, a2]; scene.add(enemy);
  flash = new THREE.SpotLight(0xfff0d0, 60, 28, .5, .5, 1.5); flash.position.set(0, 0, 0); flash.castShadow = cfg.q > 0; flash.shadow.mapSize.set(cfg.q > 1 ? 1024 : 512, cfg.q > 1 ? 1024 : 512);
  dust = null; if (cfg.q > 0) { const N = 220, g = new THREE.BufferGeometry(), a = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) a[i] = (Math.random() - .5) * 16; g.setAttribute('position', new THREE.BufferAttribute(a, 3)); dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfc3a0, size: .05, transparent: true, opacity: .5 })); scene.add(dust); } flash.target.position.set(0, 0, -1); cam.add(flash, flash.target);
  me.x = (d.SP[0] + .5) * C; me.z = (d.SP[1] + .5) * C; me.bat = 1; me.stam = 1; me.fl = true; hidden = false; cap = false; window.LV = d; lastState = { p: {}, e: { x: -99, z: -99 }, k: d.ITEMS.map(() => 0) }; $('#obj').textContent = d.obj;
  const intro = d.intro || ['«این فرش چنده؟»', '«ما فقط ۱۰۰ ریال داریم.»', '«یه فرش کارکرده تو زیرزمین دارم. بیا پایین نشونت بدم.»', 'همه‌چیز سیاه می‌شود...'];
  intro.forEach((t, i) => setTimeout(() => say(t, 2400), i * 2600)); if (prevCh === 0 && d.ch === 1) { beep(55, 1.4, .5); flashFade('ناگهان قدبلند با دست‌های بزرگش تو را می‌گیرد... عمو اکسیر: «بالاخره یکی دیگه برای آزمایش پیدا شد!» ... در آهنی بسته می‌شود.', 4500); } else flashFade(d.title || '', 2600);
  if (!isTouch) renderer_lock(); if (!looping) { looping = true; requestAnimationFrame(loop); }
});
const renderer_lock = () => { document.body.addEventListener('click', () => { if (started && !document.pointerLockElement) document.body.requestPointerLock?.(); }); };
S.on('state', s => { lastState = s; });
S.on('say', t => say(t));
function scream() {
  const lab = LV.ch === 3, sk = lab ? '#a8d8a0' : '#cfc6b8', gl = lab ? '#3f3' : '#f11', o = document.createElement('div');
  o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;pointer-events:none';
  o.innerHTML = `<style>@keyframes zm{0%{transform:scale(.15) rotate(-6deg)}15%{transform:scale(1.5) rotate(4deg)}100%{transform:scale(2.3) rotate(-3deg)}}@keyframes sh{0%,100%{translate:0 0}25%{translate:-30px 18px}50%{translate:26px -22px}75%{translate:-18px -26px}}@keyframes bl{0%,60%{background:#000}30%,80%{background:#900}}</style>
  <svg viewBox="0 0 300 400" style="height:120vh;animation:zm 1.4s ease-out forwards,sh .08s linear infinite"><ellipse cx="150" cy="190" rx="95" ry="165" fill="${sk}"/><ellipse cx="108" cy="150" rx="30" ry="42" fill="#000"/><ellipse cx="192" cy="150" rx="30" ry="42" fill="#000"/><circle cx="108" cy="156" r="9" fill="${gl}"/><circle cx="192" cy="156" r="9" fill="${gl}"/>
  <path d="M60 255 Q150 215 240 255 L225 360 Q150 420 75 360Z" fill="#100"/><path d="M75 262 L90 310 L105 258 L120 318 L135 255 L150 322 L165 255 L180 318 L195 258 L210 310 L225 262" fill="none" stroke="#eee" stroke-width="9"/><path d="M108 108 L90 60 M192 108 L214 58" stroke="#000" stroke-width="7"/></svg>
  <div style="position:absolute;inset:0;animation:bl .25s steps(1) infinite;mix-blend-mode:multiply;opacity:.6"></div>`;
  document.body.appendChild(o);
  if (AC) { const n = AC.sampleRate * 1.6, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = AC.createBufferSource(), gn = AC.createGain(), ws = AC.createWaveShaper(); gn.gain.value = 1.2; s.buffer = b; s.connect(ws).connect(gn).connect(AC.destination); s.start();
    [900, 1350, 60].forEach((f, k) => { const q = AC.createOscillator(), h = AC.createGain(); q.type = 'sawtooth'; q.frequency.setValueAtTime(f, AC.currentTime); q.frequency.exponentialRampToValueAtTime(f * (k < 2 ? .3 : 2), AC.currentTime + 1.4); h.gain.setValueAtTime(.35, AC.currentTime); h.gain.exponentialRampToValueAtTime(.001, AC.currentTime + 1.5); q.connect(h).connect(AC.destination); q.start(); q.stop(AC.currentTime + 1.5); }); }
  navigator.vibrate?.([200, 60, 300]); setTimeout(() => o.remove(), 1800);
}
S.on('captured', (n, id) => { say(n + ' گرفتار شد!'); if (id === S.id) scream(); else beep(70, .8, .4); });
S.on('wipe', () => { flashFade('همه گرفتار شدند... فصل از نو شروع می‌شود', 2500); me.x = me.z = 6; hidden = false; });
S.on('win', () => { started = false; beep(60, 2, .5); flashFade('آسانسور حرکت می‌کند... چراغ‌ها خاموش می‌شوند. «یه لحظه صبر کن...»', 3200);
  setTimeout(() => { $('#hud').style.display = 'none'; $('#et').innerHTML = 'چراغ روشن می‌شود... عمو اکسیر داخل آسانسور ایستاده است.<br><br>📺 تلویزیون قدیمی روشن می‌شود. فروشنده: «حالا دیگه وقتشه حقیقت رو بدونی...»<br><br>ادامه دارد...'; show('end'); }, 3400); });
const jump = (face, msg, snd = 70) => { const f = $('#fade'); f.style.transition = 'none'; f.style.opacity = 1; f.style.fontSize = '30vmin'; f.textContent = face; beep(snd, .6, .5);
  setTimeout(() => { f.style.opacity = 0; f.textContent = ''; f.style.fontSize = ''; f.style.transition = ''; if (msg) say(msg, 4000); }, 450); };
const EV = {
  rug: () => { jump('😱', 'چراغ‌قوه خاموش شد... وقتی روشن شد، چیزی نبود.'); me.fl = false; setTimeout(() => me.fl = true, 2500); },
  room: () => { beep(45, 1, .6); say('در پشت سرت بسته شد... قدبلند انتهای اتاق ایستاده است! چراغ‌ها خاموش می‌شوند — فرار کن!', 5000); me.fl = false; setTimeout(() => me.fl = true, 1500); },
  steps: () => { say('صدای قدم‌های خودت را می‌شنوی... ولی تو ایستاده‌ای.', 4000); [1, 1.6, 2.2, 2.8].forEach(t => setTimeout(() => beep(90, .12, .3), t * 1000)); },
  mirror: w => { if (w !== S.id) return; say('در آینهٔ قدیمی، قدبلند پشت سرت است...', 2500); setTimeout(() => say('برمی‌گردی؛ هیچ‌کس نیست. دوباره نگاه می‌کنی؛ او نزدیک‌تر شده!', 2500), 2600); setTimeout(() => jump('🪞', 'آینه ترک خورد.', 90), 5400); },
  chair: () => { say('صندلی آزمایش... چراغ‌ها خاموش می‌شوند. عمو اکسیر: «بشین... فقط یه آزمایش کوچیکه.»', 4500); me.fl = false; setTimeout(() => { me.fl = true; jump('🟢', ''); }, 3500); },
  lock: () => { say('درها قفل شدند! «کجا می‌ری؟ هنوز آزمایشمون تموم نشده!»', 4500); beep(50, 1, .5); }
};
S.on('ev', ({ id, who }) => EV[id]?.(who));
// ---------- input
const K = {}, T = { mx: 0, my: 0, s: false }, G = { s: false };
addEventListener('keydown', e => { K[e.code] = 1; if (e.code === 'KeyF') me.fl = !me.fl; if (e.code === 'KeyC') me.crouch = !me.crouch; if (e.code === 'KeyE') interact(); });
addEventListener('keyup', e => K[e.code] = 0);
addEventListener('mousemove', e => { if (document.pointerLockElement) look(e.movementX, e.movementY, .0012); });
const look = (dx, dy, k) => { const s = k * (cfg.sens / 5); me.ry -= dx * s; me.pitch = Math.max(-1.3, Math.min(1.3, me.pitch - dy * s * (cfg.inv ? -1 : 1))); };
const joy = $('#joy'), knob = $('#knob'); let jid = null, lid = null, lx = 0, ly = 0;
joy.addEventListener('touchstart', e => { jid = e.changedTouches[0].identifier; e.preventDefault(); }, { passive: false });
addEventListener('touchmove', e => { for (const t of e.changedTouches) {
  if (t.identifier === jid) { const r = joy.getBoundingClientRect(), dx = t.clientX - r.left - 65, dy = t.clientY - r.top - 65, d = Math.min(1, Math.hypot(dx, dy) / 55), a = Math.atan2(dy, dx); T.mx = Math.cos(a) * d; T.my = Math.sin(a) * d; knob.style.transform = `translate(${T.mx * 40}px,${T.my * 40}px)`; }
  else if (t.identifier === lid) { look(t.clientX - lx, t.clientY - ly, .005); lx = t.clientX; ly = t.clientY; } } }, { passive: false });
addEventListener('touchstart', e => { if (!started) return; for (const t of e.changedTouches) if (t.clientX > innerWidth / 2 && lid === null && !t.target.closest('button')) { lid = t.identifier; lx = t.clientX; ly = t.clientY; } });
addEventListener('touchend', e => { for (const t of e.changedTouches) { if (t.identifier === jid) { jid = null; T.mx = T.my = 0; knob.style.transform = ''; } if (t.identifier === lid) lid = null; } });
const hold = (id, f) => { const b = $(id); b.addEventListener('touchstart', e => { f(true); e.preventDefault(); }, { passive: false }); b.addEventListener('touchend', () => f(false)); };
const fsToggle = () => {
  const d = document, el = d.documentElement, on = d.fullscreenElement || d.webkitFullscreenElement;
  const note = t => started ? say(t, 6000) : $('#err').textContent = t;
  if (on) return (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  const rq = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!rq) return note('این مرورگر تمام‌صفحه را پشتیبانی نمی‌کند. در آیفون: دکمهٔ اشتراک‌گذاری، سپس «Add to Home Screen» و بازی را از آیکون باز کن.');
  Promise.resolve(rq.call(el)).then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => note('تمام‌صفحه اجازه داده نشد'));
};
$('#fsm').onclick = fsToggle; $('#fsb').onclick = fsToggle;
$('#solo').addEventListener('click', () => { if (isTouch && !document.fullscreenElement) fsToggle(); });
hold('#bS', v => T.s = v); hold('#bE', v => v && interact()); hold('#bF', v => v && (me.fl = !me.fl)); hold('#bC', v => v && (me.crouch = !me.crouch));
let gpPrev = {}; function pad(dt) {
  const g = [...(navigator.getGamepads?.() || [])].find(x => x); G.mx = G.my = 0; G.s = false; if (!g) return;
  const dz = v => Math.abs(v) < .15 ? 0 : v; G.mx = dz(g.axes[0]); G.my = dz(g.axes[1]); look(dz(g.axes[2]) * 900 * dt * 1, dz(g.axes[3]) * 900 * dt, .0035);
  G.s = g.buttons[5]?.pressed; const edge = (i, f) => { const p = g.buttons[i]?.pressed; if (p && !gpPrev[i]) f(); gpPrev[i] = p; };
  edge(2, interact); edge(4, () => me.fl = !me.fl); edge(1, () => me.crouch = !me.crouch);
}
addEventListener('gamepadconnected', () => say('دسته بازی وصل شد')); addEventListener('gamepaddisconnected', () => say('دسته بازی قطع شد'));
function interact() {
  if (!started || cap) return; const d = (x, z) => Math.hypot(x - me.x, z - me.z);
  if (hidden) { hidden = false; S.emit('hide', false); return; }
  const ks = keyMeshes.findIndex((m, i) => !lastState.k[i] && d(m.position.x, m.position.z) < 3.8); if (ks >= 0) { S.emit('pickup', ks); beep(900, .2); return; }
  const lk = lockers.find(m => d(m.position.x, m.position.z) < 2.2); if (lk) { hidden = true; me.x = lk.position.x; me.z = lk.position.z; S.emit('hide', true); say('در کمد پنهان شدی. با E بیرون بیا'); return; }
  for (const [id, p] of Object.entries(lastState.p)) if (id !== S.id && p.cap && d(p.x, p.z) < 3.5) { S.emit('rescue', id); return; }
}
// ---------- loop
let t0 = performance.now(), sendT = 0, hb = 0, pk = 0;
function loop(t) {
  if (!started) { looping = false; return; } requestAnimationFrame(loop); const dt = Math.min(.05, (t - t0) / 1000); t0 = t; pad(dt); const hasFl = !LV.needFl || lastState.k[0];
  const mine = lastState.p[S.id]; cap = !!(mine && mine.cap); if (cap) { hidden = false; $('#fade').style.opacity = .75; $('#fade').textContent = 'گرفتار شدی... منتظر نجات همتیمی‌ها'; } else if (window._wc) { $('#fade').style.opacity = 0; $('#fade').textContent = ''; } window._wc = cap;
  let ix = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0) + T.mx + (G.mx || 0), iz = (K.KeyS ? 1 : 0) - (K.KeyW ? 1 : 0) + T.my + (G.my || 0);
  const l = Math.hypot(ix, iz); if (l > 1) { ix /= l; iz /= l; }
  const moving = l > .1 && !cap && !hidden, sprint = (K.ShiftLeft || T.s || G.s) && moving && me.stam > .05 && !me.crouch;
  me.stam = Math.max(0, Math.min(1, me.stam + (sprint ? -.18 : .12) * dt));
  const sp = (me.crouch ? 1.6 : sprint ? 5.2 : 3) * dt;
  if (moving) { const s = Math.sin(me.ry), c = Math.cos(me.ry), dx = (ix * c + iz * s) * sp, dz = (-ix * s + iz * c) * sp;
    if (!blocked(me.x + dx, me.z)) me.x += dx; if (!blocked(me.x, me.z + dz)) me.z += dz; }
  me.pc = Math.max(0, (me.pc || 0) - dt); if (LV.ch === 2 || LV.distort) scene.fog.color.setHSL((t / 20000) % 1, .6, .05);
  if (!me.pc && LV.PORTALS) for (const [a, b] of LV.PORTALS) for (const [s_, t_] of [[a, b], [b, a]]) if (Math.hypot(me.x - (s_[0] + .5) * C, me.z - (s_[1] + .5) * C) < 1) { me.x = (t_[0] + .5) * C; me.z = (t_[1] + .5) * C; me.pc = 2; flashFade('', 300); say('راهرو تو را جای دیگری برد...'); }
  if (dust) { dust.position.set(me.x, 1.5, me.z); const pa = dust.geometry.attributes.position; for (let i = 1; i < pa.array.length; i += 3) { pa.array[i] -= dt * .05; if (pa.array[i] < -2) pa.array[i] = 6; } pa.needsUpdate = true; }
  if (LV.dlg && lastState.k[0] && !LV.talked) { LV.talked = 1; LV.dlg.forEach((l, i) => setTimeout(() => say(l, 2800), i * 3000)); }
  if (LV.npc && window.npc) window.npc.rotation.y = Math.atan2(me.x - window.npc.position.x, me.z - window.npc.position.z);
  if (LV.ch === 0 && window.owner) { const ow = window.owner;
    if (lastState.k[0] && !LV.talked) { LV.talked = 1; ['تو: «سلام، یه فرش می‌خواستم. چنده؟»', 'فروشنده: «این فرش ۵۰۰ هزار ریاله.»', 'تو: «ما فقط ۱۰۰ ریال داریم.»', 'فروشنده: «با ۱۰۰ ریال؟! 😂 ولی یه فرش کارکرده تو زیرزمین دارم. بیا پایین نشونت بدم.»', 'فروشنده: «فقط مراقب باش... پایین یه کم تاریکه.»'].forEach((l, i) => setTimeout(() => say(l, 2800), i * 3000)); setTimeout(() => LV.walk = 1, 12000); }
    const dx = 54 - ow.position.x, dz = 6 - ow.position.z, dd = Math.hypot(dx, dz), wk = LV.walk && dd > .4;
    if (wk) { ow.position.x += dx / dd * 2 * dt; ow.position.z += dz / dd * 2 * dt; ow.rotation.y = Math.atan2(dx, dz); }
    ow.userData.l.forEach((l, i) => l.rotation.x = wk ? Math.sin(t / 200 + i * Math.PI) * .6 : 0); }
  me.bat = Math.max(0, me.bat - (me.fl && hasFl ? .004 : -.01) * dt); if (me.bat <= 0) me.fl = false;
  cam.position.set(me.x, (me.crouch || hidden ? .9 : 1.6) - (LV.ch === 0 ? Math.max(0, 9 - Math.hypot(me.x - 54, me.z - 6)) / 9 * .8 : 0) + (moving ? Math.sin(t / 140) * .04 : 0), me.z);
  const e = lastState.e, ed = Math.hypot(e.x - me.x, e.z - me.z), shake = ed < 10 ? (10 - ed) / 10 * .03 : 0;
  cam.rotation.set(me.pitch + (Math.random() - .5) * shake, me.ry + (Math.random() - .5) * shake, LV.distort ? Math.sin(t / 900) * .06 : 0);
  const flick = (e.c && Math.random() < .25) || Math.random() < .003; flash.intensity = me.fl && hasFl && !flick ? 60 : 0;
  scene.userData.flick.intensity = e.c ? (Math.random() * 1.5) : 0; scene.userData.flick.position.set(me.x, 2.5, me.z);
  enemy.position.x += (e.x - enemy.position.x) * .25; enemy.position.z += (e.z - enemy.position.z) * .25;
  enemy.lookAt(e.x + (e.x - enemy.position.x) * 5, 0, e.z + (e.z - enemy.position.z) * 5 + .001); enemy.userData.arms.forEach((a, i) => a.rotation.x = Math.sin(t / (e.c ? 70 : 300) + i * 3) * .6);
  keyMeshes.forEach((m, i) => { m.visible = !lastState.k[i]; m.rotation.y += dt * 2; });
  for (const [id, p] of Object.entries(lastState.p)) { if (id === S.id) continue;
    if (!others[id]) { others[id] = mkHuman(new THREE.Color(p.c || '#3a7acc')); scene.add(others[id]);
      { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const cx = cv.getContext('2d'); cx.font = 'bold 34px Vazirmatn, Tahoma'; cx.textAlign = 'center'; cx.fillStyle = '#fff'; cx.shadowColor = '#000'; cx.shadowBlur = 6; cx.fillText(p.n || '', 128, 44); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false })); sp.scale.set(1.6, .4, 1); sp.position.y = 2.35; others[id].add(sp); } }
    const o = others[id], mv = Math.hypot(p.x - o.position.x, p.z - o.position.z) > .05; o.position.x += (p.x - o.position.x) * .3; o.position.z += (p.z - o.position.z) * .3; o.position.y = p.cap ? .3 : 0; o.rotation.z = p.cap ? 1.4 : 0; o.rotation.y = p.ry + Math.PI; o.userData.l.forEach((l, i) => l.rotation.x = mv ? Math.sin(t / 150 + i * Math.PI) * .6 : 0); o.userData.a.forEach((l, i) => l.rotation.x = mv ? -Math.sin(t / 150 + i * Math.PI) * .5 : 0); o.visible = !p.hid; }
  for (const id in others) if (!lastState.p[id]) { scene.remove(others[id]); delete others[id]; }
  pk -= dt; if (pk <= 0 && !cap && !hidden && LV.ch > 0) { pk = .3; keyMeshes.forEach((m, i) => { if (!lastState.k[i] && Math.hypot(m.position.x - me.x, m.position.z - me.z) < 2.2) { S.emit('pickup', i); beep(900, .2); } }); }
  hb -= dt; if (ed < 14 && hb <= 0) { beep(55, .25, .5 * (1 - ed / 14)); hb = .35 + ed / 20; }
  if (e.c && ed < 20 && Math.random() < .03) beep(40 + Math.random() * 60, .5, .08);
  sendT += dt; if (sendT > .066 && !cap) { sendT = 0; S.emit('move', { x: me.x, z: me.z, ry: me.ry }); }
  $('#st').style.width = me.stam * 100 + '%'; $('#bt').style.width = me.bat * 100 + '%';
  $('#obj').textContent = `${LV.lab}: ${lastState.k.reduce((a, b) => a + b, 0)} از ${lastState.k.length} ${lastState.k.every(Boolean) ? '— ' + LV.go : ''}`;
  ren.render(scene, cam);
}
