
import * as THREE from 'three';
const $ = s => document.querySelector(s), S = io(), show = id => { document.querySelectorAll('.scr').forEach(e => e.classList.toggle('on', e.id === id)); };
const cfg = JSON.parse(localStorage.zsf || '{"sens":5,"q":1,"inv":false}');
$('#sens').value = cfg.sens; $('#q').value = cfg.q; $('#inv').checked = cfg.inv;
const save = () => { cfg.sens = +$('#sens').value; cfg.q = +$('#q').value; cfg.inv = $('#inv').checked; localStorage.zsf = JSON.stringify(cfg); };
['sens', 'q', 'inv'].forEach(i => $('#' + i).onchange = save);
cfg.name = cfg.name || ''; cfg.col = cfg.col || '#3a7acc'; $('#pn').value = cfg.name; $('#pc').value = cfg.col;
const prof = () => ({ name: cfg.name || 'بازیکن', col: cfg.col });
$('#hsSolo').onclick = () => $('#solo').click();
$('#hsMulti').onclick = () => $('#mp').click();
$('#hsCreate').onclick = () => $('#mk2').click();
$('#hsSettings').onclick = () => $('#set').click();
$('#hsAbout').onclick = () => $('#ab').click();
$('#hsExit').onclick = () => $('#ex').click();
$('#hsRoomCreate').onclick = () => $('#mk').click();
$('#hsJoin').onclick = () => { $('#code').value = $('#hsCode').value.trim(); $('#jn').click(); };
$('#hsCode').addEventListener('input', () => { $('#code').value = $('#hsCode').value.replace(/\\D/g,'').slice(0,4); });
$('#hsCharacter').onclick = () => $('#chb').click();
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
const solid = (x, z) => { const r = Math.floor(z / C), c = Math.floor(x / C); return !M[r] || M[r][c] !== '.' || closed.has(r * 100 + c); };
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
  const prevCh = window.LV ? window.LV.ch : -1; started = true; FX.length = 0; closed = new Set(); doorMeshes = {}; stopAmb(); { const cu = document.getElementById('cut'); if (cu) { cu.style.opacity = 0; setTimeout(() => cu.remove(), 900); } } if (ren) { ren.domElement.remove(); ren.dispose(); others = {}; } M = d.MAP; C = d.C; show(''); $('#hud').style.display = 'block'; if (isTouch) $('#touch').style.display = 'block';
  AC = AC || new AudioContext(); if (AC.state === 'suspended') AC.resume();
  scene = new THREE.Scene(); scene.background = new THREE.Color(d.fog); scene.fog = new THREE.FogExp2(d.fog, d.fogD || .09);
  cam = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, .1, 60); cam.rotation.order = 'YXZ'; scene.add(cam);
  ren = new THREE.WebGLRenderer({ antialias: cfg.q > 0 }); ren.setPixelRatio(cfg.q == 0 ? .6 : cfg.q == 1 ? Math.min(devicePixelRatio, 1.25) : Math.min(devicePixelRatio, 2));
  ren.setSize(innerWidth, innerHeight); ren.shadowMap.enabled = cfg.q > 0; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.15; document.body.prepend(ren.domElement);
  addEventListener('resize', () => { ren.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });
  scene.userData.amb = new THREE.AmbientLight(d.amb, 1.2); scene.add(scene.userData.amb);
  // carpet-patterned floor texture
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = d.floor; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#c9a24a'; x.lineWidth = 3; x.strokeRect(6, 6, 52, 52); x.beginPath(); x.moveTo(32, 12); x.lineTo(52, 32); x.lineTo(32, 52); x.lineTo(12, 32); x.closePath(); x.stroke();
  for (let i = 0; i < 900; i++) { x.fillStyle = 'rgba(0,0,0,' + Math.random() * .3 + ')'; x.fillRect(Math.random() * 64, Math.random() * 64, 1, 1); }
  const ft = new THREE.CanvasTexture(cv); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(M[0].length * 2, M.length * 2);
  const wt = tex(d.wall || '#6b665f', 14, 1), wm = new THREE.MeshStandardMaterial({ map: wt, bumpMap: wt, bumpScale: 1.5, roughness: .95 }), n = M.length * C;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(n, n), new THREE.MeshStandardMaterial({ map: ft, bumpMap: ft, bumpScale: .6, roughness: .9 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; fl.position.set(n / 2, 0, n / 2); scene.add(fl);
  const ce = new THREE.Mesh(new THREE.PlaneGeometry(n, n), new THREE.MeshStandardMaterial({ color: 0x222 })); ce.rotation.x = Math.PI / 2; ce.position.set(n / 2, 3.2, n / 2); scene.add(ce); scene.userData.ce = ce;
  const wg = new THREE.BoxGeometry(C, 3.2, C);
  M.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') { const m = new THREE.Mesh(wg, wm); m.position.set((c + .5) * C, 1.6, (r + .5) * C); m.castShadow = m.receiveShadow = true; scene.add(m); } }));
  const mid = a => (a + .5) * C;
  keyMeshes = d.ITEMS.map((k, i) => { const ic = d.ICOL?.[i] || d.icol, m = new THREE.Mesh(new THREE.BoxGeometry(.5, .2, .2), new THREE.MeshBasicMaterial({ color: ic })); if (d.ISC?.[i]) m.scale.set(...d.ISC[i]); m.position.set(mid(k[0]), 1, mid(k[1])); const l = new THREE.PointLight(ic, 1.5, 6); m.add(l); scene.add(m); return m; });
  if (d.ch === 0) keyMeshes.forEach(m => m.position.set(30, 2.8, 14));
  if (d.npc) { keyMeshes[0].position.y = 2.8; window.npc = mkHuman(0x1b1b1f, { beard: 0x8a8a8a, hair: 0x9a9a9a }); window.npc.position.set(keyMeshes[0].position.x, 0, keyMeshes[0].position.z); scene.add(window.npc); }
  lockers = d.LOCKERS.map(k => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 2.4, 1), new THREE.MeshStandardMaterial({ color: 0x3a4a3a })); m.position.set(mid(k[0]), 1.2, mid(k[1])); scene.add(m); return m; });
  const ex = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3, .3), new THREE.MeshStandardMaterial({ color: 0x888, emissive: 0x112211 })); ex.position.set(mid(d.EXIT[0]), 1.5, mid(d.EXIT[1])); scene.add(ex);
  const el = new THREE.PointLight(0x33ff66, 2, 8); el.position.copy(ex.position); scene.add(el); scene.userData.ex = ex; scene.userData.el = el; if (d.ch >= 5) ex.material.color.setHex(d.ch === 6 ? 0x4a3322 : 0x5a6066);
  if (d.shop) prologue(d); if (d.ch >= 4) decor(d);
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
  if (!d.retry) intro.forEach((t, i) => setTimeout(() => say(t, 2400), i * 2600)); if (prevCh === 0 && d.ch === 1) { beep(55, 1.4, .5); flashFade('ناگهان رامبد جوان با دست‌های بزرگش تو را می‌گیرد... عمو پورنگ: «بالاخره یکی دیگه برای آزمایش پیدا شد!» ... در آهنی بسته می‌شود.', 4500); } else flashFade(d.retry ? 'همه گرفتار شدند... فصل از نو شروع می‌شود' : (d.title || ''), 2600);
  if (d.ch >= 4) startAmb(d); resetX(); if (!isTouch) renderer_lock(); if (!looping) { looping = true; requestAnimationFrame(loop); }
});
const renderer_lock = () => { document.body.addEventListener('click', () => { if (started && !document.pointerLockElement) document.body.requestPointerLock?.(); }); };
S.on('state', s => { lastState = s; closed = new Set((s.d || []).map(([c, r]) => r * 100 + c)); });
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
S.on('win', () => { started = false; stopAmb(); $('#hud').style.display = 'none'; $('#et').innerHTML = 'ادامه دارد...'; show('end'); setTimeout(() => document.getElementById('cut')?.remove(), 300); });
const jump = (face, msg, snd = 70) => { const f = $('#fade'); f.style.transition = 'none'; f.style.opacity = 1; f.style.fontSize = '30vmin'; f.textContent = face; beep(snd, .6, .5);
  setTimeout(() => { f.style.opacity = 0; f.textContent = ''; f.style.fontSize = ''; f.style.transition = ''; if (msg) say(msg, 4000); }, 450); };
