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

const PAGE_SIZE = 25;

function renderPagination(containerId, page, total, onPageChange) {
  const container = get(containerId);
  container.innerHTML = '';
  if (total <= PAGE_SIZE) return;

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);

  const prev = el('button', 'btn btn-ghost btn-sm', '&larr; Prev');
  const info = el('span', 'pagination-info', `${start}–${end} of ${total}`);
  const next = el('button', 'btn btn-ghost btn-sm', 'Next &rarr;');

  prev.disabled = page === 0;
  next.disabled = page >= totalPages - 1;
  prev.onclick = () => onPageChange(page - 1);
  next.onclick = () => onPageChange(page + 1);

  container.append(prev, info, next);
}

function showToast(msg) {
  const container = get('toast-container');
  const toast = el('div', 'toast', msg);
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 4000);
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
  location.hash = section;
  return loaders[section]();
}

qsa('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    get('global-search').value = '';
    navigate(item.dataset.section);
  });
});

const loaders = {
  dashboard: loadDashboard,
  plants:    loadPlants,
  beds:      loadBeds,
  calendar:  loadCalendar,
  tasks:     loadTasks,
  journal:   loadNotes,
  harvest:   loadHarvests,
};

async function loadDashboard() {
  const [plants, beds, pendingTasks, events, notes] = await Promise.all([
    api('GET', '/api/plants'),
    api('GET', '/api/beds'),
    api('GET', '/api/tasks?completed=false&limit=5'),
    api('GET', '/api/calendar'),
    api('GET', '/api/notes?limit=5'),
  ]);

  const pending = pendingTasks.data;
  const pendingTotal = pendingTasks.total;
  const upcoming = events.filter(e => e.event_date >= today()).slice(0, 5);

  // Stats
  const statsEl = get('dashboard-stats');
  statsEl.innerHTML = '';
  [
    { value: plants.length, label: 'Plants' },
    { value: beds.length,   label: 'Garden Beds' },
    { value: pendingTotal, label: 'Pending Tasks' },
    { value: upcoming.length, label: 'Upcoming Events' },
  ].forEach(s => {
    const card = el('div', 'stat-card');
    card.innerHTML = `<div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div>`;
    statsEl.appendChild(card);
  });

  // Upcoming tasks
  const tasksEl = get('dashboard-tasks');
  tasksEl.innerHTML = '';
  const upTasks = pending.slice(0, 5);
  if (!upTasks.length) {
    tasksEl.innerHTML = '<div class="panel-empty">No pending tasks</div>';
  } else {
    upTasks.forEach(t => {
      const item = el('div', 'panel-item');
      item.innerHTML = `<div class="panel-item-title">${escHtml(t.title)}</div>
        <div class="panel-item-meta">${t.due_date ? fmtDate(t.due_date) : 'No due date'} &bull; ${t.type}</div>`;
      item.onclick = () => { navigate('tasks'); showTaskForm(t); };
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
      item.onclick = () => { navigate('calendar'); showEventForm(ev); };
      eventsEl.appendChild(item);
    });
  }

  // Recent journal
  const journalEl = get('dashboard-journal');
  journalEl.innerHTML = '';
  const recentNotes = notes.data;
  if (!recentNotes.length) {
    journalEl.innerHTML = '<div class="panel-empty">No journal entries</div>';
  } else {
    recentNotes.forEach(n => {
      const item = el('div', 'panel-item');
      item.innerHTML = `<div class="panel-item-title">${escHtml(n.title)}</div>
        <div class="panel-item-meta">${fmtDate(n.entry_date)}</div>`;
      item.onclick = async () => { await navigate('journal'); openNote(n.id); };
      journalEl.appendChild(item);
    });
  }
}

let allPlants = [];
let plantsPage = 0;

async function loadPlants() {
  allPlants = await api('GET', '/api/plants');
  plantsPage = 0;
  renderPlants();
}

async function refreshPlantsCache() { allPlants = await api('GET', '/api/plants'); }
async function refreshBedsCache() { allBeds = await api('GET', '/api/beds'); }

