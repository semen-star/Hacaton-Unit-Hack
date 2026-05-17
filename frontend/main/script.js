// ═══════════════════════════════════════════════════
//  AUTH & CONFIG
// ═══════════════════════════════════════════════════
const API_BASE = '/api/v1';
let currentUser = null;

// Получаем токен из localStorage
function getAuthToken() {
  return localStorage.getItem('access_token');
}

// Проверка авторизации
async function checkAuth() {
  const token = getAuthToken();
  if (!token) {
    window.location.href = '/login%20register';
    return false;
  }
  
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error('Token invalid');
    }
    
    currentUser = await response.json();
    
    // Показываем имя пользователя в тулбаре
    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
      userInfo.innerHTML = `👤 ${escapeHtml(currentUser.username)}`;
    }
    
    // Показываем кнопку админки только для админов
    const adminIcon = document.querySelector('.desktop-icon[ondblclick="goToAdmin()"]');
    if (adminIcon && currentUser.role !== 'admin') {
      adminIcon.style.display = 'none';
    }
    
    return true;
  } catch (error) {
    console.error('Auth check failed:', error);
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.location.href = '/login%20register';
    return false;
  }
}

// Выход из системы
function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  showNotif('👋', 'До свидания!', 'Вы вышли из системы');
  setTimeout(() => {
    window.location.href = '/login%20register';
  }, 500);
}

// Переход в админку (с проверкой роли)
function goToAdmin() {
  if (currentUser && currentUser.role === 'admin') {
    window.location.href = '/admin';
  } else {
    showNotif('⛔', 'Доступ запрещён', 'Только для администраторов');
  }
}

