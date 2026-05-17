// ═══════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════
const API = '/api/v1';
const USE_MOCK = true; // ← переключить на false когда добавится бэк

let state = {
  columns: [
    {
      id: 1, title: 'To Do', emoji: '📋',
      tasks: [
        { id: 1, title: 'Настроить CI/CD пайплайн', description: 'Настроить GitHub Actions для автоматического деплоя', priority: 'HIGH', tags: ['devops', 'инфра'], deadline: '2025-08-10', created: '2025-07-20' },
        { id: 2, title: 'Написать документацию API', description: 'Swagger/OpenAPI спецификация для всех эндпоинтов', priority: 'MEDIUM', tags: ['docs'], deadline: '2025-09-01', created: '2025-07-21' },
        { id: 3, title: 'Исправить баг в авторизации', description: 'Пользователи иногда не могут войти после сброса пароля', priority: 'CRITICAL', tags: ['bug', 'auth'], deadline: '2025-07-25', created: '2025-07-22' },
      ]
    },
    {
      id: 2, title: 'In Progress', emoji: '🔄',
      tasks: [
        { id: 4, title: 'Разработать Kanban UI', description: 'Windows 95 стиль, drag & drop, real-time обновления', priority: 'HIGH', tags: ['frontend', 'ui'], deadline: '2025-08-05', created: '2025-07-18' },
        { id: 5, title: 'Настроить WebSocket', description: 'Real-time синхронизация между пользователями через WS', priority: 'HIGH', tags: ['backend', 'ws'], deadline: null, created: '2025-07-19' },
      ]
    },
    {
      id: 3, title: 'Done', emoji: '✅',
      tasks: [
        { id: 6, title: 'Инициализировать проект', description: 'Создать репозиторий, настроить структуру папок', priority: 'LOW', tags: ['setup'], deadline: null, created: '2025-07-15' },
        { id: 7, title: 'Выбрать технологии', description: 'Go + RabbitMQ + PostgreSQL + WebSockets', priority: 'MEDIUM', tags: ['архитектура'], deadline: null, created: '2025-07-16' },
      ]
    }
  ],
  nextId: 8,
  draggedTaskId: null,
  draggedFromCol: null,
  compactMode: false,
  filterOverdue: false,
};

// ═══════════════════════════════════════════════════
//  API / MOCK
// ═══════════════════════════════════════════════════
async function apiCall(method, path, body) {
  if (USE_MOCK) {
    return mockApi(method, path, body);
  }
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  return r.json();
}

function mockApi(method, path, body) {
  if (method === 'GET' && path === '/board') {
    return Promise.resolve({ columns: JSON.parse(JSON.stringify(state.columns)) });
  }
  if (method === 'POST' && path === '/tasks') {
    const task = { ...body, id: state.nextId++, created: new Date().toISOString().slice(0,10) };
    const col = state.columns.find(c => c.id === body.column_id);
    if (col) col.tasks.push(task);
    return Promise.resolve(task);
  }
  if (method === 'PUT' && path.startsWith('/tasks/')) {
    const id = parseInt(path.split('/')[2]);
    for (const col of state.columns) {
      const t = col.tasks.find(t => t.id === id);
      if (t) Object.assign(t, body);
    }
    return Promise.resolve({});
  }
  if (method === 'DELETE' && path.startsWith('/tasks/')) {
    const id = parseInt(path.split('/')[2]);
    for (const col of state.columns) {
      col.tasks = col.tasks.filter(t => t.id !== id);
    }
    return Promise.resolve({});
  }
  if (method === 'POST' && path === '/tasks/move') {
    const { task_id, new_column_id } = body;
    let task;
    for (const col of state.columns) {
      const idx = col.tasks.findIndex(t => t.id === task_id);
      if (idx !== -1) { task = col.tasks.splice(idx, 1)[0]; break; }
    }
    if (task) {
      const newCol = state.columns.find(c => c.id === new_column_id);
      if (newCol) newCol.tasks.push(task);
    }
    return Promise.resolve({});
  }
  if (method === 'POST' && path === '/columns') {
    const col = { ...body, id: Date.now(), tasks: [] };
    state.columns.push(col);
    return Promise.resolve(col);
  }
  return Promise.resolve({});
}