function renderPlants() {
  const search = get('plant-search').value.toLowerCase();
  const typeFilter = get('plant-type-filter').value;

  let list = allPlants;
  if (search) list = list.filter(p => p.name.toLowerCase().includes(search) || (p.variety || '').toLowerCase().includes(search));
  if (typeFilter) list = list.filter(p => p.type === typeFilter);

  const total = list.length;
  const paged = list.slice(plantsPage * PAGE_SIZE, (plantsPage + 1) * PAGE_SIZE);

  const grid = get('plants-grid');
  grid.innerHTML = '';

  if (!paged.length) {
    grid.innerHTML = '<div class="plant-card-empty">No plants found. Add one to get started.</div>';
    renderPagination('plants-pagination', plantsPage, total, p => { plantsPage = p; renderPlants(); });
    return;
  }

  paged.forEach(p => {
    const card = el('div', 'plant-card');
    const topHtml = p.image_url
      ? `<div class="plant-card-photo"><img src="${escHtml(p.image_url)}" alt="${escHtml(p.name)}"></div>`
      : `<div class="plant-card-top" style="background:${escHtml(p.color)}"></div>`;
    card.innerHTML = `
      ${topHtml}
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
  renderPagination('plants-pagination', plantsPage, total, p => { plantsPage = p; renderPlants(); });
}

get('plant-search').addEventListener('input', () => { plantsPage = 0; renderPlants(); });
get('plant-type-filter').addEventListener('change', () => { plantsPage = 0; renderPlants(); });
get('btn-add-plant').addEventListener('click', () => showPlantForm(null));
get('btn-export-plants').addEventListener('click', () => showExportModal('Export Plants', '/api/plants', 'plants'));

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
    <div class="form-row">
      <label>Photo</label>
      <div class="photo-upload-wrap">
        ${p?.image_url ? `<img class="photo-preview" src="${escHtml(p.image_url)}" alt="Plant photo">` : '<div class="photo-preview photo-placeholder">No photo</div>'}
        <div class="photo-actions">
          <label class="btn btn-ghost btn-sm">
            Choose Photo
            <input type="file" id="plant-photo-input" accept="image/*" style="display:none">
          </label>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-remove-photo"${!p?.image_url ? ' style="display:none"' : ''}>Remove</button>
        </div>
      </div>
      <input type="hidden" name="image_url" value="${escHtml(p?.image_url || '')}">
    </div>
    <div class="form-actions">
      ${p ? `<button type="button" class="btn btn-danger btn-sm" id="btn-del-plant">Delete</button>` : ''}
      ${p ? `<button type="button" class="btn btn-secondary btn-sm" id="btn-log-harvest-plant">Log Harvest</button>` : ''}
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
      await Promise.all([loadPlants(), refreshBedsCache()]);
    } catch (e) { showToast(e.message); }
  });

  // Sync color picker <-> text input
  const picker = qs('[name="color_picker"]', get('modal-body'));
  const colorText = qs('[name="color"]', get('modal-body'));
  picker.oninput = () => { colorText.value = picker.value; };
  colorText.oninput = () => { if (/^#[0-9a-fA-F]{6}$/.test(colorText.value)) picker.value = colorText.value; };

  // Photo upload
  const photoInput = get('plant-photo-input');
  const removePhotoBtn = get('btn-remove-photo');
  const imageUrlInput = qs('[name="image_url"]', get('modal-body'));
  const previewWrap = qs('.photo-upload-wrap', get('modal-body'));

  function updatePhotoPreview(src) {
    const existing = qs('.photo-preview', previewWrap);
    if (src) {
      if (existing.tagName === 'IMG') {
        existing.src = src;
      } else {
        const img = document.createElement('img');
        img.className = 'photo-preview';
        img.alt = 'Plant photo';
        img.src = src;
        existing.replaceWith(img);
      }
      removePhotoBtn.style.display = '';
    } else {
      if (existing.tagName === 'IMG') {
        const ph = document.createElement('div');
        ph.className = 'photo-preview photo-placeholder';
        ph.textContent = 'No photo';
        existing.replaceWith(ph);
      }
      removePhotoBtn.style.display = 'none';
    }
    imageUrlInput.value = src || '';
  }

  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('Photo must be under 10 MB'); photoInput.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (e) => updatePhotoPreview(e.target.result);
    reader.readAsDataURL(file);
  });
  removePhotoBtn.addEventListener('click', () => { photoInput.value = ''; updatePhotoPreview(null); });

  const cancelBtn = get('btn-cancel-plant');
  if (cancelBtn) cancelBtn.onclick = Modal.close;

  const logHarvestPlantBtn = get('btn-log-harvest-plant');
  if (logHarvestPlantBtn) logHarvestPlantBtn.onclick = () => {
    Modal.close();
    showHarvestForm(null, plant.id, null);
  };

  const delBtn = get('btn-del-plant');
  if (delBtn) delBtn.onclick = async () => {
    const links = await api('GET', `/api/plants/${plant.id}/links`);
    const parts = [];
    if (links.bed_cells > 0) parts.push(`${links.bed_cells} bed cell${links.bed_cells !== 1 ? 's' : ''}`);
    if (links.calendar_events > 0) parts.push(`${links.calendar_events} calendar event${links.calendar_events !== 1 ? 's' : ''}`);
    if (links.tasks > 0) parts.push(`${links.tasks} task${links.tasks !== 1 ? 's' : ''}`);
    if (links.journal_entries > 0) parts.push(`${links.journal_entries} journal entr${links.journal_entries !== 1 ? 'ies' : 'y'}`);
    const linkMsg = parts.length > 0
      ? `\n\nThis will unlink it from: ${parts.join(', ')}.`
      : '';
    if (!confirm(`Delete "${plant.name}"?${linkMsg}`)) return;
    await api('DELETE', `/api/plants/${plant.id}`);
    Modal.close();
    await Promise.all([loadPlants(), refreshBedsCache()]);
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
    const cellMap = {};
    (b.cells || []).forEach(c => { cellMap[`${c.row_num},${c.col_num}`] = c.plant_color; });
    let previewHtml = `<div class="bed-card-preview" style="--cols:${previewCols}">`;
    for (let r = 0; r < previewRows; r++) {
      previewHtml += '<div class="bed-preview-row">';
      for (let c = 0; c < previewCols; c++) {
        const color = cellMap[`${r},${c}`];
        const style = color ? ` style="background:${escHtml(color)}"` : '';
        const cls = color ? 'bed-preview-cell occupied' : 'bed-preview-cell';
        previewHtml += `<div class="${cls}"${style}></div>`;
      }
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

  const totalCells = bed.rows * bed.cols;
  const plantedCells = (bed.cells || []).filter(c => c.plant_id).length;
  const coverageHtml = `<div class="bed-coverage">${plantedCells} of ${totalCells} cells planted</div>`;

  body.innerHTML = `<div class="bed-detail-body">
    <div class="bed-grid-wrap">${tableHtml}</div>
    ${legendHtml}
  </div>${coverageHtml}${notesHtml}`;

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
      ${p.image_url
        ? `<img class="cell-thumb" src="${escHtml(p.image_url)}" alt="">`
        : `<div class="cell-swatch" style="background:${escHtml(p.color)}"></div>`}${escHtml(p.name)}
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

      if (currentPlantId && plantId !== currentPlantId) {
        const currentPlant = allPlants.find(p => p.id === currentPlantId);
        const currentName = currentPlant ? currentPlant.name : 'the current plant';
        const newPlant = plantId ? allPlants.find(p => p.id === plantId) : null;
        const action = newPlant ? `Replace with ${newPlant.name}?` : 'Clear this cell?';
        if (!confirm(`This cell contains ${currentName}. ${action}`)) return;
      }

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
      await Promise.all([loadBeds(), refreshPlantsCache()]);
    } catch (e) { showToast(e.message); }
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
      await Promise.all([openBedDetail(currentBedId), refreshPlantsCache()]);
    } catch (e) { showToast(e.message); }
  });
  const cancelBtn = get('btn-cancel-bed');
  if (cancelBtn) cancelBtn.onclick = Modal.close;
});

get('btn-delete-bed').addEventListener('click', async () => {
  const bed = allBeds.find(b => b.id === currentBedId);
  if (!confirm(`Delete "${bed?.name}"? This cannot be undone.`)) return;
  await api('DELETE', `/api/beds/${currentBedId}`);
  showBedsListView();
  await Promise.all([loadBeds(), refreshPlantsCache()]);
});

get('btn-log-harvest-bed').addEventListener('click', () => {
  showHarvestForm(null, null, currentBedId);
});

get('btn-save-as-template').addEventListener('click', () => {
  const bed = allBeds.find(b => b.id === currentBedId) || {};
  Modal.show('Save as Template', `
    <form id="template-save-form">
      <div class="form-row">
        <label>Template Name *</label>
        <input class="input" name="name" value="${escHtml(bed.name || '')}" required>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" id="btn-cancel-template">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Template</button>
      </div>
    </form>
  `, async (form) => {
    const { name } = formData(form);
    try {
      await api('POST', '/api/beds/templates', { name, bed_id: currentBedId });
      Modal.close();
      showToast('Template saved.');
    } catch (e) { showToast(e.message); }
  });
  get('btn-cancel-template').onclick = Modal.close;
});

get('btn-from-template').addEventListener('click', async () => {
  const templates = await api('GET', '/api/beds/templates');
  if (!templates.length) {
    Modal.show('From Template', '<p style="color:var(--text-muted);padding:16px 0">No templates saved yet. Open a bed and use "Save as Template" to create one.</p>');
    return;
  }

  function templatePreviewHtml(t) {
    const previewRows = Math.min(t.rows, 4);
    const previewCols = Math.min(t.cols, 6);
    const cellMap = {};
    (t.cells || []).forEach(c => { cellMap[`${c.row_num},${c.col_num}`] = c.plant_color; });
    let html = `<div class="bed-card-preview" style="--cols:${previewCols}">`;
    for (let r = 0; r < previewRows; r++) {
      html += '<div class="bed-preview-row">';
      for (let c = 0; c < previewCols; c++) {
        const color = cellMap[`${r},${c}`];
        const style = color ? ` style="background:${escHtml(color)}"` : '';
        const cls = color ? 'bed-preview-cell occupied' : 'bed-preview-cell';
        html += `<div class="${cls}"${style}></div>`;
      }
      html += '</div>';
    }
    return html + '</div>';
  }

  const listHtml = templates.map(t => `
    <div class="template-option" data-id="${t.id}">
      <div>
        <div class="bed-card-name">${escHtml(t.name)}</div>
        <div class="bed-card-dims">${t.rows} rows &times; ${t.cols} columns</div>
      </div>
      ${templatePreviewHtml(t)}
    </div>`).join('');

  Modal.show('New Bed from Template', `<div class="template-list">${listHtml}</div>`);

  qsa('.template-option', get('modal-body')).forEach(opt => {
    opt.addEventListener('click', () => {
      const templateId = opt.dataset.id;
      const tName = templates.find(t => t.id === +templateId)?.name || '';
      Modal.show('New Bed from Template', `
        <form id="bed-from-template-form">
          <div class="form-row">
            <label>Bed Name *</label>
            <input class="input" name="name" value="${escHtml(tName)}" required>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-ghost" id="btn-cancel-from-template">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Bed</button>
          </div>
        </form>
      `, async (form) => {
        const { name } = formData(form);
        try {
          const bed = await api('POST', `/api/beds/from-template/${templateId}`, { name });
          Modal.close();
          await loadBeds();
          await openBedDetail(bed.id);
        } catch (e) { showToast(e.message); }
      });
      get('btn-cancel-from-template').onclick = Modal.close;
    });
  });
});

let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-based
let allEvents = [];

async function loadCalendar() {
  allEvents = await api('GET', `/api/calendar?year=${calYear}&month=${calMonth + 1}`);
  renderCalendar();
}

function renderCalendar() {
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  get('cal-month-label').textContent = `${MONTHS[calMonth]} ${calYear}`;

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev  = new Date(calYear, calMonth, 0).getDate();
  const todayStr = today();

  // Event lookup by date
  const eventsByDate = {};
  allEvents.forEach(ev => {
    if (!eventsByDate[ev.event_date]) eventsByDate[ev.event_date] = [];
    eventsByDate[ev.event_date].push(ev);
  });

  const grid = get('calendar-grid');
  grid.innerHTML = '';

  // Day headers
  DAYS.forEach(d => {
    grid.appendChild(el('div', 'cal-day-header', d));
  });

  // Leading blanks
  for (let i = 0; i < firstDay; i++) {
    const dayEl = el('div', 'cal-day other-month');
    dayEl.innerHTML = `<div class="cal-day-num">${daysInPrev - firstDay + 1 + i}</div>`;
    grid.appendChild(dayEl);
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;
    const dayEl = el('div', `cal-day${isToday ? ' today' : ''}`);
    dayEl.innerHTML = `<div class="cal-day-num">${d}</div>`;

    const evs = eventsByDate[dateStr] || [];
    evs.slice(0, 3).forEach(ev => {
      const evEl = el('div', 'cal-event', escHtml(ev.title));
      evEl.style.background = eventTypeColor(ev.type);
      evEl.title = ev.title;
      evEl.onclick = (e) => { e.stopPropagation(); showEventForm(ev); };
      dayEl.appendChild(evEl);
    });
    if (evs.length > 3) {
      const moreEl = el('div', 'cal-event', `+${evs.length - 3} more`);
      moreEl.onclick = (e) => {
        e.stopPropagation();
        const rows = evs.map(ev =>
          `<div class="cal-event" style="background:${eventTypeColor(ev.type)};margin-bottom:4px">${escHtml(ev.title)}</div>`
        ).join('');
        Modal.show(dateStr, rows);
      };
      dayEl.appendChild(moreEl);
    }

    dayEl.addEventListener('click', () => showEventForm(null, dateStr));
    grid.appendChild(dayEl);
  }

  // Trailing blanks
  const total = firstDay + daysInMonth;
  const trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= trailing; i++) {
    const dayEl = el('div', 'cal-day other-month');
    dayEl.innerHTML = `<div class="cal-day-num">${i}</div>`;
    grid.appendChild(dayEl);
  }

  // Event list for current month
  const monthStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}`;
  const monthEvents = allEvents.filter(ev => ev.event_date.startsWith(monthStr));
  monthEvents.sort((a,b) => a.event_date.localeCompare(b.event_date));

  const listEl = get('calendar-event-list');
  listEl.innerHTML = '';
  monthEvents.forEach(ev => {
    const item = el('div', 'event-item');
    item.innerHTML = `
      <div class="event-date-badge">${fmtDate(ev.event_date)}${ev.event_time ? `<div class="event-time">${ev.event_time}</div>` : ''}</div>
      <div class="event-info">
        <div class="event-title">${escHtml(ev.title)}</div>
        <div class="event-meta">${ev.type}${ev.recurrence_rule ? ` &#x21bb; ${fmtRecur(ev.recurrence_rule)}` : ''}${ev.plant_name ? ` &bull; ${escHtml(ev.plant_name)}` : ''}${ev.bed_name ? ` &bull; ${escHtml(ev.bed_name)}` : ''}</div>
      </div>
      <div class="event-actions">
        <button class="btn btn-ghost btn-sm btn-edit-event">Edit</button>
        <button class="btn btn-danger btn-sm btn-del-event">Delete</button>
      </div>`;
    qs('.btn-edit-event', item).onclick = () => showEventForm(ev);
    qs('.btn-del-event', item).onclick  = async () => {
      if (!confirm('Delete this event?')) return;
      await api('DELETE', `/api/calendar/${ev.id}`);
      await loadCalendar();
    };
    listEl.appendChild(item);
  });
}

get('cal-prev').onclick = async () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  await loadCalendar();
};
get('cal-next').onclick = async () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  await loadCalendar();
};
get('cal-today').onclick = async () => {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  await loadCalendar();
};

get('btn-add-event').addEventListener('click', () => showEventForm(null, today()));

function eventFormHtml(ev, defaultDate) {
  const plants = allPlants.map(p => `<option value="${p.id}" ${ev?.plant_id===p.id?'selected':''}>${escHtml(p.name)}</option>`).join('');
  const beds   = allBeds.map(b => `<option value="${b.id}" ${ev?.bed_id===b.id?'selected':''}>${escHtml(b.name)}</option>`).join('');
  return `<form id="event-form">
    <div class="form-row">
      <label>Title *</label>
      <input class="input" name="title" value="${escHtml(ev?.title || '')}" required>
    </div>
    <div class="form-row-2">
      <div class="form-row">
        <label>Date *</label>
        <input class="input" type="date" name="event_date" value="${ev?.event_date || defaultDate || today()}" required>
      </div>
      <div class="form-row">
        <label>Time</label>
        <input class="input" type="time" name="event_time" value="${ev?.event_time || ''}">
      </div>
    </div>
    <div class="form-row">
      <label>Type</label>
      <select class="input" name="type">
        ${['plant','transplant','harvest','fertilize','prune','water','other'].map(t =>
          `<option value="${t}" ${ev?.type===t?'selected':''}>${t}</option>`).join('')}
      </select>
    </div>
    <div class="form-row-2">
      <div class="form-row">
        <label>Plant</label>
        <select class="input" name="plant_id">
          <option value="">— none —</option>${plants}
        </select>
      </div>
      <div class="form-row">
        <label>Bed</label>
        <select class="input" name="bed_id">
          <option value="">— none —</option>${beds}
        </select>
      </div>
    </div>
    <div class="form-row">
      <label>Notes</label>
      <textarea class="input" name="notes">${escHtml(ev?.notes || '')}</textarea>
    </div>
    ${recurrenceFormHtml(ev?.recurrence_rule || '', 'ev')}
    <div class="form-actions">
      ${ev ? `<button type="button" class="btn btn-danger btn-sm" id="btn-del-event">Delete</button>` : ''}
      <button type="button" class="btn btn-ghost" id="btn-cancel-event">Cancel</button>
      <button type="submit" class="btn btn-primary">${ev ? 'Save Changes' : 'Add Event'}</button>
    </div>
  </form>`;
}

function showEventForm(ev, defaultDate) {
  Modal.show(ev ? 'Edit Event' : 'New Event', eventFormHtml(ev, defaultDate), async (form) => {
    const data = formData(form);
    resolveRecurrenceRule(data);
    try {
      if (ev) {
        await api('PUT', `/api/calendar/${ev.id}`, data);
      } else {
        await api('POST', '/api/calendar', data);
      }
      Modal.close();
      await loadCalendar();
    } catch (e) { showToast(e.message); }
  });
  bindRecurrenceSelect('ev-recur-select', 'ev-recur-interval');
  const cancelBtn = get('btn-cancel-event');
  if (cancelBtn) cancelBtn.onclick = Modal.close;
  const delBtn = get('btn-del-event');
  if (delBtn) delBtn.onclick = async () => {
    if (!confirm('Delete this event?')) return;
    await api('DELETE', `/api/calendar/${ev.id}`);
    Modal.close();
    await loadCalendar();
  };
}

function fmtRecur(rule) {
  if (rule === 'daily')   return 'daily';
  if (rule === 'weekly')  return 'weekly';
  if (rule === 'monthly') return 'monthly';
  return `every ${rule}d`;
}

function recurrenceFormHtml(rule, idPrefix) {
  const named = ['daily', 'weekly', 'monthly'];
  const selectVal = named.includes(rule) ? rule : (rule ? '_custom' : '');
  const intervalVal = (rule && !named.includes(rule)) ? rule : '7';
  return `
    <div class="form-row">
      <label>Recurrence</label>
      <select class="input" name="recurrence_rule" id="${idPrefix}-recur-select">
        <option value="">None</option>
        <option value="daily" ${selectVal==='daily'?'selected':''}>Daily</option>
        <option value="weekly" ${selectVal==='weekly'?'selected':''}>Weekly</option>
        <option value="monthly" ${selectVal==='monthly'?'selected':''}>Monthly</option>
        <option value="_custom" ${selectVal==='_custom'?'selected':''}>Every N days</option>
      </select>
    </div>
    <div class="form-row" id="${idPrefix}-recur-interval" style="display:${selectVal==='_custom'?'':'none'}">
      <label>Interval (days)</label>
      <input class="input" type="number" name="recurrence_interval" min="1" max="365" value="${escHtml(String(intervalVal))}">
    </div>`;
}

function bindRecurrenceSelect(selectId, intervalRowId) {
  const sel = get(selectId);
  const row = get(intervalRowId);
  if (sel && row) {
    sel.addEventListener('change', () => {
      row.style.display = sel.value === '_custom' ? '' : 'none';
    });
  }
}

function resolveRecurrenceRule(data) {
  if (data.recurrence_rule === '_custom') {
    data.recurrence_rule = data.recurrence_interval || null;
  }
  delete data.recurrence_interval;
}

function eventTypeColor(type) {
  const colors = {
    plant:      '#4a7c4e',
    transplant: '#2a6b9c',
    harvest:    '#5a8a3a',
    fertilize:  '#b49a20',
    prune:      '#7c4a7a',
    water:      '#2a7a9c',
    other:      '#7a7a7a',
  };
  return colors[type] || colors.other;
}

let taskFilter = 'pending';
let tasksPage = 0;

async function loadTasks(page = 0) {
  tasksPage = page;
  const params = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  if (taskFilter === 'pending')   params.set('completed', 'false');
  if (taskFilter === 'completed') params.set('completed', 'true');
  const { data, total } = await api('GET', `/api/tasks?${params}`);
  renderTasks(data, total);
}

function renderTasks(list, total) {
  const container = get('tasks-list');
  container.innerHTML = '';

  if (!list.length) {
    container.innerHTML = `<div class="tasks-empty">No ${taskFilter} tasks.</div>`;
    renderPagination('tasks-pagination', tasksPage, total, p => loadTasks(p));
    return;
  }

  list.forEach(t => {
    const item = el('div', `task-item${t.completed ? ' completed' : ''}`);

    const checkEl = el('div', `task-checkbox${t.completed ? ' checked' : ''}`);
    if (t.completed) checkEl.innerHTML = '&#10003;';
    checkEl.addEventListener('click', async () => {
      await api('PATCH', `/api/tasks/${t.id}/complete`, { completed: !t.completed });
      await loadTasks(tasksPage);
    });

    const dueCls = getDueCls(t.due_date, t.completed);
    const dueTxt = t.due_date ? fmtDate(t.due_date) : 'No due date';

    const info = el('div', 'task-info');
    info.innerHTML = `
      <div class="task-title${t.completed ? ' done' : ''}">${escHtml(t.title)}</div>
      <div class="task-meta">
        <span class="badge badge-${t.type.replaceAll('-','')}">${t.type}</span>
        <span class="due-date ${dueCls}">${dueTxt}</span>
        ${t.recurrence_rule ? `<span class="badge badge-recur">&#x21bb; ${fmtRecur(t.recurrence_rule)}</span>` : ''}
        ${t.plant_name ? `<span class="note-tag">${escHtml(t.plant_name)}</span>` : ''}
        ${t.bed_name   ? `<span class="note-tag">${escHtml(t.bed_name)}</span>`   : ''}
      </div>
      ${t.notes ? `<div class="task-notes">${escHtml(t.notes)}</div>` : ''}`;

    const actions = el('div', 'task-actions');
    const editBtn = el('button', 'btn btn-ghost btn-sm', 'Edit');
    editBtn.onclick = () => showTaskForm(t);
    actions.appendChild(editBtn);

    item.appendChild(checkEl);
    item.appendChild(info);
    item.appendChild(actions);
    container.appendChild(item);
  });
  renderPagination('tasks-pagination', tasksPage, total, p => loadTasks(p));
}

function getDueCls(due, completed) {
  if (!due || completed) return '';
  const d = new Date(due + 'T00:00:00');
  const now = new Date(); now.setHours(0,0,0,0);
  const diff = (d - now) / 86400000;
  if (diff < 0)  return 'due-overdue';
  if (diff <= 3) return 'due-soon';
  return '';
}

qsa('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    qsa('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    taskFilter = tab.dataset.filter;
    loadTasks(0);
  });
});

get('btn-add-task').addEventListener('click', () => showTaskForm(null));
get('btn-export-tasks').addEventListener('click', () => showExportModal('Export Tasks', '/api/tasks', 'tasks'));

function taskFormHtml(t) {
  const plants = allPlants.map(p => `<option value="${p.id}" ${t?.plant_id===p.id?'selected':''}>${escHtml(p.name)}</option>`).join('');
  const beds   = allBeds.map(b => `<option value="${b.id}" ${t?.bed_id===b.id?'selected':''}>${escHtml(b.name)}</option>`).join('');
  return `<form id="task-form">
    <div class="form-row">
      <label>Title *</label>
      <input class="input" name="title" value="${escHtml(t?.title || '')}" required>
    </div>
    <div class="form-row-2">
      <div class="form-row">
        <label>Type</label>
        <select class="input" name="type">
          ${['water','fertilize','prune','harvest','pest-control','plant','other'].map(v =>
            `<option value="${v}" ${t?.type===v?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>Due Date</label>
        <input class="input" type="date" name="due_date" value="${t?.due_date || ''}">
      </div>
    </div>
    <div class="form-row-2">
      <div class="form-row">
        <label>Plant</label>
        <select class="input" name="plant_id">
          <option value="">— none —</option>${plants}
        </select>
      </div>
      <div class="form-row">
        <label>Bed</label>
        <select class="input" name="bed_id">
          <option value="">— none —</option>${beds}
        </select>
      </div>
    </div>
    <div class="form-row">
      <label>Notes</label>
      <textarea class="input" name="notes">${escHtml(t?.notes || '')}</textarea>
    </div>
    ${recurrenceFormHtml(t?.recurrence_rule || '', 'task')}
    <div class="form-actions">
      ${t ? `<button type="button" class="btn btn-danger btn-sm" id="btn-del-task">Delete</button>` : ''}
      <button type="button" class="btn btn-ghost" id="btn-cancel-task">Cancel</button>
      <button type="submit" class="btn btn-primary">${t ? 'Save Changes' : 'Add Task'}</button>
    </div>
  </form>`;
}

function showTaskForm(task) {
  Modal.show(task ? 'Edit Task' : 'New Task', taskFormHtml(task), async (form) => {
    const data = formData(form);
    resolveRecurrenceRule(data);
    try {
      if (task) {
        await api('PUT', `/api/tasks/${task.id}`, data);
      } else {
        await api('POST', '/api/tasks', data);
      }
      Modal.close();
      await loadTasks();
    } catch (e) { showToast(e.message); }
  });
  bindRecurrenceSelect('task-recur-select', 'task-recur-interval');
  const cancelBtn = get('btn-cancel-task');
  if (cancelBtn) cancelBtn.onclick = Modal.close;
  const delBtn = get('btn-del-task');
  if (delBtn) delBtn.onclick = async () => {
    if (!confirm('Delete this task?')) return;
    await api('DELETE', `/api/tasks/${task.id}`);
    Modal.close();
    await loadTasks();
  };
}

let currentNoteId = null;
let notesPage = 0;

async function loadNotes(page = 0) {
  notesPage = page;
  populateNoteFilters();
  showNoteListView();
  const params = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  const search      = get('journal-search').value;
  const plantFilter = get('journal-plant-filter').value;
  const bedFilter   = get('journal-bed-filter').value;
  if (search)      params.set('search', search);
  if (plantFilter) params.set('plant_id', plantFilter);
  if (bedFilter)   params.set('bed_id', bedFilter);
  const { data, total } = await api('GET', `/api/notes?${params}`);
  renderNotes(data, total);
}

function populateNoteFilters() {
  const plantSel = get('journal-plant-filter');
  const bedSel   = get('journal-bed-filter');
  const prevPlant = plantSel.value;
  const prevBed   = bedSel.value;

  plantSel.innerHTML = '<option value="">All plants</option>' +
    allPlants.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');
  bedSel.innerHTML = '<option value="">All beds</option>' +
    allBeds.map(b => `<option value="${b.id}">${escHtml(b.name)}</option>`).join('');

  plantSel.value = prevPlant;
  bedSel.value   = prevBed;
}

function showNoteListView() {
  get('journal-list-view').classList.remove('hidden');
  get('journal-entry-view').classList.add('hidden');
}

function renderNotes(notes, total) {
  const list = get('notes-list');
  list.innerHTML = '';

  if (!notes.length) {
    list.innerHTML = `<div class="notes-empty">${total === 0 ? 'No journal entries yet. Record your first observation!' : 'No entries match your search.'}</div>`;
    renderPagination('notes-pagination', notesPage, total, p => loadNotes(p));
    return;
  }
  notes.forEach(n => {
    const card = el('div', 'note-card');
    const preview = (n.content || '').replace(/\n/g, ' ').slice(0, 140);
    const tags = [n.plant_name, n.bed_name].filter(Boolean);
    card.innerHTML = `
      <div class="note-card-header">
        <div class="note-card-title">${escHtml(n.title)}</div>
        <div class="note-card-date">${fmtDate(n.entry_date)}</div>
      </div>
      ${preview ? `<div class="note-card-preview">${escHtml(preview)}</div>` : ''}
      ${tags.length ? `<div class="note-card-tags">${tags.map(t=>`<span class="note-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}`;
    card.onclick = () => openNote(n.id);
    list.appendChild(card);
  });
  renderPagination('notes-pagination', notesPage, total, p => loadNotes(p));
}

async function openNote(noteId) {
  currentNoteId = noteId;
  const note = await api('GET', `/api/notes/${noteId}`);
  get('journal-list-view').classList.add('hidden');
  get('journal-entry-view').classList.remove('hidden');

  const tags = [note.plant_name, note.bed_name].filter(Boolean);
  get('journal-entry-body').innerHTML = `
    <h2>${escHtml(note.title)}</h2>
    <div class="entry-date">${fmtDate(note.entry_date)}</div>
    ${tags.length ? `<div class="entry-tags">${tags.map(t=>`<span class="note-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
    <div class="entry-content">${escHtml(note.content || '')}</div>`;
}

get('btn-back-journal').addEventListener('click', () => {
  showNoteListView();
});

get('journal-search').addEventListener('input', () => loadNotes(0));
get('journal-plant-filter').addEventListener('change', () => loadNotes(0));
get('journal-bed-filter').addEventListener('change', () => loadNotes(0));

get('btn-add-note').addEventListener('click', () => showNoteForm(null));
get('btn-export-notes').addEventListener('click', () => showExportModal('Export Journal', '/api/notes', 'journal'));

get('btn-edit-note').addEventListener('click', async () => {
  const note = await api('GET', `/api/notes/${currentNoteId}`);
  showNoteForm(note);
});

get('btn-delete-note').addEventListener('click', async () => {
  if (!confirm('Delete this journal entry?')) return;
  await api('DELETE', `/api/notes/${currentNoteId}`);
  showNoteListView();
  await loadNotes();
});

function noteFormHtml(n) {
  const plants = allPlants.map(p => `<option value="${p.id}" ${n?.plant_id===p.id?'selected':''}>${escHtml(p.name)}</option>`).join('');
  const beds   = allBeds.map(b => `<option value="${b.id}" ${n?.bed_id===b.id?'selected':''}>${escHtml(b.name)}</option>`).join('');
  return `<form id="note-form">
    <div class="form-row">
      <label>Title *</label>
      <input class="input" name="title" value="${escHtml(n?.title || '')}" required>
    </div>
    <div class="form-row">
      <label>Date</label>
      <input class="input" type="date" name="entry_date" value="${n?.entry_date || today()}" required>
    </div>
    <div class="form-row-2">
      <div class="form-row">
        <label>Plant</label>
        <select class="input" name="plant_id">
          <option value="">— none —</option>${plants}
        </select>
      </div>
      <div class="form-row">
        <label>Bed</label>
        <select class="input" name="bed_id">
          <option value="">— none —</option>${beds}
        </select>
      </div>
    </div>
    <div class="form-row">
      <label>Content</label>
      <textarea class="input" name="content" style="min-height:160px">${escHtml(n?.content || '')}</textarea>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" id="btn-cancel-note">Cancel</button>
      <button type="submit" class="btn btn-primary">${n ? 'Save Changes' : 'Add Entry'}</button>
    </div>
  </form>`;
}

function showNoteForm(note) {
  Modal.show(note ? 'Edit Entry' : 'New Journal Entry', noteFormHtml(note), async (form) => {
    const data = formData(form);
    try {
      if (note) {
        await api('PUT', `/api/notes/${note.id}`, data);
        Modal.close();
        await loadNotes();
        await openNote(note.id);
      } else {
        const created = await api('POST', '/api/notes', data);
        Modal.close();
        await loadNotes();
        await openNote(created.id);
      }
    } catch (e) { showToast(e.message); }
  });
  const cancelBtn = get('btn-cancel-note');
  if (cancelBtn) cancelBtn.onclick = Modal.close;
}

function formData(form) {
  const fd = new FormData(form);
  const obj = {};
  for (const [k, v] of fd.entries()) {
    // Skip the color_picker helper field
    if (k === 'color_picker') continue;
    obj[k] = v === '' ? null : v;
    // Coerce numeric fields
    if (['spacing_inches','days_to_maturity','rows','cols','plant_id','bed_id','quantity'].includes(k) && v !== '') {
      const n = ['spacing_inches','days_to_maturity','quantity'].includes(k) ? parseFloat(v) : parseInt(v, 10);
      if (!isFinite(n)) throw new Error(`Invalid value for ${k}: ${v}`);
      obj[k] = n;
    }
  }
  return obj;
}

function downloadFile(content, filename, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}

function showExportModal(title, endpoint, filename) {
  Modal.show(title, `
    <div style="display:flex;gap:.75rem;padding:.5rem 0">
      <button class="btn btn-primary" id="exp-json">Download JSON</button>
      <button class="btn btn-secondary" id="exp-csv">Download CSV</button>
    </div>
  `);
  const fetchAll = async () => {
    const sep = endpoint.includes('?') ? '&' : '?';
    const raw = await api('GET', `${endpoint}${sep}limit=10000`);
    return Array.isArray(raw) ? raw : raw.data;
  };
  get('exp-json').onclick = async () => {
    const data = await fetchAll();
    downloadFile(JSON.stringify(data, null, 2), filename + '.json', 'application/json');
    Modal.close();
  };
  get('exp-csv').onclick = async () => {
    const data = await fetchAll();
    downloadFile(toCSV(data), filename + '.csv', 'text/csv');
    Modal.close();
  };
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

let harvestPage = 0;

async function loadHarvests(page = 0) {
  harvestPage = page;
  populateHarvestFilters();
  const params = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  const plantFilter = get('harvest-plant-filter').value;
  const bedFilter   = get('harvest-bed-filter').value;
  if (plantFilter) params.set('plant_id', plantFilter);
  if (bedFilter)   params.set('bed_id', bedFilter);
  const { data, total } = await api('GET', `/api/harvest?${params}`);
  renderHarvests(data, total);
}

function populateHarvestFilters() {
  const plantSel = get('harvest-plant-filter');
  const bedSel   = get('harvest-bed-filter');
  const prevPlant = plantSel.value;
  const prevBed   = bedSel.value;

  plantSel.innerHTML = '<option value="">All plants</option>' +
    allPlants.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');
  bedSel.innerHTML = '<option value="">All beds</option>' +
    allBeds.map(b => `<option value="${b.id}">${escHtml(b.name)}</option>`).join('');

  plantSel.value = prevPlant;
  bedSel.value   = prevBed;
}

function renderHarvests(harvests, total) {
  const list = get('harvest-list');
  list.innerHTML = '';

  if (!harvests.length) {
    list.innerHTML = `<div class="notes-empty">${total === 0 ? 'No harvests logged yet. Record your first harvest!' : 'No harvests match your filters.'}</div>`;
    renderPagination('harvest-pagination', harvestPage, total, p => loadHarvests(p));
    return;
  }

  harvests.forEach(h => {
    const item = el('div', 'task-item');
    const tags = [h.plant_name, h.bed_name].filter(Boolean);
    const info = el('div', 'task-info');
    info.innerHTML = `
      <div class="task-title">${escHtml(String(h.quantity))} ${escHtml(h.unit)}${h.plant_name ? ` of ${escHtml(h.plant_name)}` : ''}</div>
      <div class="task-meta">
        <span>${fmtDate(h.harvested_at)}</span>
        ${tags.length > 1 || (tags.length === 1 && !h.plant_name) ? `<span class="badge badge-other">${escHtml(h.bed_name)}</span>` : ''}
        ${h.notes ? `<span class="task-notes">${escHtml(h.notes)}</span>` : ''}
      </div>`;

    const actions = el('div', 'task-actions');
    const editBtn = el('button', 'btn btn-ghost btn-sm', 'Edit');
    editBtn.onclick = () => showHarvestForm(h);
    const delBtn = el('button', 'btn btn-danger btn-sm', 'Delete');
    delBtn.onclick = async () => {
      if (!confirm('Delete this harvest entry?')) return;
      try {
        await api('DELETE', `/api/harvest/${h.id}`);
        await loadHarvests();
      } catch (e) { showToast(e.message); }
    };
    actions.append(editBtn, delBtn);
    item.append(info, actions);
    list.appendChild(item);
  });
  renderPagination('harvest-pagination', harvestPage, total, p => loadHarvests(p));
}

function harvestFormHtml(h, prefillPlantId, prefillBedId) {
  const plants = allPlants.map(p => {
    const sel = h ? h.plant_id === p.id : String(p.id) === String(prefillPlantId);
    return `<option value="${p.id}" ${sel ? 'selected' : ''}>${escHtml(p.name)}</option>`;
  }).join('');
  const beds = allBeds.map(b => {
    const sel = h ? h.bed_id === b.id : String(b.id) === String(prefillBedId);
    return `<option value="${b.id}" ${sel ? 'selected' : ''}>${escHtml(b.name)}</option>`;
  }).join('');
  const units = ['lbs','oz','kg','g','items','bunches','cups','quarts','gallons'];
  const unitOpts = units.map(u => `<option value="${u}" ${(h?.unit ?? 'lbs') === u ? 'selected' : ''}>${u}</option>`).join('');
  return `<form id="harvest-form">
    <div class="form-row">
      <label>Date *</label>
      <input class="input" type="date" name="harvested_at" value="${h?.harvested_at || today()}" required>
    </div>
    <div class="form-row-2">
      <div class="form-row">
        <label>Quantity *</label>
        <input class="input" type="number" name="quantity" min="0.01" step="any" value="${h?.quantity || ''}" required>
      </div>
      <div class="form-row">
        <label>Unit</label>
        <select class="input" name="unit">${unitOpts}</select>
      </div>
    </div>
    <div class="form-row-2">
      <div class="form-row">
        <label>Plant</label>
        <select class="input" name="plant_id">
          <option value="">— none —</option>${plants}
        </select>
      </div>
      <div class="form-row">
        <label>Bed</label>
        <select class="input" name="bed_id">
          <option value="">— none —</option>${beds}
        </select>
      </div>
    </div>
    <div class="form-row">
      <label>Notes</label>
      <textarea class="input" name="notes">${escHtml(h?.notes || '')}</textarea>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" id="btn-cancel-harvest">Cancel</button>
      <button type="submit" class="btn btn-primary">${h ? 'Save Changes' : 'Log Harvest'}</button>
    </div>
  </form>`;
}

function showHarvestForm(harvest, prefillPlantId, prefillBedId) {
  Modal.show(harvest ? 'Edit Harvest' : 'Log Harvest', harvestFormHtml(harvest, prefillPlantId, prefillBedId), async (form) => {
    const data = formData(form);
    try {
      if (harvest) {
        await api('PUT', `/api/harvest/${harvest.id}`, data);
      } else {
        await api('POST', '/api/harvest', data);
      }
      Modal.close();
      if (currentSection === 'harvest') await loadHarvests();
    } catch (e) { showToast(e.message); }
  });
  const cancelBtn = get('btn-cancel-harvest');
  if (cancelBtn) cancelBtn.onclick = Modal.close;
}

get('btn-add-harvest').addEventListener('click', () => showHarvestForm(null));
get('btn-export-harvest').addEventListener('click', () => showExportModal('Export Harvest Log', '/api/harvest', 'harvest-log'));
get('harvest-plant-filter').addEventListener('change', () => loadHarvests(0));
get('harvest-bed-filter').addEventListener('change', () => loadHarvests(0));

// Global search
let _searchTimer = null;
let _preSearchSection = 'dashboard';

get('global-search').addEventListener('input', () => {
  clearTimeout(_searchTimer);
  const q = get('global-search').value.trim();
  if (!q) {
    if (currentSection === 'search') navigate(_preSearchSection);
    return;
  }
  _searchTimer = setTimeout(() => runGlobalSearch(q), 300);
});

async function runGlobalSearch(q) {
  if (currentSection !== 'search') _preSearchSection = currentSection;
  qsa('.section').forEach(s => s.classList.add('hidden'));
  qsa('.nav-item').forEach(n => n.classList.remove('active'));
  get('section-search').classList.remove('hidden');
  get('search-heading').textContent = `Results for "${q}"`;
  currentSection = 'search';

  const results = await api('GET', `/api/search?q=${encodeURIComponent(q)}`);
  renderSearchResults(results, q);
}

function renderSearchResults(results, q) {
  const container = get('search-results');
  if (!results.length) {
    container.innerHTML = `<p class="search-empty">No results for <strong>${escHtml(q)}</strong></p>`;
    return;
  }

  const sectionLabels = { plants: 'Plants', beds: 'Beds', tasks: 'Tasks', calendar: 'Events', journal: 'Journal' };
  const groups = {};
  results.forEach(r => {
    if (!groups[r.section]) groups[r.section] = [];
    groups[r.section].push(r);
  });

  container.innerHTML = '';
  for (const [section, items] of Object.entries(groups)) {
    const group = el('div', 'search-group');
    const heading = el('h2', 'search-group-title', escHtml(sectionLabels[section] || section));
    group.appendChild(heading);
    const list = el('div', 'search-group-list');
    items.forEach(item => {
      const row = el('div', 'search-result-item');
      const desc = item.description ? item.description.slice(0, 120) : '';
      row.innerHTML = `<div class="search-result-title">${escHtml(item.title)}</div>${desc ? `<div class="search-result-desc">${escHtml(desc)}</div>` : ''}`;
      row.onclick = () => {
        get('global-search').value = '';
        navigate(section);
      };
      list.appendChild(row);
    });
    group.appendChild(list);
    container.appendChild(group);
  }
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  get('theme-toggle').textContent = theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';

  get('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    get('theme-toggle').textContent = next === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();

  // Prefetch plants and beds so they're available everywhere
  try {
    [allPlants, allBeds] = await Promise.all([
      api('GET', '/api/plants'),
      api('GET', '/api/beds'),
    ]);
  } catch (e) {
    console.error('Failed to preload data:', e);
  }
  const validSections = Object.keys(loaders);
  const hash = location.hash.slice(1);
  navigate(validSections.includes(hash) ? hash : 'dashboard');
});
