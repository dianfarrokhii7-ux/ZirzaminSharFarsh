const express = require('express'), http = require('http'), { Server } = require('socket.io');
const app = express(); app.use(express.static('public'));
const srv = http.createServer(app), io = new Server(srv);
const C = 4, rnd = n => Math.floor(Math.random() * n);
const cell = v => Math.floor(v / C), mid = c => (c + 0.5) * C;
const open = (L, c, r) => L.MAP[r] && L.MAP[r][c] === '.';
const { level } = require('./levels');
const rooms = Object.create(null);
const code = () => { let s; do s = String(Math.floor(1000 + Math.random() * 9000)); while (rooms[s]); return s; };
// line of sight on the grid (used by the chapter 5+ enemy)
const los = (L, a, b) => { const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 1.5); for (let i = 1; i < n; i++) { const t = i / n; if (!open(L, cell(a.x + (b.x - a.x) * t), cell(a.z + (b.z - a.z) * t))) return false; } return true; };
// straight corridor cell (walls on two opposite sides) — a door can be shut here
const corr = (L, c, r) => open(L, c, r) && ((!open(L, c - 1, r) && !open(L, c + 1, r) && open(L, c, r - 1) && open(L, c, r + 1)) || (!open(L, c, r - 1) && !open(L, c, r + 1) && open(L, c - 1, r) && open(L, c + 1, r)));
function bfsNext(L, a, b) {
  const q = [a], prev = {}, k = p => p[0] + ',' + p[1]; prev[k(a)] = null; const seen = new Set([k(a)]);
  while (q.length) {
    const p = q.shift();
    if (p[0] === b[0] && p[1] === b[1]) { let cur = p, last = p; while (prev[k(cur)]) { last = cur; cur = prev[k(cur)]; } return last; }
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) { const n = [p[0] + dx, p[1] + dz]; if (open(L, n[0], n[1]) && !seen.has(k(n))) { seen.add(k(n)); prev[k(n)] = p; q.push(n); } }
  } return a;
}
function load(r, ch) {
  r.ch = ch; const L = r.L = level(ch);
  r.cells = []; L.MAP.forEach((row, y) => [...row].forEach((c, x) => c === '.' && r.cells.push([x, y])));
  r.keys = L.ITEMS.map(() => 0); r.fired = {}; r.doors = []; r.dcool = 0; r.hold = false;
  const f = r.cells.filter(c => c[0] + c[1] > 12)[0] || r.cells[r.cells.length - 1];
  r.e = { x: mid(f[0]), z: mid(f[1]), goal: f, stun: 0, chase: false, rage: 0 };
  Object.values(r.players).forEach(p => Object.assign(p, { x: mid((L.SP || [1, 1])[0]), z: mid((L.SP || [1, 1])[1]), cap: false, hid: false, l: 0, gt: 0 }));
}
const send = r => ({ ...r.L, C, SP: r.L.SP || [1, 1] });
const pub = r => ({ code: r.code, host: r.host, started: r.started, players: Object.fromEntries(Object.entries(r.players).map(([i, p]) => [i, { name: p.name, ready: p.ready, col: p.col }])) });
// a chapter was finished: chapters 1-2 go straight on, chapters 3-6 first play an end-of-chapter cutscene (clients answer with 'cutdone')
function advance(r) {
  if (r.ch >= 3) { r.hold = true; r.holdT = Date.now(); r.acks = new Set(); io.to(r.code).emit('cut', r.ch); }
  else { load(r, r.ch + 1); io.to(r.code).emit('started', send(r)); }
}
function proceed(r) {
  r.hold = false;
  if (r.ch >= 6) { r.started = false; io.to(r.code).emit('win'); }
  else { load(r, r.ch + 1); io.to(r.code).emit('started', send(r)); }
}
// chapter 5: when the chase starts, Rambod slams a couple of corridor doors shut for a few seconds
function closeDoors(r, p, now) {
  const L = r.L, pc = cell(p.x), pr = cell(p.z);
  const cand = r.cells.filter(([c, y]) => { const d = Math.abs(c - pc) + Math.abs(y - pr); return d >= 3 && d <= 8 && corr(L, c, y) && !(c === L.EXIT[0] && y === L.EXIT[1]); });
  for (let k = 0; k < 2 && cand.length; k++) { const [c, y] = cand.splice(rnd(cand.length), 1)[0]; r.doors.push({ c, r: y, until: now + 7000 }); }
  r.dcool = now + 16000; io.to(r.code).emit('ev', { id: 'doorshut', who: '' });
}
io.on('connection', s => {
  let R = null;
  const join = (r, pr) => {
    if (Object.keys(r.players).length >= 4 || r.started) return s.emit('err', 'اتاق پر است یا بازی شروع شده است');
    pr = pr || {}; const nm = String(pr.name || '').replace(/[<>&"'`]/g, '').slice(0, 16) || 'بازیکن', col = /^#[0-9a-f]{6}$/i.test(pr.col) ? pr.col : '#3a7acc';
    R = r; s.join(r.code);
    r.players[s.id] = { name: nm, col, x: 6, z: 6, ry: 0, cap: false, hid: false, ready: false, l: 0 };
    io.to(r.code).emit('lobby', pub(r));
  };
  s.on('create', pr => { const c = code(); rooms[c] = { code: c, host: s.id, players: {}, started: false }; load(rooms[c], 0); join(rooms[c], pr); });
  s.on('join', (c, pr) => rooms[c] ? join(rooms[c], pr) : s.emit('err', 'اتاقی با این کد پیدا نشد'));
  s.on('ready', v => { if (!R) return; R.players[s.id].ready = !!v; io.to(R.code).emit('lobby', pub(R)); });
  s.on('start', () => { if (!R || R.host !== s.id || R.started) return; R.started = true; load(R, 0); io.to(R.code).emit('started', send(R)); });
  s.on('move', p => { if (!p) return; const q = R && R.players[s.id]; if (q && !q.cap) { q.x = +p.x || 0; q.z = +p.z || 0; q.ry = +p.ry || 0; q.l = p.l === 2 ? 2 : p.l === 1 ? 1 : 0; } });
  s.on('hide', v => { const q = R && R.players[s.id]; if (q && !q.cap) q.hid = !!v; });
  s.on('cutdone', () => { if (R && R.hold && R.acks) R.acks.add(s.id); });
  s.on('pickup', i => {
    const q = R && R.players[s.id]; if (!q || q.cap || R.hold || !R.L.ITEMS[i] || R.keys[i]) return;
    const L = R.L, it = L.ITEMS[i];
    if (Math.hypot(q.x - mid(it[0]), q.z - mid(it[1])) >= 4.5) return;
    const g = L.gate && L.gate[i]; // ordered objectives (power needs the cards, the security door needs power ...)
    if (g && !g.every(j => R.keys[j])) { const t = Date.now(); if (t - (q.gt || 0) > 3000) { q.gt = t; s.emit('say', (L.gmsg && L.gmsg[i]) || 'هنوز نمی‌توانی این کار را انجام دهی'); } return; }
    R.keys[i] = 1; const mg = L.msgs && L.msgs[i];
    io.to(R.code).emit('say', mg ? mg.replace('{n}', q.name).replace(/\{code\}/g, L.code || '') : q.name + ' ' + L.verb);
    if (L.hear && !R.e.chase) { R.e.goal = [it[0], it[1]]; R.e.stun = 0; } // objectives make noise: Rambod walks over to investigate
    const pe = L.PICK && L.PICK[i]; if (pe) io.to(R.code).emit('ev', { id: pe, who: s.id });
    if (L.FINAL && R.keys.every(Boolean)) {
      io.to(R.code).emit('ev', { id: L.FINAL, who: s.id }); const r = R, px = q.x, pz = q.z;
      setTimeout(() => { // finale: lights go out and Rambod charges from far away
        if (rooms[r.code] !== r || r.hold || r.L !== L) return;
        const far = r.cells.filter(c => Math.hypot(mid(c[0]) - px, mid(c[1]) - pz) > 26), f = far[rnd(far.length)] || r.cells[0];
        r.e.x = mid(f[0]); r.e.z = mid(f[1]); r.e.stun = 0; r.e.rage = Date.now() + 9000;
      }, 3000);
    }
  });
  s.on('rescue', id => {
    const a = R && R.players[s.id], b = R && R.players[id];
    if (a && b && !a.cap && b.cap && Math.hypot(a.x - b.x, a.z - b.z) < 3.5) { b.cap = false; io.to(R.code).emit('say', b.name + ' نجات پیدا کرد'); }
  });
  s.on('disconnect', () => {
    if (!R) return; delete R.players[s.id];
    if (!Object.keys(R.players).length) delete rooms[R.code];
    else { if (R.host === s.id) R.host = Object.keys(R.players)[0]; io.to(R.code).emit('lobby', pub(R)); }
  });
});
setInterval(() => {
  const dt = 0.1, now = Date.now();
  for (const r of Object.values(rooms)) {
    if (!r.started) continue;
    if (r.hold) { if (now - r.holdT > 60000 || Object.keys(r.players).every(id => r.acks.has(id))) proceed(r); continue; }
    r.doors = r.doors.filter(d => d.until > now);
    const L = r.L, ps = Object.entries(r.players), e = r.e, alive = ps.filter(([, p]) => !p.cap);
    if (L.noEnemy) { e.x = e.z = -99; e.chase = false; }
    else if (e.stun > 0) e.stun -= dt;
    else {
      const rage = e.rage > now, rng = rage ? 999 : (L.range || 16); let tgt = null, best = 999;
      for (const [, p] of alive) {
        const d = Math.hypot(p.x - e.x, p.z - e.z);
        const ear = L.hear ? (p.l === 2 ? 15 : p.l === 1 ? 7 : 0) : 0; // sprinting is loud, walking is quiet, crouching/standing is silent
        const seen = d < rng && (!L.los || rage || los(L, e, p));
        if (d < best && (!p.hid || d < 2) && (seen || d < ear)) { best = d; tgt = p; }
      }
      const was = e.chase; e.chase = !!tgt;
      if (tgt) e.goal = [cell(tgt.x), cell(tgt.z)];
      else if (cell(e.x) === e.goal[0] && cell(e.z) === e.goal[1]) e.goal = r.cells[rnd(r.cells.length)];
      if (L.doors && e.chase && !was && now > r.dcool) closeDoors(r, tgt, now);
      const nx = bfsNext(L, [cell(e.x), cell(e.z)], e.goal), tx = mid(nx[0]), tz = mid(nx[1]);
      const d = Math.hypot(tx - e.x, tz - e.z) || 1, sp = (e.chase ? (rage ? Math.max(L.chase, 6.4) : L.chase) : 2.2) * dt;
      e.x += (tx - e.x) / d * Math.min(sp, d); e.z += (tz - e.z) / d * Math.min(sp, d);
      for (const [pid, p] of alive) if (Math.hypot(p.x - e.x, p.z - e.z) < 1.6) {
        p.cap = true; p.hid = false; e.stun = 4; e.rage = 0;
        const far = r.cells.filter(c => Math.hypot(mid(c[0]) - p.x, mid(c[1]) - p.z) > 20), f = far[rnd(far.length)] || r.cells[0];
        e.x = mid(f[0]); e.z = mid(f[1]); e.goal = f; io.to(r.code).emit('captured', p.name, pid);
      }
    }
    for (const t of L.TRG || []) { const w = !r.fired[t.id] && alive.find(([, p]) => Math.hypot(p.x - mid(t.cell[0]), p.z - mid(t.cell[1])) < 3); if (!w) continue;
      r.fired[t.id] = 1; io.to(r.code).emit('ev', { id: t.id, who: w[0] });
      if (t.rush && !L.noEnemy) { const f = r.cells.filter(c => { const d = Math.hypot(mid(c[0]) - w[1].x, mid(c[1]) - w[1].z); return d > 9 && d < 15; }), g = f[rnd(f.length)] || r.cells[0]; e.x = mid(g[0]); e.z = mid(g[1]); e.goal = [cell(w[1].x), cell(w[1].z)]; e.stun = 0; } }
    if (ps.length && ps.every(([, p]) => p.cap)) { load(r, r.ch); io.to(r.code).emit('started', { ...send(r), retry: true }); continue; }
    if (r.keys.every(Boolean) && alive.some(([, p]) => Math.hypot(p.x - mid(L.EXIT[0]), p.z - mid(L.EXIT[1])) < 3)) { advance(r); continue; }
    io.to(r.code).emit('state', { p: Object.fromEntries(ps.map(([i, p]) => [i, { x: p.x, z: p.z, ry: p.ry, cap: p.cap, hid: p.hid, n: p.name, c: p.col }])), e: { x: e.x, z: e.z, c: e.chase }, k: r.keys, d: r.doors.map(d => [d.c, d.r]) });
  }
}, 100);
srv.listen(process.env.PORT || 3000, () => console.log('listening'));