// ═══════════════════════════════════════════════════
//  BOARD RENDER
// ═══════════════════════════════════════════════════
async function loadBoard() {
  setToolbarStatus('Загрузка…');
  try {
    if (!USE_MOCK) {
      const board = await apiCall('GET', '/board');
      state.columns = board.columns;
    }
    renderBoard();
    setLastEvent('Доска обновлена');
    setToolbarStatus('Готово');
  } catch(e) {
    showNotif('⚠️', 'Ошибка загрузки', e.message);
    setToolbarStatus('Ошибка!');
  }
}

function renderBoard() {
  const board = document.getElementById('board');
  const addBtn = board.querySelector('.add-column-btn');
  
  // Remove old columns
  board.querySelectorAll('.column').forEach(c => c.remove());
  
  let filtered = state.filterOverdue;
  const today = new Date(); today.setHours(0,0,0,0);
  
  for (const col of state.columns) {
    let tasks = col.tasks;
    if (filtered) {
      tasks = tasks.filter(t => t.deadline && new Date(t.deadline) < today);
    }
    
    const colEl = document.createElement('div');
    colEl.className = 'column';
    colEl.dataset.colId = col.id;
    colEl.innerHTML = `
      <div class="column-header">
        <span><span class="col-emoji">${col.emoji || '📌'}</span>${col.title}</span>
        <span class="count" id="count-${col.id}">${tasks.length}</span>
      </div>
      <div class="column-body" id="col-${col.id}"
        ondrop="drop(event)" ondragover="allowDrop(event)"
        ondragleave="dragLeave(event)">
        ${tasks.map(t => renderCard(t)).join('')}
      </div>
    `;
    board.insertBefore(colEl, addBtn);
  }
  
  // Update total
  const total = state.columns.reduce((s,c) => s + c.tasks.length, 0);
  document.getElementById('total-tasks').textContent = total;
  
  // Update column selector in modal
  const sel = document.getElementById('taskColumn');
  if (sel) {
    sel.innerHTML = state.columns.map(c =>
      `<option value="${c.id}">${c.emoji || '📌'} ${c.title}</option>`
    ).join('');
  }
}

function renderCard(t) {
  const today = new Date(); today.setHours(0,0,0,0);
  let deadlineHtml = '';
  if (t.deadline) {
    const dl = new Date(t.deadline);
    const diff = Math.round((dl - today) / 86400000);
    let cls = '';
    let label = dl.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit' });
    if (diff < 0) { cls = 'overdue'; label = '⚠️ ' + label; }
    else if (diff <= 3) { cls = 'soon'; label = '⏰ ' + label; }
    deadlineHtml = `<span class="card-deadline ${cls}" title="Дедлайн: ${t.deadline}">${label}</span>`;
  }
  
  const tagsHtml = (t.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
  const compact = state.compactMode ? 'style="display:none"' : '';
  
  return `
    <div class="card" draggable="true" ondragstart="dragStart(event, ${t.id})" id="task-${t.id}">
      <div class="card-actions">
        <button class="card-btn" title="Редактировать" onclick="editTask(${t.id}, event)">✏</button>
        <button class="card-btn" title="Удалить" onclick="deleteTask(${t.id}, event)">✕</button>
      </div>
      <div class="card-id" ${compact}>#${t.id} · ${t.created || ''}</div>
      <div class="card-title">${escapeHtml(t.title)}</div>
      ${t.description ? `<div class="card-desc" ${compact}>${escapeHtml(t.description)}</div>` : ''}
      <div class="card-meta">
        <span class="priority priority-${t.priority}">${priorityLabel(t.priority)}</span>
        ${tagsHtml}
        ${deadlineHtml}
      </div>
    </div>`;
}

function priorityLabel(p) {
  return { LOW:'🟢 Низкий', MEDIUM:'🟡 Средний', HIGH:'🟠 Высокий', CRITICAL:'🔴 Критичный' }[p] || p;
}

function escapeHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ═══════════════════════════════════════════════════
//  DRAG & DROP
// ═══════════════════════════════════════════════════
function dragStart(e, taskId) {
  state.draggedTaskId = taskId;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', taskId);
  setTimeout(() => {
    const el = document.getElementById('task-'+taskId);
    if (el) el.classList.add('dragging');
  }, 0);
}

function allowDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function dragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function drop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  
  const taskId = parseInt(e.dataTransfer.getData('text/plain') || state.draggedTaskId);
  if (!taskId) return;
  
  const colBody = e.target.closest('.column-body');
  if (!colBody) return;
  
  const newColId = parseInt(colBody.id.replace('col-', ''));
  
  // Find current column
  let oldColId;
  for (const col of state.columns) {
    if (col.tasks.find(t => t.id === taskId)) { oldColId = col.id; break; }
  }
  
  if (oldColId === newColId) return;
  
  await apiCall('POST', '/tasks/move', { task_id: taskId, new_column_id: newColId });
  
  const newColName = state.columns.find(c => c.id === newColId)?.title || '?';
  setLastEvent(`Задача #${taskId} → ${newColName}`);
  showNotif('↗️', 'Задача перемещена', `#${taskId} → ${newColName}`);
  
  renderBoard();
}

