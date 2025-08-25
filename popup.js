document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const taskList = document.getElementById('task-list');
    const addTaskForm = document.getElementById('add-task-form');
    const newTaskInput = document.getElementById('new-task-input');
    const themeToggle = document.getElementById('theme-toggle');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const taskStreak = document.getElementById('task-streak');
    
    // Pomodoro Elements
    const pomoTime = document.getElementById('pomodoro-time');
    const pomoStart = document.getElementById('pomodoro-start');
    const pomoReset = document.getElementById('pomodoro-reset');
    
    // Filter Elements
    const searchInput = document.getElementById('search-input');
    const filterCategory = document.getElementById('filter-category');

    // --- State Management ---
    let tasks = [];
    let pomodoroTimer;
    let pomoMinutes = 25;
    let pomoSeconds = 0;
    let isPomoRunning = false;
    
    // --- Load Initial Data ---
    loadState();

    // --- Event Listeners ---
    addTaskForm.addEventListener('submit', handleAddTask);
    taskList.addEventListener('click', handleTaskActions);
    themeToggle.addEventListener('click', toggleTheme);
    pomoStart.addEventListener('click', togglePomodoro);
    pomoReset.addEventListener('click', resetPomodoro);
    searchInput.addEventListener('input', renderTasks);
    filterCategory.addEventListener('change', renderTasks);
    
    // AI Suggestion Placeholder
    document.getElementById('ai-suggest-btn').addEventListener('click', () => {
        newTaskInput.value = "Schedule a team meeting for project AI";
        newTaskInput.focus();
    });

    // Keyboard shortcut for new task
    chrome.commands.onCommand.addListener((command) => {
        if (command === 'new-task') {
            newTaskInput.focus();
        }
    });

    // --- Functions ---
    async function loadState() {
        const result = await chrome.storage.sync.get(['tasks', 'theme', 'streak']);
        tasks = result.tasks || [];
        
        // Set Theme
        if (result.theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggle.querySelector('.material-icons-outlined').textContent = 'dark_mode';
        } else {
            document.body.classList.remove('dark-mode');
            themeToggle.querySelector('.material-icons-outlined').textContent = 'light_mode';
        }
        
        // Set Streak
        taskStreak.textContent = `🔥 ${result.streak?.count || 0}`;

        renderTasks();
        updateProgress();
    }

    function saveState() {
        chrome.storage.sync.set({ tasks: tasks }, () => {
            // Send a message to background script to update the badge and check alarms
            chrome.runtime.sendMessage({ action: 'updateBadge', tasks: tasks });
            updateProgress();
        });
    }

    function renderTasks() {
        const searchTerm = searchInput.value.toLowerCase();
        const category = filterCategory.value;

        const filteredTasks = tasks.filter(task => {
            const matchesSearch = task.text.toLowerCase().includes(searchTerm);
            const matchesCategory = category === 'all' || !task.category || task.category === category;
            return matchesSearch && matchesCategory;
        });

        taskList.innerHTML = '';
        if (filteredTasks.length === 0) {
            taskList.innerHTML = `<li class="task-item-placeholder">No tasks found. Add one below!</li>`;
        }
        
        filteredTasks.forEach((task, index) => {
            const taskItem = document.createElement('li');
            taskItem.className = `task-item neumorphic ${task.completed ? 'completed' : ''}`;
            taskItem.dataset.id = task.id;
            taskItem.draggable = true;

            taskItem.innerHTML = `
                <div class="checkbox">
                    <span class="material-icons-outlined">done</span>
                </div>
                <span class="task-text">${task.text}</span>
                <button class="delete-btn icon-btn" title="Delete Task">
                    <span class="material-icons-outlined">delete_outline</span>
                </button>
            `;
            taskList.appendChild(taskItem);
        });

        addDragAndDropListeners();
    }

    function handleAddTask(e) {
        e.preventDefault();
        const text = newTaskInput.value.trim();
        if (text) {
            const newTask = {
                id: Date.now(),
                text: text,
                completed: false,
                createdAt: new Date().toISOString()
                // You can add more properties here: category, dueDate, priority
            };
            tasks.unshift(newTask); // Add to the top
            saveState();
            renderTasks();
            newTaskInput.value = '';
        }
    }

    function handleTaskActions(e) {
        const target = e.target;
        const taskItem = target.closest('.task-item');
        if (!taskItem) return;

        const taskId = Number(taskItem.dataset.id);
        const task = tasks.find(t => t.id === taskId);

        if (target.closest('.checkbox')) {
            task.completed = !task.completed;
            saveState();
            renderTasks();
        }

        if (target.closest('.delete-btn')) {
            tasks = tasks.filter(t => t.id !== taskId);
            saveState();
            renderTasks();
        }
    }

    function toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        themeToggle.querySelector('.material-icons-outlined').textContent = isDarkMode ? 'dark_mode' : 'light_mode';
        chrome.storage.sync.set({ theme: isDarkMode ? 'dark' : 'light' });
    }

    function updateProgress() {
        const completedTasks = tasks.filter(t => t.completed).length;
        const totalTasks = tasks.length;
        const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;
    }

    // --- Drag and Drop ---
    function addDragAndDropListeners() {
        const draggables = document.querySelectorAll('.task-item');
        draggables.forEach(draggable => {
            draggable.addEventListener('dragstart', () => {
                draggable.classList.add('dragging');
            });

            draggable.addEventListener('dragend', () => {
                draggable.classList.remove('dragging');
                updateTaskOrder();
            });
        });

        taskList.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(taskList, e.clientY);
            const dragging = document.querySelector('.dragging');
            if (afterElement == null) {
                taskList.appendChild(dragging);
            } else {
                taskList.insertBefore(dragging, afterElement);
            }
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function updateTaskOrder() {
        const orderedIds = [...taskList.querySelectorAll('.task-item')].map(item => Number(item.dataset.id));
        tasks.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
        saveState();
    }

    // --- Pomodoro Timer Logic ---
    function togglePomodoro() {
        if (isPomoRunning) {
            clearInterval(pomodoroTimer);
            pomoStart.querySelector('.material-icons-outlined').textContent = 'play_arrow';
        } else {
            pomodoroTimer = setInterval(updatePomoTimer, 1000);
            pomoStart.querySelector('.material-icons-outlined').textContent = 'pause';
        }
        isPomoRunning = !isPomoRunning;
    }

    function updatePomoTimer() {
        if (pomoSeconds === 0) {
            if (pomoMinutes === 0) {
                clearInterval(pomodoroTimer);
                isPomoRunning = false;
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon128.png',
                    title: 'Pomodoro Finished!',
                    message: 'Time to take a short break.',
                    priority: 2
                });
                resetPomodoro();
                return;
            }
            pomoMinutes--;
            pomoSeconds = 59;
        } else {
            pomoSeconds--;
        }
        pomoTime.textContent = `${String(pomoMinutes).padStart(2, '0')}:${String(pomoSeconds).padStart(2, '0')}`;
    }

    function resetPomodoro() {
        clearInterval(pomodoroTimer);
        isPomoRunning = false;
        pomoMinutes = 25;
        pomoSeconds = 0;
        pomoTime.textContent = '25:00';
        pomoStart.querySelector('.material-icons-outlined').textContent = 'play_arrow';
    }
});
