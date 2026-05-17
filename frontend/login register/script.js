const API_BASE = '/api/v1';

function showLogin() {
  document.getElementById('loginForm').classList.add('active');
  document.getElementById('registerForm').classList.remove('active');
  setStatus('Введите логин и пароль');
}

function showRegister() {
  document.getElementById('loginForm').classList.remove('active');
  document.getElementById('registerForm').classList.add('active');
  setStatus('Создание нового аккаунта');
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
    
    // Сохраняем токен
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      console.log('Token saved:', data.access_token.substring(0, 50) + '...');
      
      showNotification(`Добро пожаловать, ${data.user.username}!`);
      setStatus('Вход выполнен! Перенаправление...');
      
      // Перенаправление
      setTimeout(() => {
        if (data.user.role === 'admin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/main';
        }
      }, 500);
    } else {
      throw new Error('Токен не получен от сервера');
    }
    
  } catch (error) {
    console.error('Login error:', error);
    setStatus(error.message, true);
    showNotification(error.message, true);
  }
}

async function register() {
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  
  if (!username || !password) {
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
      body: JSON.stringify({ username, email: `${username}@temp.com`, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка регистрации');
    }
    
    const data = await response.json();
    
    if (data.access_token) {
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
    } else {
      throw new Error('Токен не получен от сервера');
    }
    
  } catch (error) {
    console.error('Register error:', error);
    setStatus(error.message, true);
    showNotification(error.message, true);
  }
}

// Проверяем существующий токен при загрузке
function checkExistingToken() {
  const token = localStorage.getItem('access_token');
  console.log('Checking existing token:', token ? token.substring(0, 50) + '...' : 'null');
  
  if (token) {
    fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(response => {
      if (response.ok) {
        response.json().then(user => {
          console.log('User already logged in:', user.username);
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

// Enter key handler
document.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const loginForm = document.getElementById('loginForm');
    if (loginForm.classList.contains('active')) {
      login();
    } else {
      register();
    }
  }
});

// Start
checkExistingToken();