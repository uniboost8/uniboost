/* Admin and instructor dashboard. Uses the same DB as the public site. */
(function () {
  if (typeof window === 'undefined' || !window.DB) return;
  const DB = window.DB;
  const esc = DB.esc;
  const say = m => window.say && window.say(m);
  const home = () => (window.__NEXT ? '/' : 'index.html');
  const instHref = id => (window.__NEXT ? '/instructors/' + encodeURIComponent(id) : 'instructor.html?id=' + encodeURIComponent(id));
  const ADMIN_TABS = [['overview', 'Overview'], ['instructors', 'Instructors'], ['catalog', 'Catalog'], ['schedule', 'Schedule'], ['bookings', 'Bookings'], ['requests', 'Requests'], ['settings', 'Settings']];
  const INST_TABS = [['classes', 'Classes'], ['students', 'Students'], ['promo', 'Promo']];
  const state = { gate: 'admin', tab: 'overview', err: '', editInst: null, editCat: null, editCourse: null, instFilter: '', past: false, classId: null, pages: {} };
  function cut(key, list) {
    if (!window.ubSlice) return { rows: list, page: 1, pages: 1, total: list.length, size: 12 };
    const c = window.ubSlice(list, state.pages[key] || 1);
    state.pages[key] = c.page;
    return c;
  }
  function pg(key, c) {
    return window.ubPager ? window.ubPager(c.page, c.pages, c.total, { extra: 'data-act="page" data-key="' + key + '"' }) : '';
  }

  const meInst = () => { const r = DB.role(); return r && r.inst; };
  const mine = s => DB.isAdmin() || (meInst() && s && s.instId === meInst());
  const errBox = () => (state.err ? `<p class="warn">${esc(state.err)}</p>` : '');
  const payBadge = b => {
    const s = DB.payStatus(b);
    if (s === 'paid') return '<span class="badge free">Paid</span>';
    if (s === 'pending') return '<span class="badge pend">Pending</span>';
    return '<span class="badge taken">Unpaid</span>';
  };
  const loginMsg = c => ({
    badpass: 'Wrong email or password.',
    notadmin: 'This account is not an admin.',
    unconfirmed: 'Confirm that email before signing in.'
  })[c] || 'Could not sign in. Check the connection and try again.';

  function loginView() {
    const admin = state.gate === 'admin';
    const remote = !!DB.remote;
    const insts = DB.instructors();
    const hint = admin
      ? (DB.demo && !remote ? '<p class="help">Preview password: <b style="color:var(--text)">demo</b>. It works only while sample data is on.</p>' : '<p class="help">Sign in with the admin account for this site.</p>')
      : (DB.demo ? '<p class="help">Preview PINs:<br>' + insts.map(i => esc(i.name) + ' · <b style="color:var(--text)">' + esc(i.pin) + '</b>').join('<br>') + '</p>' : '<p class="help">Use the PIN set on your instructor profile.</p>');
    const fields = admin
      ? (remote
        ? '<label>Email</label><input name="email" type="email" required autocomplete="username"><label>Password</label><input name="password" type="password" required autocomplete="current-password">'
        : '<label>Password</label><input name="password" type="password" required autocomplete="current-password">')
      : `<label>Instructor</label><select name="inst" required>${insts.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</select><label>PIN</label><input name="pin" required maxlength="20" autocomplete="current-password">`;
    return `<div class="wrap"><section class="page-hero"><p class="crumbs"><a href="${home()}">Home</a> / Dashboard</p><h1>Dashboard</h1><p class="sub">Staff sign-in for Uni Boost.</p></section>
      <div class="panel login-box"><div class="tabs" style="margin-top:0">
        <button type="button" class="tab${admin ? ' on' : ''}" data-act="gate" data-gate="admin">Admin</button>
        <button type="button" class="tab${admin ? '' : ' on'}" data-act="gate" data-gate="inst">Instructor</button>
      </div>${errBox()}<form data-form="login">${fields}<div class="actions"><button class="btn btn-primary" type="submit">Sign in</button></div></form>${hint}</div></div>`;
  }

  function tabs() {
    const list = DB.isAdmin() ? ADMIN_TABS : INST_TABS;
    if (!list.some(t => t[0] === state.tab)) state.tab = list[0][0];
    return list;
  }

  function shell() {
    const list = tabs();
    const who = DB.isAdmin() ? 'Admin' : ((DB.instructor(meInst()) || {}).name || 'Instructor');
    const slot = state.classId ? DB.slot(state.classId) : null;
    return `<div class="wrap"><section class="page-hero">
      <p class="crumbs"><a href="${home()}">Home</a> / Dashboard</p>
      <div class="admin-top"><div><h1>Dashboard</h1><p class="sub">${esc(who)}${DB.demo ? ' · sample data on this browser' : ''}</p></div>
      <button type="button" class="btn btn-ghost btn-sm" data-act="logout">Log out</button></div>
      <div class="tabs">${list.map(t => `<button type="button" class="tab${t[0] === state.tab ? ' on' : ''}" data-act="tab" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div>
    </section>${errBox()}<div style="margin-bottom:90px">${section()}</div>${slot && mine(slot) ? classModal(slot) : ''}</div>`;
  }

  function section() {
    const map = { overview, instructors, catalog, schedule, bookings, requests, settings, classes, students, promo };
    return (map[state.tab] || overview)();
  }

  function overview() {
    const open = DB.slots().filter(s => DB.seatsLeft(s) > 0).length;
    const cards = [
      ['Instructors', DB.instructors().length, 'instructors'],
      ['Open classes', open, 'schedule'],
      ['Bookings', DB.bookings().length, 'bookings'],
      ['Payments to review', DB.pendingPayments(), 'bookings'],
      ['New requests', DB.newRequests(), 'requests']
    ];
    return `<div class="dash-grid">${cards.map(c => `<button type="button" class="cc-box" data-act="tab" data-tab="${c[2]}" style="text-align:left"><h4>${c[0]}</h4><div class="cd">${c[1]}</div></button>`).join('')}</div>
      <div class="panel" style="margin-top:0"><h2>What to do next</h2>
      <p class="summary">Confirm InstaPay transfers in Bookings, answer course requests, and put the class link on each online session from Schedule.</p>
      ${DB.demo ? '<p class="help">This browser is using sample data. A booking made here stays on this computer until the live database is connected.</p>' : ''}
      </div>`;
  }

  function instForm(row) {
    const colors = DB.COLORS.map((c, i) => `<option value="${i}" ${row && +row.color === i ? 'selected' : ''}>${esc(c[0])}</option>`).join('');
    return `<form data-form="inst" class="panel" style="margin-top:0">
      <h2>${row ? 'Edit instructor' : 'New instructor'}</h2>
      <input type="hidden" name="id" value="${row ? esc(row.id) : ''}">
      <div class="inline"><div><label>Name</label><input name="name" required maxlength="80" value="${row ? esc(row.name) : ''}"></div>
      <div><label>Title</label><input name="title" maxlength="80" value="${row ? esc(row.title || '') : ''}"></div></div>
      <label>University</label><input name="university" maxlength="80" value="${row ? esc(row.university || '') : ''}">
      <label>Bio</label><textarea name="bio" maxlength="600">${row ? esc(row.bio || '') : ''}</textarea>
      <label>Subjects (comma separated)</label><input name="tags" value="${row ? esc((row.tags || []).join(', ')) : ''}">
      <div class="inline"><div><label>${row && DB.remote ? 'New PIN' : 'PIN'}</label><input name="pin" ${row && DB.remote ? '' : 'required'} maxlength="20" value="${row && !DB.remote ? esc(row.pin || '') : ''}" autocomplete="new-password">${row && DB.remote ? '<p class="help">Leave blank to keep the current PIN. It is stored hashed and is not shown again.</p>' : ''}</div>
      <div><label>Promo code</label><input name="promo" maxlength="30" value="${row ? esc(row.promo || '') : ''}"></div>
      <div><label>Color</label><select name="color">${colors}</select></div></div>
      <label>Photo URL (optional)</label><input name="photo" value="${row ? esc(row.photo || '') : ''}" placeholder="https://...">
      <div class="actions"><button class="btn btn-primary" type="submit">Save instructor</button><button type="button" class="btn btn-ghost" data-act="cancel-inst">Cancel</button></div>
    </form>`;
  }

  function instructors() {
    const rows = DB.instructors().slice().sort((a, b) => a.name.localeCompare(b.name));
    const view = cut('instructors', rows);
    const editing = state.editInst === 'new' ? instForm(null) : (state.editInst ? instForm(DB.instructor(state.editInst) || null) : '');
    const body = view.rows.map(i => `<tr><td><div class="who-cell">${avatar(i)}<div><b>${esc(i.name)}</b><div class="help" style="margin:0">${esc(i.title || '')}</div></div></div></td>
      <td>${esc(i.university || '')}</td><td>${DB.remote ? (i.hasPin ? 'Saved' : 'Not set') : esc(i.pin || '')}</td><td>${esc(i.promo || '—')}</td><td>${DB.slots(i.id).filter(s => DB.seatsLeft(s) > 0).length}</td>
      <td><button type="button" class="mini" data-act="edit-inst" data-id="${esc(i.id)}">Edit</button><button type="button" class="mini del" data-act="del-inst" data-id="${esc(i.id)}">Delete</button></td></tr>`).join('');
    return `${editing}<div class="admin-top"><h2>Instructors</h2><button type="button" class="btn btn-primary btn-sm" data-act="edit-inst" data-id="new">Add instructor</button></div>
      <div class="scroll-x"><table class="table"><thead><tr><th>Name</th><th>University</th><th>PIN</th><th>Promo</th><th>Open</th><th></th></tr></thead><tbody>${body || '<tr><td colspan="6">No instructors yet.</td></tr>'}</tbody></table></div>${pg('instructors', view)}`;
  }

  function avatar(i) {
    const k = DB.COLORS[(+i.color || 0) % DB.COLORS.length] || DB.COLORS[0];
    const style = i.photo ? `background-image:url('${esc(window.safeUrl(i.photo))}')` : `background:linear-gradient(135deg,${k[0]},${k[1]})`;
    return `<div class="avatar" style="${style}">${i.photo ? '' : esc(DB.initials(i.name || '?'))}</div>`;
  }

  function catOptions(selected, skip) {
    const cats = DB.catalog().cats.filter(c => c.id !== skip);
    return '<option value="">None</option>' + cats.map(c => `<option value="${esc(c.id)}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  }

  function catalog() {
    const { cats, courses } = DB.catalog();
    const catForm = state.editCat != null ? `<form data-form="cat" class="panel"><h2>${state.editCat ? 'Edit category' : 'New category'}</h2>
      <input type="hidden" name="id" value="${state.editCat ? esc(state.editCat) : ''}">
      <div class="inline"><div><label>Name</label><input name="name" required maxlength="80" value="${esc((cats.find(c => c.id === state.editCat) || {}).name || '')}"></div>
      <div><label>Icon</label><input name="ic" maxlength="4" value="${esc((cats.find(c => c.id === state.editCat) || {}).ic || '')}"></div></div>
      <label>Description</label><input name="desc" maxlength="200" value="${esc((cats.find(c => c.id === state.editCat) || {}).desc || '')}">
      <label>Parent category</label><select name="parent">${catOptions((cats.find(c => c.id === state.editCat) || {}).parent || '', state.editCat || '')}</select>
      <div class="actions"><button class="btn btn-primary" type="submit">Save category</button><button type="button" class="btn btn-ghost" data-act="cancel-cat">Cancel</button></div></form>` : '';
    const course = courses.find(c => c.id === state.editCourse) || null;
    const courseForm = state.editCourse != null ? `<form data-form="course" class="panel"><h2>${course ? 'Edit course' : 'New course'}</h2>
      <input type="hidden" name="id" value="${course ? esc(course.id) : ''}">
      <label>Name</label><input name="name" required maxlength="120" value="${course ? esc(course.name) : ''}">
      <label>Category</label><select name="catId" required>${DB.catalog().cats.map(c => `<option value="${esc(c.id)}" ${course && course.catId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <div class="inline"><div><label>Price (EGP)</label><input name="price" type="number" min="0" value="${course && course.price != null ? esc(course.price) : ''}"></div>
      <div><label>Tag</label><input name="tag" maxlength="80" value="${course ? esc(course.tag || '') : ''}"></div></div>
      <label>Description</label><textarea name="desc" maxlength="400">${course ? esc(course.desc || '') : ''}</textarea>
      <div class="actions"><button class="btn btn-primary" type="submit">Save course</button><button type="button" class="btn btn-ghost" data-act="cancel-course">Cancel</button></div></form>` : '';
    const catName = id => (cats.find(c => c.id === id) || {}).name || '—';
    const catView = cut('cats', cats), courseView = cut('courses', courses);
    return `${catForm}${courseForm}
      <div class="admin-top"><h2>Categories</h2><button type="button" class="btn btn-primary btn-sm" data-act="edit-cat" data-id="">Add category</button></div>
      <div class="scroll-x"><table class="table"><thead><tr><th>Name</th><th>Parent</th><th>Courses</th><th></th></tr></thead><tbody>
      ${catView.rows.map(c => `<tr><td>${esc(c.ic || '')} ${esc(c.name)}</td><td>${esc(catName(c.parent))}</td><td>${courses.filter(x => x.catId === c.id).length}</td>
        <td><button type="button" class="mini" data-act="edit-cat" data-id="${esc(c.id)}">Edit</button><button type="button" class="mini del" data-act="del-cat" data-id="${esc(c.id)}">Delete</button></td></tr>`).join('') || '<tr><td colspan="4">No categories yet.</td></tr>'}
      </tbody></table></div>${pg('cats', catView)}
      <div class="admin-top" style="margin-top:28px"><h2>Courses</h2><button type="button" class="btn btn-primary btn-sm" data-act="edit-course" data-id="">Add course</button></div>
      <div class="scroll-x"><table class="table"><thead><tr><th>Name</th><th>Category</th><th>Price</th><th></th></tr></thead><tbody>
      ${courseView.rows.map(c => `<tr><td><b>${esc(c.name)}</b><div class="help" style="margin:0">${esc(c.desc || '')}</div></td><td>${esc(catName(c.catId))}</td><td>${esc(DB.money(c.price) || '—')}</td>
        <td><button type="button" class="mini" data-act="edit-course" data-id="${esc(c.id)}">Edit</button><button type="button" class="mini del" data-act="del-course" data-id="${esc(c.id)}">Delete</button></td></tr>`).join('') || '<tr><td colspan="4">No courses yet.</td></tr>'}
      </tbody></table></div>${pg('courses', courseView)}`;
  }

  function schedule() {
    const insts = DB.instructors().slice().sort((a, b) => a.name.localeCompare(b.name));
    const names = DB.catalog().courses.map(c => c.name);
    const rows = DB.slots(state.instFilter || undefined, { all: state.past });
    const view = cut('schedule', rows);
    return `<form data-form="slot" class="panel" style="margin-top:0"><h2>Add a class</h2>
      <div class="inline"><div><label>Instructor</label><select name="instId" required>${insts.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</select></div>
      <div><label>Course</label><input name="course" required maxlength="120" list="course-names"></div></div>
      <datalist id="course-names">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="inline"><div><label>Date</label><input name="date" type="date" required></div>
      <div><label>Time</label><input name="time" type="time" required></div>
      <div><label>Where</label><select name="mode"><option>Online</option><option>Giza campus</option></select></div>
      <div><label>Seats</label><input name="cap" type="number" min="1" max="500" value="8"></div></div>
      <div class="actions"><button class="btn btn-primary" type="submit">Add class</button></div></form>
      <div class="admin-top"><h2>${state.past ? 'All classes' : 'Upcoming classes'}</h2>
        <div><select id="inst-filter">${'<option value="">All instructors</option>' + insts.map(i => `<option value="${esc(i.id)}" ${state.instFilter === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</select>
        <button type="button" class="mini" data-act="past">${state.past ? 'Hide past' : 'Show past'}</button>
        <button type="button" class="mini" data-act="clear-past">Clear empty past classes</button></div></div>
      <div class="scroll-x"><table class="table"><thead><tr><th>When</th><th>Class</th><th>Seats</th><th></th></tr></thead><tbody>
      ${view.rows.map(s => { const i = DB.instructor(s.instId) || { name: '' }; const left = DB.seatsLeft(s);
        return `<tr><td>${esc(DB.fmtDate(s.date))} · ${esc(DB.fmtTime(s.time))}</td><td><b>${esc(s.course)}</b><div class="help" style="margin:0">${esc(i.name)} · ${esc(s.mode || 'Online')}</div></td>
        <td>${left} / ${s.cap || 10}</td><td><button type="button" class="mini" data-act="open-class" data-id="${esc(s.id)}">Manage</button><button type="button" class="mini del" data-act="del-slot" data-id="${esc(s.id)}">Delete</button></td></tr>`; }).join('') || '<tr><td colspan="4">No classes match.</td></tr>'}
      </tbody></table></div>${pg('schedule', view)}`;
  }

  function payButtons(s, b) {
    if (!b.phone) return '';
    const st = DB.payStatus(b);
    const btn = (status, label, del) => `<button type="button" class="mini${del ? ' del' : ''}" data-act="pay" data-slot="${esc(s.id)}" data-phone="${esc(b.phone)}" data-status="${status}">${label}</button>`;
    if (st === 'pending') return btn('paid', 'Confirm') + btn('unpaid', 'Reject', true);
    if (st === 'paid') return btn('unpaid', 'Mark unpaid', true);
    return btn('paid', 'Mark paid');
  }

  function bookings() {
    const rows = DB.bookings();
    const view = cut('bookings', rows);
    return `<h2>Bookings</h2><div class="scroll-x"><table class="table"><thead><tr><th>Student</th><th>Class</th><th>Payment</th><th></th></tr></thead><tbody>
      ${view.rows.map(({ slot, b }) => `<tr><td><b>${esc(b.name || 'Student')}</b><div class="help" style="margin:0">${esc(b.phone || '')}${b.pin ? ' · code ' + esc(b.pin) : ''}</div></td>
        <td>${esc(b.subject || slot.course)}<div class="help" style="margin:0">${esc(DB.fmtDate(slot.date))} · ${esc(DB.fmtTime(slot.time))}${b.price != null ? ' · ' + esc(DB.money(b.price, b.cur)) : ''}</div></td>
        <td>${payBadge(b)}</td><td>${payButtons(slot, b)}</td></tr>`).join('') || '<tr><td colspan="4">No bookings yet.</td></tr>'}
      </tbody></table></div>${pg('bookings', view)}`;
  }

  function requests() {
    const rows = DB.requests();
    if (!rows.length) return '<div class="empty">No requests yet.</div>';
    const view = cut('requests', rows);
    return view.rows.map(r => `<div class="cc"><div class="cc-head"><div><h3>${esc(r.course || 'Request')}</h3><p class="meta">${esc(r.name)} · ${esc(r.phone)}${r.email ? ' · ' + esc(r.email) : ''} · ${esc(r.students || 1)} students · ${esc(r.mode || '')}</p></div><span class="badge ${r.status === 'done' ? 'free' : 'pend'}">${esc(r.status || 'new')}</span></div>
      <p class="summary" style="margin-top:12px">${esc(r.times || '')}${r.note ? ' — ' + esc(r.note) : ''}</p>
      <div class="actions"><button type="button" class="btn btn-primary btn-sm" data-act="req" data-id="${esc(r.id)}" data-status="done">Mark done</button><button type="button" class="btn btn-ghost btn-sm" data-act="req" data-id="${esc(r.id)}" data-status="deleted">Delete</button></div></div>`).join('') + pg('requests', view);
  }

  function settings() {
    const s = DB.settings();
    return `<form data-form="settings" class="panel" style="margin-top:0"><h2>Payment and class defaults</h2>
      <div class="inline"><div><label>InstaPay ID</label><input name="instapayId" value="${esc(s.instapayId || '')}"></div>
      <div><label>Account name</label><input name="instapayName" value="${esc(s.instapayName || '')}"></div></div>
      <label>InstaPay link (optional)</label><input name="instapayLink" value="${esc(s.instapayLink || '')}" placeholder="https://...">
      <label>Note shown to students</label><textarea name="payNote">${esc(s.payNote || '')}</textarea>
      <div class="inline"><div><label>Currency</label><input name="currency" value="${esc(s.currency || 'EGP')}"></div>
      <div><label>Link opens (minutes before)</label><input name="leadMin" type="number" min="0" value="${esc(s.leadMin)}"></div>
      <div><label>Duration (minutes)</label><input name="durMin" type="number" min="15" value="${esc(s.durMin)}"></div>
      <div><label>Recording hours</label><input name="recHours" type="number" min="1" value="${esc(s.recHours)}"></div></div>
      <div class="inline"><div><label>Promo points per booking</label><input name="promoPoints" type="number" min="0" value="${esc(s.promoPoints)}"></div>
      <div><label>Group price is</label><select name="groupMode"><option value="" ${s.groupMode === 'total' ? '' : 'selected'}>Per student</option><option value="total" ${s.groupMode === 'total' ? 'selected' : ''}>A total for the group</option></select></div></div>
      ${DB.remote ? '' : '<label>New admin password (leave blank to keep the current one)</label><input name="password" type="password" autocomplete="new-password">'}
      <div class="actions"><button class="btn btn-primary" type="submit">Save settings</button></div></form>
      ${DB.remote ? '' : `<div class="panel"><h2>Backup on this browser</h2><p class="help">Export keeps a copy of the sample data. Reset puts the original sample catalog back.</p>
        <div class="actions"><button type="button" class="btn btn-ghost" data-act="export">Export</button><button type="button" class="btn btn-ghost" data-act="reset">Reset sample data</button></div>
        <form data-form="import"><label>Restore a backup file</label><input name="file" type="file" accept="application/json,.json" required><div class="actions"><button class="btn btn-primary" type="submit">Restore</button></div></form></div>`}`;
  }

  function classes() {
    const id = meInst();
    const rows = DB.slots(id, { all: state.past });
    const view = cut('classes', rows);
    return `<div class="admin-top"><h2>Your classes</h2><button type="button" class="mini" data-act="past">${state.past ? 'Hide past' : 'Show past'}</button></div>
      <div class="scroll-x"><table class="table"><thead><tr><th>When</th><th>Class</th><th>Seats</th><th></th></tr></thead><tbody>
      ${view.rows.map(s => `<tr><td>${esc(DB.fmtDate(s.date))} · ${esc(DB.fmtTime(s.time))}</td><td><b>${esc(s.course)}</b><div class="help" style="margin:0">${esc(s.mode || 'Online')}${s.link ? ' · link added' : ''}</div></td>
        <td>${DB.seatsLeft(s)} / ${s.cap || 10}</td><td><button type="button" class="mini" data-act="open-class" data-id="${esc(s.id)}">Manage</button></td></tr>`).join('') || '<tr><td colspan="4">No classes on your profile yet.</td></tr>'}
      </tbody></table></div>${pg('classes', view)}`;
  }

  function students() {
    const id = meInst();
    const rows = DB.bookings().filter(x => x.slot.instId === id);
    const view = cut('students', rows);
    return `<h2>Your students</h2><div class="scroll-x"><table class="table"><thead><tr><th>Student</th><th>Class</th><th>Payment</th></tr></thead><tbody>
      ${view.rows.map(({ slot, b }) => `<tr><td><b>${esc(b.name || 'Student')}</b><div class="help" style="margin:0">${esc(b.phone || '')}</div></td>
        <td>${esc(b.subject || slot.course)}<div class="help" style="margin:0">${esc(DB.fmtDate(slot.date))} · ${esc(DB.fmtTime(slot.time))}</div></td><td>${payBadge(b)}</td></tr>`).join('') || '<tr><td colspan="3">No students booked yet.</td></tr>'}
      </tbody></table></div>${pg('students', view)}`;
  }

  function promo() {
    const id = meInst();
    const st = DB.promoStats(id);
    return `<form data-form="promo" class="panel" style="margin-top:0"><h2>Promo code</h2>
      <label>Code students can enter</label><input name="promo" maxlength="30" value="${esc(DB.promoCode(id))}">
      <p class="help">${st.points} points from ${st.count} confirmed booking${st.count === 1 ? '' : 's'}${st.pending ? ' · ' + st.pending + ' still unpaid' : ''}.</p>
      <div class="actions"><button class="btn btn-primary" type="submit">Save code</button></div></form>
      ${st.items && st.items.length ? (() => { const view = cut('promo', st.items); return `<div class="scroll-x"><table class="table"><thead><tr><th>Student</th><th>Class</th><th>Points</th></tr></thead><tbody>
        ${view.rows.map(it => `<tr><td>${esc(it.name || '')}</td><td>${esc(it.course || '')}</td><td>${it.confirmed ? esc(it.points) : 'Pending'}</td></tr>`).join('')}
      </tbody></table></div>${pg('promo', view)}`; })() : ''}`;
  }

  function classModal(s) {
    const i = DB.instructor(s.instId) || { name: '' };
    const mats = (s.materials || []).map(m => `<div class="mat"><span>${esc(m.name || m.url || 'File')}</span><button type="button" data-act="del-mat" data-slot="${esc(s.id)}" data-id="${esc(m.id)}">Remove</button></div>`).join('') || '<p class="help">No materials yet.</p>';
    const rec = s.rec ? `<p class="help">Current recording: ${esc(s.rec.kind === 'url' ? (s.rec.url || '') : (s.rec.name || 'Uploaded file'))} · ${esc(s.rec.hours)} hours</p><button type="button" class="mini del" data-act="clear-rec" data-slot="${esc(s.id)}">Remove recording</button>` : '<p class="help">No recording yet. Paste a link for a full video. An uploaded file must be 10 MB or smaller and stays in this browser.</p>';
    return `<div class="modal open"><div class="box box-wide"><h3>${esc(s.course)}</h3>
      <p class="summary">${esc(DB.fmtDate(s.date, true))} · ${esc(DB.fmtTime(s.time))} · ${esc(i.name)} · <a href="${instHref(s.instId)}" style="color:var(--accent2)">Public profile</a></p>
      <form data-form="class"><input type="hidden" name="id" value="${esc(s.id)}">
        <label>Class link</label><input name="link" value="${esc(s.link || '')}" placeholder="https://meet.google.com/...">
        <div class="inline"><div><label>Link opens (minutes before)</label><input name="lead" type="number" min="0" value="${s.leadMin != null ? esc(s.leadMin) : ''}" placeholder="${esc(DB.settings().leadMin)}"></div>
        <div><label>Duration (minutes)</label><input name="dur" type="number" min="15" value="${s.dur != null ? esc(s.dur) : ''}" placeholder="${esc(DB.settings().durMin)}"></div></div>
        <label>Apply to</label><select name="scope"><option value="one">This class only</option><option value="later">This and later classes of the same course</option></select>
        <div class="actions"><button class="btn btn-primary" type="submit">Save class</button></div></form>
      <p class="sec-t">Materials</p>${mats}
      <form data-form="mat"><input type="hidden" name="id" value="${esc(s.id)}">
        <div class="inline"><div><label>Name</label><input name="name" maxlength="120" placeholder="Week 1 notes"></div><div><label>Link</label><input name="url" placeholder="https://..."></div></div>
        <label>Or upload a file (max 10 MB)</label><input name="file" type="file">
        <div class="actions"><button class="btn btn-primary" type="submit">Add material</button></div></form>
      <p class="sec-t">Recording</p>${rec}
      <form data-form="rec"><input type="hidden" name="id" value="${esc(s.id)}">
        <label>Recording link</label><input name="url" placeholder="https://...">
        <label>Or upload a video (max 10 MB)</label><input name="file" type="file" accept="video/*,.mp4,.webm">
        <label>Available for (hours)</label><input name="hours" type="number" min="1" value="${esc((s.rec && s.rec.hours) || DB.settings().recHours || 72)}">
        <div class="actions"><button class="btn btn-primary" type="submit">Save recording</button><button type="button" class="btn btn-ghost" data-act="close-class">Close</button></div></form>
    </div></div>`;
  }

  function fail(msg) { state.err = msg; render(); }
  function ok(msg) { state.err = ''; if (msg) say(msg); render(); }

  function doLogin(f) {
    state.err = '';
    let good = false;
    if (state.gate === 'inst') good = DB.loginInstructor(f.inst.value, f.pin.value.trim());
    else if (DB.remote) good = DB.login(f.email.value.trim(), f.password.value);
    else good = DB.login(f.password.value);
    if (!good) return fail(state.gate === 'inst' ? 'Wrong instructor or PIN.' : (DB.remote ? loginMsg(DB.loginProblem) : 'Wrong password.'));
    state.tab = DB.isAdmin() ? 'overview' : 'classes';
    ok();
  }

  async function putFile(file) {
    if (!file) return null;
    if (file.size > 10 * 1048576) throw new Error('File is too large (max 10 MB).');
    const id = await DB.files.put(file);
    return { id, name: file.name };
  }

  async function onSubmit(e) {
    const f = e.target;
    if (!f || !f.dataset || !f.dataset.form) return;
    e.preventDefault();
    const kind = f.dataset.form;
    try {
      if (kind === 'login') return doLogin(f);
      if (!DB.role()) return fail('Sign in again.');
      if (kind === 'inst') {
        if (!DB.isAdmin()) return;
        const data = { name: f.name.value.trim(), title: f.title.value.trim(), university: f.university.value.trim(), bio: f.bio.value.trim(), pin: f.pin.value.trim(), promo: f.promo.value.trim(), photo: f.photo.value.trim(), color: +f.color.value || 0, tags: f.tags.value.split(',').map(t => t.trim()).filter(Boolean) };
        if (data.name.length < 2) return fail('Enter the instructor name.');
        if (!data.pin && !(DB.remote && f.id.value)) return fail('Enter a PIN.');
        if (!data.pin) delete data.pin;
        if (f.id.value) data.id = f.id.value;
        DB.saveInstructor(data); state.editInst = null; return ok('Instructor saved');
      }
      if (kind === 'cat') {
        if (!DB.isAdmin()) return;
        const data = { name: f.name.value.trim(), ic: f.ic.value.trim(), desc: f.desc.value.trim(), parent: f.parent.value };
        if (data.name.length < 2) return fail('Enter a category name.');
        if (f.id.value) data.id = f.id.value;
        DB.saveCat(data); state.editCat = null; return ok('Category saved');
      }
      if (kind === 'course') {
        if (!DB.isAdmin()) return;
        const data = { name: f.name.value.trim(), catId: f.catId.value, desc: f.desc.value.trim(), tag: f.tag.value.trim(), price: f.price.value === '' ? null : +f.price.value };
        if (data.name.length < 2) return fail('Enter a course name.');
        if (!data.tag) data.tag = data.name;
        if (f.id.value) data.id = f.id.value;
        DB.saveCourse(data); state.editCourse = null; return ok('Course saved');
      }
      if (kind === 'slot') {
        if (!DB.isAdmin()) return;
        const time = String(f.time.value || '').slice(0, 5);
        const added = DB.addSlot({ instId: f.instId.value, date: f.date.value, time, mode: f.mode.value, course: f.course.value.trim(), cap: Math.max(1, +f.cap.value || 8) });
        if (!added) return fail('That instructor already has a class at this time.');
        return ok('Class added');
      }
      if (kind === 'settings') {
        if (!DB.isAdmin()) return;
        DB.setSettings({ instapayId: f.instapayId.value.trim(), instapayName: f.instapayName.value.trim(), instapayLink: f.instapayLink.value.trim(), payNote: f.payNote.value.trim(), currency: f.currency.value.trim() || 'EGP', leadMin: +f.leadMin.value || 0, durMin: +f.durMin.value || 90, recHours: +f.recHours.value || 72, promoPoints: +f.promoPoints.value || 0, groupMode: f.groupMode.value });
        if (!DB.remote && f.password && f.password.value) DB.setPassword(f.password.value);
        return ok('Settings saved');
      }
      if (kind === 'import') {
        if (!DB.isAdmin() || DB.remote) return;
        const file = f.file.files[0]; if (!file) return;
        DB.import(await file.text()); return ok('Backup restored');
      }
      if (kind === 'class') {
        const s = DB.slot(f.id.value); if (!mine(s)) return;
        const patch = { link: f.link.value.trim() };
        if (f.lead.value !== '') patch.leadMin = Math.max(0, +f.lead.value || 0);
        if (f.dur.value !== '') patch.dur = Math.max(15, +f.dur.value || 15);
        DB.updateClass(s.id, patch, f.scope.value === 'later');
        return ok('Class saved');
      }
      if (kind === 'mat') {
        const s = DB.slot(f.id.value); if (!mine(s)) return;
        const uploaded = await putFile(f.file.files[0]);
        const url = f.url.value.trim();
        if (!uploaded && !url) return fail('Add a link or a file.');
        const name = f.name.value.trim() || (uploaded ? uploaded.name : url);
        DB.addMaterial(s.id, uploaded ? { kind: 'file', name, fileId: uploaded.id } : { kind: 'url', name, url });
        return ok('Material added');
      }
      if (kind === 'rec') {
        const s = DB.slot(f.id.value); if (!mine(s)) return;
        const uploaded = await putFile(f.file.files[0]);
        const url = f.url.value.trim();
        if (!uploaded && !url) return fail('Add a recording link or a file.');
        const hours = Math.max(1, +f.hours.value || 72);
        DB.setRecording(s.id, uploaded ? { kind: 'file', name: uploaded.name, fileId: uploaded.id, hours } : { kind: 'url', url, hours });
        return ok('Recording saved');
      }
      if (kind === 'promo') {
        const id = meInst(); if (!id) return;
        DB.saveInstructor({ id, promo: f.promo.value.trim() });
        return ok('Promo code saved');
      }
    } catch (err) { fail(err.message || 'Could not save that.'); }
  }

  function onClick(e) {
    if (e.target.classList && e.target.classList.contains('modal')) { state.classId = null; state.err = ''; render(); return; }
    const b = e.target.closest && e.target.closest('[data-act]');
    if (!b || !document.getElementById('dash').contains(b)) return;
    const act = b.dataset.act;
    if (act === 'gate') { state.gate = b.dataset.gate; state.err = ''; render(); return; }
    if (act === 'tab') { state.tab = b.dataset.tab; state.err = ''; state.editInst = state.editCat = state.editCourse = null; render(); return; }
    if (act === 'page') {
      if (b.disabled) return;
      const key = b.dataset.key;
      state.pages[key] = +b.dataset.pg || 1;
      render();
      const btn = document.querySelector('#dash .pager [data-key="' + key + '"]');
      const bar = btn && btn.closest('.pager');
      const head = bar && bar.previousElementSibling;
      if (head && head.scrollIntoView) head.scrollIntoView({ block: 'start' });
      return;
    }
    if (act === 'logout') { DB.logout(); state.classId = null; state.err = ''; state.gate = 'admin'; render(); return; }
    if (!DB.role()) return;
    if (act === 'edit-inst') { state.editInst = b.dataset.id || 'new'; state.err = ''; render(); return; }
    if (act === 'cancel-inst') { state.editInst = null; render(); return; }
    if (act === 'del-inst') {
      if (!DB.isAdmin()) return;
      const i = DB.instructor(b.dataset.id);
      if (i && confirm('Delete ' + i.name + ' and their classes?')) { DB.deleteInstructor(i.id); state.editInst = null; ok('Instructor deleted'); }
      return;
    }
    if (act === 'edit-cat') { state.editCat = b.dataset.id || ''; state.editCourse = null; state.err = ''; render(); return; }
    if (act === 'cancel-cat') { state.editCat = null; render(); return; }
    if (act === 'del-cat') {
      if (DB.isAdmin() && confirm('Delete this category and its courses?')) { DB.deleteCat(b.dataset.id); state.editCat = null; ok('Category deleted'); }
      return;
    }
    if (act === 'edit-course') { state.editCourse = b.dataset.id || ''; state.editCat = null; state.err = ''; render(); return; }
    if (act === 'cancel-course') { state.editCourse = null; render(); return; }
    if (act === 'del-course') {
      if (DB.isAdmin() && confirm('Delete this course?')) { DB.deleteCourse(b.dataset.id); state.editCourse = null; ok('Course deleted'); }
      return;
    }
    if (act === 'past') { state.past = !state.past; state.pages.schedule = 1; state.pages.classes = 1; render(); return; }
    if (act === 'clear-past') {
      if (DB.isAdmin() && confirm('Delete past classes that have no students?')) { const n = DB.clearPast(); ok(n ? n + ' classes removed' : 'Nothing to clear'); }
      return;
    }
    if (act === 'del-slot') {
      if (DB.isAdmin() && confirm('Delete this class?')) { if (state.classId === b.dataset.id) state.classId = null; DB.deleteSlot(b.dataset.id); ok('Class deleted'); }
      return;
    }
    if (act === 'open-class') { state.classId = b.dataset.id; state.err = ''; render(); return; }
    if (act === 'close-class') { state.classId = null; state.err = ''; render(); return; }
    if (act === 'pay') { DB.setPayStatus(b.dataset.slot, b.dataset.phone, b.dataset.status); ok('Payment updated'); return; }
    if (act === 'req') { DB.setRequestStatus(b.dataset.id, b.dataset.status); ok('Request updated'); return; }
    if (act === 'del-mat') { const s = DB.slot(b.dataset.slot); if (mine(s)) { DB.removeMaterial(s.id, b.dataset.id); ok('Material removed'); } return; }
    if (act === 'clear-rec') { const s = DB.slot(b.dataset.slot); if (mine(s)) { DB.clearRecording(s.id); ok('Recording removed'); } return; }
    if (act === 'export') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([DB.export()], { type: 'application/json' }));
      a.download = 'uniboost-backup.json'; document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    if (act === 'reset') {
      if (!DB.remote && DB.isAdmin() && confirm('Replace everything on this browser with the original sample data?')) { DB.reset(); state.classId = null; ok('Sample data restored'); }
    }
  }

  function onChange(e) {
    if (e.target && e.target.id === 'inst-filter') { state.instFilter = e.target.value; state.pages.schedule = 1; render(); }
  }

  function mount() {
    const el = document.getElementById('dash');
    if (!el) return;
    const role = DB.role();
    el.innerHTML = role && (role.admin || role.inst) ? shell() : loginView();
    if (el.dataset.wired !== '1') {
      el.dataset.wired = '1';
      el.addEventListener('click', onClick);
      el.addEventListener('submit', onSubmit);
      el.addEventListener('change', onChange);
    }
  }

  function render() { mount(); }

  window.UCC_PAGES = window.UCC_PAGES || {};
  window.UCC_PAGES.dashboard = mount;
  if (!window.__NEXT && /dashboard(\.html)?$/.test(location.pathname || '')) mount();
})();
