'use strict';

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

function get(id)   { return document.getElementById(id); }
function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
function qsa(sel, ctx) { return [...(ctx || document).querySelectorAll(sel)]; }
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls)  e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const Modal = {
  _resolve: null,
  show(title, html, onSubmit) {
    get('modal-title').textContent = title;
    get('modal-body').innerHTML = html;
    get('modal').classList.remove('hidden');
    // Focus first input
    const first = qs('input, textarea, select', get('modal-body'));
    if (first) setTimeout(() => first.focus(), 50);

    const form = qs('form', get('modal-body'));
    if (form && onSubmit) {
      form.onsubmit = (e) => { e.preventDefault(); onSubmit(form); };
    }
  },
  close() {
    get('modal').classList.add('hidden');
    get('modal-body').innerHTML = '';
  }
};

get('modal-close').onclick    = () => Modal.close();
get('modal-backdrop').onclick = () => Modal.close();
document.addEventListener('keydown', e => { if (e.key === 'Escape') Modal.close(); });

let currentSection = 'dashboard';

function navigate(section) {
  currentSection = section;
  qsa('.section').forEach(s => s.classList.add('hidden'));
  qsa('.nav-item').forEach(n => n.classList.remove('active'));
  get(`section-${section}`).classList.remove('hidden');
  qs(`.nav-item[data-section="${section}"]`).classList.add('active');
  loaders[section]();
}

qsa('.nav-item').forEach(item => {
  item.addEventListener('click', () => navigate(item.dataset.section));
});

const loaders = {
  dashboard: loadDashboard,
  plants:    loadPlants,
  beds:      loadBeds,
  calendar:  loadCalendar,
  tasks:     loadTasks,
  journal:   loadNotes,
};

async function loadDashboard() {
  const [plants, beds, tasks, events, notes] = await Promise.all([
    api('GET', '/api/plants'),
    api('GET', '/api/beds'),
    api('GET', '/api/tasks'),
    api('GET', '/api/calendar'),
    api('GET', '/api/notes'),
  ]);

  const pending = tasks.filter(t => !t.completed);
  const upcoming = events.filter(e => e.event_date >= today()).slice(0, 5);

  // Stats
  const statsEl = get('dashboard-stats');
  statsEl.innerHTML = '';
  [
    { value: plants.length, label: 'Plants' },
    { value: beds.length,   label: 'Garden Beds' },
    { value: pending.length, label: 'Pending Tasks' },
    { value: upcoming.length, label: 'Upcoming Events' },
  ].forEach(s => {
    const card = el('div', 'stat-card');
    card.innerHTML = `<div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div>`;
    statsEl.appendChild(card);
  });

  // Upcoming tasks
  const tasksEl = get('dashboard-tasks');
  tasksEl.innerHTML = '';
  const upTasks = pending.filter(t => !t.due_date || t.due_date >= today()).slice(0, 5);
  if (!upTasks.length) {
    tasksEl.innerHTML = '<div class="panel-empty">No pending tasks</div>';
  } else {
    upTasks.forEach(t => {
      const item = el('div', 'panel-item');
      item.innerHTML = `<div class="panel-item-title">${escHtml(t.title)}</div>
        <div class="panel-item-meta">${t.due_date ? fmtDate(t.due_date) : 'No due date'} &bull; ${t.type}</div>`;
      item.onclick = () => navigate('tasks');
      tasksEl.appendChild(item);
    });
  }

  // Upcoming events
  const eventsEl = get('dashboard-events');
  eventsEl.innerHTML = '';
  if (!upcoming.length) {
    eventsEl.innerHTML = '<div class="panel-empty">No upcoming events</div>';
  } else {
    upcoming.forEach(ev => {
      const item = el('div', 'panel-item');
      item.innerHTML = `<div class="panel-item-title">${escHtml(ev.title)}</div>
        <div class="panel-item-meta">${fmtDate(ev.event_date)} &bull; ${ev.type}</div>`;
      item.onclick = () => navigate('calendar');
      eventsEl.appendChild(item);
    });
  }

  // Recent journal
  const journalEl = get('dashboard-journal');
  journalEl.innerHTML = '';
  const recentNotes = notes.slice(0, 5);
  if (!recentNotes.length) {
    journalEl.innerHTML = '<div class="panel-empty">No journal entries</div>';
  } else {
    recentNotes.forEach(n => {
      const item = el('div', 'panel-item');
      item.innerHTML = `<div class="panel-item-title">${escHtml(n.title)}</div>
        <div class="panel-item-meta">${fmtDate(n.entry_date)}</div>`;
      item.onclick = () => { navigate('journal'); };
      journalEl.appendChild(item);
    });
  }
}