// ═══════════════════════════════════════════════════
//  TASK CRUD
// ═══════════════════════════════════════════════════
function openNewTask() {
  closeMenus();
  document.getElementById('modalTitle').textContent = 'Новая задача';
  document.getElementById('editTaskId').value = '';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value = '';
  document.getElementById('taskPriority').value = 'MEDIUM';
  document.getElementById('taskTags').value = '';
  document.getElementById('taskDeadline').value = '';
  document.getElementById('taskColumn').value = state.columns[0]?.id || 1;
  document.getElementById('taskModal').classList.add('active');
  setTimeout(() => document.getElementById('taskTitle').focus(), 50);
}

function editTask(id, e) {
  if (e) e.stopPropagation();
  closeMenus();
  let task;
  for (const col of state.columns) {
    task = col.tasks.find(t => t.id === id);
    if (task) break;
  }
  if (!task) return;
  
  document.getElementById('modalTitle').textContent = `Редактирование задачи #${id}`;
  document.getElementById('editTaskId').value = id;
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDesc').value = task.description || '';
  document.getElementById('taskPriority').value = task.priority;
  document.getElementById('taskTags').value = (task.tags || []).join(', ');
  document.getElementById('taskDeadline').value = task.deadline || '';
  
  // Find column
  for (const col of state.columns) {
    if (col.tasks.find(t => t.id === id)) {
      document.getElementById('taskColumn').value = col.id;
      break;
    }
  }
  
  document.getElementById('taskModal').classList.add('active');
  setTimeout(() => document.getElementById('taskTitle').focus(), 50);
}

async function saveTask() {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) { showNotif('⚠️', 'Ошибка', 'Введите название задачи'); return; }
  
  const editId = parseInt(document.getElementById('editTaskId').value);
  const desc = document.getElementById('taskDesc').value.trim();
  const priority = document.getElementById('taskPriority').value;
  const tags = document.getElementById('taskTags').value.split(',').map(s=>s.trim()).filter(Boolean);
  const deadline = document.getElementById('taskDeadline').value || null;
  const colId = parseInt(document.getElementById('taskColumn').value);
  
  if (editId) {
    // Update
    const data = { title, description: desc, priority, tags, deadline };
    await apiCall('PUT', `/tasks/${editId}`, data);
    
    // Move if column changed
    let currentColId;
    for (const col of state.columns) {
      if (col.tasks.find(t => t.id === editId)) { currentColId = col.id; break; }
    }
    if (currentColId !== colId) {
      await apiCall('POST', '/tasks/move', { task_id: editId, new_column_id: colId });
    }
    
    setLastEvent(`Задача #${editId} обновлена`);
    showNotif('✏️', 'Задача обновлена', title);
  } else {
    // Create
    await apiCall('POST', '/tasks', { title, description: desc, priority, tags, deadline, column_id: colId });
    setLastEvent(`Создана задача: ${title}`);
    showNotif('📝', 'Задача создана', title);
  }
  
  closeTaskModal();
  renderBoard();
}

async function deleteTask(id, e) {
  if (e) e.stopPropagation();
  const task = findTask(id);
  if (!confirm(`Удалить задачу #${id} «${task?.title}»?`)) return;
  await apiCall('DELETE', `/tasks/${id}`);
  setLastEvent(`Задача #${id} удалена`);
  showNotif('🗑️', 'Задача удалена', task?.title || '');
  renderBoard();
}

function findTask(id) {
  for (const col of state.columns) {
    const t = col.tasks.find(t => t.id === id);
    if (t) return t;
  }
  return null;
}

function closeTaskModal() {
  document.getElementById('taskModal').classList.remove('active');
}

async function clearDone() {
  const done = state.columns.find(c => c.title === 'Done');
  if (!done || !done.tasks.length) { showNotif('ℹ️', 'Нечего очищать', 'Колонка Done пуста'); return; }
  if (!confirm(`Удалить все ${done.tasks.length} задач из Done?`)) return;
  for (const t of [...done.tasks]) {
    await apiCall('DELETE', `/tasks/${t.id}`);
  }
  showNotif('🗑️', 'Done очищен', `Удалено ${done.tasks.length} задач`);
  renderBoard();
}