const EV = {
  rug: () => { jump('😱', 'چراغ‌قوه خاموش شد... وقتی روشن شد، چیزی نبود.'); me.fl = false; setTimeout(() => me.fl = true, 2500); },
  room: () => { beep(45, 1, .6); say('در پشت سرت بسته شد... رامبد جوان انتهای اتاق ایستاده است! چراغ‌ها خاموش می‌شوند — فرار کن!', 5000); me.fl = false; setTimeout(() => me.fl = true, 1500); },
  steps: () => { say('صدای قدم‌های خودت را می‌شنوی... ولی تو ایستاده‌ای.', 4000); [1, 1.6, 2.2, 2.8].forEach(t => setTimeout(() => beep(90, .12, .3), t * 1000)); },
  mirror: w => { if (w !== S.id) return; say('در آینهٔ قدیمی، رامبد جوان پشت سرت است...', 2500); setTimeout(() => say('برمی‌گردی؛ هیچ‌کس نیست. دوباره نگاه می‌کنی؛ او نزدیک‌تر شده!', 2500), 2600); setTimeout(() => jump('🪞', 'آینه ترک خورد.', 90), 5400); },
  chair: () => { say('صندلی آزمایش... چراغ‌ها خاموش می‌شوند. عمو پورنگ: «بشین... فقط یه آزمایش کوچیکه.»', 4500); me.fl = false; setTimeout(() => { me.fl = true; jump('🟢', ''); }, 3500); },
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
    if (lastState.k[0] && !LV.talked) { LV.talked = 1; ['تو: «سلام، یه فرش می‌خواستم. چنده؟»', 'پژمان جمشیدی: «این فرش ۵۰۰ هزار ریاله.»', 'تو: «ما فقط ۱۰۰ ریال داریم.»', 'پژمان جمشیدی: «با ۱۰۰ ریال؟! 😂 ولی یه فرش کارکرده تو زیرزمین دارم. بیا پایین نشونت بدم.»', 'پژمان جمشیدی: «فقط مراقب باش... پایین یه کم تاریکه.»'].forEach((l, i) => setTimeout(() => say(l, 2800), i * 3000)); setTimeout(() => LV.walk = 1, 12000); }
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
  sendT += dt; if (sendT > .066 && !cap) { sendT = 0; S.emit('move', { x: me.x, z: me.z, ry: me.ry, l: moving ? (me.crouch ? 0 : sprint ? 2 : 1) : 0 }); }
  $('#st').style.width = me.stam * 100 + '%'; $('#bt').style.width = me.bat * 100 + '%';
  $('#obj').textContent = `${LV.lab}: ${lastState.k.reduce((a, b) => a + b, 0)} از ${lastState.k.length} ${lastState.k.every(Boolean) ? '— ' + LV.go : ''}`;
  extra(t, dt);
  ren.render(scene, cam);
}

