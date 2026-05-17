// ---------- STATE ----------
const API_BASE = '/api/v1';

let adminState = {
  columns: [],
  automationRules: [],
  eventQueue: [],
  notificationSettings: {
    onTaskCreate: true,
    onTaskMove: true,
    onDeadlineSoon: true,
    webhook: ""
  },
  autoLogs: []
};

let modalCallback = null;
let boardId = 1;

// ---------- НАВИГАЦИЯ ----------
function goToMainBoard() {
  window.location.href = '/';
}

// ---------- API CALLS ----------
async function apiCall(method, path, body = null) {
  const url = `${API_BASE}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
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
    addSystemNotif(`Ошибка API: ${error.message}`, "error");
    throw error;
  }
}

// Загрузка доски для получения колонок
async function loadBoardData() {
  try {
    const board = await apiCall('GET', `/boards/${boardId}`);
    adminState.columns = board.columns.map(col => ({
      id: col.id,
      title: col.title,
      emoji: getEmojiForColumn(col.title),
      wipLimit: null
    }));
    renderColumns();
  } catch (error) {
    console.error('Load board error:', error);
    addSystemNotif('Не удалось загрузить колонки', 'error');
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

// Загрузка правил автоматизации (пока мок, в API добавим позже)
async function loadRules() {
  // TODO: когда будет API для правил, заменить на реальный запрос
  const saved = localStorage.getItem("kanban_admin_rules");
  if (saved) {
    try {
      adminState.automationRules = JSON.parse(saved);
    } catch(e) {}
  } else {
    adminState.automationRules = [
      { id: "r1", name: "Критичный → In Progress", trigger: "priority:CRITICAL", action: "move:2", enabled: true },
      { id: "r2", name: "Дедлайн просрочен → уведомление", trigger: "deadline_overdue", action: "notify:admin", enabled: true },
      { id: "r3", name: "Тег 'срочно' → приоритет HIGH", trigger: "tag:срочно", action: "set_priority:HIGH", enabled: true }
    ];
  }
  renderRules();
}

// Сохранение правил
function saveRules() {
  localStorage.setItem("kanban_admin_rules", JSON.stringify(adminState.automationRules));
}

// Helpers
function saveToLocal() {
  localStorage.setItem("kanban_admin_config", JSON.stringify({
    columns: adminState.columns,
    notificationSettings: adminState.notificationSettings
  }));
  saveRules();
}

function loadFromLocal() {
  const saved = localStorage.getItem("kanban_admin_config");
  if (saved) {
    try {
      const data = JSON.parse(saved);
      adminState.columns = data.columns || adminState.columns;
      adminState.notificationSettings = data.notificationSettings || adminState.notificationSettings;
    } catch(e) {}
  }
  
  const notifyCreate = document.getElementById("notifyTaskCreate");
  const notifyMove = document.getElementById("notifyTaskMove");
  const notifyDeadline = document.getElementById("notifyDeadline");
  const webhookUrl = document.getElementById("webhookUrl");
  
  if (notifyCreate) notifyCreate.checked = adminState.notificationSettings.onTaskCreate;
  if (notifyMove) notifyMove.checked = adminState.notificationSettings.onTaskMove;
  if (notifyDeadline) notifyDeadline.checked = adminState.notificationSettings.onDeadlineSoon;
  if (webhookUrl) webhookUrl.value = adminState.notificationSettings.webhook || "";
  
  loadBoardData();
  loadRules();
}

function addSystemNotif(msg, type = "info") {
  const container = document.getElementById("notifContainer");
  if (!container) return;
  
  const el = document.createElement("div");
  el.className = "notification";
  el.innerHTML = `<span>${type === "error" ? "⚠️" : "ℹ️"}</span><span>${escapeHtml(msg)}</span><button style="margin-left:8px;" onclick="this.parentElement.remove()">OK</button>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function addAutoLog(ruleName, eventData) {
  adminState.autoLogs.unshift({ time: new Date().toLocaleTimeString(), rule: ruleName, event: eventData });
  if (adminState.autoLogs.length > 20) adminState.autoLogs.pop();
  renderAutoLog();
}

function enqueueEvent(event) {
  const ev = { id: Date.now() + Math.random(), timestamp: new Date().toISOString(), ...event, processed: false };
  adminState.eventQueue.push(ev);
  renderQueue();
  addSystemNotif(`Событие добавлено в очередь: ${event.type}`, "info");
}

function processQueue() {
  if (adminState.eventQueue.length === 0) { 
    addSystemNotif("Очередь пуста", "info"); 
    return; 
  }
  const toProcess = [...adminState.eventQueue];
  adminState.eventQueue = [];
  toProcess.forEach(ev => {
    addSystemNotif(`✅ Обработано событие: ${ev.type} для задачи #${ev.taskId || "?"}`, "info");
    applyAutomation(ev);
  });
  renderQueue();
  addSystemNotif(`Обработано ${toProcess.length} событий`, "info");
}

function applyAutomation(event) {
  const enabledRules = adminState.automationRules.filter(r => r.enabled);
  for (let rule of enabledRules) {
    let matched = false;
    if (rule.trigger === "priority:CRITICAL" && event.priority === "CRITICAL") matched = true;
    if (rule.trigger === "deadline_overdue" && event.isOverdue === true) matched = true;
    if (rule.trigger.startsWith("tag:") && event.tags && event.tags.includes(rule.trigger.split(":")[1])) matched = true;
    if (matched) {
      addAutoLog(rule.name, `${event.type} → ${rule.action}`);
      if (rule.action.startsWith("move:")) {
        addSystemNotif(`🤖 Автоматизация: правило "${rule.name}" переместило задачу`, "info");
      }
      if (rule.action.startsWith("notify:")) {
        addSystemNotif(`📢 Уведомление от правила: ${rule.name}`, "info");
      }
      if (rule.action.startsWith("set_priority:")) {
        addSystemNotif(`⚡ Правило ${rule.name}: приоритет изменён`, "info");
      }
    }
  }
}

function flushQueue() {
  adminState.eventQueue = [];
  renderQueue();
  addSystemNotif("Очередь событий очищена", "info");
}

function simulateLoad() {
  for (let i = 0; i < 5; i++) {
    enqueueEvent({ 
      type: "TASK_CREATE", 
      taskId: Math.floor(Math.random() * 1000), 
      priority: ["LOW", "MEDIUM", "HIGH", "CRITICAL"][Math.floor(Math.random() * 4)], 
      tags: ["срочно", "баг", "фича"][Math.floor(Math.random() * 3)] 
    });
  }
  addSystemNotif("Симуляция: добавлено 5 тестовых событий в очередь", "info");
}

function renderColumns() {
  const container = document.getElementById("columnsList");
  if (!container) return;
  
  container.innerHTML = adminState.columns.map(col => `
    <div class="col-item">
      <div><span style="font-size:16px;">${col.emoji || "📌"}</span> <strong>${escapeHtml(col.title)}</strong> ${col.wipLimit ? `(WIP: ${col.wipLimit})` : ""}</div>
      <div>
        <button class="btn-small" onclick="editColumn(${col.id})">✏️</button>
        <button class="btn-small" onclick="deleteColumn(${col.id})">🗑️</button>
      </div>
    </div>
  `).join("");
  
  const statColumns = document.getElementById("statColumns");
  if (statColumns) statColumns.innerText = adminState.columns.length;
  
  const flowPreview = document.getElementById("flowPreview");
  if (flowPreview) flowPreview.innerHTML = adminState.columns.map(c => `${c.emoji} ${escapeHtml(c.title)}`).join(" → ");
}

function renderRules() {
  const container = document.getElementById("rulesList");
  if (!container) return;
  
  container.innerHTML = adminState.automationRules.map(rule => `
    <div class="rule-item">
      <div><strong>${escapeHtml(rule.name)}</strong><br><span class="rule-badge">${escapeHtml(rule.trigger)} → ${escapeHtml(rule.action)}</span></div>
      <div>
        <button class="btn-small" onclick="toggleRule('${rule.id}')">${rule.enabled ? "🔘 Вкл" : "⚪ Выкл"}</button>
        <button class="btn-small" onclick="deleteRule('${rule.id}')">🗑️</button>
      </div>
    </div>
  `).join("");
  
  const statRules = document.getElementById("statRules");
  if (statRules) statRules.innerText = adminState.automationRules.length;
}

function renderQueue() {
  const container = document.getElementById("eventQueueList");
  if (!container) return;
  
  container.innerHTML = adminState.eventQueue.length === 0 ? 
    "<div style='color:#888;'>Нет событий в очереди</div>" :
    adminState.eventQueue.map(ev => `<div class="log-entry">[${new Date(ev.timestamp).toLocaleTimeString()}] ${ev.type} | task:${ev.taskId || "-"} | prio:${ev.priority || "-"} | tags:${ev.tags?.join(",") || "-"}</div>`).join("");
  
  const statQueueLen = document.getElementById("statQueueLen");
  if (statQueueLen) statQueueLen.innerText = adminState.eventQueue.length;
  
  const queueStats = document.getElementById("queueStats");
  if (queueStats) {
    queueStats.innerHTML = `
      <div class="stat-card"><div class="stat-value">${adminState.eventQueue.length}</div><div>В очереди</div></div>
      <div class="stat-card"><div class="stat-value">${adminState.autoLogs.length}</div><div>Срабатываний</div></div>
    `;
  }
}

function renderAutoLog() {
  const logDiv = document.getElementById("autoLog");
  if (!logDiv) return;
  logDiv.innerHTML = adminState.autoLogs.map(l => `<div class="log-entry">[${l.time}] ${escapeHtml(l.rule)} → ${escapeHtml(l.event)}</div>`).join("");
}

function renderAll() {
  renderColumns();
  renderRules();
  renderQueue();
  renderAutoLog();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// CRUD Columns (через API)
async function openAddColumnModal() {
  document.getElementById("modalTitle").innerText = "Новая колонка";
  document.getElementById("modalBody").innerHTML = `
    <div class="form-group"><label>Название:</label><input id="colTitle" placeholder="In Review"></div>
    <div class="form-group"><label>Эмодзи:</label><input id="colEmoji" value="📌"></div>
  `;
  modalCallback = async () => {
    const title = document.getElementById("colTitle").value.trim();
    if (!title) return;
    try {
      await apiCall('POST', '/columns', { title, board_id: boardId });
      addSystemNotif(`Колонка "${title}" добавлена`, "info");
      await loadBoardData();
      closeModal();
    } catch (error) {
      addSystemNotif('Ошибка добавления колонки', 'error');
    }
  };
  document.getElementById("modal").classList.add("active");
}

async function editColumn(id) {
  const col = adminState.columns.find(c => c.id === id);
  if (!col) return;
  
  document.getElementById("modalTitle").innerText = "Редактировать колонку";
  document.getElementById("modalBody").innerHTML = `
    <div class="form-group"><label>Название:</label><input id="colTitle" value="${escapeHtml(col.title)}"></div>
    <div class="form-group"><label>Эмодзи:</label><input id="colEmoji" value="${col.emoji || "📌"}"></div>
  `;
  modalCallback = async () => {
    const newTitle = document.getElementById("colTitle").value;
    // TODO: когда будет API для обновления колонки
    col.title = newTitle;
    col.emoji = document.getElementById("colEmoji").value;
    saveToLocal();
    renderColumns();
    closeModal();
    addSystemNotif(`Колонка переименована в "${newTitle}"`, "info");
  };
  document.getElementById("modal").classList.add("active");
}

async function deleteColumn(id) {
  if (confirm("Удалить колонку? Все задачи из неё исчезнут!")) {
    // TODO: когда будет API для удаления колонки
    adminState.columns = adminState.columns.filter(c => c.id !== id);
    saveToLocal();
    renderColumns();
    addSystemNotif("Колонка удалена", "info");
  }
}

// Rules
function openAddRuleModal() {
  document.getElementById("modalTitle").innerText = "Новое правило автоматизации";
  document.getElementById("modalBody").innerHTML = `
    <div class="form-group"><label>Название:</label><input id="ruleName" placeholder="Критичные задачи в In Progress"></div>
    <div class="form-group"><label>Триггер:</label>
      <select id="ruleTrigger">
        <option value="priority:CRITICAL">Приоритет Критичный</option>
        <option value="deadline_overdue">Дедлайн просрочен</option>
        <option value="tag:срочно">Тег "срочно"</option>
      </select>
    </div>
    <div class="form-group"><label>Действие:</label>
      <select id="ruleAction">
        <option value="move:2">Переместить в In Progress</option>
        <option value="notify:admin">Уведомить админа</option>
        <option value="set_priority:HIGH">Изменить приоритет на HIGH</option>
      </select>
    </div>
  `;
  modalCallback = () => {
    const name = document.getElementById("ruleName").value.trim();
    if (!name) return;
    adminState.automationRules.push({ 
      id: "r" + Date.now(), 
      name, 
      trigger: document.getElementById("ruleTrigger").value, 
      action: document.getElementById("ruleAction").value, 
      enabled: true 
    });
    saveRules();
    renderRules();
    closeModal();
    addSystemNotif(`Правило "${name}" добавлено`, "info");
  };
  document.getElementById("modal").classList.add("active");
}

function toggleRule(id) {
  const rule = adminState.automationRules.find(r => r.id === id);
  if (rule) {
    rule.enabled = !rule.enabled;
    saveRules();
    renderRules();
    addSystemNotif(`Правило "${rule.name}" ${rule.enabled ? "включено" : "выключено"}`, "info");
  }
}

function deleteRule(id) {
  const rule = adminState.automationRules.find(r => r.id === id);
  if (rule && confirm(`Удалить правило "${rule.name}"?`)) {
    adminState.automationRules = adminState.automationRules.filter(r => r.id !== id);
    saveRules();
    renderRules();
    addSystemNotif(`Правило "${rule.name}" удалено`, "info");
  }
}

function saveNotificationSettings() {
  adminState.notificationSettings = {
    onTaskCreate: document.getElementById("notifyTaskCreate").checked,
    onTaskMove: document.getElementById("notifyTaskMove").checked,
    onDeadlineSoon: document.getElementById("notifyDeadline").checked,
    webhook: document.getElementById("webhookUrl").value
  };
  saveToLocal();
  addSystemNotif("Настройки уведомлений сохранены", "info");
}

function sendTestNotification() {
  const msg = document.getElementById("testNotifMsg").value || "Тестовое уведомление от администратора";
  addSystemNotif(`📢 ${msg}`, "info");
  enqueueEvent({ type: "ADMIN_BROADCAST", message: msg });
}

function exportSettings() {
  const data = { 
    columns: adminState.columns, 
    rules: adminState.automationRules, 
    notif: adminState.notificationSettings 
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `kanban_admin_export_${new Date().toISOString().slice(0, 19)}.json`;
  a.click();
  addSystemNotif("Экспорт завершён", "info");
}

function importSettings() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.columns) adminState.columns = data.columns;
        if (data.rules) adminState.automationRules = data.rules;
        if (data.notif) adminState.notificationSettings = data.notif;
        saveToLocal();
        renderAll();
        addSystemNotif("Импорт выполнен успешно", "info");
      } catch (err) { 
        addSystemNotif("Ошибка импорта", "error"); 
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function refreshData() { 
  loadBoardData();
  loadRules();
  addSystemNotif("Данные админки обновлены", "info"); 
}

// UI Helpers
function switchTab(tab) {
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  const tabId = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  if (tabId) tabId.classList.add("active");
  
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  if (event && event.target) event.target.classList.add("active");
}

function toggleMenu(el) { 
  document.querySelectorAll(".menu-item.open").forEach(m => m.classList.remove("open")); 
  if (!el.classList.contains("open")) el.classList.add("open"); 
  else el.classList.remove("open"); 
}

function toggleStartMenu() { 
  const startMenu = document.getElementById("startMenu");
  if (startMenu) startMenu.classList.toggle("open"); 
}

function closeModal() { 
  const modal = document.getElementById("modal");
  if (modal) modal.classList.remove("active"); 
  modalCallback = null; 
}

function submitModal() { 
  if (modalCallback) modalCallback(); 
}

function showAbout() { 
  alert("KanbanOS 95 Admin Panel\nВерсия 1.0\nEvent-driven архитектура\nГотов к интеграции с RabbitMQ/Kafka\n\n© 1995-2026\nКоманда МГТУ Носова BitKillers"); 
}

function updateClock() { 
  const d = new Date(); 
  const clockEl = document.getElementById("clock");
  if (clockEl) clockEl.innerText = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); 
}

setInterval(updateClock, 1000); 
updateClock();

document.addEventListener("click", (e) => { 
  if (!e.target.closest(".menu-bar")) document.querySelectorAll(".menu-item.open").forEach(m => m.classList.remove("open")); 
  if (!e.target.closest(".start-menu") && !e.target.closest(".start-btn")) {
    const startMenu = document.getElementById("startMenu");
    if (startMenu) startMenu.classList.remove("open");
  }
});

loadFromLocal();