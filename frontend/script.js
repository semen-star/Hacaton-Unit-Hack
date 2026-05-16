let tasks = [
    { id: 1, title: 'Установить Windows 95', description: '25 дискет, 40 минут', priority: 'HIGH', column: 'done', tags: ['система'] },
    { id: 2, title: 'Подключить dial-up', description: 'Проверить модем 56k', priority: 'MEDIUM', column: 'in-progress', tags: ['интернет'] },
    { id: 3, title: 'Написать на ICQ', description: 'Сообщение: "Привет! Как дела?"', priority: 'LOW', column: 'todo', tags: ['общение'] },
    { id: 4, title: 'Дефрагментировать диск', description: 'Запустить Norton Disk Doctor', priority: 'CRITICAL', column: 'todo', tags: ['система'] },
    { id: 5, title: 'Слушать Winamp', description: 'Плейлист: Prodigy, Scooter', priority: 'LOW', column: 'in-progress', tags: ['музыка'] },
];

let taskIdCounter = 6;
let activeTab = 0;
let pendingDeleteId = null;

const COLUMNS = ['todo', 'in-progress', 'done'];

// ============================
// RENDER
// ============================

function renderBoard() {
    const map = { 'todo': [], 'in-progress': [], 'done': [] };
    tasks.forEach(t => map[t.column].push(t));

    COLUMNS.forEach(colId => {
        const container = document.getElementById(colId);
        container.innerHTML = map[colId].map(t => cardHTML(t)).join('');

        const countId = colId === 'in-progress' ? 'progress-count' : colId + '-count';
        document.getElementById(countId).textContent = map[colId].length;
    });

    // Tab counts
    document.getElementById('tab-todo-count').textContent = map['todo'].length;
    document.getElementById('tab-progress-count').textContent = map['in-progress'].length;
    document.getElementById('tab-done-count').textContent = map['done'].length;

    document.getElementById('total-tasks').textContent = tasks.length;
    document.getElementById('done-tasks').textContent = map['done'].length;

    // Re-attach drag listeners
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('dragstart', drag);
    });

    // Apply mobile active column
    applyMobileTab(activeTab, false);
}

function cardHTML(t) {
    const tagsHTML = t.tags.map(tag => `<span class="tag">${escHtml(tag)}</span>`).join('');
    return `
        <div class="card" draggable="true" id="task-${t.id}" data-id="${t.id}">
            <button class="card-delete" onclick="askDelete(${t.id}, '${escHtml(t.title).replace(/'/g, "\\'")}', event)" title="Удалить">✕</button>
            <div class="card-title">[${t.id}] ${escHtml(t.title)}</div>
            ${t.description ? `<div class="card-desc">${escHtml(t.description)}</div>` : ''}
            <div class="card-meta">
                <span class="priority priority-${t.priority}">${priorityLabel(t.priority)}</span>
                ${tagsHTML}
            </div>
        </div>
    `;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function priorityLabel(p) {
    return { LOW: '🟢 Низкий', MEDIUM: '🟡 Средний', HIGH: '🟠 Высокий', CRITICAL: '🔴 Критичный' }[p] || p;
}

// ============================
// DRAG & DROP (desktop)
// ============================

function drag(ev) {
    const card = ev.target.closest('.card');
    ev.dataTransfer.setData("text", card.dataset.id);
    card.classList.add('dragging');
    setTimeout(() => card.classList.remove('dragging'), 0);
}

function allowDrop(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.add('drag-over');
}

function drop(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('drag-over');
    const taskId = parseInt(ev.dataTransfer.getData("text"));
    const newColumn = ev.target.closest('.column-body').id;
    moveTask(taskId, newColumn);
}

document.querySelectorAll('.column-body').forEach(col => {
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
});

function moveTask(taskId, newColumn) {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.column !== newColumn) {
        task.column = newColumn;
        renderBoard();
    }
}

// ============================
// TOUCH DRAG (mobile)
// ============================

let touchDragId = null;
let touchGhost = null;
let touchStartX = 0;

function touchStart(ev) {
    const card = ev.target.closest('.card');
    if (!card) return;
    touchDragId = parseInt(card.dataset.id);
    touchStartX = ev.touches[0].clientX;

    // Create ghost
    touchGhost = card.cloneNode(true);
    touchGhost.style.cssText = `
        position: fixed; pointer-events: none; z-index: 9999;
        opacity: 0.8; width: ${card.offsetWidth}px;
        top: ${card.getBoundingClientRect().top}px;
        left: ${card.getBoundingClientRect().left}px;
    `;
    document.body.appendChild(touchGhost);
}

