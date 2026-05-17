#!/bin/bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }

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
pip install -r requirements.txt -q
pip install alembic psycopg2-binary -q
ok "Зависимости установлены."

# 3. Docker контейнеры
log "Запуск контейнеров..."
cd "$PROJECT_DIR"
docker compose up -d 2>/dev/null || docker-compose up -d

log "Ожидание PostgreSQL..."
for i in {1..30}; do
    if docker exec kanban_postgres pg_isready -U kanban_user &> /dev/null; then
        break
    fi
    echo -n "."
    sleep 1
done
echo ""
ok "PostgreSQL готов."

# 4. Миграции
log "Применение миграций..."
cd "$BACKEND_DIR"
alembic upgrade head
ok "Миграции применены."

# 5. Инициализация
log "Инициализация данных..."
uvicorn src.main:app --host 0.0.0.0 --port 8000 &
SERVER_PID=$!
sleep 3
curl -s -X POST http://localhost:8000/api/v1/init > /dev/null 2>&1 || true
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true
ok "Данные инициализированы."

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Готово!${NC}"
echo -e "${GREEN}  Доска:   http://$HOST_IP:8000${NC}"
echo -e "${GREEN}  Админка: http://$HOST_IP:8000/admin${NC}"
echo -e "${GREEN}  Swagger: http://$HOST_IP:8000/docs${NC}"
echo ""

read -p "Запустить сервер? [Y/n] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]?$|^$ ]]; then
    cd "$BACKEND_DIR"
    source venv/bin/activate
    uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
fi