// =====================================================================
// NIGHTMARE EXPANSION — chapters 4-6 (client side)
// =====================================================================
const FX = [], X = { ph: 20, gs: 25, bl: 9, tvOn: 0 };
let closed = new Set(), doorMeshes = {}, amb = null;
const wait = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[<>&"'`]/g, '');
// ---------- audio helpers
const pbeep = (f, d, g = .15, pan = 0, type = 'sine') => {
  if (!AC) return; const o = AC.createOscillator(), v = AC.createGain(); o.type = type; o.frequency.value = f;
  v.gain.setValueAtTime(g, AC.currentTime); v.gain.exponentialRampToValueAtTime(.001, AC.currentTime + d);
  if (AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); o.connect(v).connect(p).connect(AC.destination); } else o.connect(v).connect(AC.destination);
  o.start(); o.stop(AC.currentTime + d);
};
const noiseBurst = (d = .4, g = .25, f = 1500) => {
  if (!AC) return; const n = AC.sampleRate * d | 0, b = AC.createBuffer(1, n, AC.sampleRate), a = b.getChannelData(0); for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), gn = AC.createGain(); fl.type = 'bandpass'; fl.frequency.value = f; gn.gain.value = g; s.buffer = b; s.connect(fl).connect(gn).connect(AC.destination); s.start();
};
const crackle = () => { noiseBurst(.45, .22, 2600); pbeep(1200, .08, .08); };
const bell = () => [520, 1040, 1560].forEach((f, i) => pbeep(f, 2.4 - i * .6, .08 / (i + 1), Math.random() * 1.2 - .6));
const sting = (g = .6) => { noiseBurst(.9, g, 1800); pbeep(900, .8, .25, 0, 'sawtooth'); pbeep(60, .9, .5, 0, 'sawtooth'); navigator.vibrate?.([150, 50, 250]); };
function startAmb(d) { // low drone (ch4/5) or wind (ch6)
  stopAmb(); if (!AC) return; const n = AC.sampleRate * 2, b = AC.createBuffer(1, n, AC.sampleRate), a = b.getChannelData(0); for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain(); s.buffer = b; s.loop = true; f.type = 'lowpass'; f.frequency.value = d.ch === 6 ? 520 : 200;
  g.gain.value = d.ch === 6 ? .12 : .05; lfo.frequency.value = d.ch === 6 ? .23 : .12; lg.gain.value = g.gain.value * .8; lfo.connect(lg).connect(g.gain); s.connect(f).connect(g).connect(AC.destination); s.start(); lfo.start(); amb = { s, lfo };
}
function stopAmb() { if (amb) { try { amb.s.stop(); amb.lfo.stop(); } catch (e) {} amb = null; } }
function resetX() { X.ph = 14 + Math.random() * 10; X.gs = 20 + Math.random() * 10; X.bl = 6 + Math.random() * 6; X.tvOn = 0; }
// ---------- geometry helpers
const solidAt = (x, z) => solid(x, z);
const rayFree = (x, z, dx, dz, max = 24) => { let d = 0; while (d < max && !solidAt(x + dx * (d + .5), z + dz * (d + .5))) d += .5; return d; };
function mkRambod(k = 1) { // same silhouette as the chasing creature, k > 1 = taller with huge hands
  const g = new THREE.Group(), bm = new THREE.MeshStandardMaterial({ color: 0x0d0d0d });
  const body = new THREE.Mesh(new THREE.BoxGeometry(.7, 2.6, .4), bm); body.position.y = 2; const head = new THREE.Mesh(new THREE.SphereGeometry(.28), bm); head.position.y = 3.5;
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(.3, .05, .05), new THREE.MeshBasicMaterial({ color: 0xff0000 })); eyes.position.set(0, 3.55, .25);
  const ag = new THREE.BoxGeometry(.12, 2.4, .12), a1 = new THREE.Mesh(ag, bm), a2 = new THREE.Mesh(ag, bm); a1.position.set(.5, 1.6, 0); a2.position.set(-.5, 1.6, 0);
  const hg = new THREE.SphereGeometry(.2 * k, 8, 8), h1 = new THREE.Mesh(hg, bm), h2 = new THREE.Mesh(hg, bm); h1.position.set(.5, .35, 0); h2.position.set(-.5, .35, 0);
  g.add(body, head, eyes, a1, a2, h1, h2); if (k > 1) g.scale.set(1, 1 + (k - 1) * .5, 1); return g;
}
function wallSpots(M) { // every open cell face that touches a wall: position (just in front of the wall), plane rotation, wall direction
  const out = []; M.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') return;
    [[1, 0, -Math.PI / 2], [-1, 0, Math.PI / 2], [0, -1, 0], [0, 1, Math.PI]].forEach(([dx, dz, ry]) => { if (M[r + dz]?.[c + dx] === '#') out.push({ x: (c + .5) * C + dx * (C / 2 - .04), z: (r + .5) * C + dz * (C / 2 - .04), ry, dx, dz, c, r }); }); }));
  return out;
}
const cv2 = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const toTex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const spineTex = () => { const [c, x] = cv2(128, 192); x.fillStyle = '#1a1410'; x.fillRect(0, 0, 128, 192);
  for (let r = 0; r < 5; r++) { let px = 4; const y = 8 + r * 37; x.fillStyle = '#2b2118'; x.fillRect(0, y + 30, 128, 5);
    while (px < 122) { const w = 4 + Math.random() * 7 | 0, h = 22 + Math.random() * 8 | 0, v = 60 + Math.random() * 60 | 0; x.fillStyle = `rgb(${v + 40},${v + 25},${v})`; x.fillRect(px, y + 30 - h, w, h); x.fillStyle = '#e8dcc080'; x.fillRect(px + 1, y + 30 - h + 4, w - 2, 3); px += w + 1; } }
  return toTex(c); };
const photoTex = k => { const [c, x] = cv2(96, 128); x.fillStyle = '#d8cfb4'; x.fillRect(0, 0, 96, 128); x.fillStyle = '#7a6a58'; x.fillRect(6, 6, 84, 100);
  for (let i = 0; i < 2 + k % 2; i++) { const px = 28 + i * 26; x.fillStyle = '#3a2f26'; x.beginPath(); x.ellipse(px, 62, 10, 13, 0, 0, 7); x.fill(); x.fillRect(px - 13, 76, 26, 30); x.fillStyle = '#d8cfb4'; x.fillRect(px - 5, 60, 3, 3); x.fillRect(px + 3, 60, 3, 3); }
  x.fillStyle = '#4a3f33'; for (let i = 0; i < 3; i++) x.fillRect(10, 112 + i * 5, 50 + Math.random() * 25, 2);
  return toTex(c); };