// API вызов с токеном
async function apiCall(method, path, body = null) {
  const token = getAuthToken();
  const url = `${API_BASE}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    if (response.status === 401) {
      logout();
      throw new Error('Сессия истекла');
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
    if (response.status === 204) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    showNotif('⚠️', 'Ошибка', error.message);
    throw error;
  }
}

// ═══════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════
let state = {
  columns: [],
  nextId: 1,
  draggedTaskId: null,
  draggedFromCol: null,
  compactMode: false,
  filterOverdue: false,
  boardId: 1
};

// ═══════════════════════════════════════════════════
//  BOARD LOAD
// ═══════════════════════════════════════════════════
async function loadBoard() {
  
  setToolbarStatus('Загрузка...');
  try {
    const board = await apiCall('GET', `/boards/${state.boardId}`);
    // Преобразуем данные из API в формат фронта
    state.columns = board.columns.map(col => ({
      id: col.id,
      title: col.title,
      emoji: getEmojiForColumn(col.title),
      tasks: (col.tasks || []).map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        tags: task.tags || [],
        deadline: task.deadline || null,
        created: task.created_at ? task.created_at.split('T')[0] : new Date().toISOString().slice(0, 10)
      }))
    }));
    
    renderBoard();
    setLastEvent('Доска обновлена');
    setToolbarStatus('Готово');
  } catch (error) {
    console.error('Load board error:', error);
    setToolbarStatus('Ошибка!');
    showNotif('⚠️', 'Ошибка подключения', 'Не удалось загрузить доску.');
  }
}

function getEmojiForColumn(title) {
  const emojiMap = {
    'To Do': '📋',
    'In Progress': '🔄',
    'Done': '✅',
    'Review': '👀',
    'Backlog': '📦'
  };
  return emojiMap[title] || '📌';
}

// ═══════════════════════════════════════════════════
//  BOARD RENDER
// ═══════════════════════════════════════════════════
function renderBoard() {
  const board = document.getElementById('board');
  if (!board) return;
  
  const addBtn = board.querySelector('.add-column-btn');
  
  // Remove old columns
  board.querySelectorAll('.column').forEach(c => c.remove());
  
  let filtered = state.filterOverdue;
  const today = new Date(); 
  today.setHours(0, 0, 0, 0);
  
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
        <span><span class="col-emoji">${col.emoji || '📌'}</span>${escapeHtml(col.title)}</span>
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
  const total = state.columns.reduce((s, c) => s + c.tasks.length, 0);
  const totalEl = document.getElementById('total-tasks');
  if (totalEl) totalEl.textContent = total;
  
  // Update column selector in modal
  const sel = document.getElementById('taskColumn');
  if (sel) {
    sel.innerHTML = state.columns.map(c =>
      `<option value="${c.id}">${c.emoji || '📌'} ${escapeHtml(c.title)}</option>`
    ).join('');
  }
}

function renderCard(t) {
  const today = new Date(); 
  today.setHours(0, 0, 0, 0);
  let deadlineHtml = '';
  if (t.deadline) {
    const dl = new Date(t.deadline);
    const diff = Math.round((dl - today) / 86400000);
    let cls = '';
    let label = dl.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit' });
    if (diff < 0) { 
      cls = 'overdue'; 
      label = '⚠️ ' + label; 
    } else if (diff <= 3) { 
      cls = 'soon'; 
      label = '⏰ ' + label; 
    }
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
  const labels = { 
    LOW: '🟢 Низкий', 
    MEDIUM: '🟡 Средний', 
    HIGH: '🟠 Высокий', 
    CRITICAL: '🔴 Критичный' 
  };
  return labels[p] || p;
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ═══════════════════════════════════════════════════
//  DRAG & DROP
// ═══════════════════════════════════════════════════
function dragStart(e, taskId) {
  state.draggedTaskId = taskId;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', taskId);
  setTimeout(() => {
    const el = document.getElementById('task-' + taskId);
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
    if (col.tasks.find(t => t.id === taskId)) { 
      oldColId = col.id; 
      break; 
    }
  }
  
  if (oldColId === newColId) return;
  
  try {
    await apiCall('POST', '/tasks/move', { 
      task_id: taskId, 
      new_column_id: newColId 
    });
    
    const newColName = state.columns.find(c => c.id === newColId)?.title || '?';
    setLastEvent(`Задача #${taskId} → ${newColName}`);
    showNotif('↗️', 'Задача перемещена', `#${taskId} → ${newColName}`);
    
    await loadBoard();
  } catch (error) {
    console.error('Move error:', error);
    showNotif('❌', 'Ошибка', 'Не удалось переместить задачу');
  }
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
  if (state.columns.length > 0) {
    document.getElementById('taskColumn').value = state.columns[0].id;
  }
  document.getElementById('taskModal').classList.add('active');
  setTimeout(() => document.getElementById('taskTitle').focus(), 50);
}

async function editTask(id, e) {
  if (e) e.stopPropagation();
  closeMenus();
  
  let task;
  let taskColumn;
  for (const col of state.columns) {
    const found = col.tasks.find(t => t.id === id);
    if (found) {
      task = found;
      taskColumn = col;
      break;
    }
  }
  if (!task) return;
  
  document.getElementById('modalTitle').textContent = `Редактирование задачи #${id}`;
  document.getElementById('editTaskId').value = id;
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDesc').value = task.description || '';
  document.getElementById('taskPriority').value = task.priority;
  document.getElementById('taskTags').value = (task.tags || []).join(', ');
  document.getElementById('taskDeadline').value = task.deadline || '';
  document.getElementById('taskColumn').value = taskColumn.id;
  
  document.getElementById('taskModal').classList.add('active');
  setTimeout(() => document.getElementById('taskTitle').focus(), 50);
}