function touchMove(ev) {
    if (!touchDragId) return;
    ev.preventDefault();
    const t = ev.touches[0];
    if (touchGhost) {
        touchGhost.style.left = (t.clientX - 30) + 'px';
        touchGhost.style.top  = (t.clientY - 30) + 'px';
    }
}

function touchEnd(ev) {
    if (!touchDragId) return;
    if (touchGhost) { touchGhost.remove(); touchGhost = null; }

    // Swipe gesture: if moved > 60px horizontally, change column
    const deltaX = ev.changedTouches[0].clientX - touchStartX;
    const task = tasks.find(t => t.id === touchDragId);

    if (task && Math.abs(deltaX) > 60) {
        const currentIdx = COLUMNS.indexOf(task.column);
        let newIdx = currentIdx + (deltaX > 0 ? 1 : -1);
        newIdx = Math.max(0, Math.min(COLUMNS.length - 1, newIdx));
        if (newIdx !== currentIdx) {
            task.column = COLUMNS[newIdx];
            activeTab = newIdx;
            renderBoard();
        }
    }

    touchDragId = null;
}

// ============================
// MOBILE TABS
// ============================

function switchTab(idx) {
    activeTab = idx;
    applyMobileTab(idx, true);
}

function applyMobileTab(idx, updateCounts) {
    document.querySelectorAll('.column').forEach((col, i) => {
        col.classList.toggle('active-mobile', i === idx);
    });
    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === idx);
    });
}

// ============================
// MODAL — CREATE TASK
// ============================

function openModal() {
    document.getElementById('taskModal').classList.add('active');
    setTimeout(() => document.getElementById('taskTitle').focus(), 50);
}

function closeModal() {
    document.getElementById('taskModal').classList.remove('active');
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDesc').value = '';
    document.getElementById('taskTag').value = '';
}

function createTask() {
    const title = document.getElementById('taskTitle').value.trim();
    const desc  = document.getElementById('taskDesc').value.trim();
    const priority = document.getElementById('taskPriority').value;
    const tag   = document.getElementById('taskTag').value.trim();

    if (!title) {
        document.getElementById('taskTitle').focus();
        return;
    }

    tasks.push({
        id: taskIdCounter++,
        title,
        description: desc,
        priority,
        column: 'todo',
        tags: tag ? [tag] : []
    });

    // Switch to Todo tab on mobile
    activeTab = 0;
    closeModal();
    renderBoard();
}

// ============================
// DELETE TASK
// ============================

function askDelete(id, name, ev) {
    ev.stopPropagation();
    pendingDeleteId = id;
    document.getElementById('deleteTaskName').textContent = '"' + name + '"';
    document.getElementById('deleteModal').classList.add('active');
}

function confirmDelete() {
    if (pendingDeleteId !== null) {
        tasks = tasks.filter(t => t.id !== pendingDeleteId);
        pendingDeleteId = null;
        closeDeleteModal();
        renderBoard();
    }
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    pendingDeleteId = null;
}

// ============================
// KEYBOARD
// ============================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeDeleteModal(); }
    if (e.key === 'Enter' && document.getElementById('taskModal').classList.contains('active')) {
        if (document.activeElement.tagName !== 'TEXTAREA') createTask();
    }
});

// ============================
// CLOCK
// ============================

function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const time = `${hh}:${mm}`;
    const clockEl = document.getElementById('clock');
    const tbClockEl = document.getElementById('taskbarClock');
    if (clockEl) clockEl.textContent = time;
    if (tbClockEl) tbClockEl.textContent = time;
}

updateClock();
setInterval(updateClock, 10000);

// ============================
// INIT
// ============================

renderBoard();

// ============================
// WINDOW CONTROLS
// ============================

let isMinimized = false;
let isWindowed = false;

function minimizeWindow() {
    const win = document.querySelector('.window');
    if (isMinimized) return;
    isMinimized = true;
    win.classList.add('minimized');
    document.getElementById('taskbarApp').style.fontWeight = 'normal';
    showToast('📋 Свёрнуто. Нажмите на заголовок в панели задач, чтобы восстановить.');
}

function restoreWindow() {
    const win = document.querySelector('.window');
    if (!isMinimized) return;
    isMinimized = false;
    win.classList.remove('minimized');
    document.getElementById('taskbarApp').style.fontWeight = '';
}

function maximizeWindow() {
    const win = document.querySelector('.window');
    const btn = document.getElementById('maxBtn');
    isWindowed = !isWindowed;
    win.classList.toggle('windowed', isWindowed);
    btn.textContent = isWindowed ? '⬜' : '□';
    btn.title = isWindowed ? 'Полный экран' : 'Окно';
    showToast(isWindowed ? '🪟 Оконный режим. Теперь вы можете видеть рабочий стол.' : '🔲 Полный экран. Рабочего стола больше нет.');
}