function decor(d) { // props that make each new chapter look different; collision still comes from the maze map
  const M = d.MAP, sp = wallSpots(M), P = Math.random, ud = scene.userData;
  const mk = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m; };
  const inw = (s, k) => [s.x - s.dx * k, s.z - s.dz * k]; // move k units from the wall into the corridor
  const MT = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .85, ...o });
  if (d.ch === 4) { // archive room: file shelves, pinned photos, a desk monitor
    const sm = new THREE.MeshStandardMaterial({ map: spineTex(), roughness: .9 }), sg = new THREE.BoxGeometry(3.2, 2.6, .35), pg = new THREE.PlaneGeometry(.5, .66), pm = [0, 1, 2, 3].map(k => new THREE.MeshStandardMaterial({ map: photoTex(k), roughness: 1 }));
    sp.forEach((s, i) => { const r = P(); const [x, z] = inw(s, .18);
      if (r < .5) mk(sg, sm, x, 1.3, z, s.ry);
      else if (r < .72) { const tx = s.dz ? 1 : 0, tz = s.dx ? 1 : 0; for (let k = 0; k < 3; k++) mk(pg, pm[(i + k) % 4], s.x - s.dx * .02 + tx * (k - 1) * .75, 1.25 + (k % 2) * .3, s.z - s.dz * .02 + tz * (k - 1) * .75, s.ry); } });
    const ms = sp.filter(s => s.c + s.r > 6 && !(d.ITEMS || []).some(k => k[0] === s.c && k[1] === s.r)), s = ms[ms.length * P() | 0] || sp[0];
    const [dx_, dz_] = inw(s, .45); mk(new THREE.BoxGeometry(1.6, .8, .7), MT(0x3a2a1c), dx_, .4, dz_, s.ry);
    const [cx, cz] = inw(s, .38); mk(new THREE.BoxGeometry(1.1, .75, .12), MT(0x1a1a1a), cx, 1.2, cz, s.ry);
    const [sx, sz] = inw(s, .46); ud.mon = mk(new THREE.PlaneGeometry(.95, .6), new THREE.MeshBasicMaterial({ color: 0x020202 }), sx, 1.2, sz, s.ry);
    ud.lamp = new THREE.PointLight(0xffe0b0, .5, 12); scene.add(ud.lamp);
  }
  if (d.ch === 5) { // industrial basement: overhead pipes, standing carpet rolls, crates
    const pm = MT(0x5a5f66, { metalness: .6, roughness: .45 }), pg = new THREE.CylinderGeometry(.12, .12, C, 8), wood = MT(0x6a4a2a);
    M.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.' || P() > .35) return; const ew = M[r][c + 1] === '.' || M[r][c - 1] === '.', o = (P() < .5 ? -1 : 1) * 1.2;
      const m = mk(pg, pm, (c + .5) * C + (ew ? 0 : o), 2.85, (r + .5) * C + (ew ? o : 0)); if (ew) m.rotation.z = Math.PI / 2; else m.rotation.x = Math.PI / 2; }));
    sp.forEach((s, i) => { const r = P(), [x, z] = inw(s, .55);
      if (r < .22) mk(new THREE.CylinderGeometry(.35, .35, 2.4, 14), cmat(i), x, 1.2, z);
      else if (r < .38) { mk(new THREE.BoxGeometry(1, 1, 1), wood, x, .5, z, P() * .5); if (P() < .5) mk(new THREE.BoxGeometry(.9, .9, .9), wood, x, 1.45, z, P()); } });
  }
  if (d.ch === 6) { // abandoned floor: broken shelves, black windows, dead TVs, dusty carpets, flickering fixtures
    const wood = MT(0x2a2018), frame = MT(0x2b2118), black = new THREE.MeshBasicMaterial({ color: 0x000000 }), bk = MT(0x151515), tvs = [];
    sp.forEach((s, i) => { const r = P(), [x, z] = inw(s, .35);
      if (r < .3) { const m = mk(new THREE.BoxGeometry(3, 2.2, .35), wood, x, 1.1, z, s.ry); m.rotation.z = (P() - .5) * .25; m.rotation.x = (P() - .5) * .15; for (let k = 0; k < 2; k++) mk(new THREE.BoxGeometry(1.4, .08, .25), wood, x + (P() - .5) * 2, .05, z + (P() - .5) * 2, P() * 3); }
      else if (r < .5) { const [fx, fz] = inw(s, .02); mk(new THREE.BoxGeometry(1.8, 1.6, .06), frame, fx, 1.7, fz, s.ry); const [bx, bz] = inw(s, .07); mk(new THREE.PlaneGeometry(1.5, 1.3), black, bx, 1.7, bz, s.ry); }
      else if (r < .6) { const [tx, tz] = inw(s, .5); mk(new THREE.BoxGeometry(1.2, .6, 1), wood, tx, .3, tz, s.ry); mk(new THREE.BoxGeometry(.95, .7, .7), bk, tx, .95, tz, s.ry); const [px, pz] = inw(s, .86); tvs.push(mk(new THREE.PlaneGeometry(.72, .5), new THREE.MeshBasicMaterial({ color: 0x050505 }), px, .98, pz, s.ry)); } });
    M.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.' || P() > .12) return; const m = cmat(r + c); m.color.setHex(0x777777); const q = mk(new THREE.PlaneGeometry(2.4, 3.6), m, (c + .5) * C + (P() - .5) * 1.5, .03, (r + .5) * C + (P() - .5) * 1.5); q.rotation.x = -Math.PI / 2; q.rotation.z = P() * 3; }));
    ud.fix = []; M.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.' || P() > .3) return; const m = new THREE.MeshBasicMaterial({ color: 0xaa9a70 }); mk(new THREE.BoxGeometry(1.2, .1, .25), m, (c + .5) * C, 3.12, (r + .5) * C); ud.fix.push({ m, p: P() * 20 }); }));
    ud.tvs = tvs; ud.lamp = new THREE.PointLight(0xffd9a0, .5, 14); scene.add(ud.lamp);
  }
}
const syncDoors = () => { // closed corridor doors (chapter 5)
  closed.forEach(k => { if (!doorMeshes[k]) { const r = Math.floor(k / 100), c = k % 100, ns = M[r][c - 1] === '#' && M[r][c + 1] === '#';
      const m = new THREE.Mesh(new THREE.BoxGeometry(ns ? C : .4, 3.1, ns ? .4 : C), new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: .6, roughness: .5 })); m.position.set((c + .5) * C, 1.55, (r + .5) * C); scene.add(m); doorMeshes[k] = m; } doorMeshes[k].visible = true; });
  for (const k in doorMeshes) if (!closed.has(+k)) doorMeshes[k].visible = false;
};
// ---------- full-screen scare overlays
const overlay = (html, ms, css = '') => { const o = document.createElement('div'); o.style.cssText = 'position:fixed;inset:0;z-index:99998;pointer-events:none;overflow:hidden;' + css; o.innerHTML = html; document.body.appendChild(o); setTimeout(() => o.remove(), ms); return o; };
const FACE = (sk = '#cfc6b8', gl = '#f11', h = '120vh') => `<svg viewBox="0 0 300 400" style="height:${h}"><ellipse cx="150" cy="190" rx="95" ry="165" fill="${sk}"/><ellipse cx="108" cy="150" rx="30" ry="42" fill="#000"/><ellipse cx="192" cy="150" rx="30" ry="42" fill="#000"/><circle cx="108" cy="156" r="9" fill="${gl}"/><circle cx="192" cy="156" r="9" fill="${gl}"/><path d="M60 255 Q150 215 240 255 L225 360 Q150 420 75 360Z" fill="#100"/><path d="M75 262 L90 310 L105 258 L120 318 L135 255 L150 322 L165 255 L180 318 L195 258 L210 310 L225 262" fill="none" stroke="#eee" stroke-width="9"/><path d="M108 108 L90 60 M192 108 L214 58" stroke="#000" stroke-width="7"/></svg>`;
const KF = '<style>@keyframes zm2{0%{transform:scale(.2) rotate(-5deg)}20%{transform:scale(1.4) rotate(3deg)}100%{transform:scale(2.1) rotate(-3deg)}}@keyframes sh2{0%,100%{translate:0 0}25%{translate:-24px 14px}50%{translate:20px -18px}75%{translate:-14px -22px}}@keyframes gz{0%{transform:translateY(70%) scale(.55)}100%{transform:translateY(6%) scale(1)}}@keyframes dg{0%{width:6%}100%{width:30%}}@keyframes mf{0%,100%{opacity:1}48%{opacity:.55}52%{opacity:1}}</style>';
function scareFace(ms = 1000) { overlay(`${KF}<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000"><div style="animation:zm2 ${ms}ms ease-out forwards,sh2 .08s linear infinite">${FACE()}</div></div>`, ms); sting(); }
function scareGlass() { // power comes on: Rambod behind the control-room window
  crackle(); overlay(`${KF}<div style="position:absolute;inset:0;background:#030806;display:flex;align-items:center;justify-content:center"><div style="position:relative;width:min(84vw,680px);height:min(66vh,440px);border:16px solid #2c312e;background:linear-gradient(135deg,#143a30,#04100c);overflow:hidden;box-shadow:0 0 70px #000"><div style="position:absolute;inset:0;display:flex;justify-content:center;align-items:flex-start;animation:gz 1.2s ease-in forwards,sh2 .1s linear infinite">${FACE('#9fb09c', '#3f3', '110%')}</div><div style="position:absolute;inset:0;background:linear-gradient(115deg,#fff3 0,transparent 35%,#fff1 62%,transparent 80%)"></div><svg viewBox="0 0 100 60" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><path d="M62 0 L55 20 L70 28 L52 44 L60 60 M55 20 L38 26 L30 40" stroke="#dfe" stroke-width=".5" fill="none" opacity=".6"/></svg></div></div>`, 1700);
  setTimeout(() => sting(.5), 1000);
}
function scareDoor() { // security door opens: his face for a moment in the gap
  overlay(`${KF}<div style="position:absolute;inset:0;background:#000;display:flex;justify-content:center"><div style="flex:1;background:linear-gradient(90deg,#2a2f35,#4a5058);border-right:4px solid #111"></div><div style="width:26%;overflow:hidden;display:flex;justify-content:center;align-items:center;background:#000;animation:dg .7s ease-out forwards">${FACE('#cfc6b8', '#f11', '100vh')}</div><div style="flex:1;background:linear-gradient(270deg,#2a2f35,#4a5058);border-left:4px solid #111"></div></div>`, 750); sting(.45);
}
function rambodNear(dur = 450) { // Rambod appears right in front of the camera for an instant
  const g = mkRambod(); g.position.set(me.x - Math.sin(me.ry) * 1.5, 0, me.z - Math.cos(me.ry) * 1.5); g.lookAt(me.x, 0, me.z); scene.add(g);
  noiseBurst(.4, .35, 900); pbeep(45, .5, .6); navigator.vibrate?.(180); setTimeout(() => scene.remove(g), dur);
}
function monitorEvent(w) { // room monitor switches on: the player's name on a file dated three days ago
  const nm = esc(lastState.p[w]?.n || cfg.name || 'بازیکن'), ds = new Date(Date.now() - 3 * 864e5).toLocaleDateString('fa-IR'), m = scene.userData.mon;
  crackle(); say('مانیتور اتاق ناگهان روشن می‌شود...', 2500);
  if (m) { m.material.color.setHex(0x66ff99); m.add(new THREE.PointLight(0x66ff99, 1.6, 10)); }
  overlay(`${KF}<div style="position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);width:min(86vw,620px);background:#010d05;border:3px solid #2f6;box-shadow:0 0 40px #0f6a;padding:22px 28px;color:#6f8;font-family:monospace;font-size:clamp(14px,2.6vw,24px);line-height:2;direction:rtl;text-align:right;animation:mf .3s infinite"><div>📁 پروندهٔ مشتری</div><div>نام: <b>${nm}</b></div><div>تاریخ ثبت: ${ds}</div><div style="color:#f55">⚠ این تاریخ سه روز پیش است...</div></div>`, 6500, 'background:#000a');
}
function photoEvent() { // a face inside a customer photo slowly changes
  say('عکس‌ها و مدارک مشتریان را بررسی می‌کنی...', 2600);
  const o = overlay(`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><div style="width:min(72vw,430px);background:#d8cfb8;padding:14px 14px 30px;transform:rotate(-2deg);box-shadow:0 0 50px #000"><svg viewBox="0 0 300 220" style="width:100%;display:block"><rect width="300" height="220" fill="#7a6a58"/><circle cx="70" cy="105" r="22" fill="#3a2f26"/><path d="M40 220 L45 135 Q70 125 95 135 L100 220Z" fill="#3a2f26"/><circle cx="230" cy="105" r="22" fill="#3a2f26"/><path d="M200 220 L205 135 Q230 125 255 135 L260 220Z" fill="#3a2f26"/><g id="pf"><ellipse id="ph" cx="150" cy="96" rx="27" ry="32" fill="#4a3c30"/><path d="M110 220 L116 140 Q150 126 184 140 L190 220Z" fill="#3a2f26"/><circle id="pe1" cx="138" cy="90" r="3" fill="#d8cfb8"/><circle id="pe2" cx="162" cy="90" r="3" fill="#d8cfb8"/><path id="pm" d="M136 112 Q150 122 164 112" stroke="#d8cfb8" stroke-width="3" fill="none"/></g></svg><div style="color:#4a3f33;font-size:15px;margin-top:8px;text-align:center">مشتری‌های سابق</div></div></div><div id="pr" style="position:absolute;inset:0;background:#a00;opacity:0"></div>`, 7600, 'background:#000b');
  let s = 0; const q = id => o.querySelector(id), iv = setInterval(() => { s += .01; if (s >= 1 || !q('#ph')) return clearInterval(iv);
    q('#ph').setAttribute('ry', 32 + s * 9); q('#ph').setAttribute('fill', `rgb(${74 - s * 20 | 0},${60 + s * 40 | 0},${48 + s * 18 | 0})`);
    q('#pe1').setAttribute('r', 3 + s * 6); q('#pe2').setAttribute('r', 3 + s * 6); q('#pe1').setAttribute('fill', s > .5 ? '#000' : '#d8cfb8'); q('#pe2').setAttribute('fill', s > .5 ? '#000' : '#d8cfb8');
    q('#pm').setAttribute('d', `M${136 - s * 12} 112 Q150 ${122 + s * 58} ${164 + s * 12} 112`); q('#pm').setAttribute('stroke', s > .6 ? '#000' : '#d8cfb8'); q('#pf').setAttribute('transform', `rotate(${s * 9} 150 120)`); q('#pr').style.opacity = s * .35; }, 60);
  setTimeout(() => say('چهرهٔ یکی از افراد داخل عکس عوض شده... به تو خیره شده است.', 4200), 6800);
}
// ---------- events fired by the server (chapters 4-6)
Object.assign(EV, {
  photo: () => photoEvent(),
  monitor: w => monitorEvent(w),
  wall: () => { say('صدای قدم‌های رامبد جوان از پشت دیوار شنیده می‌شود...', 4500); const side = Math.random() < .5 ? -1 : 1; for (let i = 0; i < 11; i++) setTimeout(() => pbeep(72 + Math.random() * 12, .13, .35, side * (.9 - i * .17), 'triangle'), 600 + i * 520); },
  behind: () => { const y0 = me.ry, t0 = performance.now(); FX.push(() => { if (performance.now() - t0 > 60000) return false; if (Math.abs(Math.atan2(Math.sin(me.ry - y0), Math.cos(me.ry - y0))) < 2) return true; rambodNear(); return false; }); },
  doorshut: () => { beep(60, .5, .6); noiseBurst(.3, .4, 400); say('دری با صدای وحشتناکی بسته شد!', 2500); },
  carpet: () => { // a carpet slides along the floor, then Rambod rises from behind it
    const fx = -Math.sin(me.ry), fz = -Math.cos(me.ry), free = rayFree(me.x, me.z, fx, fz, 9), dist = Math.max(2.5, free - .8), m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6), cmat(3));
    m.rotation.set(-Math.PI / 2, 0, Math.random() * 3); let px = me.x + fx * dist, pz = me.z + fz * dist; m.position.set(px, .06, pz); scene.add(m); say('یک فرش روی زمین می‌لغزد...', 3000); pbeep(110, 1.5, .12, 0, 'triangle');
    const t0 = performance.now(); let g = null;
    FX.push(() => { const age = (performance.now() - t0) / 1000;
      if (age < 2.6) { const dx = me.x - px, dz = me.z - pz, d = Math.hypot(dx, dz) || 1, v = .9 * (1 / 60); if (d > 1.8 && !solidAt(px + dx / d * v * 2, pz + dz / d * v * 2)) { px += dx / d * v; pz += dz / d * v; } m.position.set(px, .06, pz); return true; }
      if (!g) { g = mkRambod(); g.position.set(px, 0, pz); g.scale.y = .1; g.lookAt(me.x, 0, me.z); scene.add(g); }
      g.scale.y = Math.min(1, g.scale.y + .15); g.lookAt(me.x, 0, me.z);
      if (age > 3.1) { scareFace(900); scene.remove(g); scene.remove(m); return false; } return true; });
  },
  glass: () => { say('برق بخش صنعتی روشن شد... پشت شیشهٔ اتاق کنترل یک نفر ایستاده است!', 3500); setTimeout(scareGlass, 1100); },
  doorface: () => { say('در امنیتی با صدای سنگین باز می‌شود...', 2500); setTimeout(scareDoor, 1300); },
  pa: () => setTimeout(() => { crackle(); bell(); say('پژمان جمشیدی (از بلندگو): «اگه این صدا رو می‌شنوی، یعنی هنوز زنده‌ای... ولی به من اعتماد نکن.»', 7000); }, 9500),
  tv: () => { // every old TV switches on at once, all showing the player
    crackle(); say('تلویزیون‌های قدیمی فروشگاه هم‌زمان روشن می‌شوند...', 3200); X.tvOn = 1;
    const col = esc(cfg.col), nm = esc(cfg.name || 'بازیکن'), tile = `<div style="position:relative;background:repeating-linear-gradient(0deg,#1a1d1a 0 3px,#111411 3px 6px);border:5px solid #222;border-radius:10px;overflow:hidden;animation:mf .2s infinite"><svg viewBox="0 0 100 80" style="width:100%;display:block"><circle cx="50" cy="30" r="12" fill="${col}"/><path d="M26 80 Q30 48 50 46 Q70 48 74 80Z" fill="${col}"/></svg><div style="position:absolute;bottom:4px;width:100%;text-align:center;color:#ddd;font-size:13px">${nm}</div></div>`;
    overlay(`${KF}<div style="position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:12vh 8vw;align-content:center">${tile.repeat(6)}</div>`, 4300, 'background:#000c');
    setTimeout(() => { crackle(); say('عمو پورنگ (از بلندگو): «فکر کردی می‌تونی از اینجا فرار کنی؟»', 5000); }, 4600); setTimeout(() => { X.tvOn = 0; (scene.userData.tvs || []).forEach(s => s.material.color.setHex(0x050505)); }, 14000);
  },
  final: () => { // last fuse: lights on, Rambod (huge) at the end of the hall, lights off, something sprints
    const ud = scene.userData; say('آخرین فیوز نصب شد... تمام چراغ‌های فروشگاه روشن می‌شوند!', 2800); LV.lit = true; ud.amb.intensity = 3.2; scene.fog.density = .022; if (ud.el) { ud.el.color.setHex(0x33ff66); ud.el.intensity = 3; ud.el.distance = 70; }
    let best = null; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, dx = -Math.sin(a), dz = -Math.cos(a), f = rayFree(me.x, me.z, dx, dz, 24), face = Math.cos(a - me.ry), sc = f >= 7 ? face * 10 + Math.min(f, 20) : -1; if (!best || sc > best.sc) best = { sc, dx, dz, f }; }
    const g = mkRambod(1.8); g.position.set(me.x + best.dx * Math.max(4, Math.min(best.f - 1, 20)), 0, me.z + best.dz * Math.max(4, Math.min(best.f - 1, 20))); scene.add(g); pbeep(40, 2.2, .35, 0, 'sawtooth');
    FX.push(() => { g.lookAt(me.x, 0, me.z); return !!g.parent; });
    setTimeout(() => { scene.remove(g); LV.lit = false; ud.amb.intensity = 1.2; scene.fog.density = LV.fogD || .09; beep(40, 1.4, .5);
      say('چراغ‌ها خاموش شدند... صدای دویدن بسیار سریع! فوراً وارد در مخفی شو!', 5000);
      for (let i = 0; i < 22; i++) setTimeout(() => pbeep(95 + (i % 2) * 14, .08, .2 + i * .02, Math.sin(i * .6) * .8, 'square'), i * (230 - i * 6)); }, 2800);
  }
});
// ---------- end-of-chapter cutscenes (the server waits until every player answers 'cutdone')
const person = hot => `<svg viewBox="0 0 200 120" style="position:absolute;inset:0;width:100%;height:100%">${hot ? '<rect x="82" y="8" width="36" height="104" fill="#050505"/><circle cx="100" cy="14" r="10" fill="#050505"/><rect x="94" y="12" width="5" height="2" fill="#f22"/><rect x="101" y="12" width="5" height="2" fill="#f22"/>' : ''}<circle cx="100" cy="68" r="11" fill="${esc(cfg.col)}"/><path d="M82 112 Q86 84 100 82 Q114 84 118 112Z" fill="${esc(cfg.col)}"/></svg>`;
const cctv = hot => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;width:min(92vw,760px)">${[1, 2, 3, 4].map(i => `<div style="position:relative;height:min(26vh,200px);background:repeating-linear-gradient(0deg,#0d150f 0 3px,#0a100c 3px 6px);border:2px solid ${hot && i === 3 ? '#e22' : '#2a4a34'};overflow:hidden"><span style="position:absolute;top:4px;left:8px;color:#6f8;font:12px monospace">CAM 0${i}</span><span style="position:absolute;top:4px;right:8px;color:#e44;font:12px monospace">● REC</span>${i === 3 ? person(hot) : ''}</div>`).join('')}</div>`;
const stairs = `<svg viewBox="0 0 300 200" style="width:min(80vw,520px)"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#2a2622"/></linearGradient></defs><rect width="300" height="200" fill="#050505"/>${[0, 1, 2, 3, 4, 5, 6].map(i => `<path d="M${40 + i * 12} ${40 + i * 22} L${260 - i * 12} ${40 + i * 22} L${260 - i * 12 - 6} ${62 + i * 22} L${46 + i * 12} ${62 + i * 22}Z" fill="url(#sg)" stroke="#3a342e" stroke-width="1" opacity="${1 - i * .09}"/>`).join('')}</svg>`;
const CUTS = {
  3: async ({ T }) => { beep(55, 1.4, .5); await T('آسانسور حرکت می‌کند... چراغ‌ها خاموش می‌شوند.<br>«یه لحظه صبر کن...»', 3800); await T('چراغ روشن می‌شود... عمو پورنگ داخل آسانسور ایستاده است.', 3600); crackle(); await T('📺 تلویزیون قدیمی روشن می‌شود.<br>پژمان جمشیدی: «حالا دیگه وقتشه حقیقت رو بدونی...»', 4400); beep(70, .8, .4); await T('آسانسور باز می‌شود... بوی کاغذ کهنه و خاک.', 2600); },
  4: async ({ T }) => { await T('پرونده را باز می‌کنی...', 2600); crackle(); await T('«این مشتری برای آزمایش نهایی انتخاب شده است.»', 4600, 'border:2px solid #2f6;padding:18px 28px;background:#021208;color:#6f8;font-family:monospace;text-shadow:0 0 10px #0f6'); await T('', 400); beep(50, 1.2, .5); await T('چراغ‌ها خاموش می‌شوند...', 2600, 'color:#777'); await T('صدای عمو پورنگ در تاریکی:<br>«بالاخره رسیدی...»', 4200, 'color:#c66'); },
  5: async ({ T, V }) => { V(cctv(false)); noiseBurst(.5, .15, 3000); await T('به اتاق کنترل می‌رسی و تصویر دوربین‌ها را نگاه می‌کنی...', 3600); V(cctv(true)); pbeep(48, 1.6, .3, 0, 'sawtooth'); await T('در یکی از دوربین‌ها، رامبد جوان دقیقاً پشت سر تو ایستاده است.', 4400, 'color:#f66'); V(''); beep(60, .5, .5); await T('برمی‌گردی.', 2400); await T('هیچ‌کس آنجا نیست.', 3600, 'color:#aaa'); },
  6: async ({ T, V }) => { beep(60, 1, .4); await T('در مخفی باز می‌شود... وارد یک راه‌پلهٔ تاریک می‌شوی که به طبقهٔ سوم زیرزمین می‌رود.', 4600); V(stairs); await T('روی دیوار نوشته شده:', 2600); await T('«هیچ‌کس از طبقه سوم برنگشته است.»', 5200, 'color:#c11;font-weight:700;text-shadow:0 0 14px #800;font-size:1.3em'); V(''); await T('', 2400); }
};
async function runCut(ch) {
  const o = document.createElement('div'); o.id = 'cut'; o.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:18px;color:#ddd;text-align:center;font-size:clamp(18px,3.2vw,30px);padding:24px;line-height:1.9;transition:opacity .8s;opacity:0';
  o.innerHTML = '<div id="cv" style="width:100%;display:flex;justify-content:center"></div><div id="ct" style="max-width:820px"></div>'; document.body.appendChild(o); document.exitPointerLock?.();
  await wait(30); o.style.opacity = 1;
  const V = h => { o.querySelector('#cv').innerHTML = h; }, T = (t, ms, css = '') => { const e = o.querySelector('#ct'); e.style.cssText = css; e.innerHTML = t; return wait(ms); };
  try { await CUTS[ch]?.({ T, V }); } catch (e) {}
  S.emit('cutdone'); setTimeout(() => { if (ch < 6 && o.isConnected) o.remove(); }, 9000); // the next chapter's 'started' event fades it out
}
S.on('cut', ch => runCut(ch));
function extra(t, dt) { // per-frame logic for chapters 4-6
  for (let i = FX.length - 1; i >= 0; i--) if (FX[i](t, dt) === false) FX.splice(i, 1);
  const ch = LV.ch; if (ch < 4) return; const ud = scene.userData;
  syncDoors();
  if (ud.lamp) { ud.lamp.position.set(me.x, 2.8, me.z); ud.lamp.intensity = LV.lit ? 0 : (Math.sin(t / 130) + Math.sin(t / 47) > 1.2 ? 0 : .35 + Math.random() * .5); }
  if (ud.fix) ud.fix.forEach(f => { const v = LV.lit ? .9 : (Math.sin(t / 120 + f.p) + Math.sin(t / 37 + f.p * 3) > 1.1 ? .04 : .5); f.m.color.setRGB(v, v * .92, v * .7); });
  if (ud.tvs && X.tvOn) ud.tvs.forEach(s => s.material.color.setScalar(.4 + Math.random() * .6));
  if (LV.hideExit && ud.ex) { const all = lastState.k.every(Boolean); ud.ex.visible = all; ud.el.visible = all; } // the hidden door only shows once the power is on
  if (cap || hidden || !started) return;
  if (ch === 5) { X.ph -= dt; X.gs -= dt; if (X.ph <= 0) { X.ph = 22 + Math.random() * 18; phantom(); } if (X.gs <= 0) { X.gs = 20 + Math.random() * 15; ghostSteps(); } }
  if (ch === 6) { X.bl -= dt; if (X.bl <= 0) { X.bl = 9 + Math.random() * 11; bell(); } }
}
function phantom() { // Rambod far away at the end of a corridor — he vanishes before you can reach him
  const opts = []; for (let k = -4; k <= 4; k++) { const a = me.ry + k * .15, dx = -Math.sin(a), dz = -Math.cos(a), f = rayFree(me.x, me.z, dx, dz, 24); if (f >= 12) opts.push([dx, dz, Math.min(f - 1, 20)]); }
  if (!opts.length) { X.ph = 5; return; }
  const [dx, dz, f] = opts[Math.random() * opts.length | 0], g = mkRambod(); g.position.set(me.x + dx * f, 0, me.z + dz * f); scene.add(g); pbeep(48, 1.4, .25); say('در انتهای راهرو... یک نفر ایستاده است.', 2600);
  const t0 = performance.now(); FX.push(() => { g.lookAt(me.x, 0, me.z); g.visible = Math.random() > .08; if (performance.now() - t0 > 3200 || Math.hypot(g.position.x - me.x, g.position.z - me.z) < 8) { scene.remove(g); return false; } return true; });
}
function ghostSteps() { say('صدای قدم‌هایی از پشت سرت شنیده می‌شود... ولی هیچ‌کس نیست.', 4200); for (let i = 0; i < 10; i++) setTimeout(() => pbeep(70 + (i % 2) * 8, .1, .12 + i * .035, 0, 'triangle'), 400 + i * (520 - i * 22)); }