async function saveTask() {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) { 
    showNotif('⚠️', 'Ошибка', 'Введите название задачи'); 
    return; 
  }
  
  const editId = parseInt(document.getElementById('editTaskId').value);
  const desc = document.getElementById('taskDesc').value.trim();
  const priority = document.getElementById('taskPriority').value;
  const tagsRaw = document.getElementById('taskTags').value;
  const tags = tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const deadline = document.getElementById('taskDeadline').value || null;
  const colId = parseInt(document.getElementById('taskColumn').value);
  
  try {
    if (editId) {
      const updateData = { 
        title, 
        description: desc, 
        priority, 
        tags,
        deadline 
      };
      await apiCall('PUT', `/tasks/${editId}`, updateData);
      
      let currentColId = null;
      for (const col of state.columns) {
        if (col.tasks.find(t => t.id === editId)) {
          currentColId = col.id;
          break;
        }
      }
      if (currentColId && currentColId !== colId) {
        await apiCall('POST', '/tasks/move', { 
          task_id: editId, 
          new_column_id: colId 
        });
      }
      
      setLastEvent(`Задача #${editId} обновлена`);
      showNotif('✏️', 'Задача обновлена', title);
    } else {
      const createData = {
        title,
        description: desc,
        priority,
        column_id: colId,
        tags
      };
      await apiCall('POST', '/tasks', createData);
      setLastEvent(`Создана задача: ${title}`);
      showNotif('📝', 'Задача создана', title);
    }
    
    closeTaskModal();
    await loadBoard();
  } catch (error) {
    console.error('Save error:', error);
    showNotif('❌', 'Ошибка', 'Не удалось сохранить задачу');
  }
}

async function deleteTask(id, e) {
  if (e) e.stopPropagation();
  
  const task = findTask(id);
  if (!confirm(`Удалить задачу #${id} «${task?.title}»?`)) return;
  
  try {
    await apiCall('DELETE', `/tasks/${id}`);
    setLastEvent(`Задача #${id} удалена`);
    showNotif('🗑️', 'Задача удалена', task?.title || '');
    await loadBoard();
  } catch (error) {
    console.error('Delete error:', error);
    showNotif('❌', 'Ошибка', 'Не удалось удалить задачу');
  }
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
  const doneColumn = state.columns.find(c => c.title === 'Done');
  if (!doneColumn || !doneColumn.tasks.length) { 
    showNotif('ℹ️', 'Нечего очищать', 'Колонка Done пуста'); 
    return; 
  }
  
  if (!confirm(`Удалить все ${doneColumn.tasks.length} задач из Done?`)) return;
  
  for (const task of [...doneColumn.tasks]) {
    try {
      await apiCall('DELETE', `/tasks/${task.id}`);
    } catch (error) {
      console.error('Delete error:', error);
    }
  }
  showNotif('🗑️', 'Done очищен', `Удалено ${doneColumn.tasks.length} задач`);
  await loadBoard();
}

async function addColumn() {
  closeMenus();
  const name = prompt('Название новой колонки:');
  if (!name) return;
  
  try {
    await apiCall('POST', '/columns', { 
      title: name, 
      board_id: state.boardId 
    });
    showNotif('➕', 'Колонка добавлена', name);
    await loadBoard();
  } catch (error) {
    console.error('Add column error:', error);
    showNotif('❌', 'Ошибка', 'Не удалось добавить колонку');
  }
}

// ═══════════════════════════════════════════════════
//  SORTING & FILTERING
// ═══════════════════════════════════════════════════
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
  a.download = `kanban-export-${new Date().toISOString().slice(0, 19)}.json`;
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
  const mainWindow = document.getElementById('mainWindow');
  if (mainWindow) mainWindow.classList.add('minimized');
  const taskbarBtn = document.getElementById('taskbarMainBtn');
  if (taskbarBtn) taskbarBtn.classList.remove('active');
}

function maximizeWindow() {
  const win = document.getElementById('mainWindow');
  const btn = document.getElementById('maxBtn');
  if (!win || !btn) return;
  
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
    { label: 'Да', action: () => { 
      const mainWindow = document.getElementById('mainWindow');
      if (mainWindow) mainWindow.style.display = 'none'; 
      showNotif('👋', 'До свидания!', 'Окно закрыто. Дважды кликните по иконке на рабочем столе.'); 
    } },
    { label: 'Нет', action: closeMsgBox }
  ]);
}

