
# Kanban Board — Event-Driven Task Management System

Канбан-доска в стиле Windows 95 с синхронизацией, автоматизацией и event-driven архитектурой.

---

## Функциональность

### Для пользователей
- Создание, редактирование, удаление задач
- Drag-and-drop перемещение между колонками (To Do -> In Progress -> Done)
- Приоритеты: LOW, MEDIUM, HIGH, CRITICAL
- Теги для задач
- Все данные сохраняются в PostgreSQL

### Для администраторов
- Настройка колонок
- Правила автоматизации (в разработке)
- Уведомления о событиях (в разработке)

---

## Стек технологий

| Слой | Технология |
|------|-----------|
| Backend | Python 3.14, FastAPI, Uvicorn |
| База данных | PostgreSQL 15 (Docker / внешний сервер) |
| ORM | SQLAlchemy 2.0 (async) |
| Миграции | Alembic |
| Очередь | RabbitMQ 3.12 (в разработке) |
| Real-time | WebSocket (в разработке) |
| Фронтенд | HTML/CSS/JS (Vanilla, стиль Windows 95) |
| Контейнеризация | Docker Compose |

---

## Архитектура

```
Frontend (Win95 UI)
       |
       | HTTP/REST
       v
FastAPI Backend
       |
       | Async SQLAlchemy
       v
PostgreSQL
       |
       | События (в разработке)
       v
RabbitMQ --> WebSocket --> Клиенты
```

### Поток данных
1. Пользователь создаёт/перемещает задачу на фронте
2. Запрос уходит в FastAPI
3. Бизнес-логика в TaskService
4. Данные сохраняются в PostgreSQL через SQLAlchemy
5. Генерируется событие -> RabbitMQ (в разработке)
6. WebSocket рассылает изменения всем клиентам (в разработке)

---

## Структура проекта

```
Hacaton-Unit-Hack/
├── backend/
│   ├── src/
│   │   ├── api/v1/         # API эндпоинты (tasks, boards, init)
│   │   ├── core/           # config, database, security
│   │   ├── models/         # SQLAlchemy модели (8 таблиц)
│   │   ├── schemas/        # Pydantic схемы
│   │   ├── services/       # Бизнес-логика
│   │   ├── events/         # События (в разработке)
│   │   ├── websocket/      # WebSocket (в разработке)
│   │   └── workers/        # RabbitMQ consumer (в разработке)
│   ├── alembic/            # Миграции БД
│   ├── requirements.txt
│   └── .env
├── frontend/
│   └── index.html          # Канбан-доска Win95 UI
├── docker-compose.yml
└── README.md
```

---

## Быстрый старт

### Требования
- Python 3.11+
- Docker Desktop
- Git

### 1. Клонировать репозиторий
```bash
git clone <repo-url>
cd Hacaton-Unit-Hack
```

### 2. Запустить PostgreSQL и RabbitMQ
```bash
docker-compose up -d
```

### 3. Создать виртуальное окружение
```bash
cd backend
python -m venv venv
```

### 4. Активировать venv
Windows PowerShell:
```powershell
.\venv\scripts\activate.ps1
```
Linux/Mac:
```bash
source venv/bin/activate
```

### 5. Установить зависимости
```bash
pip install -r requirements.txt
```

### 6. Применить миграции
```bash
alembic upgrade head
```

### 7. Запустить сервер
```bash
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

### 8. Инициализировать базу данных
Открыть в браузере:
```
http://127.0.0.1:8000/docs
```
Найти `POST /api/v1/init` -> Execute

### 9. Открыть приложение
```
http://127.0.0.1:8000
```

---

## API Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/` | Канбан-доска (фронтенд) |
| GET | `/health` | Проверка работоспособности |
| GET | `/docs` | Swagger документация |
| GET | `/api/v1/boards/{id}` | Получить доску с колонками и задачами |
| POST | `/api/v1/tasks` | Создать задачу |
| PUT | `/api/v1/tasks/{id}` | Обновить задачу |
| POST | `/api/v1/tasks/move` | Переместить задачу |
| DELETE | `/api/v1/tasks/{id}` | Удалить задачу |
| POST | `/api/v1/init` | Инициализировать БД (одноразово) |

---

## Схема базы данных

8 таблиц:
- `users` — пользователи и администраторы
- `boards` — канбан-доски
- `columns` — колонки (To Do, In Progress, Done, кастомные)
- `tasks` — задачи с оптимистичной блокировкой (version)
- `tags` — теги
- `task_tags` — связь многие-ко-многим задач и тегов
- `automation_rules` — правила автоматизации
- `notifications` — уведомления

---

## Переменные окружения (.env)

```env
DATABASE_URL=postgresql+asyncpg://user:pass@host:port/dbname
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
APP_NAME=Kanban System
DEBUG=true
```

---

## Разработка

### Создание миграции
```bash
cd backend
alembic revision --autogenerate -m "описание"
alembic upgrade head
```

### Запуск тестов (в разработке)
```bash
pytest
```

---

## Статус проекта

- [x] Backend API (CRUD задач)
- [x] PostgreSQL + Alembic миграции
- [x] Фронтенд Win95 UI
- [x] Drag-and-drop
- [x] Сохранение в БД
- [ ] WebSocket real-time
- [ ] RabbitMQ события
- [ ] Автоматизация (правила)
- [ ] Уведомления
- [ ] Авторизация JWT

---

## Лицензия

MIT
```