async function addColumn() {
  closeMenus();
  const name = prompt('Название новой колонки:');
  if (!name) return;
  const emoji = prompt('Эмодзи для колонки (необязательно):', '📌') || '📌';
  await apiCall('POST', '/columns', { title: name, emoji });
  showNotif('➕', 'Колонка добавлена', name);
  renderBoard();
}

function sortByPriority() {
  const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  for (const col of state.columns) {
    col.tasks.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));
  }
  renderBoard();
  setLastEvent('Задачи отсортированы по приоритету');
  showNotif('⬆️', 'Отсортировано', 'По приоритету (критичный → низкий)');
}

function filterOverdue() {
  state.filterOverdue = !state.filterOverdue;
  renderBoard();
  if (state.filterOverdue) {
    setLastEvent('Фильтр: просроченные задачи');
    showNotif('🔴', 'Фильтр активен', 'Показаны только просроченные задачи');
  } else {
    setLastEvent('Фильтр снят');
    showNotif('✅', 'Фильтр снят', 'Показаны все задачи');
  }
}

function toggleCompactMode() {
  closeMenus();
  state.compactMode = !state.compactMode;
  renderBoard();
  showNotif('🗜️', state.compactMode ? 'Компактный вид' : 'Обычный вид', '');
}

function exportData() {
  closeMenus();
  const json = JSON.stringify(state.columns, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'kanban-export.json';
  a.click();
  showNotif('💾', 'Экспортировано', 'kanban-export.json');
}

// ═══════════════════════════════════════════════════
//  WINDOW CONTROLS
// ═══════════════════════════════════════════════════
let windowMinimized = false;
let windowMaximized = true;

function minimizeWindow() {
  windowMinimized = true;
  document.getElementById('mainWindow').classList.add('minimized');
  document.getElementById('taskbarMainBtn').classList.remove('active');
}

function maximizeWindow() {
  const win = document.getElementById('mainWindow');
  const btn = document.getElementById('maxBtn');
  if (windowMaximized) {
    win.style.width = '70%';
    win.style.height = '70%';
    win.style.top = '30px';
    win.style.left = '30px';
    win.classList.remove('main-window');
    btn.textContent = '⤢';
    windowMaximized = false;
  } else {
    win.style.width = '';
    win.style.height = '';
    win.style.top = '';
    win.style.left = '';
    win.classList.add('main-window');
    btn.textContent = '□';
    windowMaximized = true;
  }
}

function closeWindow() {
  showMsgBox('⚠️', 'Выход', 'Вы уверены, что хотите закрыть KanbanOS 95?\n\nВсе несохранённые данные будут потеряны.', [
    { label: 'Да', action: () => { document.getElementById('mainWindow').style.display = 'none'; showNotif('👋', 'До свидания!', 'Окно закрыто. Дважды кликните по иконке на рабочем столе.'); } },
    { label: 'Нет', action: closeMsgBox }
  ]);
}

function restoreWindow() {
  const win = document.getElementById('mainWindow');
  win.style.display = '';
  win.classList.remove('minimized');
  win.classList.add('main-window');
  windowMinimized = false;
  document.getElementById('taskbarMainBtn').classList.add('active');
}

function toggleWindowFromTaskbar() {
  if (windowMinimized) {
    restoreWindow();
  } else {
    minimizeWindow();
  }
}

// ═══════════════════════════════════════════════════
//  MENUS
// ═══════════════════════════════════════════════════
function toggleMenu(el) {
  const isOpen = el.classList.contains('open');
  closeMenus();
  if (!isOpen) el.classList.add('open');
}

function closeMenus() {
  document.querySelectorAll('.menu-item.open').forEach(el => el.classList.remove('open'));
}

// ═══════════════════════════════════════════════════
//  START MENU
// ═══════════════════════════════════════════════════
function toggleStartMenu() {
  const sm = document.getElementById('startMenu');
  const btn = document.getElementById('startBtn');
  const isOpen = sm.classList.contains('open');
  sm.classList.toggle('open');
  btn.classList.toggle('open');
}

function closeStartMenu() {
  document.getElementById('startMenu').classList.remove('open');
  document.getElementById('startBtn').classList.remove('open');
}

// ═══════════════════════════════════════════════════
//  FUN STUFF
// ═══════════════════════════════════════════════════
const CATS = ['😸','😹','😺','😻','😼','🐱','🙀'];
const MEMES = [
  { title: 'Дедлайн', text: '«Я сделаю это за выходные»\n\n— Я, каждую пятницу уже 3 года подряд 😅' },
  { title: 'В процессе', text: '«In Progress» с 2023 года\n\n📊 Прогресс: ████░░░░░░ 40%\n\n(Последнее обновление: никогда)' },
  { title: 'Баг-репорт', text: 'Пользователь: «Это не работает»\n\nРазработчик: «У меня работает»\n\n🤷 Закрыть как "не воспроизводится"' },
  { title: 'Спринт', text: '🏃 Sprint Planning:\n\n«Возьмём 40 стори-поинтов!»\n\nОдин день спустя:\n\n«Нам нужно обсудить velocity...»' },
  { title: 'Критичный приоритет', text: '🔴 КРИТИЧНЫЙ\n\n...\n\n🔴 КРИТИЧНЫЙ\n\n...\n\n🔴 КРИТИЧНЫЙ\n\nСегодня в To Do: 12 критичных задач 🫠' },
];

function showMeme() {
  closeStartMenu();
  const meme = MEMES[Math.floor(Math.random() * MEMES.length)];
  const cat = CATS[Math.floor(Math.random() * CATS.length)];
  
  const div = document.createElement('div');
  div.className = 'meme-win';
  div.style.cssText = `top:${80+Math.random()*100}px; left:${80+Math.random()*150}px; width:280px;`;
  div.innerHTML = `
    <div class="title-bar" style="cursor:move;" onmousedown="startDragWin(event, this.parentElement)">
      <div class="title-bar-left"><span>${cat}</span><span>${escapeHtml(meme.title)}</span></div>
      <div class="title-bar-buttons">
        <button class="tb-btn" onclick="this.closest('.meme-win').remove()">✕</button>
      </div>
    </div>
    <div class="meme-content">${meme.text.replace(/\n/g,'<br>')}</div>
  `;
  document.body.appendChild(div);
}

function showAbout() {
  closeMenus(); closeStartMenu();
  document.getElementById('aboutModal').classList.add('active');
}

function playMinesweeper() {
  closeStartMenu();
  document.getElementById('minesweeperModal').classList.add('active');
}

function shutDown() {
  document.getElementById('shutdownModal').classList.add('active');
}

function doShutdown() {
  const action = document.getElementById('shutdownAction').value;
  document.getElementById('shutdownModal').classList.remove('active');
  
  if (action.includes('Выключить')) {
    showProgress('Завершение работы…', 'Windows выполняет завершение работы…', () => {
      document.body.innerHTML = `
        <div style="background:#000;color:#ccc;height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;font-size:14px;">
          Теперь можно безопасно выключить компьютер.<br><br>
          <span style="opacity:0.4; font-size:11px;">(Обновите страницу, чтобы продолжить)</span>
        </div>`;
    });
  } else if (action.includes('Перезапустить в режиме MS-DOS')) {
    showProgress('Перезапуск…', 'Подготовка к режиму MS-DOS…', () => {
      document.body.innerHTML = `
        <div style="background:#000;color:#ccc;height:100vh;padding:20px;font-family:'Courier New',monospace;font-size:14px;overflow:auto;">
          Microsoft(R) MS-DOS(R) Version 6.22<br>
          (C)Copyright Microsoft Corp 1981-1994.<br><br>
          C:\\WINDOWS><span id="dosInput">_</span>
        </div>`;
      let cmd = '';
      document.addEventListener('keydown', e => {
        const cursor = document.getElementById('dosInput');
        if (!cursor) return;
        if (e.key === 'Enter') {
          const parent = cursor.parentElement;
          let response = `Bad command or file name`;
          if (cmd.toLowerCase().includes('dir')) response = `Volume in drive C is KANBAN95\n Directory of C:\\\n\nKANBAN95   &lt;DIR&gt;      07-25-95   1:00p\nWINDOWS    &lt;DIR&gt;      07-25-95   1:00p\n        2 dir(s)     999,999 bytes free`;
          if (cmd.toLowerCase().includes('help')) response = `FOR HELP, REFRESH THE PAGE :)`;
          if (cmd.toLowerCase().includes('exit')) window.location.reload();
          parent.innerHTML += `<br>${response}<br>C:\\WINDOWS><span id="dosInput">_</span>`;
          cmd = '';
        } else if (e.key === 'Backspace') {
          cmd = cmd.slice(0,-1);
          if (cursor) cursor.previousSibling?.remove();
        } else if (e.key.length === 1) {
          cmd += e.key;
          const span = document.createElement('span');
          span.textContent = e.key;
          cursor.before(span);
        }
      });
    });
  } else {
    showProgress('Перезапуск…', 'Перезапуск Windows…', () => window.location.reload());
  }
}

function triggerBSOD() {
  closeMenus();
  document.getElementById('bsod').classList.add('active');
}

function showEaster() {
  closeMenus();
  showMsgBox('🥚', 'Пасхалка!', '🎉 Поздравляем! Вы нашли пасхальное яйцо!\n\n🏆 Достижение разблокировано:\n«Любопытный разработчик»\n\nP.S. А вы знали, что Windows 95 весила всего 30 МБ?', [
    { label: 'Круто!', action: () => { closeMsgBox(); showMeme(); } }
  ]);
}

// ═══════════════════════════════════════════════════
//  DRAGGABLE WINDOWS (мемы)
// ═══════════════════════════════════════════════════
let dragWin = null, dragWinOX = 0, dragWinOY = 0;

function startDragWin(e, win) {
  dragWin = win;
  dragWinOX = e.clientX - win.offsetLeft;
  dragWinOY = e.clientY - win.offsetTop;
  e.preventDefault();
}

document.addEventListener('mousemove', e => {
  if (!dragWin) return;
  dragWin.style.left = (e.clientX - dragWinOX) + 'px';
  dragWin.style.top  = (e.clientY - dragWinOY) + 'px';
});
document.addEventListener('mouseup', () => { dragWin = null; });

// ═══════════════════════════════════════════════════
//  MSGBOX
// ═══════════════════════════════════════════════════
function showMsgBox(icon, title, text, buttons) {
  document.getElementById('msgBoxIcon').textContent = icon;
  document.getElementById('msgBoxBigIcon').textContent = icon;
  document.getElementById('msgBoxTitle').textContent = title;
  document.getElementById('msgBoxText').innerHTML = text.replace(/\n/g,'<br>');
  const acts = document.getElementById('msgBoxActions');
  acts.innerHTML = '';
  (buttons || [{ label: 'OK', action: closeMsgBox }]).forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = b.label;
    btn.onclick = b.action;
    acts.appendChild(btn);
  });
  document.getElementById('msgBoxOverlay').classList.add('active');
}