function restoreWindow() {
  const win = document.getElementById('mainWindow');
  if (!win) return;
  
  win.style.display = '';
  win.classList.remove('minimized');
  win.classList.add('main-window');
  windowMinimized = false;
  const taskbarBtn = document.getElementById('taskbarMainBtn');
  if (taskbarBtn) taskbarBtn.classList.add('active');
}

function toggleWindowFromTaskbar() {
  if (windowMinimized) {
    restoreWindow();
  } else {
    minimizeWindow();
  }
}

// ═══════════════════════════════════════════════════
//  MENUS & START MENU
// ═══════════════════════════════════════════════════
function toggleMenu(el) {
  const isOpen = el.classList.contains('open');
  closeMenus();
  if (!isOpen) el.classList.add('open');
}

function closeMenus() {
  document.querySelectorAll('.menu-item.open').forEach(el => el.classList.remove('open'));
}

function toggleStartMenu() {
  const sm = document.getElementById('startMenu');
  const btn = document.getElementById('startBtn');
  if (!sm) return;
  
  const isOpen = sm.classList.contains('open');
  sm.classList.toggle('open');
  if (btn) btn.classList.toggle('open');
}

function closeStartMenu() {
  const sm = document.getElementById('startMenu');
  const btn = document.getElementById('startBtn');
  if (sm) sm.classList.remove('open');
  if (btn) btn.classList.remove('open');
}

// ═══════════════════════════════════════════════════
//  FUN STUFF
// ═══════════════════════════════════════════════════
const CATS = ['😸', '😹', '😺', '😻', '😼', '🐱', '🙀'];
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
  div.style.cssText = `top:${80 + Math.random() * 100}px; left:${80 + Math.random() * 150}px; width:280px;`;
  div.innerHTML = `
    <div class="title-bar" style="cursor:move;" onmousedown="startDragWin(event, this.parentElement)">
      <div class="title-bar-left"><span>${cat}</span><span>${escapeHtml(meme.title)}</span></div>
      <div class="title-bar-buttons">
        <button class="tb-btn" onclick="this.closest('.meme-win').remove()">✕</button>
      </div>
    </div>
    <div class="meme-content">${meme.text.replace(/\n/g, '<br>')}</div>
  `;
  document.body.appendChild(div);
}

function showAbout() {
  closeMenus();
  closeStartMenu();
  const aboutModal = document.getElementById('aboutModal');
  if (aboutModal) aboutModal.classList.add('active');
}

function playMinesweeper() {
  closeStartMenu();
  const minesweeperModal = document.getElementById('minesweeperModal');
  if (minesweeperModal) minesweeperModal.classList.add('active');
}

function shutDown() {
  const shutdownModal = document.getElementById('shutdownModal');
  if (shutdownModal) shutdownModal.classList.add('active');
}

function doShutdown() {
  const actionSelect = document.getElementById('shutdownAction');
  const action = actionSelect ? actionSelect.value : '';
  const shutdownModal = document.getElementById('shutdownModal');
  if (shutdownModal) shutdownModal.classList.remove('active');
  
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
          let response = 'Bad command or file name';
          if (cmd.toLowerCase().includes('dir')) response = 'Volume in drive C is KANBAN95\n Directory of C:\\\n\nKANBAN95   &lt;DIR&gt;      07-25-95   1:00p\nWINDOWS    &lt;DIR&gt;      07-25-95   1:00p\n        2 dir(s)     999,999 bytes free';
          if (cmd.toLowerCase().includes('help')) response = 'FOR HELP, REFRESH THE PAGE :)';
          if (cmd.toLowerCase().includes('exit')) window.location.reload();
          parent.innerHTML += `<br>${response}<br>C:\\WINDOWS><span id="dosInput">_</span>`;
          cmd = '';
        } else if (e.key === 'Backspace') {
          cmd = cmd.slice(0, -1);
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
  const bsod = document.getElementById('bsod');
  if (bsod) bsod.classList.add('active');
}