function closeWindow() {
    document.getElementById('closeModal').classList.add('active');
}

function reallyClose() {
    document.getElementById('closeModal').classList.remove('active');
    if (Math.random() < 0.25) {
        showBsod();
    } else {
        const win = document.querySelector('.window');
        win.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        win.style.transform = 'scale(0.95)';
        win.style.opacity = '0';
        setTimeout(() => {
            win.style.transform = '';
            win.style.opacity = '';
            showToast('🤔 Передумал? Окно само вернулось 😎');
        }, 1500);
    }
}

// ============================
// BSOD
// ============================

function showBsod() {
    const el = document.createElement('div');
    el.className = 'bsod';
    el.innerHTML = `
        <div class="bsod-inner">
            <div class="bsod-title">Windows</div>
            <p>Произошла ФАТАЛЬНАЯ ОШИБКА при попытке закрыть Kanban Board.</p>
            <br>
            <p>*** STOP: 0x0000TASK (0xC0FFEE, 0xDEADBEEF, 0x00000000, 0xCAFEBABE)</p>
            <br>
            <p>KANBAN_BOARD_CANNOT_BE_CLOSED</p>
            <br>
            <p>Если это первый раз когда вы видите этот экран,<br>
            перезагрузите компьютер. Если этот экран появляется снова,<br>
            выполните следующие действия:</p>
            <br>
            <p>Проверьте правильность установки нового программного обеспечения.<br>
            Запустите CHKDSK /F для проверки диска на наличие задач.</p>
            <br>
            <p style="animation: blink 1s step-end infinite">Нажмите любую клавишу для продолжения _</p>
        </div>
    `;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 50);
    const style = document.createElement('style');
    style.textContent = `@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`;
    document.head.appendChild(style);
    const dismiss = () => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 400);
        document.removeEventListener('keydown', dismiss);
        el.removeEventListener('click', dismiss);
    };
    setTimeout(() => {
        document.addEventListener('keydown', dismiss);
        el.addEventListener('click', dismiss);
    }, 800);
}

// ============================
// START MENU
// ============================

const TIPS_OF_DAY = [
    '💡 Совет дня: Если компьютер завис — подождите. Он сам справится.',
    '💡 Совет дня: Нажмите Ctrl+Alt+Del, если что-то пошло не так. Или не нажимайте.',
    '💡 Совет дня: Регулярно дефрагментируйте жёсткий диск. Например, прямо сейчас.',
    '💡 Совет дня: Не выключайте компьютер во время обновления. Займёт 3-4 часа.',
    '💡 Совет дня: ICQ — это не мессенджер, это образ жизни.',
    '💡 Совет дня: Если у вас dial-up, не качайте файлы больше 1 МБ.',
    '💡 Совет дня: Чтобы ускорить Windows 95 — добавьте ОЗУ. Хотя бы до 64 МБ.',
    '💡 Совет дня: Антивирус не нужен, если не скачивать файлы с дискет незнакомцев.',
    '💡 Совет дня: Сохраните работу. Ctrl+S. Сделайте это прямо сейчас.',
    '💡 Совет дня: Если мышь не работает — попробуйте протереть шарик. Серьёзно.',
];

const RUN_JOKES = [
    { cmd: 'winamp', result: '🎵 It really whips the llamas ass! Плейлист загружен.' },
    { cmd: 'minesweeper', result: '💣 Бум. Вы нашли мину на первом же ходу.' },
    { cmd: 'solitaire', result: '🃏 Вы не выиграли. Попробуйте через 4 часа.' },
    { cmd: 'notepad', result: '📝 Открыт TODO.txt. Содержимое: [пусто]. Как обычно.' },
    { cmd: 'cmd', result: 'C:\\> _ (курсор мигает 5 минут. Ничего не происходит.)' },
    { cmd: 'format c:', result: '⚠️ Форматирование C: завершено. Удалено 0 полезных файлов.' },
    { cmd: 'ping', result: '📡 Request timed out. Dial-up не поддерживает интернет.' },
    { cmd: 'doom', result: '👾 DOOM запущен. Фреймрейт: 3 fps. Приемлемо.' },
    { cmd: 'help', result: '❓ Справочная система Windows: файл справки не найден.' },
    { cmd: 'matrix', result: '🟩 Wake up, Neo...' },
];

function toggleStart() {
    const menu = document.getElementById('startMenu');
    const btn = document.getElementById('startBtn');
    const isOpen = menu.classList.toggle('open');
    btn.classList.toggle('active', isOpen);
    if (isOpen) {
        const tip = TIPS_OF_DAY[Math.floor(Math.random() * TIPS_OF_DAY.length)];
        showToast(tip, 5000);
        setTimeout(() => document.addEventListener('click', closeStartOnOutside), 10);
    }
}

