/* Uni Boost – data layer v2.
   Data lives in localStorage; uploaded files live in IndexedDB (this browser only). */
(function () {
  const KEY = 'ucc_db_v2', OLD = 'ucc_db_v1', ROLE = 'ucc_role', ME = 'ucc_me';
  const MIN = 60000, HOUR = 3600000;
  /* Remote mode = Supabase (see config.js). Without it the site runs fully in this browser (demo mode). */
  const CFG = window.UCC_CONFIG || {};
  const REMOTE = !!(CFG.url && CFG.key);
  const TOK = 'ucc_tok';
  const SBURL = () => String(CFG.url || '').replace(/\/$/, '');
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const uid = p => p + Math.random().toString(36).slice(2, 9);
  const DEF = { leadMin: 30, durMin: 90, recHours: 72, currency: 'EGP', instapayId: '', instapayName: '', instapayLink: '', payNote: '', promoPoints: 10 };

  const COLORS = [
    ['#2563eb', '#1d4ed8'], ['#0ea5e9', '#0369a1'], ['#14b8a6', '#0f766e'], ['#6366f1', '#4338ca'],
    ['#8b5cf6', '#6d28d9'], ['#0891b2', '#155e75'], ['#3b82f6', '#1e40af'], ['#64748b', '#334155']
  ];

  const newSlot = o => ({
    id: uid('s'), mode: 'Online', course: 'Class', cap: 10, dur: null, link: '', leadMin: null,
    bookings: [], materials: [], rec: null, ...o
  });

  function defaultCatalog() {
    const C = (id, catId, name, mods, wks, desc, tag, price) => (typeof tag === 'number' ? { id, catId, name, mods, wks, desc, tag: name, price: tag } : { id, catId, name, mods, wks, desc, tag: tag || name, price: price == null ? null : price });
    return {
      cats: [
        { id: 'cs', name: 'Computer Science', ic: '</>', desc: 'Algorithms, AI, data and software.', parent: '' },
        { id: 'biz', name: 'Business', ic: '$', desc: 'Management, finance and marketing.', parent: '' },
        { id: 'eng', name: 'Engineering', ic: '⚙', desc: 'Mechatronics, Civil and Basic Sciences.', parent: '' },
        { id: 'mech', name: 'Mechatronics', ic: 'M', desc: 'Mechanical, electrical and control systems working together.', parent: 'eng' },
        { id: 'civil', name: 'Civil', ic: 'C', desc: 'Structures, materials and infrastructure.', parent: 'eng' },
        { id: 'sci', name: 'Basic Sciences', ic: 'B', desc: 'The math and science foundation for every engineering year.', parent: 'eng' }
      ],
      courses: [
        C('c1', 'cs', 'Computer Science Fundamentals', 12, 8, 'Algorithms, data structures and software engineering principles with interactive virtual labs.', 'Computer Science', 600),
        C('c2', 'cs', 'Algorithms', 10, 6, 'Complexity, sorting, graphs and dynamic programming with exam-style practice.', 450),
        C('c3', 'cs', 'Artificial Intelligence', 10, 8, 'Search, reasoning and modern AI building blocks explained from first principles.', 'AI', 700),
        C('c4', 'cs', 'Machine Learning', 12, 8, 'From linear models to deep learning, with hands-on notebooks.', 800),
        C('c5', 'cs', 'Data Science', 10, 8, 'Data analysis and visualization for real portfolio projects.', 700),
        C('c6', 'cs', 'Cloud Computing', 8, 6, 'Cloud fundamentals and data pipelines.', 'Cloud', 500),
        C('c7', 'cs', 'Mobile Development', 10, 8, 'Build and ship Android, iOS and Flutter apps.', 'Flutter', 650),
        C('c8', 'biz', 'Business Administration MBA', 15, 12, 'Finance, strategy and leadership for the Egyptian market.', 'MBA', 1500),
        C('c9', 'biz', 'Finance', 10, 8, 'Corporate finance, valuation and financial statements.', 600),
        C('c10', 'biz', 'Digital Marketing', 10, 6, 'Campaign planning, social analytics and growth strategy.', 450),
        C('c11', 'biz', 'SEO', 8, 4, 'Modern search optimization strategies and measurement.', 300),
        C('c12', 'biz', 'Accounting Principles', 9, 6, 'Bookkeeping to financial reporting, step by step.', 400),
        C('c13', 'biz', 'Entrepreneurship', 8, 6, 'Validate an idea, build a model and pitch it.', 350),
        C('c14', 'mech', 'Heat Transfer', 10, 6, 'Conduction, convection and radiation with worked examples and exam-style problems.', 350),
        C('c15', 'mech', 'Thermodynamics', 10, 6, 'Laws of thermodynamics, cycles and energy analysis.', 350),
        C('c16', 'mech', 'Fluid Mechanics', 10, 6, 'Fluid statics, flow equations and pipe systems.', 350),
        C('c17', 'mech', 'Control Systems', 12, 8, 'Transfer functions, stability and PID design.', 500),
        C('c18', 'mech', 'Robotics', 10, 8, 'Kinematics, sensors and motion planning basics.', 550),
        C('c19', 'mech', 'Embedded Systems', 10, 8, 'Microcontrollers, interfacing and real-time programming.', 550),
        C('c20', 'civil', 'Structural Analysis', 12, 8, 'Beams, trusses and frames: forces, deflections and design checks.', 450),
        C('c21', 'civil', 'Reinforced Concrete Design', 10, 8, 'Design of beams, slabs and columns to code.', 450),
        C('c22', 'civil', 'Surveying', 8, 6, 'Levelling, angles and coordinates for site work.', 300),
        C('c23', 'civil', 'Soil Mechanics', 9, 6, 'Soil properties, compaction and foundations.', 350),
        C('c24', 'civil', 'Highway Engineering', 8, 6, 'Road geometry, pavement and traffic basics.', 300),
        C('c25', 'sci', 'Calculus', 12, 8, 'Limits, derivatives, integrals and series.', 300),
        C('c26', 'sci', 'Linear Algebra', 10, 6, 'Matrices, vector spaces and eigenvalues.', 300),
        C('c27', 'sci', 'Physics', 12, 8, 'Mechanics, waves, electricity and magnetism.', 350),
        C('c28', 'sci', 'Chemistry', 10, 6, 'General chemistry for engineering students.', 300),
        C('c29', 'sci', 'Differential Equations', 10, 6, 'Solving ODEs and applications.', 300),
        C('c30', 'sci', 'Probability & Statistics', 8, 6, 'Distributions, estimation and hypothesis tests.', 250)
      ]
    };
  }

  function seed() {
    const people = [
      ['Dr. Ahmed Hassan', 'Professor of Computer Science', 'Cairo University', 'Algorithms, data structures and software engineering with interactive virtual labs. 15 years of teaching and research experience.', ['Computer Science', 'Algorithms']],
      ['Dr. Mona El-Sayed', 'Digital Marketing Lecturer', 'AUC', 'SEO, social analytics and growth strategy taught through real campaigns from Cairo\'s tech scene.', ['Digital Marketing', 'SEO']],
      ['Dr. Karim Fouad', 'Associate Professor of Business', 'GUC', 'Finance, strategy and leadership for the Egyptian market. Former consultant for regional banks.', ['MBA', 'Finance']],
      ['Dr. Salma Nabil', 'AI & Machine Learning Researcher', 'Zewail City', 'Practical machine learning, from linear models to deep learning, with hands-on notebooks.', ['AI', 'Machine Learning']],
      ['Dr. Omar Khaled', 'Mobile Development Instructor', 'Ain Shams University', 'iOS, Android and Flutter. Ships production apps and teaches how to do the same.', ['iOS', 'Android', 'Flutter']],
      ['Dr. Hana Mostafa', 'Data Science Lecturer', 'British University in Egypt', 'Data analysis, visualization and cloud pipelines for students who want real portfolio projects.', ['Data Science', 'Cloud']],
      ['Dr. Youssef Adel', 'Professor of Mechanical Engineering', 'Cairo University', 'Heat transfer, thermodynamics and fluid mechanics explained with worked examples and exam-style problems.', ['Heat Transfer', 'Thermodynamics', 'Fluid Mechanics']]
    ];
    const instructors = people.map((p, i) => ({
      id: 'i' + (i + 1), name: p[0], title: p[1], university: p[2], bio: p[3], tags: p[4],
      color: i % COLORS.length, photo: '', pin: String(1111 * (i + 1)).slice(0, 4)
    }));
    const times = ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
    const slots = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    instructors.forEach((ins, k) => {
      for (let d = 0; d <= 21; d++) {
        const day = new Date(today); day.setDate(day.getDate() + d);
        if ((d + k) % 3 === 2) continue;
        const n = 2 + ((d + k) % 3);
        for (let j = 0; j < n; j++) {
          slots.push(newSlot({
            instId: ins.id, date: iso(day), time: times[(j * 2 + k + d) % times.length],
            mode: (j + d) % 2 ? 'Online' : 'Giza campus',
            course: ins.tags[(j + d) % ins.tags.length], cap: 8
          }));
        }
      }
    });
    const seen = new Set();
    const uniq = slots.filter(s => { const q = s.instId + s.date + s.time; if (seen.has(q)) return false; seen.add(q); return true; });
    return { password: '', settings: { ...DEF }, instructors, slots: uniq, catalog: defaultCatalog() };
  }

  function migrate(txt) {
    const o = JSON.parse(txt);
    const ins = o.instructors.map((i, k) => ({ pin: String(1111 * ((k % 9) + 1)).slice(0, 4), ...i }));
    return {
      password: o.password || '', settings: { ...DEF }, instructors: ins,
      slots: o.slots.map(s => {
        const i = ins.find(x => x.id === s.instId) || { tags: [] };
        return newSlot({ id: s.id, instId: s.instId, date: s.date, time: s.time, mode: s.mode || 'Online',
          course: (i.tags || [])[0] || 'Class', bookings: s.booked ? [s.booked] : [] });
      })
    };
  }

  let db, loadError = null, loginProblem = '';
  function save() { if (REMOTE) return; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { alert('Could not save (storage full or blocked).'); } }
  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || !db.instructors) {
      try { const old = localStorage.getItem(OLD); db = old ? migrate(old) : seed(); } catch (e) { db = seed(); }
      save();
    }
    db.settings = { ...DEF, ...(db.settings || {}) };
    if (!db.requests) db.requests = [];
    if (!db.catalog) { db.catalog = defaultCatalog(); save(); }
    else if (db.catalog.courses.some(c => c.price === undefined)) {   // older data: add starter prices
      const dflt = defaultCatalog().courses;
      db.catalog.courses.forEach(c => { if (c.price === undefined) { const d = dflt.find(x => x.id === c.id); c.price = d ? d.price : null; } });
      save();
    }
  }
  /* ---------- remote engine (Supabase REST + Auth + Storage) ---------- */
  function xhr(method, path, body, token) {            // synchronous on purpose: keeps the page code simple
    const x = new XMLHttpRequest();
    x.open(method, SBURL() + path, false);
    x.setRequestHeader('apikey', CFG.key);
    if (token) x.setRequestHeader('Authorization', 'Bearer ' + token);
    x.setRequestHeader('Content-Type', 'application/json');
    x.send(body == null ? null : JSON.stringify(body));
    let j = null; try { j = x.responseText ? JSON.parse(x.responseText) : null; } catch (e) { j = x.responseText; }
    if (x.status < 200 || x.status >= 300) {
      const err = new Error((j && (j.message || j.msg || j.error_description || j.error)) || ('HTTP ' + x.status));
      err.status = x.status; throw err;
    }
    return j;
  }
  const roleNow = () => { try { return JSON.parse(sessionStorage.getItem(ROLE)); } catch (e) { return null; } };
  function adminToken() {
    let t; try { t = JSON.parse(sessionStorage.getItem(TOK)); } catch (e) { t = null; }
    if (!t) return null;
    if (Date.now() > t.exp - 30000) {
      try {
        const r = xhr('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: t.refresh });
        t = { access: r.access_token, refresh: r.refresh_token, exp: Date.now() + r.expires_in * 1000 };
        sessionStorage.setItem(TOK, JSON.stringify(t));
      } catch (e) { sessionStorage.removeItem(TOK); sessionStorage.removeItem(ROLE); return null; }
    }
    return t.access;
  }
  const rpc = (fn, args) => xhr('POST', '/rest/v1/rpc/' + fn, args || {}, adminToken());
  const onAdminPage = () => true;
  function remoteLoad() {
    const r = roleNow(); let data = null;
    try {
      if (onAdminPage() && r && r.admin) data = rpc('admin_get');
      else if (onAdminPage() && r && r.inst) { data = rpc('inst_get', { p_inst: r.inst, p_pin: r.pin }); if (data && data.error) data = null; }
    } catch (e) { data = null; }
    if (!data && onAdminPage() && r) { sessionStorage.removeItem(ROLE); sessionStorage.removeItem(TOK); }
    if (!data) {
      try { data = rpc('get_public'); loadError = null; }
      catch (e) { loadError = e; data = { settings: {}, instructors: [], slots: [], catalog: { cats: [], courses: [] } }; }
    }
    db = data;
    db.settings = { ...DEF, ...(db.settings || {}) };
    db.catalog = db.catalog || { cats: [], courses: [] };
    db.requests = db.requests || [];
    db.slots = (db.slots || []).map(s => ({
      link: '', materials: [], rec: null, ...s,
      bookings: s.bookings || Array.from({ length: s.booked || 0 }, () => ({}))
    }));
  }
  const R = REMOTE ? {
    err(e) { console.error(e); alert('Could not save to the server: ' + e.message + '\nPlease reload the page and try again.'); },
    up(table, rows) {
      try {
        const r = roleNow();
        if (table === 'slots' && r && r.inst) rows.forEach(w => rpc('inst_save_slot', { p_inst: r.inst, p_pin: r.pin, p_slot: w.id, p_patch: w }));
        else rpc('admin_upsert', { p_table: table, p_rows: rows });
      } catch (e) { R.err(e); }
    },
    del(table, ids) { try { rpc('admin_delete', { p_table: table, p_ids: ids }); } catch (e) { R.err(e); } }
  } : null;
  const pick = (s, keys) => { const o = { id: s.id }; keys.forEach(k => { o[k] = s[k] === undefined ? null : s[k]; }); return o; };
  const slotRow = s => { const o = { ...s }; delete o.bookings; delete o.booked; delete o.hasLink; return o; };

  if (REMOTE) remoteLoad(); else load();

  /* ---------- helpers ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slotDate = s => new Date(s.date + 'T' + s.time + ':00');
  const fmtDate = (d, long) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = t => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`; };
  const fmtDT = d => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const initials = n => n.replace(/^Dr\.?\s*/i, '').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
  const normPhone = p => String(p || '').replace(/\D/g, '').slice(-10);
  const payFiles = p => (!p ? [] : (p.files && p.files.length ? p.files : (p.fileId ? [{ id: p.fileId, name: p.fileName || 'Receipt' }] : [])));
  const cap = s => s.cap || 10;
  const taken = s => (s.bookings.some(b => b.kind === 'single') ? cap(s) : s.bookings.reduce((n, b) => n + (+b.seats || 1), 0));
  function human(ms) {
    const m = Math.max(0, Math.round(ms / MIN));
    const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    return d ? `${d}d ${h}h` : h ? `${h}h ${mm}m` : `${mm}m`;
  }

  /* course price lookup: matches a class's course text to a catalog course (name or tag) */
  function courseOfName(name) {
    const t = String(name || '').trim().toLowerCase(), L = (db.catalog || {}).courses || [];
    return L.find(x => x.name.toLowerCase() === t) || L.find(x => (x.tag || '').toLowerCase() === t) || null;
  }
  const numOrNull = v => (v === '' || v == null || isNaN(v) ? null : +v);
  /* a course's prices: base (offline / default), single (private online), group 2-4, group 5+ */
  function tiersOf(c) {
    if (!c) return null;
    const base = numOrNull(c.price);
    return { base, single: numOrNull(c.priceSingle) ?? base, g24: numOrNull(c.priceG24) ?? base, g5: numOrNull(c.priceG5) ?? base };
  }
  function priceOf(name) {
    const t = tiersOf(courseOfName(name)); if (!t) return null;
    return [t.base, t.single, t.g24, t.g5].find(x => x != null) ?? null;
  }
  const isOnline = s => !s || !s.mode || s.mode === 'Online';
  /* what a student pays: kind = 'single' | 'group' (online only), seats = number of students in a group */
  function quote(name, slot, kind, seats) {
    const t = tiersOf(courseOfName(name)); if (!t) return { unit: null, total: null, kind: '', seats: 1 };
    let unit, total, n = 1;
    if (isOnline(slot) && kind === 'single') { unit = t.single; total = unit; }
    else if (isOnline(slot) && kind === 'group') {
      n = Math.max(2, Math.round(+seats || 2)); unit = n >= 5 ? t.g5 : t.g24;
      total = unit == null ? null : (db.settings.groupMode === 'total' ? unit : unit * n);
    } else { unit = t.base ?? t.single ?? t.g24 ?? t.g5; total = unit; }
    return { unit, total, kind: isOnline(slot) ? kind || '' : '', seats: n };
  }
  const money = (p, cur) => p == null ? '' : p === 0 ? 'Free' : Number(p).toLocaleString('en-US') + ' ' + (cur || db.settings.currency);

  function cls(s, now = new Date()) {
    const start = slotDate(s);
    const dur = s.dur || db.settings.durMin;
    const end = new Date(+start + dur * MIN);
    const lead = s.leadMin != null ? s.leadMin : db.settings.leadMin;
    const linkAt = new Date(+start - lead * MIN);
    const linkUntil = new Date(+end + 15 * MIN);
    const has = !!(s.link || s.hasLink);          // (online mode only sends the link itself inside its time window)
    return {
      start, end, dur, lead, linkAt, linkUntil,
      phase: now < start ? 'upcoming' : now <= end ? 'live' : 'ended',
      linkOpen: !!s.link && now >= linkAt && now <= linkUntil,
      linkWait: has && !s.link && now >= linkAt && now <= linkUntil,
      linkPending: has && now < linkAt,
      linkClosed: has && now > linkUntil
    };
  }
  function recInfo(s, now = new Date()) {
    if (!s.rec) return null;
    const from = new Date(s.rec.addedAt), until = new Date(+from + s.rec.hours * HOUR);
    return { from, until, visible: now >= from && now < until, expired: now >= until };
  }

  /* ---------- IndexedDB file store ---------- */
  const idb = () => new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('IndexedDB unavailable'));
    const r = indexedDB.open('ucc_files', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('f');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => {
    const d = await idb();
    return new Promise((res, rej) => {
      const t = d.transaction('f', mode); let out;
      out = fn(t.objectStore('f'));
      t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error);
    });
  };
  const bucketOf = id => String(id).split('/')[0];
  const filesRemote = {
    async put(file, kind) {
      const bucket = kind === 'receipt' ? 'receipts' : 'uploads';
      const ext = (String(file.name || '').match(/\.[A-Za-z0-9]{1,8}$/) || [''])[0].toLowerCase();
      const rnd = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
      const id = bucket + '/' + rnd + ext;
      const r = await fetch(SBURL() + '/storage/v1/object/' + id, { method: 'POST',
        headers: { apikey: CFG.key, ...(adminToken() ? { Authorization: 'Bearer ' + adminToken() } : {}), 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (!r.ok) { let m = ''; try { m = (await r.json()).message; } catch (e) {} throw new Error(m || 'Upload failed'); }
      return id;
    },
    async get(id) {
      const priv = bucketOf(id) === 'receipts';
      const r = await fetch(SBURL() + '/storage/v1/object/' + (priv ? 'authenticated/' : 'public/') + id,
        { headers: priv ? { apikey: CFG.key, ...(adminToken() ? { Authorization: 'Bearer ' + adminToken() } : {}) } : {} });
      if (!r.ok) return null;
      return r.blob();
    },
    url: id => (bucketOf(id) === 'uploads' ? SBURL() + '/storage/v1/object/public/' + id : null),
    async del(id) {
      const t = adminToken(); if (!t || !id) return;
      try { await fetch(SBURL() + '/storage/v1/object/' + id, { method: 'DELETE', headers: { apikey: CFG.key, Authorization: 'Bearer ' + t } }); } catch (e) {}
    }
  };
  const filesLocal = {
    url: () => null,
    async put(file) { const id = uid('f'); await tx('readwrite', st => st.put(file, id)); return id; },
    async get(id) { return tx('readonly', st => st.get(id)); },
    async del(id) { return tx('readwrite', st => st.delete(id)).catch(() => {}); }
  };
  const files = REMOTE ? filesRemote : filesLocal;
  const refs = fid => db.slots.reduce((n, s) => n + s.materials.filter(m => m.fileId === fid).length + (s.rec && s.rec.fileId === fid ? 1 : 0), 0);
  const gc = fid => { if (fid && !refs(fid)) files.del(fid); };

  const sameGroup = (a, b) => b.instId === a.instId && b.course === a.course && slotDate(b) >= new Date();
  const find = id => db.slots.find(x => x.id === id);
  const sortSlots = arr => arr.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  let mineIds = null;
  const phoneMatch = (b, phone) => normPhone(b.phone) === normPhone(phone);

  window.DB = {
    COLORS, DEF, esc, fmtDate, fmtTime, fmtDT, initials, iso, pad, human, cls, recInfo, normPhone, files,
    remote: REMOTE,
    refresh() { if (REMOTE) remoteLoad(); },
    get loadError() { return loadError; },
    get loginProblem() { return loginProblem; },
    payFiles,
    attendees: s => s.bookings.reduce((n, b) => n + (+b.seats || 1), 0),
    validatePromo(code) {
      const c = String(code || '').replace(/\s/g, '').toUpperCase(); if (!c) return { ok: false };
      if (REMOTE) { try { return rpc('validate_promo', { p_code: c }) || { ok: false }; } catch (e) { return { ok: false, error: true }; } }
      const i = db.instructors.find(x => String(x.promo || '').replace(/\s/g, '').toUpperCase() === c);
      return i ? { ok: true, name: i.name } : { ok: false };
    },
    /* points an instructor earned from bookings made with their promo code (confirmed = paid or free) */
    promoStats(instId) {
      if (REMOTE) { const r = roleNow(); if (r && r.inst === instId && db.me) return db.me.stats || { points: 0, count: 0, pending: 0, items: [] }; return (db.promo || {})[instId] || { points: 0, count: 0, pending: 0, items: [] }; }
      const out = { points: 0, count: 0, pending: 0, items: [] };
      db.slots.forEach(s => s.bookings.forEach(b => {
        if (b.promoInst !== instId) return;
        const ok = !b.pay || b.pay.status === 'paid';
        if (ok) { out.points += +b.promoPoints || 0; out.count++; } else out.pending++;
        out.items.push({ name: b.name, course: b.subject || s.course, date: s.date, points: +b.promoPoints || 0, confirmed: ok, at: b.at });
      }));
      out.items.sort((a, b) => String(b.at).localeCompare(String(a.at))); out.items = out.items.slice(0, 60); return out;
    },
    promoCode: instId => { const r = roleNow(); if (REMOTE && r && r.inst === instId && db.me) return db.me.promo || ''; const i = db.instructors.find(x => x.id === instId); return (i && i.promo) || ''; },
    seatsTaken: s => taken(s),
    seatsLeft: s => cap(s) - taken(s),
    isOnline, quote, priceInfo: name => tiersOf(courseOfName(name)),
    notifyCfg: () => ({ ...(db.notify || {}) }),
    saveNotify(o) { db.notify = { ...(db.notify || {}), ...o }; R && R.up('settings', [{ id: 'notify', ...o }]); },
    testNotify() { try { return rpc('admin_test_notify') || null; } catch (e) { return null; } },
    notifyLog() { try { return rpc('admin_notify_log') || []; } catch (e) { return []; } },
    settings: () => ({ ...db.settings }),
    setSettings(o) { db.settings = { ...db.settings, ...o }; save(); R && R.up('settings', [{ id: 'main', ...o }]); },

    instructors: () => db.instructors.slice(),
    instructor: id => db.instructors.find(i => i.id === id),
    saveInstructor(data) {
      let row;
      if (data.id) { row = db.instructors.find(i => i.id === data.id); Object.assign(row, data); }
      else { data.id = uid('i'); db.instructors.push(data); row = data; }
      save(); R && R.up('instructors', [row]); return data.id;
    },
    deleteInstructor(id) {
      db.slots.filter(s => s.instId === id).forEach(s => { s.materials.forEach(m => m.fileId && files.del(m.fileId)); s.rec && s.rec.fileId && files.del(s.rec.fileId); });
      db.instructors = db.instructors.filter(i => i.id !== id);
      db.slots = db.slots.filter(s => s.instId !== id); save(); R && R.del('instructors', [id]);
    },

    /* course catalog (categories + courses) */
    catalog: () => ({ cats: db.catalog.cats.slice(), courses: db.catalog.courses.slice() }),
    saveCat(d) {
      const c = db.catalog; let row;
      if (d.id) { row = c.cats.find(x => x.id === d.id); Object.assign(row, d); } else { d.id = uid('k'); c.cats.push(d); row = d; }
      save(); R && R.up('cats', [row]); return d.id;
    },
    deleteCat(id) {
      const c = db.catalog, ids = new Set([id, ...c.cats.filter(x => x.parent === id).map(x => x.id)]);
      const cids = c.courses.filter(x => ids.has(x.catId)).map(x => x.id);
      c.cats = c.cats.filter(x => !ids.has(x.id)); c.courses = c.courses.filter(x => !ids.has(x.catId)); save();
      if (R) { if (cids.length) R.del('courses', cids); R.del('cats', [...ids]); }
    },
    saveCourse(d) {
      const c = db.catalog; let row;
      if (d.id) { row = c.courses.find(x => x.id === d.id); Object.assign(row, d); } else { d.id = uid('c'); c.courses.push(d); row = d; }
      save(); R && R.up('courses', [row]); return d.id;
    },
    deleteCourse(id) { db.catalog.courses = db.catalog.courses.filter(x => x.id !== id); save(); R && R.del('courses', [id]); },

    /* student requests: "Request a class" / "Request a course" */
    submitRequest(d) {
      const n = String(d.name || '').trim(), c = String(d.course || '').trim(), ph = String(d.phone || '').replace(/\D/g, '');
      const cnt = Math.round(+d.students || 0);
      if (n.length < 2) return { ok: false, error: 'Please enter your name.' };
      if (ph.length < 7) return { ok: false, error: 'Please enter a valid phone number.' };
      if (c.length < 2) return { ok: false, error: 'Please enter the subject.' };
      if (cnt < 1 || cnt > 500) return { ok: false, error: 'Number of students must be between 1 and 500.' };
      const row = { kind: d.kind === 'course' ? 'course' : 'class', name: n, phone: String(d.phone).trim(), email: String(d.email || '').trim(), course: c,
        instId: d.instId || '', students: cnt, times: String(d.times || '').trim(), mode: ['Online', 'Offline', 'Either'].includes(d.mode) ? d.mode : 'Either', note: String(d.note || '').trim() };
      if (REMOTE) { try { return { ok: rpc('submit_request', { p_data: row }) === true, error: 'Could not send — please try again.' }; } catch (e) { return { ok: false, error: 'Could not reach the server.' }; } }
      db.requests.unshift({ ...row, id: uid('q'), status: 'new', at: new Date().toISOString() }); save(); return { ok: true };
    },
    requests: () => (db.requests || []).slice(),
    newRequests: () => (db.requests || []).filter(r => (r.status || 'new') === 'new').length,
    setRequestStatus(id, status) {
      if (REMOTE) { try { rpc('admin_set_request', { p_id: +id, p_status: status }); } catch (e) { R.err(e); } remoteLoad(); return; }
      if (status === 'deleted') db.requests = db.requests.filter(r => r.id !== id);
      else { const r = db.requests.find(x => x.id === id); if (r) r.status = status; }
      save();
    },

    seedCatalog() {
      const d = defaultCatalog(), c = db.catalog;
      const haveC = new Set(c.cats.map(x => x.id)), haveK = new Set(c.courses.map(x => x.id));
      const nc = d.cats.filter(x => !haveC.has(x.id)), nk = d.courses.filter(x => !haveK.has(x.id));
      c.cats.push(...nc); c.courses.push(...nk); save();
      if (R) { if (nc.length) R.up('cats', nc); if (nk.length) R.up('courses', nk); }
      return nk.length;
    },
    priceOf, money,
    instructorsFor(c) {
      if (!c) return [];
      const ids = new Set(c.instructors || []), m = t => String(t || '').trim().toLowerCase();
      return db.instructors.filter(i => ids.has(i.id) || (i.tags || []).some(t => m(t) === m(c.name) || m(t) === m(c.tag)) ||
        db.slots.some(s => s.instId === i.id && (m(s.course) === m(c.name) || m(s.course) === m(c.tag))));
    },
    courseById: id => db.catalog.courses.find(c => c.id === id),
    courseMatch: (c, text) => { const t = String(text || '').trim().toLowerCase(); return !!c && (c.name.toLowerCase() === t || (c.tag || '').toLowerCase() === t); },
    slot: id => find(id),
    /* upcoming (not started yet) unless opts.all */
    slots(instId, opts = {}) {
      const now = new Date();
      return sortSlots(db.slots.filter(s => (!instId || s.instId === instId) && (opts.all || slotDate(s) >= now)));
    },
    addSlot(s) {
      if (db.slots.some(x => x.instId === s.instId && x.date === s.date && x.time === s.time)) return false;
      const n = newSlot(s); db.slots.push(n); save(); R && R.up('slots', [slotRow(n)]); return true;
    },
    deleteSlot(id) {
      const s = find(id); if (!s) return;
      db.slots = db.slots.filter(x => x.id !== id);
      s.materials.forEach(m => gc(m.fileId)); s.rec && gc(s.rec.fileId); save(); R && R.del('slots', [id]);
    },
    clearPast() {
      const n = new Date(), before = db.slots.length;
      db.slots.filter(s => slotDate(s) < n && !s.bookings.length).forEach(s => this.deleteSlot(s.id));
      return before - db.slots.length;
    },

    /* bookings */
    book(id, info) {
      const s = find(id);
      if (!s) return 'missing';
      if (REMOTE) {
        let r;
        try { r = rpc('book', { p_slot: id, p_name: info.name, p_phone: info.phone, p_email: info.email || '', p_subject: info.subject || '', p_topic: info.topic || '', p_file: info.fileId || '', p_fname: info.fileName || '', p_kind: info.kind || '', p_seats: info.seats || 1, p_promo: info.promo || '', p_uni: info.university || '', p_pin: String(info.pin || '') }); }
        catch (e) { alert('Could not reach the server: ' + e.message); return 'error'; }
        if (r.status === 'ok') { s.bookings.push({ kind: info.kind || '', seats: info.seats || 1 }); mineIds && mineIds.add(id); }
        if (r.status === 'full') s.bookings.push({ kind: 'single' });
        return r.status;
      }
      if (s.bookings.some(b => phoneMatch(b, info.phone))) return 'dup';
      const normC = t => String(t || '').replace(/\s/g, '').toUpperCase();
      let pI = null;
      if (normC(info.promo)) { pI = db.instructors.find(i => normC(i.promo) === normC(info.promo)); if (!pI) return 'badcode'; }
      const online = isOnline(s), kind = online && ['single', 'group'].includes(info.kind) ? info.kind : '';
      let seats = 1;
      if (kind === 'single') { if (taken(s) > 0) return 'full'; }
      else if (kind === 'group') { seats = Math.round(+info.seats || 0); if (seats < 2) return 'invalid'; if (taken(s) + seats > cap(s)) return 'full'; }
      else if (taken(s) >= cap(s)) return 'full';
      const q = [info.subject, s.course].map(n => quote(n, s, kind, seats)).find(x => x.total != null) || { unit: null, total: null };
      const pr = q.total, need = pr > 0;
      const bk = { ...info, kind, seats, unit: q.unit, price: pr, cur: db.settings.currency, ...(need ? { pay: { status: 'unpaid' } } : {}), at: new Date().toISOString() };
      if (pI) { bk.promo = normC(info.promo); bk.promoInst = pI.id; bk.promoPoints = numOrNull(pI.pointsPer) ?? numOrNull(db.settings.promoPoints) ?? 10; }
      s.bookings.push(bk); save(); return 'ok';
    },
    /* did the phone saved on this device book this class? */
    hasBooked(s) {
      const p = this.me().phone; if (!p) return false;
      if (!REMOTE) return s.bookings.some(b => phoneMatch(b, p));
      if (!mineIds) { try { mineIds = new Set(rpc('my_slot_ids', { p_phone: p, p_pin: this.me().pin || '' })); } catch (e) { mineIds = new Set(); } }
      return mineIds.has(s.id);
    },
    cancelBooking(slotId, phone) {
      const s = find(slotId);
      if (REMOTE) {
        try { rpc('cancel_booking', { p_slot: slotId, p_phone: phone, p_pin: this.me().pin || '' }); } catch (e) { R.err(e); return; }
        if (mineIds) mineIds.delete(slotId);
        const idx = s ? s.bookings.findIndex(b => b.phone !== undefined && phoneMatch(b, phone)) : -1;
        const old = idx >= 0 ? s.bookings[idx] : null;
        if (old && old.pay) payFiles(old.pay).forEach(x => files.del(x.id));
        if (s) { if (idx >= 0) s.bookings.splice(idx, 1); else s.bookings.pop(); }
        return;
      }
      if (!s) return;
      const old = s.bookings.find(b => phoneMatch(b, phone));
      if (old && old.pay) payFiles(old.pay).forEach(x => files.del(x.id));
      s.bookings = s.bookings.filter(b => !phoneMatch(b, phone)); save();
    },
    /* payments (InstaPay, confirmed manually by the admin) */
    payStatus: b => (b && b.pay ? b.pay.status : 'paid'),
    payRequired: name => (priceOf(name) || 0) > 0,
    payReady: () => !!String(db.settings.instapayId || '').trim(),
    submitPayment(slotId, phone, info) {
      if (REMOTE) {
        try { return rpc('submit_payment', { p_slot: slotId, p_phone: phone, p_ref: info.ref, p_file: info.fileId || '', p_fname: info.fileName || '', p_files: info.files || [], p_pin: this.me().pin || '' }) === true; }
        catch (e) { alert('Could not send the payment: ' + e.message); return false; }
      }
      const s = find(slotId), b = s && s.bookings.find(x => phoneMatch(x, phone)); if (!b) return false;
      payFiles(b.pay).forEach(x => { if (!(info.files || []).some(y => y.id === x.id) && x.id !== info.fileId) files.del(x.id); });
      b.pay = { status: 'pending', ref: info.ref, fileId: info.fileId || '', fileName: info.fileName || '', files: info.files || [], sentAt: new Date().toISOString() }; save(); return true;
    },
    setPayStatus(slotId, phone, status) {
      const s = find(slotId), b = s && s.bookings.find(x => phoneMatch(x, phone)); if (!b) return;
      b.pay = { ...(b.pay || {}), status, decidedAt: new Date().toISOString() }; save();
      if (REMOTE) { try { rpc('admin_set_pay', { p_slot: slotId, p_phone: phone, p_status: status }); } catch (e) { R.err(e); } }
    },
    pendingPayments: () => db.slots.reduce((n, s) => n + s.bookings.filter(b => b.pay && b.pay.status === 'pending').length, 0),
    bookings() {
      const out = [];
      db.slots.forEach(s => s.bookings.forEach(b => b.phone !== undefined && out.push({ slot: s, b })));
      return out.sort((a, c) => (a.slot.date + a.slot.time).localeCompare(c.slot.date + c.slot.time));
    },
    myClasses(phone) {
      const p = normPhone(phone); if (p.length < 6) return [];
      if (REMOTE) {
        try {
          const rows = rpc('get_mine', { p_phone: phone, p_pin: this.me().pin || '' }) || [];
          if (rows && rows.error) { this.authErr = rows.error; return []; } this.authErr = '';
          return rows.map(s => ({ link: '', materials: [], rec: null, ...s }));
        } catch (e) { loadError = e; return []; }
      }
      return sortSlots(db.slots.filter(s => s.bookings.some(b => phoneMatch(b, phone))));
    },
    authErr: '',
    authMsg(c) { return ({ nopin: 'Enter your phone number and access code to see your classes.', badpin: 'Wrong phone number or access code.', locked: 'Too many wrong attempts. Please try again in 15 minutes.', legacy: 'This number was used before access codes existed. Please contact us and we will give you a code.', weakpin: 'The access code must be 6 to 10 digits.' })[c] || 'Could not check your access code.'; },
    setStudentCode(phone, pin) { if (!/^[0-9]{6,10}$/.test(pin)) return false; if (!REMOTE) return true; try { return rpc('admin_set_student_pin', { p_phone: phone, p_pin: pin }) === true; } catch (e) { R.err(e); return false; } },
    me() { try { return JSON.parse(localStorage.getItem(ME)) || {}; } catch (e) { return {}; } },
    setMe(o) { try { localStorage.setItem(ME, JSON.stringify(o)); } catch (e) {} },

    /* class management */
    updateClass(id, patch, applyAll) {
      const s = find(id); if (!s) return;
      Object.assign(s, patch);
      const rows = [pick(s, Object.keys(patch))];
      if (applyAll) db.slots.filter(x => x.id !== id && sameGroup(s, x)).forEach(x => {
        const ks = ['link', 'leadMin', 'dur'].filter(k => k in patch);
        ks.forEach(k => { x[k] = patch[k]; }); rows.push(pick(x, ks));
      });
      save(); R && R.up('slots', rows);
    },
    addMaterial(id, mat, applyAll) {
      const s = find(id); if (!s) return;
      const targets = [s, ...(applyAll ? db.slots.filter(x => x.id !== id && sameGroup(s, x)) : [])];
      targets.forEach(t => t.materials.push({ ...mat, id: uid('m') }));
      save(); R && R.up('slots', targets.map(t => pick(t, ['materials'])));
    },
    removeMaterial(id, matId) {
      const s = find(id); if (!s) return;
      const m = s.materials.find(x => x.id === matId);
      s.materials = s.materials.filter(x => x.id !== matId); save(); R && R.up('slots', [pick(s, ['materials'])]); m && gc(m.fileId);
    },
    setRecording(id, rec) {
      const s = find(id); if (!s) return;
      const old = s.rec; s.rec = { addedAt: new Date().toISOString(), hours: db.settings.recHours, ...rec };
      save(); R && R.up('slots', [pick(s, ['rec'])]); old && old.fileId !== s.rec.fileId && gc(old.fileId);
    },
    setRecHours(id, hours) { const s = find(id); if (s && s.rec) { s.rec.hours = hours; save(); R && R.up('slots', [pick(s, ['rec'])]); } },
    restartRecording(id) { const s = find(id); if (s && s.rec) { s.rec.addedAt = new Date().toISOString(); save(); R && R.up('slots', [pick(s, ['rec'])]); } },
    clearRecording(id) { const s = find(id); if (!s || !s.rec) return; const f = s.rec.fileId; s.rec = null; save(); R && R.up('slots', [pick(s, ['rec'])]); gc(f); },

    /* auth: role is {admin:true} or {inst:id[, pin]} */
    login(a, b) {
      loginProblem = '';
      if (REMOTE) {                        // a = e-mail, b = password (Supabase Auth)
        let r;
        try { r = xhr('POST', '/auth/v1/token?grant_type=password', { email: String(a).trim(), password: b }); }
        catch (e) {
          const m = String(e.message || '');
          loginProblem = e.status ? (/confirm/i.test(m) ? 'unconfirmed' : /invalid|credential/i.test(m) ? 'badpass' : 'auth:' + m) : 'network:' + m;
          return false;
        }
        sessionStorage.setItem(TOK, JSON.stringify({ access: r.access_token, refresh: r.refresh_token, exp: Date.now() + r.expires_in * 1000 }));
        let isAdm = false;
        try { isAdm = rpc('admin_check') === true; } catch (e) { loginProblem = 'rpc:' + e.message; sessionStorage.removeItem(TOK); return false; }
        if (!isAdm) { sessionStorage.removeItem(TOK); loginProblem = 'notadmin'; return false; }
        sessionStorage.setItem(ROLE, JSON.stringify({ admin: true })); remoteLoad(); return true;
      }
      if (db.password && a === db.password) { sessionStorage.setItem(ROLE, JSON.stringify({ admin: true })); return true; } return false;
    },
    loginInstructor(id, pin) {
      if (REMOTE) {
        try {
          const d = rpc('inst_get', { p_inst: id, p_pin: String(pin).trim() });
          if (!d || d.error) return false;
          sessionStorage.setItem(ROLE, JSON.stringify({ inst: id, pin: String(pin).trim() })); remoteLoad(); return true;
        } catch (e) { return false; }
      }
      const i = this.instructor(id);
      if (i && String(i.pin) === String(pin).trim()) { sessionStorage.setItem(ROLE, JSON.stringify({ inst: id })); return true; }
      return false;
    },
    role() { return roleNow(); },
    logout() { sessionStorage.removeItem(ROLE); sessionStorage.removeItem(TOK); if (REMOTE) remoteLoad(); },
    isAdmin() { const r = this.role(); return !!(r && r.admin); },
    setPassword(p) { if (!REMOTE) { db.password = p; save(); } },

    export: () => JSON.stringify(db, null, 2),
    import(text) {
      if (REMOTE) throw new Error('Restore is not available when the site uses Supabase.');
      const d = JSON.parse(text);
      if (!d.instructors || !d.slots) throw new Error('Invalid file');
      d.slots = d.slots.map(s => newSlot(s.booked !== undefined ? { ...s, bookings: s.booked ? [s.booked] : [] } : s));
      db = d; db.settings = { ...DEF, ...(db.settings || {}) }; if (!db.catalog) db.catalog = defaultCatalog(); save();
    },
    reset() { if (REMOTE) return; db = seed(); save(); }
  };
})();