function closeMsgBox() {
  document.getElementById('msgBoxOverlay').classList.remove('active');
}

// ═══════════════════════════════════════════════════
//  PROGRESS
// ═══════════════════════════════════════════════════
function showProgress(title, text, callback) {
  document.getElementById('progressTitle').textContent = title;
  document.getElementById('progressText').textContent = text;
  document.getElementById('progressModal').classList.add('active');
  const bar = document.getElementById('progressBar');
  let pct = 0;
  const interval = setInterval(() => {
    pct += Math.random() * 15;
    if (pct >= 100) {
      pct = 100;
      bar.style.width = '100%';
      clearInterval(interval);
      setTimeout(() => {
        document.getElementById('progressModal').classList.remove('active');
        if (callback) callback();
      }, 500);
    } else {
      bar.style.width = pct + '%';
    }
  }, 150);
}

// ═══════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════
function showNotif(icon, title, text) {
  const container = document.getElementById('notifContainer');
  const el = document.createElement('div');
  el.className = 'notification';
  el.innerHTML = `
    <div class="n-icon">${icon}</div>
    <div class="n-text"><b>${escapeHtml(title)}</b>${text ? '<br>' + escapeHtml(text) : ''}</div>
    <div class="n-close" onclick="this.parentElement.remove()">✕</div>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function setLastEvent(text) {
  document.getElementById('last-event').textContent = 'Событие: ' + text;
}

function setToolbarStatus(text) {
  document.getElementById('toolbar-status').textContent = text;
}

// ═══════════════════════════════════════════════════
//  CLOCK
// ═══════════════════════════════════════════════════
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  document.getElementById('clock').textContent = h + ':' + m;
}
setInterval(updateClock, 10000);
updateClock();

// ═══════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'n') { e.preventDefault(); openNewTask(); }
  if (e.key === 'Escape') {
    closeMenus();
    closeStartMenu();
    closeTaskModal();
    closeMsgBox();
  }
  if (e.key === 'F5') { e.preventDefault(); loadBoard(); }
});

// Close menus on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.menu-bar')) closeMenus();
  if (!e.target.closest('.start-menu') && !e.target.closest('.start-btn')) closeStartMenu();
});

// ═══════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════
loadBoard();