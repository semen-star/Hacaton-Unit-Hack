#!/bin/bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"

HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$HOST_IP" ] && HOST_IP="localhost"

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Kanban Board - Setup${NC}"
echo -e "${BLUE}  Host: $HOST_IP${NC}"
echo ""

# 1. Venv
log "Создание виртуального окружения..."
cd "$BACKEND_DIR"
rm -rf venv
python3 -m venv venv
source venv/bin/activate
ok "Venv создана."

# 2. Зависимости
log "Установка зависимостей..."
pip install --upgrade pip -q

# Установка из requirements.txt
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt -q
else
    warn "requirements.txt не найден, устанавливаю базовые пакеты..."
    pip install fastapi uvicorn[standard] sqlalchemy asyncpg alembic -q
fi

# Дополнительные пакеты
pip install alembic psycopg2-binary email-validator python-jose[cryptography] passlib[bcrypt] pydantic[email] -q
ok "Зависимости установлены."

# 3. Docker контейнеры
log "Запуск контейнеров..."
cd "$PROJECT_DIR"
if command -v docker compose &> /dev/null; then
    docker compose up -d 2>/dev/null || docker-compose up -d
else
    docker-compose up -d 2>/dev/null || warn "Docker Compose не найден, пропускаем..."
fi

# 4. Ожидание PostgreSQL
log "Ожидание PostgreSQL..."
for i in {1..30}; do
    if docker exec kanban_postgres pg_isready -U kanban_user &> /dev/null 2>&1; then
        ok "PostgreSQL готов"
        break
    fi
    if docker exec postgres pg_isready -U postgres &> /dev/null 2>&1; then
        ok "PostgreSQL готов"
        break
    fi
    echo -n "."
    sleep 1
    if [ $i -eq 30 ]; then
        warn "PostgreSQL не ответил, продолжаем..."
    fi
done
echo ""

# 5. Миграции
log "Применение миграций..."
cd "$BACKEND_DIR"
if command -v alembic &> /dev/null || [ -f "venv/bin/alembic" ]; then
    alembic upgrade head 2>/dev/null || warn "Миграции не применились (возможно, таблицы уже есть)"
else
    warn "Alembic не найден, пропускаем миграции..."
fi
ok "Миграции применены."

# 6. Инициализация данных через API
log "Инициализация данных..."
uvicorn src.main:app --host 0.0.0.0 --port 8000 &
SERVER_PID=$!
sleep 5

# Пробуем инициализировать
curl -s -X POST http://localhost:8000/api/v1/init > /dev/null 2>&1 || true

# Создаём админа через скрипт, если есть
if [ -f "scripts/create_admin.py" ]; then
    log "Создание администратора..."
    python scripts/create_admin.py 2>/dev/null || warn "Не удалось создать администратора"
fi

# Останавливаем сервер
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true
ok "Данные инициализированы."

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Готово!${NC}"
echo -e "${GREEN}  Логин:    http://$HOST_IP:8000${NC}"
echo -e "${GREEN}  Доска:    http://$HOST_IP:8000/main${NC}"
echo -e "${GREEN}  Админка:  http://$HOST_IP:8000/admin${NC}"
echo -e "${GREEN}  Swagger:  http://$HOST_IP:8000/docs${NC}"
echo ""
echo -e "${YELLOW}  Demo аккаунты:${NC}"
echo -e "    Админ:  admin / admin123"
echo -e "    Пользователь: зарегистрируйтесь через форму входа"
echo ""

read -p "Запустить сервер? [Y/n] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]?$|^$ ]]; then
    cd "$BACKEND_DIR"
    source venv/bin/activate
    log "Запуск сервера на http://$HOST_IP:8000"
    uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
fi