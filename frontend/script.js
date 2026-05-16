const API_URL = 'http://localhost:8000';
        
        let tasks = [
            { id: 1, title: 'Установить Windows 95', description: '25 дискет, 40 минут', priority: 'HIGH', column: 'done', tags: ['система'] },
            { id: 2, title: 'Подключить dial-up', description: 'Проверить модем 56k', priority: 'MEDIUM', column: 'in-progress', tags: ['интернет'] },
            { id: 3, title: 'Написать на ICQ', description: 'Сообщение: "Привет! Как дела?"', priority: 'LOW', column: 'todo', tags: ['общение'] },
            { id: 4, title: 'Дефрагментировать диск', description: 'Запустить Norton Disk Doctor', priority: 'CRITICAL', column: 'todo', tags: ['система'] },
            { id: 5, title: 'Слушать Winamp', description: 'Плейлист: Prodigy, Scooter', priority: 'LOW', column: 'in-progress', tags: ['музыка'] },
        ];
        
        let taskIdCounter = 6;
        
        function renderBoard() {
            const columns = { 'todo': [], 'in-progress': [], 'done': [] };
            tasks.forEach(t => columns[t.column].push(t));
            
            Object.keys(columns).forEach(colId => {
                const container = document.getElementById(colId);
                container.innerHTML = columns[colId].map(t => `
                    <div class="card" draggable="true" ondragstart="drag(event)" id="task-${t.id}">
                        <div class="card-title">[${t.id}] ${t.title}</div>
                        <div class="card-desc">${t.description || ''}</div>
                        <div class="card-meta">
                            <span class="priority priority-${t.priority}">${t.priority}</span>
                            ${t.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                        </div>
                    </div>
                `).join('');
                
                document.getElementById(colId + '-count').textContent = columns[colId].length;
            });
            
            document.getElementById('total-tasks').textContent = tasks.length;
        }
        
        function drag(ev) {
            ev.dataTransfer.setData("text", ev.target.closest('.card').id);
        }
        
        function allowDrop(ev) {
            ev.preventDefault();
        }
        
        function drop(ev) {
            ev.preventDefault();
            const taskId = parseInt(ev.dataTransfer.getData("text").replace('task-', ''));
            const newColumn = ev.target.closest('.column-body').id;
            
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                const oldColumn = task.column;
                task.column = newColumn;
                renderBoard();
            }
        }
        
        function openModal() {
            document.getElementById('taskModal').classList.add('active');
            document.getElementById('taskTitle').focus();
        }
        
        function closeModal() {
            document.getElementById('taskModal').classList.remove('active');
            document.getElementById('taskTitle').value = '';
            document.getElementById('taskDesc').value = '';
        }
        
        function createTask() {
            const title = document.getElementById('taskTitle').value.trim();
            const desc = document.getElementById('taskDesc').value.trim();
            const priority = document.getElementById('taskPriority').value;
            
            if (!title) return alert('Введите название задачи!');
            
            tasks.push({
                id: taskIdCounter++,
                title,
                description: desc,
                priority,
                column: 'todo',
                tags: []
            });
            
            closeModal();
            renderBoard();
        }
        
        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
        
        renderBoard();