function closeStartOnOutside(e) {
    const menu = document.getElementById('startMenu');
    const btn = document.getElementById('startBtn');
    if (!menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.remove('open');
        btn.classList.remove('active');
        document.removeEventListener('click', closeStartOnOutside);
    }
}

function startItem(action) {
    document.getElementById('startMenu').classList.remove('open');
    document.getElementById('startBtn').classList.remove('active');
    document.removeEventListener('click', closeStartOnOutside);

    const recentDocs = ['Резюме_ФИНАЛ.doc', 'Резюме_ФИНАЛ_v2.doc', 'резюме_ТОЧНО_ФИНАЛ.doc',
        'НЕ_ЭТО.doc', 'Резюме_копия.doc', 'Безымянный.txt', 'qqq.bmp'];

    switch(action) {
        case 'programs':
            showToast('📁 Установленные программы: Kanban Board v1.0. Больше нет.', 4000); break;
        case 'documents':
            showToast('📄 Недавние документы: ' + recentDocs[Math.floor(Math.random()*recentDocs.length)], 4000); break;
        case 'settings':
            showToast('⚙️ Открываются настройки... ⏳ ...готово. Ничего не изменилось.', 4000); break;
        case 'find':
            showToast('🔍 Найдено: 0 файлов по запросу "смысл жизни". Попробуйте "*.tmp"', 4000); break;
        case 'help':
            showToast('❓ Файл справки WINDOWS.HLP не найден. Попробуйте сами.', 4000); break;
        case 'run':
            document.getElementById('runModal').classList.add('active');
            setTimeout(() => document.getElementById('runInput').focus(), 50);
            break;
        case 'shutdown':
            document.getElementById('shutdownModal').classList.add('active');
            break;
    }
}

function runCommand() {
    const cmd = document.getElementById('runInput').value.trim().toLowerCase();
    document.getElementById('runModal').classList.remove('active');
    document.getElementById('runInput').value = '';
    if (!cmd) { showToast('Вы не ввели команду. Типичный пользователь Windows 95.'); return; }
    const joke = RUN_JOKES.find(j => cmd.includes(j.cmd));
    showToast(joke ? '▶ ' + joke.result : `▶ Программа "${cmd}" не найдена. Попробуйте "winamp".`, 5000);
}

function doShutdown() {
    document.getElementById('shutdownModal').classList.remove('active');
    const action = document.querySelector('input[name="shutdown"]:checked').value;

    if (action === 'standby') {
        const el = document.createElement('div');
        el.className = 'shutdown-screen';
        el.style.background = '#000';
        el.innerHTML = '<div style="text-align:center"><div style="font-size:48px">💤</div><div>Режим ожидания...</div></div>';
        document.body.appendChild(el);
        setTimeout(() => el.classList.add('show'), 50);
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => { el.remove(); showToast('☀️ Компьютер проснулся. Доброе утро!'); }, 500); }, 2500);
        return;
    }

    const msg = action === 'restart' ? '🔄 Перезагрузка системы...' : '🔌 Теперь можно безопасно выключить компьютер.';
    const el = document.createElement('div');
    el.className = 'shutdown-screen';
    el.innerHTML = `<div style="text-align:center"><div style="font-size:48px;margin-bottom:20px">💻</div><div>${msg}</div>${action==='restart'?'<div style="font-size:12px;margin-top:12px;opacity:0.7">Сохранение настроек... (0 из 0)</div>':''}</div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 50);
    if (action === 'restart') {
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => { el.remove(); showToast('🎉 Перезагрузка завершена! Все задачи чудом сохранились 😅'); }, 500); }, 3000);
    }
}

// ============================
// TOAST
// ============================

function showToast(msg, duration = 3000) {
    const existing = document.getElementById('win-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'win-toast';
    toast.textContent = msg;
    toast.style.cssText = `
        position:fixed;bottom:34px;right:8px;
        background:#ffffcc;
        border-top:2px solid #dfdfdf;border-left:2px solid #dfdfdf;
        border-right:2px solid #0a0a0a;border-bottom:2px solid #0a0a0a;
        padding:6px 12px;font-size:11px;z-index:5000;
        font-family:'MS Sans Serif',Tahoma,sans-serif;
        max-width:380px;box-shadow:2px 2px 0 rgba(0,0,0,0.3);
        animation:toastIn 0.15s ease;
    `;
    document.body.appendChild(toast);
    const s = document.createElement('style');
    s.textContent = `@keyframes toastIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`;
    document.head.appendChild(s);
    setTimeout(() => toast.remove(), duration);
}