function showEaster() {
  closeMenus();
  showMsgBox('🥚', 'Пасхалка!', '🎉 Поздравляем! Вы нашли пасхальное яйцо!\n\n🏆 Достижение разблокировано:\n«Любопытный разработчик»\n\nP.S. А вы знали, что Windows 95 весила всего 30 МБ?', [
    { label: 'Круто!', action: () => { closeMsgBox(); showMeme(); } }
  ]);
}

// ═══════════════════════════════════════════════════
//  DRAGGABLE WINDOWS
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
  dragWin.style.top = (e.clientY - dragWinOY) + 'px';
});

document.addEventListener('mouseup', () => { dragWin = null; });

// ═══════════════════════════════════════════════════
//  MSGBOX
// ═══════════════════════════════════════════════════
function showMsgBox(icon, title, text, buttons) {
  const msgBoxIcon = document.getElementById('msgBoxIcon');
  const msgBoxBigIcon = document.getElementById('msgBoxBigIcon');
  const msgBoxTitle = document.getElementById('msgBoxTitle');
  const msgBoxText = document.getElementById('msgBoxText');
  const msgBoxActions = document.getElementById('msgBoxActions');
  
  if (msgBoxIcon) msgBoxIcon.textContent = icon;
  if (msgBoxBigIcon) msgBoxBigIcon.textContent = icon;
  if (msgBoxTitle) msgBoxTitle.textContent = title;
  if (msgBoxText) msgBoxText.innerHTML = text.replace(/\n/g, '<br>');
  if (msgBoxActions) {
    msgBoxActions.innerHTML = '';
    (buttons || [{ label: 'OK', action: closeMsgBox }]).forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = b.label;
      btn.onclick = b.action;
      msgBoxActions.appendChild(btn);
    });
  }
  const msgBoxOverlay = document.getElementById('msgBoxOverlay');
  if (msgBoxOverlay) msgBoxOverlay.classList.add('active');
}

function closeMsgBox() {
  const msgBoxOverlay = document.getElementById('msgBoxOverlay');
  if (msgBoxOverlay) msgBoxOverlay.classList.remove('active');
}

// ═══════════════════════════════════════════════════
//  PROGRESS
// ═══════════════════════════════════════════════════
function showProgress(title, text, callback) {
  const progressTitle = document.getElementById('progressTitle');
  const progressText = document.getElementById('progressText');
  const progressModal = document.getElementById('progressModal');
  const progressBar = document.getElementById('progressBar');
  
  if (progressTitle) progressTitle.textContent = title;
  if (progressText) progressText.textContent = text;
  if (progressModal) progressModal.classList.add('active');
  
  let pct = 0;
  const interval = setInterval(() => {
    pct += Math.random() * 15;
    if (pct >= 100) {
      pct = 100;
      if (progressBar) progressBar.style.width = '100%';
      clearInterval(interval);
      setTimeout(() => {
        if (progressModal) progressModal.classList.remove('active');
        if (callback) callback();
      }, 500);
    } else {
      if (progressBar) progressBar.style.width = pct + '%';
    }
  }, 150);
}

// ═══════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════
function showNotif(icon, title, text) {
  const container = document.getElementById('notifContainer');
  if (!container) return;
  
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
  const lastEvent = document.getElementById('last-event');
  if (lastEvent) lastEvent.textContent = 'Событие: ' + text;
}

function setToolbarStatus(text) {
  const toolbarStatus = document.getElementById('toolbar-status');
  if (toolbarStatus) toolbarStatus.textContent = text;
}

// ═══════════════════════════════════════════════════
//  CLOCK
// ═══════════════════════════════════════════════════
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const clock = document.getElementById('clock');
  if (clock) clock.textContent = h + ':' + m;
}
setInterval(updateClock, 10000);
updateClock();

// ═══════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'n') { 
    e.preventDefault(); 
    openNewTask(); 
  }
  if (e.key === 'Escape') {
    closeMenus();
    closeStartMenu();
    closeTaskModal();
    closeMsgBox();
  }
  if (e.key === 'F5') { 
    e.preventDefault(); 
    loadBoard(); 
  }
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