/* Shared header / menu / footer / toast / reveal for every page */
(function () {
  if (typeof window === 'undefined') return;
  const DB = window.DB;
  const safeUrl = window.safeUrl;
  const page = window.__PG || location.pathname.split('/').pop() || 'index.html';
  const links = [['Home', 'index.html', 'index.html'], ['Instructors', 'instructors.html', 'instructors.html'], ['Courses', 'courses.html', 'courses.html'], ['Schedule', 'schedule.html', 'schedule.html'], ['My Classes', 'my-classes.html', 'my-classes.html'], ['Recordings', 'recordings.html', 'recordings.html'], ['Dashboard', 'dashboard.html', 'dashboard.html']];
  const cur = p => (p === page || (p === 'instructors.html' && page === 'instructor.html')) ? ' style="color:var(--accent2)"' : '';

  const hd = document.getElementById('site-header');
  if (hd) hd.outerHTML = `
  <header>
    <div class="wrap nav">
      <a href="index.html" class="logo"><i>U</i>Uni Boost</a>
      <nav class="nav-links" aria-label="Primary">${links.map(l => `<a href="${l[1]}"${cur(l[2]) ? ' aria-current="page"' : ''}>${l[0]}</a>`).join('')}</nav>
      <div class="nav-right">
        <div class="theme-switch" role="group" aria-label="Color theme">
          <button type="button" data-set-theme="light">Light</button>
          <button type="button" data-set-theme="dark">Dark</button>
        </div>
        <a class="btn btn-primary btn-sm nav-book" href="schedule.html">Book a class</a>
        <button class="burger" type="button" aria-label="Menu" aria-expanded="false"><span></span></button>
      </div>
    </div>
  </header>
  <div class="menu" id="menu">
    <div class="wrap">
      ${links.map(l => `<a class="item" href="${l[1]}" ${cur(l[2])}>${l[0]}</a>`).join('')}
      <a class="btn btn-primary menu-book" href="schedule.html">Book a class</a>
      <div class="theme-switch" role="group" aria-label="Color theme">
        <button type="button" data-set-theme="light">Light</button>
        <button type="button" data-set-theme="dark">Dark</button>
      </div>
    </div>
  </div>`;

  const ft = document.getElementById('site-footer');
  if (ft) ft.outerHTML = `
  <footer>
    <div class="wrap">
      <div class="foot">
        <a href="index.html" class="logo"><i>U</i>Uni Boost</a>
        <nav>${links.map(l => `<a href="${l[1]}" >${l[0]}</a>`).join('')}</nav>
      </div>
      <p class="copy">© 2026 Uni Boost · Giza, Egypt. All rights reserved. · <a href="privacy.html">Privacy and cancellation</a></p>
    </div>
  </footer>`;

  document.body.insertAdjacentHTML('beforeend', '<div class="toast" id="toast"></div>');
  if (window.DB && DB.loadError) document.body.insertAdjacentHTML('afterbegin', '<div class="warn" style="margin:0;border-radius:0;text-align:center">⚠ Could not reach the server (' + DB.esc(DB.loadError.message) + '). Check your connection and reload the page.</div>');

  const burger = document.querySelector('.burger');
  const setMenu = open => { document.body.classList.toggle('menu-open', open); burger && burger.setAttribute('aria-expanded', String(open)); };
  if (!window.__NEXT) {
    burger && burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
    document.querySelectorAll('#menu a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  }
  addEventListener('keydown', e => e.key === 'Escape' && document.body.classList.remove('menu-open'));
  addEventListener('resize', () => { if (innerWidth >= 1080) document.body.classList.remove('menu-open'); });
  const req = document.getElementById('reqbar');
  const reqBtn = req && req.querySelector('button');
  if (!window.__NEXT && reqBtn) reqBtn.addEventListener('click', () => window.requestForm(/course/i.test(reqBtn.textContent) ? 'course' : 'class'));

  const toast = document.getElementById('toast');
  let tt;
  /* Shared list paging: 12 records per page, hidden when a list is shorter than that. */
  window.ubSlice = function (list, page, size) {
    size = size || 12;
    const total = list.length, pages = Math.max(1, Math.ceil(total / size) || 1);
    let p = parseInt(page, 10) || 1;
    if (p < 1) p = 1;
    if (p > pages) p = pages;
    const start = (p - 1) * size;
    return { rows: list.slice(start, start + size), page: p, pages: pages, total: total, size: size };
  };
  window.ubPager = function (page, pages, total, opts) {
    opts = opts || {};
    const size = opts.size || 12;
    if (total <= size) return '';
    const extra = opts.extra ? opts.extra + ' ' : '';
    const from = (page - 1) * size + 1, to = Math.min(total, page * size);
    const nums = [], push = n => { if (n >= 1 && n <= pages && nums.indexOf(n) === -1) nums.push(n); };
    push(1);
    for (let n = page - 2; n <= page + 2; n++) push(n);
    push(pages);
    nums.sort((a, b) => a - b);
    let links = '', prev = 0;
    nums.forEach(n => {
      if (prev && n - prev > 1) links += '<span class="pager-gap">…</span>';
      links += '<button type="button" class="mini' + (n === page ? ' on' : '') + '" ' + extra + 'data-pg="' + n + '"' + (n === page ? ' aria-current="page"' : '') + '>' + n + '</button>';
      prev = n;
    });
    return '<nav class="pager" aria-label="Pagination"><button type="button" class="mini" ' + extra + 'data-pg="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>Previous</button>' + links + '<span class="pager-count">' + from + '–' + to + ' of ' + total + '</span><button type="button" class="mini" ' + extra + 'data-pg="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + '>Next</button></nav>';
  };

  window.say = function (msg) {
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('show'), 2600);
  };

  // reveal on scroll (also for elements added later)
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .08 });
  window.observeReveal = (root = document) => root.querySelectorAll('.reveal:not(.in)').forEach(el => io.observe(el));
  observeReveal();

  /* where a class happens: "Online" or "Offline · Center name" (+ map link / address) */
  window.attTxt = s => { const n = DB.attendees(s); return s.bookings.some(b => b.kind === 'single') ? n + ' · private' : n + ' attending'; };
  window.cLabel = s => (s && s.course) || 'Open session';
  window.placeTxt = s => (!s.mode || s.mode === 'Online') ? 'Online' : 'Offline' + (s.center ? ' · ' + s.center : '');
  window.placeHtml = (s, full) => {
    const esc = DB.esc, t = esc(placeTxt(s));
    if (!full || !s.loc || !s.mode || s.mode === 'Online') return t;
    const l = String(s.loc).trim(), url = /^https?:\/\//i.test(l);
    return t + '<br><span class="help" style="margin:2px 0 0">📍 ' + (url ? `<a href="${esc(safeUrl(l))}" target="_blank" rel="noopener" style="text-decoration:underline">Open location on map</a>` : esc(l)) + '</span>';
  };

  /* "Request a class" / "Request a course" form (modal), shared by several pages */
  window.requestForm = function (kind, o) {
    o = o || {}; const isC = kind === 'course', esc = DB.esc;
    const names = [...new Set(DB.catalog().courses.flatMap(c => [c.name]).filter(Boolean))];
    let m = document.getElementById('reqModal'); if (m) m.remove();
    m = document.createElement('div'); m.className = 'modal open'; m.id = 'reqModal';
    m.innerHTML = `<div class="box"><h3>${isC ? 'Request a course' : 'Request a class'}</h3>
      <p class="summary">${isC ? 'Can’t find the course you need? Tell us what and when, and we’ll arrange it.' : 'Can’t find a time that suits you? Tell us the time you need and we’ll try to arrange it.'}${o.inst ? '<br>Instructor: <b style="color:var(--text)">' + esc(o.inst) + '</b>' : ''}</p>
      <form id="rqf" style="margin-top:14px">
        <label>${isC ? 'Course name — type the course you need' : 'Subject / course'}</label><input name="course" required maxlength="120" ${isC ? 'autocomplete="off"' : 'list="rqc"'} value="${esc(o.course || '')}" placeholder="${isC ? 'Write the course name, e.g. Thermodynamics 2' : 'e.g. Heat Transfer'}">${isC ? '' : `<datalist id="rqc">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`}
        <div class="inline"><div><label>How many students?</label><input type="number" name="students" min="1" max="500" value="1" required></div>
        <div><label>Online or offline?</label><select name="mode"><option value="Online">Online</option><option value="Offline">Offline (on campus)</option><option value="Either">Either is fine</option></select></div></div>
        <label>Preferred days &amp; times</label><textarea name="times" required maxlength="600" placeholder="e.g. Saturdays 6–8 PM, or any evening after 5 PM"></textarea>
        <label>Your name</label><input name="name" required maxlength="80" autocomplete="name">
        <div class="inline"><div><label>Phone / WhatsApp</label><input name="phone" required maxlength="30" inputmode="tel" autocomplete="tel"></div>
        <div><label>Email (optional)</label><input type="email" name="email" maxlength="120" autocomplete="email"></div></div>
        <label>Notes (optional)</label><input name="note" maxlength="300">
        <div class="help err" id="rqe" style="margin-top:8px"></div>
        <div class="actions"><button type="button" class="btn btn-ghost" id="rqx">Cancel</button><button class="btn btn-primary">Send request</button></div>
      </form></div>`;
    document.body.appendChild(m);
    const close = () => m.remove();
    m.querySelector('#rqx').onclick = close; m.addEventListener('click', e => { if (e.target === m) close(); });
    m.querySelector('#rqf').onsubmit = e => {
      e.preventDefault(); const f = e.target, btn = f.querySelector('.btn-primary'); btn.disabled = true;
      const r = DB.submitRequest({ kind, instId: o.instId || '', course: f.course.value, students: f.students.value, mode: f.mode.value,
        times: f.times.value, name: f.name.value, phone: f.phone.value, email: f.email.value, note: f.note.value });
      if (!r.ok) { btn.disabled = false; m.querySelector('#rqe').textContent = r.error || 'Could not send.'; return; }
      m.querySelector('.box').innerHTML = '<h3>Request sent ✓</h3><p class="summary">Thanks! We’ll contact you on the phone number you gave as soon as we have a time for you.</p><div class="actions"><button class="btn btn-primary" id="rqd">Done</button></div>';
      m.querySelector('#rqd').onclick = close;
    };
    const first = m.querySelector('input[name=course]'); first && first.focus();
  };

  /* InstaPay payment panel, shared by the booking modal and My Classes */
  window.payForm = function (el, slotId, phone, done, price, bk) {
    const s = DB.slot(slotId), S = DB.settings(), p = price != null ? price : DB.priceOf(s.course), esc = DB.esc;
    const grp = !!bk && bk.kind === 'group', n = grp ? (+bk.seats || 2) : 1, each = grp && bk.unit != null && S.groupMode !== 'total' ? DB.money(+bk.unit) : '';
    const grpNote = grp ? `<div class="help" style="margin:0 0 12px;padding:10px 12px;border:1px solid var(--line);border-radius:12px"><b style="color:var(--text)">Group booking · ${n} students.</b> ${each ? 'Each student can send their own share (' + esc(each) + ') separately — ' : 'Students can split the amount and each send their own part — '}then <b>upload every transfer screenshot</b> below (you can select several images at once) and write each reference number.</div>` : '';
    const ipa = (S.instapayId || '').trim();
    const link = /^https?:\/\//i.test(S.instapayLink || '') ? S.instapayLink.trim() : '';
    const steps = `<div class="stepper"><span class="on done"><i>✓</i>Seat reserved</span><span class="on"><i>2</i>Pay</span><span><i>3</i>Confirmation</span></div>`;
    if (!ipa) {
      el.innerHTML = `<div class="paybox">${steps}<div class="pay-amt">${esc(DB.money(p))}</div>
        <p class="help" style="margin:0">Payment details have not been added yet. Your seat is reserved — please come back to <b>My Classes</b> in a little while to pay, or contact us.</p></div>`;
      return;
    }
    el.innerHTML = `<div class="paybox">
      ${steps}
      <div class="pay-top"><div><small>Amount to pay</small><div class="pay-amt">${esc(DB.money(p))}</div></div>
        <div class="pay-for">${esc(cLabel(s))}</div></div>
      <div class="ipa-card">
        <small>Send via InstaPay to</small>
        <div class="ipa-row"><code id="ipa">${esc(ipa)}</code><button type="button" class="btn btn-ghost btn-sm" id="cpy">Copy</button></div>
        ${S.instapayName ? `<div class="ipa-name">Account name: <b>${esc(S.instapayName)}</b></div>` : ''}
      </div>
      ${grpNote}
      <ol class="pay-steps">
        <li>Open the <b>InstaPay</b> app → <b>Send money</b>.</li>
        <li>Paste the address above and send ${grp ? (each ? 'your share (<b>' + esc(each) + '</b> each, <b>' + esc(DB.money(p)) + '</b> in total)' : 'a total of <b>' + esc(DB.money(p)) + '</b>') : 'exactly <b>' + esc(DB.money(p)) + '</b>'}.</li>
        <li>${grp ? 'Repeat for every student, then enter the <b>reference numbers</b> and upload all the screenshots below.' : 'Enter the <b>transaction reference number</b> from the receipt below and press send.'}</li>
      </ol>
      ${link ? `<a class="btn btn-ghost btn-sm" href="${esc(safeUrl(link))}" target="_blank" rel="noopener" style="margin-bottom:14px">Open InstaPay payment link ↗</a>` : ''}
      ${S.payNote ? `<p class="help">${esc(S.payNote)}</p>` : ''}
      <form class="payf">
        <label>${grp ? 'Transaction reference number(s) — one per transfer, separated by commas' : 'Transaction reference number'}</label><input name="ref" required minlength="4" maxlength="${grp ? 200 : 60}" placeholder="e.g. 123456789012">
        <label>${grp ? 'Receipt screenshots — one per student (select several)' : 'Receipt screenshot (optional)'}</label><input name="file" type="file" accept="image/*" ${grp ? 'multiple' : ''}>
        <div class="actions"><button class="btn btn-primary" type="submit">I've paid — send for confirmation</button></div>
        <p class="help" style="margin:10px 0 0;text-align:center">Access opens after your payment is confirmed.</p>
      </form></div>`;
    el.querySelector('#cpy').onclick = () => { try { navigator.clipboard.writeText(ipa); } catch (e) {} window.say && say('Copied'); };
    el.querySelector('.payf').onsubmit = async e => {
      e.preventDefault();
      const f = e.target, list = [...f.file.files].slice(0, 10), btn = f.querySelector('button'); btn.disabled = true;
      const up = [];
      try {
        for (const file of list) {
          if (file.size > 6 * 1048576) { btn.disabled = false; return say('A screenshot is too large (max 6 MB each)'); }
          up.push({ id: await DB.files.put(file, 'receipt'), name: file.name });
        }
      } catch (err) { btn.disabled = false; return say('Could not save the screenshot'); }
      DB.submitPayment(slotId, phone, { ref: f.ref.value.trim(), fileId: up[0] ? up[0].id : '', fileName: up[0] ? up[0].name : '', files: up });
      done && done();
    };
  };
})();