let allPlants = [];

async function loadPlants() {
  allPlants = await api('GET', '/api/plants');
  renderPlants();
}

function renderPlants() {
  const search = get('plant-search').value.toLowerCase();
  const typeFilter = get('plant-type-filter').value;

  let list = allPlants;
  if (search) list = list.filter(p => p.name.toLowerCase().includes(search) || (p.variety || '').toLowerCase().includes(search));
  if (typeFilter) list = list.filter(p => p.type === typeFilter);

  const grid = get('plants-grid');
  grid.innerHTML = '';

  if (!list.length) {
    grid.innerHTML = '<div class="plant-card-empty">No plants found. Add one to get started.</div>';
    return;
  }

  list.forEach(p => {
    const card = el('div', 'plant-card');
    card.innerHTML = `
      <div class="plant-card-top" style="background:${escHtml(p.color)}"></div>
      <div class="plant-card-body">
        <div class="plant-card-name">${escHtml(p.name)}</div>
        ${p.variety ? `<div class="plant-card-variety">${escHtml(p.variety)}</div>` : ''}
        ${p.type ? `<span class="plant-card-type">${escHtml(p.type)}</span>` : ''}
        <div class="plant-card-info">
          ${p.sun_requirement ? `<span class="plant-info-pill">&#9728; ${escHtml(p.sun_requirement)}</span>` : ''}
          ${p.water_needs ? `<span class="plant-info-pill">&#128167; ${escHtml(p.water_needs)}</span>` : ''}
          ${p.days_to_maturity ? `<span class="plant-info-pill">${p.days_to_maturity}d</span>` : ''}
          ${p.spacing_inches ? `<span class="plant-info-pill">${p.spacing_inches}" spacing</span>` : ''}
        </div>
      </div>`;
    card.onclick = () => showPlantForm(p);
    grid.appendChild(card);
  });
}

get('plant-search').addEventListener('input', renderPlants);
get('plant-type-filter').addEventListener('change', renderPlants);
get('btn-add-plant').addEventListener('click', () => showPlantForm(null));

function plantFormHtml(p) {
  return `<form id="plant-form">
    <div class="form-row">
      <label>Name *</label>
      <input class="input" name="name" value="${escHtml(p?.name || '')}" required>
    </div>
    <div class="form-row-2">
      <div class="form-row">
        <label>Type</label>
        <select class="input" name="type">
          ${['', 'vegetable','fruit','herb','flower','tree','other'].map(t =>
            `<option value="${t}" ${p?.type===t?'selected':''}>${t || '— select —'}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>Variety</label>
        <input class="input" name="variety" value="${escHtml(p?.variety || '')}">
      </div>
    </div>
    <div class="form-row-2">
      <div class="form-row">
        <label>Sun Requirement</label>
        <select class="input" name="sun_requirement">
          ${['','full sun','partial shade','full shade'].map(s =>
            `<option value="${s}" ${p?.sun_requirement===s?'selected':''}>${s || '— select —'}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>Water Needs</label>
        <select class="input" name="water_needs">
          ${['','low','medium','high'].map(w =>
            `<option value="${w}" ${p?.water_needs===w?'selected':''}>${w || '— select —'}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row-2">
      <div class="form-row">
        <label>Spacing (inches)</label>
        <input class="input" type="number" name="spacing_inches" min="1" value="${p?.spacing_inches || ''}">
      </div>
      <div class="form-row">
        <label>Days to Maturity</label>
        <input class="input" type="number" name="days_to_maturity" min="1" value="${p?.days_to_maturity || ''}">
      </div>
    </div>
    <div class="form-row">
      <label>Planting Depth</label>
      <input class="input" name="planting_depth" value="${escHtml(p?.planting_depth || '')}">
    </div>
    <div class="form-row">
      <label>Color (for bed view)</label>
      <div class="color-input-row">
        <input type="color" name="color_picker" value="${p?.color || '#4a7c4e'}">
        <input class="input" type="text" name="color" value="${p?.color || '#4a7c4e'}" pattern="^#[0-9a-fA-F]{6}$">
      </div>
    </div>
    <div class="form-row">
      <label>Notes</label>
      <textarea class="input" name="notes">${escHtml(p?.notes || '')}</textarea>
    </div>
    <div class="form-actions">
      ${p ? `<button type="button" class="btn btn-danger btn-sm" id="btn-del-plant">Delete</button>` : ''}
      <button type="button" class="btn btn-ghost" id="btn-cancel-plant">Cancel</button>
      <button type="submit" class="btn btn-primary">${p ? 'Save Changes' : 'Add Plant'}</button>
    </div>
  </form>`;
}

function showPlantForm(plant) {
  Modal.show(plant ? 'Edit Plant' : 'Add Plant', plantFormHtml(plant), async (form) => {
    const data = formData(form);
    try {
      if (plant) {
        await api('PUT', `/api/plants/${plant.id}`, data);
      } else {
        await api('POST', '/api/plants', data);
      }
      Modal.close();
      await loadPlants();
    } catch (e) { alert(e.message); }
  });

  // Sync color picker <-> text input
  const picker = qs('[name="color_picker"]', get('modal-body'));
  const colorText = qs('[name="color"]', get('modal-body'));
  picker.oninput = () => { colorText.value = picker.value; };
  colorText.oninput = () => { if (/^#[0-9a-fA-F]{6}$/.test(colorText.value)) picker.value = colorText.value; };

  const cancelBtn = get('btn-cancel-plant');
  if (cancelBtn) cancelBtn.onclick = Modal.close;

  const delBtn = get('btn-del-plant');
  if (delBtn) delBtn.onclick = async () => {
    if (!confirm(`Delete "${plant.name}"? This will remove it from all bed layouts.`)) return;
    await api('DELETE', `/api/plants/${plant.id}`);
    Modal.close();
    await loadPlants();
  };
}

let allBeds = [];
let currentBedId = null;

async function loadBeds() {
  allBeds = await api('GET', '/api/beds');
  showBedsListView();
  renderBeds();
}

function showBedsListView() {
  get('beds-list-view').classList.remove('hidden');
  get('bed-detail-view').classList.add('hidden');
}

function renderBeds() {
  const grid = get('beds-grid');
  grid.innerHTML = '';
  if (!allBeds.length) {
    grid.innerHTML = '<div class="bed-card-empty">No beds yet. Add one to start planning your layout.</div>';
    return;
  }
  allBeds.forEach(b => {
    const card = el('div', 'bed-card');
    // Mini preview grid (up to 6x4)
    const previewRows = Math.min(b.rows, 4);
    const previewCols = Math.min(b.cols, 6);
    let previewHtml = `<div class="bed-card-preview" style="--cols:${previewCols}">`;
    for (let r = 0; r < previewRows; r++) {
      previewHtml += '<div class="bed-preview-row">';
      for (let c = 0; c < previewCols; c++) previewHtml += '<div class="bed-preview-cell"></div>';
      previewHtml += '</div>';
    }
    previewHtml += '</div>';
    card.innerHTML = `
      <div class="bed-card-name">${escHtml(b.name)}</div>
      <div class="bed-card-dims">${b.rows} rows &times; ${b.cols} columns</div>
      ${previewHtml}`;
    card.onclick = () => openBedDetail(b.id);
    grid.appendChild(card);
  });
}

async function openBedDetail(bedId) {
  currentBedId = bedId;
  const bed = await api('GET', `/api/beds/${bedId}`);
  get('beds-list-view').classList.add('hidden');
  get('bed-detail-view').classList.remove('hidden');
  get('bed-detail-name').textContent = bed.name;
  renderBedDetail(bed);
}

function renderBedDetail(bed) {
  const body = get('bed-detail-body');

  // Build a cell lookup: "row,col" -> cell info
  const cellMap = {};
  (bed.cells || []).forEach(c => { cellMap[`${c.row_num},${c.col_num}`] = c; });

  // Legend
  const legend = {};
  (bed.cells || []).forEach(c => {
    if (c.plant_id && !legend[c.plant_id]) legend[c.plant_id] = { name: c.plant_name, color: c.plant_color };
  });

  // Build table
  let tableHtml = '<table class="bed-grid"><thead><tr><th></th>';
  for (let c = 0; c < bed.cols; c++) tableHtml += `<th>${c + 1}</th>`;
  tableHtml += '</tr></thead><tbody>';

  for (let r = 0; r < bed.rows; r++) {
    tableHtml += `<tr><th>${r + 1}</th>`;
    for (let c = 0; c < bed.cols; c++) {
      const cell = cellMap[`${r},${c}`];
      const color = cell?.plant_color || '';
      const name  = cell?.plant_name  || '';
      const style = color ? `style="background:${escHtml(color)}"` : '';
      const cls   = color ? 'bed-cell-inner planted' : 'bed-cell-inner';
      tableHtml += `<td class="bed-cell" data-row="${r}" data-col="${c}">
        <div class="${cls}" ${style}>${escHtml(name)}</div></td>`;
    }
    tableHtml += '</tr>';
  }
  tableHtml += '</tbody></table>';

  let legendHtml = '';
  const legendItems = Object.entries(legend);
  if (legendItems.length) {
    legendHtml = '<div class="bed-legend"><h3>Plants</h3>';
    legendItems.forEach(([, info]) => {
      legendHtml += `<div class="legend-item">
        <div class="legend-swatch" style="background:${escHtml(info.color)}"></div>
        <span>${escHtml(info.name)}</span></div>`;
    });
    legendHtml += '</div>';
  }

  const notesHtml = bed.notes ? `<div class="bed-notes">${escHtml(bed.notes)}</div>` : '';

  body.innerHTML = `<div class="bed-detail-body">
    <div class="bed-grid-wrap">${tableHtml}</div>
    ${legendHtml}
  </div>${notesHtml}`;

  // Cell click
  qsa('.bed-cell', body).forEach(cell => {
    cell.addEventListener('click', () => {
      assignPlantToCell(bed.id, +cell.dataset.row, +cell.dataset.col, cellMap[`${cell.dataset.row},${cell.dataset.col}`]?.plant_id || null);
    });
  });
}

async function assignPlantToCell(bedId, row, col, currentPlantId) {
  const options = allPlants.map(p =>
    `<div class="cell-picker-option ${currentPlantId === p.id ? 'selected' : ''}" data-id="${p.id}">
      <div class="cell-swatch" style="background:${escHtml(p.color)}"></div>${escHtml(p.name)}
    </div>`
  ).join('');

  const clearBtn = currentPlantId
    ? `<div class="cell-picker-option clear" data-id="__clear">&#10005; Clear cell</div>`
    : '';

  Modal.show('Assign Plant', `
    <p style="margin-bottom:12px;font-size:13px;color:var(--text-muted)">Row ${row+1}, Column ${col+1}</p>
    <div class="cell-picker">${clearBtn}${options || '<p style="color:var(--text-muted);font-style:italic">No plants in catalog yet.</p>'}</div>
  `);

  qsa('.cell-picker-option', get('modal-body')).forEach(opt => {
    opt.addEventListener('click', async () => {
      const rawId = opt.dataset.id;
      const plantId = rawId === '__clear' ? null : +rawId;
      await api('PUT', `/api/beds/${bedId}/cells/${row}/${col}`, { plant_id: plantId });
      Modal.close();
      const bed = await api('GET', `/api/beds/${bedId}`);
      renderBedDetail(bed);
    });
  });
}

function bedFormHtml(b) {
  return `<form id="bed-form">
    <div class="form-row">
      <label>Name *</label>
      <input class="input" name="name" value="${escHtml(b?.name || '')}" required>
    </div>
    <div class="form-row-2">
      <div class="form-row">
        <label>Rows</label>
        <input class="input" type="number" name="rows" min="1" max="20" value="${b?.rows || 4}" required>
      </div>
      <div class="form-row">
        <label>Columns</label>
        <input class="input" type="number" name="cols" min="1" max="20" value="${b?.cols || 6}" required>
      </div>
    </div>
    <div class="form-row">
      <label>Notes</label>
      <textarea class="input" name="notes">${escHtml(b?.notes || '')}</textarea>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" id="btn-cancel-bed">Cancel</button>
      <button type="submit" class="btn btn-primary">${b ? 'Save Changes' : 'Create Bed'}</button>
    </div>
  </form>`;
}

get('btn-add-bed').addEventListener('click', () => {
  Modal.show('New Garden Bed', bedFormHtml(null), async (form) => {
    const data = formData(form);
    try {
      await api('POST', '/api/beds', data);
      Modal.close();
      await loadBeds();
    } catch (e) { alert(e.message); }
  });
  const cancelBtn = get('btn-cancel-bed');
  if (cancelBtn) cancelBtn.onclick = Modal.close;
});

get('btn-back-beds').addEventListener('click', async () => {
  showBedsListView();
  await loadBeds();
});

get('btn-edit-bed').addEventListener('click', async () => {
  const bed = await api('GET', `/api/beds/${currentBedId}`);
  Modal.show('Edit Bed', bedFormHtml(bed), async (form) => {
    const data = formData(form);
    try {
      await api('PUT', `/api/beds/${currentBedId}`, data);
      Modal.close();
      await openBedDetail(currentBedId);
    } catch (e) { alert(e.message); }
  });
  const cancelBtn = get('btn-cancel-bed');
  if (cancelBtn) cancelBtn.onclick = Modal.close;
});

get('btn-delete-bed').addEventListener('click', async () => {
  const bed = allBeds.find(b => b.id === currentBedId);
  if (!confirm(`Delete "${bed?.name}"? This cannot be undone.`)) return;
  await api('DELETE', `/api/beds/${currentBedId}`);
  showBedsListView();
  await loadBeds();
});

let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-based
let allEvents = [];

async function loadCalendar() {
  allEvents = await api('GET', '/api/calendar');
  renderCalendar();
}
