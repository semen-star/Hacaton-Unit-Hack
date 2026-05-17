cat > /home/semka/Hacaton-Unit-Hack/frontend/login\ register/script.js << 'EOF'
const API_BASE = '/api/v1';
let currentTab = 'login';

function switchTab(tab) {
  currentTab = tab;
  
  const loginPane = document.getElementById('loginForm');
  const registerPane = document.getElementById('registerForm');
  const tabs = document.querySelectorAll('.tab-btn');
  
  if (tab === 'login') {
    loginPane.classList.add('active');
    registerPane.classList.remove('active');
    tabs[0].classList.add('active');
    tabs[1].classList.remove('active');
  } else {
    loginPane.classList.remove('active');
    registerPane.classList.add('active');
    tabs[0].classList.remove('active');
    tabs[1].classList.add('active');
  }
}

function showNotification(message, isError = false) {
  const container = document.getElementById('notifContainer');
  if (!container) return;
  
  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.innerHTML = `
    <span>${isError ? '❌' : '✅'}</span>
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="margin-left:8px;">✕</button>
  `;
  container.appendChild(notif);
  setTimeout(() => notif.remove(), 4000);
}

function setStatus(message, isError = false) {
  const statusEl = document.getElementById('statusMsg');
  if (statusEl) {
    statusEl.innerHTML = isError ? `⚠️ ${message}` : `✅ ${message}`;
    statusEl.style.color = isError ? '#a00000' : '#006400';
  }
}

async function login() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  if (!username || !password) {
    setStatus('Заполните все поля', true);
    return;
  }
  
  setStatus('Проверка учётных данных...');
  
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка входа');
    }
    
    const data = await response.json();
    
    // Сохраняем токен и данные пользователя
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    console.log('Login successful!', data.user);
    console.log('Token saved:', localStorage.getItem('access_token'));
    
    showNotification(`Добро пожаловать, ${data.user.username}!`);
    setStatus('Вход выполнен! Перенаправление...');
    
    // Перенаправление в зависимости от роли
    setTimeout(() => {
      if (data.user.role === 'admin') {
        console.log('Redirecting to /admin');
        window.location.href = '/admin';
      } else {
        console.log('Redirecting to /main');
        window.location.href = '/main';
      }
    }, 500);
    
  } catch (error) {
    console.error('Login error:', error);
    setStatus(error.message, true);
    showNotification(error.message, true);
  }
}

async function register() {
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  
  if (!username || !email || !password) {
    setStatus('Заполните все поля', true);
    return;
  }
  
  if (password !== confirmPassword) {
    setStatus('Пароли не совпадают', true);
    return;
  }
  
  if (password.length < 4) {
    setStatus('Пароль должен быть не менее 4 символов', true);
    return;
  }
  
  setStatus('Создание аккаунта...');
  
  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка регистрации');
    }
    
    const data = await response.json();
    
    // Сохраняем токен и автоматически логиним
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    showNotification('Регистрация успешна!');
    setStatus('Аккаунт создан! Перенаправление...');
    
    setTimeout(() => {
      if (data.user.role === 'admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/main';
      }
    }, 500);
    
  } catch (error) {
    console.error('Register error:', error);
    setStatus(error.message, true);
    showNotification(error.message, true);
  }
}

function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

// Проверяем, есть ли уже токен
function checkExistingToken() {
  const token = localStorage.getItem('access_token');
  console.log('Checking existing token:', token);
  
  if (token) {
    fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(response => {
      if (response.ok) {
        response.json().then(user => {
          console.log('User already logged in:', user);
          if (user.role === 'admin') {
            window.location.href = '/admin';
          } else {
            window.location.href = '/main';
          }
        });
      } else {
        console.log('Token invalid, clearing');
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
      }
    }).catch(() => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    });
  }
}

// Навешиваем обработчик Enter
document.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    if (currentTab === 'login') {
      login();
    } else {
      register();
    }
  }
});

// Добавляем обработчик для кнопки выхода (если есть на странице)
document.addEventListener('click', (e) => {
  if (e.target.id === 'logoutBtn') {
    logout();
  }
});

checkExistingToken();
EOF