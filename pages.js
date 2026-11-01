/* Public pages for Uni Boost. Built on DB (data.js) and the shared UI (site-ui.js). */
(function () {
'use strict';
const { esc } = DB, C = DB.COLORS;
const $ = s => document.querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const qs = k => new URLSearchParams(location.search).get(k);
const pg = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
const av = (i, c) => { const k = C[(+i.color || 0) % C.length] || C[0]; return `<div class="avatar ${c || ''}" style="${i.photo ? `background-image:url('${esc(safeUrl(i.photo))}')` : `background:linear-gradient(135deg,${k[0]},${k[1]})`}">${i.photo ? '' : esc(DB.initials(i.name))}</div>`; };
const tags = i => `<div class="tags">${(i.tags || []).map(t => `<span>${esc(t)}</span>`).join('')}</div>`;
const openCount = i => DB.slots(i.id).filter(s => DB.seatsLeft(s) > 0).length;
const when = s => `${DB.fmtDate(s.date, true)} · ${DB.fmtTime(s.time)}`;
const say = m => window.say && say(m);
const empty = (el, msg) => { el.innerHTML = `<div class="empty">${msg}</div>`; };

function box(html, wide) {
  const m = document.createElement('div'); m.className = 'modal open';
  m.innerHTML = `<div class="box${wide ? ' box-wide' : ''}">${html}</div>`; document.body.appendChild(m);
  const close = () => m.remove();
  m.addEventListener('click', e => { if (e.target === m) close(); });
  return { m, b: m.firstElementChild, close };
}

/* ---------------- booking ---------------- */
const BOOK_MSG = { full: 'Sorry, this class just filled up. Please pick another time.', dup: 'This phone number is already booked in this class.', badcode: 'That promo code is not valid.', invalid: 'Please check the number of students.', missing: 'This class is no longer available.', error: 'Could not reach the server. Please try again.' };
function bookModal(s, inst, after) {
  const online = DB.isOnline(s), left = DB.seatsLeft(s), me = DB.me();
  const kinds = [['', 'Join the class · 1 seat']];
  if (online && DB.seatsTaken(s) === 0) kinds.push(['single', 'Private class · just me']);
  if (online && left >= 2) kinds.push(['group', 'Group of students']);
  const courses = DB.catalog().courses.map(c => c.name);
  const m = box(`<h3>Book your seat</h3>
    <p class="summary"><b style="color:#fff">${esc(cLabel(s))}</b> with ${esc(inst.name)}<br>${esc(when(s))} · ${esc(placeTxt(s))}</p>
    <form id="bf" style="margin-top:6px">
      <label>Your name</label><input name="name" required maxlength="80" autocomplete="name" value="${esc(me.name || '')}">
      <div class="inline"><div><label>Phone / WhatsApp</label><input name="phone" required maxlength="30" inputmode="tel" autocomplete="tel" value="${esc(me.phone || '')}"></div>
      <div><label>Email (optional)</label><input type="email" name="email" maxlength="120" value="${esc(me.email || '')}"></div></div>
      <label>University</label><input name="university" maxlength="80" value="${esc(me.university || '')}">
      <label>Subject</label><input name="subject" maxlength="120" list="bsub" value="${esc(s.course && s.course !== 'Class' ? s.course : '')}" required><datalist id="bsub">${courses.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <label>Topic or chapter (optional)</label><input name="topic" maxlength="200">
      ${kinds.length > 1 ? `<label>Booking type</label><select name="kind">${kinds.map(k => `<option value="${k[0]}">${k[1]}</option>`).join('')}</select>
      <div id="seatsw" style="display:none"><label>Number of students (2 to ${left})</label><input type="number" name="seats" min="2" max="${left}" value="2"></div>` : ''}
      <div class="pricebox" id="pb" style="margin-top:14px;display:none"></div>
      <label>Access code (6 to 10 digits)</label><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6,10}" maxlength="10" required autocomplete="new-password" value="${esc(me.pin || '')}">
      <p class="help">You will use your phone number and this code to see your classes. Keep it safe.</p>
      <label>Promo code (optional)</label><input name="promo" maxlength="30" autocomplete="off"><div class="help" id="pm"></div>
      <p class="warn" id="be" style="display:none;margin-top:12px"></p>
      <div class="actions"><button type="button" class="btn btn-ghost" id="bx">Cancel</button><button class="btn btn-primary">Confirm booking</button></div>
    </form>`);
  const f = $('#bf', m.m), pb = $('#pb', m.m), err = $('#be', m.m);
  const kind = () => (f.kind ? f.kind.value : ''), seats = () => (kind() === 'group' ? Math.max(2, Math.min(left, +f.seats.value || 2)) : 1);
  const upd = () => {
    const sw = $('#seatsw', m.m); if (sw) sw.style.display = kind() === 'group' ? 'block' : 'none';
    const q = DB.quote(f.subject.value || s.course, s, kind(), seats());
    pb.style.display = q.total == null ? 'none' : 'flex';
    pb.innerHTML = q.total == null ? '' : `<span>${kind() === 'group' && q.unit != null && q.unit * q.seats !== q.total ? 'Group total' : 'Price'}</span><b>${esc(DB.money(q.total))}</b>`;
  };
  ['change', 'input'].forEach(ev => f.addEventListener(ev, upd)); upd();
  f.promo.addEventListener('change', () => { const r = f.promo.value.trim() ? DB.validatePromo(f.promo.value) : null; $('#pm', m.m).textContent = r ? (r.ok ? 'Promo applied: ' + (r.name || '') : 'Code not recognised') : ''; });
  $('#bx', m.m).onclick = m.close;
  f.onsubmit = e => {
    e.preventDefault(); err.style.display = 'none';
    const info = { name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(), university: f.university.value.trim(), subject: f.subject.value.trim(), topic: f.topic.value.trim(), kind: kind(), seats: seats(), promo: f.promo.value.trim(), pin: f.pin.value.trim() };
    if (DB.normPhone(info.phone).length < 7) { err.textContent = 'Please enter a valid phone number.'; err.style.display = 'block'; return; }
    if (!/^[0-9]{6,10}$/.test(info.pin)) { err.textContent = DB.authMsg('weakpin'); err.style.display = 'block'; return; }
    const btn = f.querySelector('.btn-primary'); btn.disabled = true;
    const r = DB.book(s.id, info);
    if (r !== 'ok') { btn.disabled = false; err.textContent = BOOK_MSG[r] || DB.authMsg(r); err.style.display = 'block'; return; }
    DB.setMe({ ...me, name: info.name, phone: info.phone, email: info.email, university: info.university, pin: info.pin });
    const q = DB.quote(info.subject || s.course, s, info.kind, info.seats), total = q.total || 0;
    const fin = () => { m.close(); DB.refresh(); after && after(); };
    if (total > 0) {
      m.b.innerHTML = `<h3>Seat reserved ✓</h3><p class="summary">${esc(cLabel(s))} · ${esc(when(s))}</p><div id="pf" style="margin-top:6px"></div><div class="actions"><button class="btn btn-ghost" id="pl">Pay later in My Classes</button></div>`;
      $('#pl', m.m).onclick = () => { fin(); say('Booked. Pay from My Classes'); };
      payForm($('#pf', m.m), s.id, info.phone, () => { fin(); say('Payment sent for confirmation'); }, total, { kind: q.kind, seats: q.seats, unit: q.unit });
    } else {
      m.b.innerHTML = `<h3>You are booked ✓</h3><p class="summary">${esc(cLabel(s))} · ${esc(when(s))}<br>Open <a href="my-classes.html" style="color:var(--accent2)">My Classes</a> with your phone number and access code to see the link and materials.</p><div class="actions"><button class="btn btn-primary" id="bd">Done</button></div>`;
      $('#bd', m.m).onclick = fin;
    }
  };
}

const P = {};

/* ---------------- home ---------------- */
P.index = () => {
  const cv = $('#hero-canvas');
  if (cv) {
    const x = cv.getContext('2d'), N = []; let W, H;
    const rs = () => { W = cv.width = cv.clientWidth; H = cv.height = cv.clientHeight; }; rs(); addEventListener('resize', rs);
    for (let i = 0; i < 46; i++) N.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - .5) * .0007, vy: (Math.random() - .5) * .0007 });
    const still = matchMedia('(prefers-reduced-motion:reduce)').matches;
    (function f() {
      x.clearRect(0, 0, W, H);
      if (!still) N.forEach(a => { a.x = (a.x + a.vx + 1) % 1; a.y = (a.y + a.vy + 1) % 1; });
      for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
        const dx = (N[i].x - N[j].x) * W, dy = (N[i].y - N[j].y) * H, d = Math.hypot(dx, dy);
        if (d < 110) { x.strokeStyle = 'rgba(96,165,250,' + (1 - d / 110) * .45 + ')'; x.beginPath(); x.moveTo(N[i].x * W, N[i].y * H); x.lineTo(N[j].x * W, N[j].y * H); x.stroke(); }
      }
      N.forEach(a => { x.fillStyle = '#60a5fa'; x.beginPath(); x.arc(a.x * W, a.y * H, 2.5, 0, 7); x.fill(); });
      if (!still) requestAnimationFrame(f);
    })();
  }
  $$('[data-count]').forEach(b => {
    const t = +b.dataset.count, sfx = b.dataset.suffix || '', cm = b.dataset.comma; let st = null;
    const step = ts => { st = st || ts; const p = Math.min((ts - st) / 1200, 1), v = Math.round(t * p); b.textContent = (cm ? v.toLocaleString('en-US') : v) + (p === 1 ? sfx : ''); if (p < 1) requestAnimationFrame(step); };
    new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { o.disconnect(); requestAnimationFrame(step); } }).observe(b);
  });
  const t = $('#tree-svg');
  if (t) {
    const pts = [[240, 50], [140, 130], [340, 130], [90, 220], [190, 220], [290, 220], [390, 220]], ed = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
    t.innerHTML = '<rect width="480" height="300" fill="#070d19"/>' + ed.map(e => `<line x1="${pts[e[0]][0]}" y1="${pts[e[0]][1]}" x2="${pts[e[1]][0]}" y2="${pts[e[1]][1]}" stroke="#3b82f6" stroke-width="3"/>`).join('') + pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="22" fill="${i ? '#1e3a8a' : '#2563eb'}" stroke="#60a5fa" stroke-width="3"/>`).join('');
  }
  const b = $('#bars-svg');
  if (b) b.innerHTML = '<rect width="480" height="300" fill="#0f1b30"/>' + [90, 140, 110, 180, 150, 220, 250].map((h, i) => `<rect x="${50 + i * 58}" y="${270 - h}" width="38" height="${h}" rx="6" fill="${i === 6 ? '#60a5fa' : '#2563eb'}"/>`).join('');
  const cat = DB.catalog(), top = cat.cats.filter(c => !c.parent), el = $('#home-cats');
  el.innerHTML = top.map(c => {
    const ids = new Set([c.id, ...cat.cats.filter(k => k.parent === c.id).map(k => k.id)]), n = cat.courses.filter(x => ids.has(x.catId)).length;
    return `<a class="cat" href="courses.html?cat=${encodeURIComponent(c.id)}"><div class="ic">${esc(c.ic || c.name[0])}</div><h3>${esc(c.name)}</h3><p>${esc(c.desc || '')}</p><small>${n} course${n === 1 ? '' : 's'}</small><span class="more">Explore ›</span></a>`;
  }).join('') || '<div class="empty" style="grid-column:1/-1">Courses will appear here soon.</div>';
};

/* ---------------- instructors ---------------- */
P.instructors = () => {
  const g = $('#grid'), all = DB.instructors().sort((a, b) => a.name.localeCompare(b.name)); let tag = 'All', q = '';
  const draw = () => {
    const l = all.filter(i => (tag === 'All' || (i.tags || []).includes(tag)) && (i.name + ' ' + (i.title || '') + ' ' + (i.university || '') + ' ' + (i.tags || []).join(' ')).toLowerCase().includes(q));
    g.innerHTML = l.map(i => { const n = openCount(i); return `<a class="inst" href="instructor.html?id=${encodeURIComponent(i.id)}">${av(i)}<h3>${esc(i.name)}</h3><p class="role">${esc(i.title || '')}</p><p class="uni">${esc(i.university || '')}</p>${tags(i)}<span class="avail${n ? '' : ' none'}">${n ? n + ' open class' + (n > 1 ? 'es' : '') : 'No open classes yet'}</span></a>`; }).join('') || '<div class="empty">No instructors match your search.</div>';
  };
  const all_t = ['All']; all.forEach(i => (i.tags || []).forEach(t => all_t.includes(t) || all_t.push(t)));
  const f = $('#filters'); f.innerHTML = all_t.map(t => `<button type="button" class="fchip${t === 'All' ? ' on' : ''}">${esc(t)}</button>`).join('');
  $$('.fchip', f).forEach(b => b.onclick = () => { tag = b.textContent; $$('.fchip', f).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#q').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
  draw();
};

/* ---------------- one instructor ---------------- */
P.instructor = () => {
  const m = $('#main'), id = qs('id'), i = DB.instructor(id);
  if (!i) { m.innerHTML = '<div class="empty" style="margin:60px 0">Instructor not found. <a href="instructors.html" style="color:var(--accent2)">See all instructors</a>.</div>'; return; }
  document.title = i.name + ' · Uni Boost';
  const want = qs('slot'); let sel = null;
  const days = () => { const g = {}; DB.slots(id).forEach(s => (g[s.date] = g[s.date] || []).push(s)); return g; };
  m.innerHTML = `<section class="page-hero"><p class="crumbs"><a href="index.html">Home</a> / <a href="instructors.html">Instructors</a> / ${esc(i.name)}</p>
    <div class="profile">${av(i, 'lg')}<div><h1>${esc(i.name)}</h1><p class="role">${esc([i.title, i.university].filter(Boolean).join(' · '))}</p></div></div>
    <p class="bio sub" style="max-width:640px">${esc(i.bio || '')}</p>${tags(i)}</section>
    <div class="panel"><h2>Book a class</h2><p class="sub" style="margin:0">Pick a date, then a time.</p><div class="dates" id="dates"></div><div class="slots" id="slots"></div>
    <div class="reqbar" id="reqbar"><span>No time that works for you?</span><button class="btn btn-primary" type="button">Request a class</button></div></div>`;
  $('#reqbar button').onclick = () => requestForm('class', { inst: i.name, instId: i.id });
  const draw = () => {
    const g = days(), keys = Object.keys(g).sort();
    if (!sel || !g[sel]) sel = keys[0];
    $('#dates').innerHTML = keys.map(k => { const d = new Date(k + 'T00:00:00'), free = g[k].filter(s => DB.seatsLeft(s) > 0).length;
      return `<button type="button" class="dpill${k === sel ? ' on' : ''}" data-k="${k}"><small>${d.toLocaleDateString('en-GB', { weekday: 'short' })}</small><b>${d.getDate()}</b><small>${d.toLocaleDateString('en-GB', { month: 'short' })}</small><em>${free} open</em></button>`; }).join('') || '<div class="empty" style="width:100%">No open classes right now. Send a request and we will arrange one.</div>';
    $$('.dpill').forEach(b => b.onclick = () => { sel = b.dataset.k; draw(); });
    const box_ = $('#slots'); box_.innerHTML = '';
    (g[sel] || []).forEach(s => {
      const left = DB.seatsLeft(s), mine = DB.hasBooked(s), b = document.createElement('button'); b.type = 'button'; b.className = 'slot'; b.disabled = left <= 0 || mine;
      b.innerHTML = `<b>${esc(DB.fmtTime(s.time))}</b><small>${esc(cLabel(s))} · ${esc(placeTxt(s))}<br>${mine ? 'You are booked ✓' : left > 0 ? left + ' seat' + (left > 1 ? 's' : '') + ' left' : 'Full'}</small>`;
      b.onclick = () => bookModal(s, i, draw); box_.appendChild(b);
    });
  };
  const ws = want && DB.slot(want); if (ws && ws.instId === id) sel = ws.date;
  draw();
  if (ws && ws.instId === id && DB.seatsLeft(ws) > 0 && !DB.hasBooked(ws)) bookModal(ws, i, draw);
};

/* ---------------- schedule ---------------- */
P.schedule = () => {
  const L = $('#list'), sel = $('#inst');
  DB.instructors().sort((a, b) => a.name.localeCompare(b.name)).forEach(i => sel.insertAdjacentHTML('beforeend', `<option value="${esc(i.id)}">${esc(i.name)}</option>`));
  const pre = qs('inst'); if (pre) sel.value = pre;
  const draw = () => {
    const g = {}; DB.slots().filter(s => (!sel.value || s.instId === sel.value) && (!$('#onlyFree').checked || DB.seatsLeft(s) > 0)).forEach(s => (g[s.date] = g[s.date] || []).push(s));
    L.innerHTML = Object.keys(g).sort().map(k => `<div class="day-block"><h3>${esc(DB.fmtDate(k, true))}</h3>${g[k].map(s => { const i = DB.instructor(s.instId) || { name: '' }, left = DB.seatsLeft(s);
      return `<div class="row-slot"><span class="t">${esc(DB.fmtTime(s.time))}</span><span class="who"><b>${esc(cLabel(s))}</b> with ${esc(i.name)} · ${esc(placeTxt(s))}</span><span class="badge ${left > 0 ? 'free' : 'taken'}">${left > 0 ? left + ' seat' + (left > 1 ? 's' : '') + ' left' : 'Full'}</span><a class="btn btn-primary btn-sm" href="instructor.html?id=${encodeURIComponent(s.instId)}&slot=${encodeURIComponent(s.id)}">View &amp; book</a></div>`; }).join('')}</div>`).join('') || '<div class="empty">No classes match. Try turning off the open-seats filter.</div>';
  };
  sel.onchange = draw; $('#onlyFree').onchange = draw; draw();
};

/* ---------------- courses ---------------- */
P.courses = () => {
  const { cats, courses } = DB.catalog(), v = $('#view'), crumbs = $('#crumbs'), h1 = $('#h1'), sub = $('#sub');
  const byId = id => cats.find(c => c.id === id), kids = id => cats.filter(c => c.parent === id);
  const ids = id => new Set([id, ...kids(id).map(k => k.id)]);
  const cardCat = c => { const n = courses.filter(x => ids(c.id).has(x.catId)).length;
    return `<a class="cat" href="courses.html?cat=${encodeURIComponent(c.id)}"><div class="ic">${esc(c.ic || c.name[0])}</div><h3>${esc(c.name)}</h3><p>${esc(c.desc || '')}</p><small>${n} course${n === 1 ? '' : 's'}</small><span class="more">Explore ›</span></a>`; };
  const cardCourse = c => { const p = DB.priceOf(c.name);
    return `<a class="course" href="courses.html?cat=${encodeURIComponent(c.catId)}&course=${encodeURIComponent(c.id)}"><h3>${esc(c.name)}</h3><div class="meta">${c.mods ? c.mods + ' modules' : ''}${c.mods && c.wks ? ' · ' : ''}${c.wks ? c.wks + ' weeks' : ''}</div>${p != null ? `<span class="price">${esc(DB.money(p))}<small>per class</small></span>` : ''}<p>${esc(c.desc || '')}</p><span class="more">See instructors ›</span></a>`; };
  const cid = qs('cat'), kid = qs('course'), c = kid && DB.courseById(kid), cat = cid && byId(cid);
  const trail = x => (x ? (x.parent && byId(x.parent) ? trail(byId(x.parent)) : '') + ` / <a href="courses.html?cat=${encodeURIComponent(x.id)}">${esc(x.name)}</a>` : '');
  if (c) {
    document.title = c.name + ' · Uni Boost';
    const cc = byId(c.catId); crumbs.innerHTML = '<a href="index.html">Home</a> / <a href="courses.html">Courses</a>' + trail(cc) + ' / ' + esc(c.name);
    h1.textContent = c.name; sub.textContent = c.desc || '';
    const t = DB.priceInfo(c.name), ins = DB.instructorsFor(c);
    const rows = t ? [['Standard', t.base], ['Private (online)', t.single], ['Group of 2 to 4', t.g24], ['Group of 5+', t.g5]].filter(r => r[1] != null) : [];
    v.innerHTML = (rows.length ? `<div class="panel" style="margin-top:10px"><h2>Pricing</h2>${rows.map(r => `<div class="pricebox" style="margin-top:10px"><span>${r[0]}</span><b>${esc(DB.money(r[1]))}</b></div>`).join('')}</div>` : '') +
      `<h2 style="margin:34px 0 0;font-size:1.5rem">Instructors for this course</h2><div class="inst-grid">${ins.map(i => { const n = DB.slots(i.id).filter(s => DB.courseMatch(c, s.course) && DB.seatsLeft(s) > 0).length;
        return `<a class="inst" href="instructor.html?id=${encodeURIComponent(i.id)}">${av(i)}<h3>${esc(i.name)}</h3><p class="role">${esc(i.title || '')}</p><p class="uni">${esc(i.university || '')}</p><span class="avail${n ? '' : ' none'}" style="display:block;margin-top:14px">${n ? n + ' open class' + (n > 1 ? 'es' : '') + ' for this course' : 'See all times'}</span></a>`; }).join('') || '<div class="empty">No instructor is assigned yet. Send a request and we will find you one.</div>'}</div>`;
  } else if (cat) {
    document.title = cat.name + ' · Uni Boost';
    crumbs.innerHTML = '<a href="index.html">Home</a> / <a href="courses.html">Courses</a>' + trail(cat).replace(/ \/ <a[^>]*>[^<]*<\/a>$/, ' / ' + esc(cat.name));
    h1.textContent = cat.name; sub.textContent = cat.desc || 'Choose a course to see its instructors and times.';
    const own = courses.filter(x => x.catId === cat.id), sc = kids(cat.id);
    v.innerHTML = (sc.length ? `<div class="cats">${sc.map(cardCat).join('')}</div>` : '') + (own.length ? `<div class="courses" style="${sc.length ? 'margin-top:40px' : ''}">${own.map(cardCourse).join('')}</div>` : '') || '';
    if (!sc.length && !own.length) empty(v, 'No courses here yet.');
  } else {
    crumbs.innerHTML = '<a href="index.html">Home</a> / Courses'; h1.innerHTML = 'Course <span class="accent">catalog</span>'; sub.textContent = 'Choose a subject area to see the courses you can book.';
    const top = cats.filter(x => !x.parent); v.innerHTML = top.length ? `<div class="cats">${top.map(cardCat).join('')}</div>` : '<div class="empty">Courses will appear here soon.</div>';
  }
};

/* ---------------- student lookup (My Classes + Recordings) ---------------- */
const payState = b => { const s = b && b.pay ? b.pay.status : 'paid'; return s === 'paid' ? 'paid' : s === 'pending' ? 'pending' : 'unpaid'; };
const mineOf = (s, phone) => s.mine || s.my || s.booking || (s.bookings || []).find(b => b && b.phone !== undefined && DB.normPhone(b.phone) === DB.normPhone(phone)) || (s.bookings || [])[0] || {};
function lookup(L, render) {
  const f = $('#lf'), me = DB.me(); $('#phone').value = me.phone || ''; $('#pin').value = me.pin || '';
  const go = () => {
    const phone = $('#phone').value.trim(), pin = $('#pin').value.trim();
    DB.setMe({ ...DB.me(), phone, pin }); L.innerHTML = '<div class="empty">Loading…</div>';
    DB.refresh(); const rows = DB.myClasses(phone);
    if (DB.authErr) return empty(L, esc(DB.authMsg(DB.authErr)));
    if (!rows.length) return empty(L, 'No bookings found for this phone number.');
    render(rows, phone);
  };
  f.onsubmit = e => { e.preventDefault(); go(); };
  if (me.phone && me.pin) go(); else empty(L, 'Enter your phone number and access code to continue.');
  return go;
}
async function fileUrl(id) { return DB.files.url(id) || URL.createObjectURL(await DB.files.get(id)); }
async function watch(s) {
  const r = s.rec; if (!r) return; $('#vtitle').textContent = cLabel(s) + ' · ' + DB.fmtDate(s.date); const body = $('#vbody'); body.innerHTML = '<p class="help">Loading…</p>'; $('#vmodal').classList.add('open');
  try {
    const u = r.kind === 'file' ? await fileUrl(r.fileId) : safeUrl(r.url);
    if (r.kind === 'file' || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(r.url || '')) { body.innerHTML = '<video class="player" controls controlslist="nodownload"></video>'; $('video', body).src = u; }
    else body.innerHTML = `<a class="btn btn-primary" target="_blank" rel="noopener noreferrer" href="${esc(u)}">Open recording ↗</a>`;
  } catch (e) { body.innerHTML = '<div class="warn">Could not load this recording.</div>'; }
}
const closeVideo = () => { const c = $('#vclose'); c && (c.onclick = () => { $('#vmodal').classList.remove('open'); $('#vbody').innerHTML = ''; }); };
async function download(id, name) { try { const u = await fileUrl(id), a = document.createElement('a'); a.href = u; a.download = name || 'file'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { say('Could not open the file'); } }

P['my-classes'] = () => {
  const L = $('#list'); let rows = [], phone = '', tab = 'up', go;
  closeVideo();
  const draw = () => {
    const now = new Date(), l = rows.filter(s => (DB.cls(s, now).phase === 'ended') === (tab === 'past'));
    L.innerHTML = l.map(s => {
      const c = DB.cls(s, now), b = mineOf(s, phone), ps = payState(b), inst = DB.instructor(s.instId) || { name: '' }, online = DB.isOnline(s), ri = DB.recInfo(s, now);
      let link;
      if (ps !== 'paid') link = '<p>The class link unlocks once your payment is confirmed.</p>';
      else if (!online) link = `<p>${placeHtml(s, true)}</p>`;
      else if (c.linkOpen) link = `<a class="btn btn-primary join" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(s.link))}">Join live class</a>`;
      else if (c.linkWait) link = '<p>The link is about to appear. Refresh in a moment.</p>';
      else if (c.linkPending || !(s.link || s.hasLink)) link = `<p>The link appears ${c.lead} minutes before the class starts${c.phase === 'upcoming' ? ' (in ' + esc(DB.human(c.linkAt - now)) + ')' : ''}.</p>`;
      else link = '<p>The class link has closed.</p>';
      const pay = ps === 'paid' ? `<p class="cd" style="font-size:1.1rem">${b.price ? esc(DB.money(b.price)) + ' · ' : ''}Confirmed ✓</p>` : ps === 'pending' ? '<p>Your payment is being reviewed. Access opens once it is confirmed.</p>' : `<p class="cd">${esc(DB.money(b.price))}</p><button class="btn btn-primary btn-sm" data-pay="${esc(s.id)}">Pay now</button>`;
      const mats = (s.materials || []).map(m => m.kind === 'url' ? `<div class="mat"><span>${esc(m.name)}</span><a href="${esc(safeUrl(m.url))}" target="_blank" rel="noopener noreferrer">Open</a></div>` : `<div class="mat"><span>${esc(m.name)}</span><button data-dl="${esc(m.fileId)}" data-n="${esc(m.name)}">Download</button></div>`).join('');
      const rec = !s.rec ? '' : ps !== 'paid' ? '<p class="help">Recording unlocks after payment.</p>' : ri && ri.visible ? `<div class="mat"><span>Class recording</span><button data-w="${esc(s.id)}">Watch</button></div><p class="help">Available until ${esc(DB.fmtDT(ri.until))}</p>` : ri && ri.expired ? '<p class="help">The recording has expired.</p>' : '';
      const st = c.phase === 'ended' ? ['s-end', 'Ended'] : ps !== 'paid' ? ['s-warn', ps === 'pending' ? 'Payment under review' : 'Awaiting payment'] : c.phase === 'live' ? ['s-live', 'Live now'] : ['s-up', 'Upcoming'];
      return `<div class="cc${c.phase === 'ended' ? ' ended' : ''}"><div class="cc-head"><div><h3>${esc(cLabel(s))}</h3><p class="meta">with ${esc(inst.name)} · ${esc(when(s))} · ${esc(placeTxt(s))}${b.kind === 'group' ? ' · group of ' + (+b.seats || 2) : b.kind === 'single' ? ' · private' : ''}</p></div><span class="status ${st[0]}">${st[1]}</span></div>
        <div class="cc-grid"><div class="cc-box"><h4>Class link</h4>${link}</div><div class="cc-box"><h4>Payment</h4>${pay}</div><div class="cc-box"><h4>Materials</h4>${mats || '<p>No materials yet.</p>'}${rec}</div></div>
        ${c.phase === 'upcoming' ? `<div class="actions" style="margin-top:16px"><button class="btn btn-danger btn-sm" data-c="${esc(s.id)}" style="flex:0 0 auto">Cancel booking</button></div>` : ''}</div>`;
    }).join('') || `<div class="empty">${tab === 'up' ? 'No upcoming classes. <a href="schedule.html" style="color:var(--accent2)">Book one</a>.' : 'No past classes.'}</div>`;
    $$('[data-w]', L).forEach(b => b.onclick = () => watch(rows.find(x => x.id === b.dataset.w)));
    $$('[data-dl]', L).forEach(b => b.onclick = () => download(b.dataset.dl, b.dataset.n));
    $$('[data-c]', L).forEach(b => b.onclick = () => { if (confirm('Cancel this booking?')) { DB.cancelBooking(b.dataset.c, phone); say('Booking cancelled'); go(); } });
    $$('[data-pay]', L).forEach(b => b.onclick = () => { const s = rows.find(x => x.id === b.dataset.pay), bk = mineOf(s, phone);
      const m = box('<h3>Complete your payment</h3><div id="pf" style="margin-top:12px"></div>');
      payForm($('#pf', m.m), s.id, phone, () => { m.close(); say('Payment sent for confirmation'); go(); }, bk.price, bk); });
  };
  $$('.tab').forEach(b => b.onclick = () => { tab = b.dataset.t; $$('.tab').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  go = lookup(L, (r, p) => { rows = r; phone = p; draw(); });
};

P.recordings = () => {
  const L = $('#list'); let rows = [], phone = '', cat = 'All', go; closeVideo();
  const { cats, courses } = DB.catalog(), byId = id => cats.find(c => c.id === id);
  const draw = () => {
    const now = new Date(), items = rows.filter(s => s.rec).map(s => {
      const c = courses.find(x => DB.courseMatch(x, s.course)), k = c && byId(c.catId), top = k && k.parent ? byId(k.parent) : k;
      return { s, top: top ? top.name : 'Other', sub: k && k.parent ? k.name : '', course: c ? c.name : cLabel(s), ic: top ? (top.ic || top.name[0]) : '•' };
    }).sort((a, b) => (b.s.date + b.s.time).localeCompare(a.s.date + a.s.time));
    const names = ['All', ...new Set(items.map(x => x.top))];
    $('#filter').innerHTML = items.length ? names.map(n => `<button type="button" class="tab${n === cat ? ' on' : ''}">${esc(n)}<small>${n === 'All' ? items.length : items.filter(x => x.top === n).length}</small></button>`).join('') : '';
    $$('#filter .tab').forEach((b, i) => b.onclick = () => { cat = names[i]; draw(); });
    const g = {}; items.filter(x => cat === 'All' || x.top === cat).forEach(x => (((g[x.top] = g[x.top] || { ic: x.ic, subs: {} }).subs[x.sub] = g[x.top].subs[x.sub] || {})[x.course] = g[x.top].subs[x.sub][x.course] || []).push(x));
    L.innerHTML = Object.keys(g).map(t => `<div class="rec-cat"><div class="rec-cat-h"><div class="ic">${esc(g[t].ic)}</div><div><h2>${esc(t)}</h2></div></div>${Object.keys(g[t].subs).map(sb => `${sb ? `<div class="rec-sub">${esc(sb)}</div>` : ''}${Object.keys(g[t].subs[sb]).map(cn => { const list = g[t].subs[sb][cn];
      return `<div class="rec-course"><h3>${esc(cn)}<small>${list.length} recording${list.length > 1 ? 's' : ''}</small></h3>${list.map(x => { const s = x.s, ri = DB.recInfo(s, now), ps = payState(mineOf(s, phone)), inst = DB.instructor(s.instId) || { name: '' };
        const act = ps !== 'paid' ? `<span class="lock${ps === 'pending' ? ' wait' : ''}">${ps === 'pending' ? 'Payment under review' : 'Unlocks after payment'}</span>` : ri && ri.visible ? `<button class="btn btn-primary btn-sm" data-w="${esc(s.id)}">Watch</button>` : ri && ri.expired ? '<span class="lock">Expired</span>' : '<span class="lock wait">Not available yet</span>';
        return `<div class="rec-row"><div><div class="t">${esc(DB.fmtDate(s.date, true))} · ${esc(DB.fmtTime(s.time))}</div><div class="m">${esc(inst.name)}${ri && ri.visible ? ' · <span class="left">available until ' + esc(DB.fmtDT(ri.until)) + '</span>' : ''}</div></div>${act}</div>`; }).join('')}</div>`; }).join('')}`).join('')}</div>`).join('') || '<div class="empty">No recordings for your classes yet.</div>';
    $$('[data-w]', L).forEach(b => b.onclick = () => watch(rows.find(x => x.id === b.dataset.w)));
  };
  go = lookup(L, (r, p) => { rows = r; phone = p; draw(); });
};

if (P[pg]) P[pg]();
})();
