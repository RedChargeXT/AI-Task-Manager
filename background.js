// Function to update the badge
function updateBadge(tasks) {
  const pendingTasks = tasks.filter(task => !task.completed).length;
  chrome.action.setBadgeText({ text: pendingTasks > 0 ? String(pendingTasks) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#007AFF' });
}

// Function to update the streak counter
async function updateStreak() {
    const { tasks, streak } = await chrome.storage.sync.get(['tasks', 'streak']);
    if (!tasks || tasks.length === 0) return;

    let currentStreak = streak || { count: 0, lastCompletedDate: null };
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Check if all tasks for today are completed
    const allCompleted = tasks.every(task => task.completed);

    if (allCompleted && currentStreak.lastCompletedDate !== today) {
        if (currentStreak.lastCompletedDate === yesterday) {
            currentStreak.count++; // Increment streak
        } else {
            currentStreak.count = 1; // Reset streak
        }
        currentStreak.lastCompletedDate = today;
        await chrome.storage.sync.set({ streak: currentStreak });
    }
}


// Listener for when the extension is first installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Productivity Task Manager installed.');
  // On install, get tasks and set initial badge
  chrome.storage.sync.get('tasks', ({ tasks }) => {
    if (tasks) {
      updateBadge(tasks);
    }
  });
});

// Listener for messages from other parts of the extension (e.g., popup.js)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateBadge' && request.tasks) {
    updateBadge(request.tasks);
    updateStreak(); // Update streak every time tasks change
  }
  // To-do: Add logic here to set alarms for tasks with due dates
  return true; // Indicates you wish to send a response asynchronously
});

// Listener for when storage changes to keep badge in sync even if popup is not open
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.tasks) {
    updateBadge(changes.tasks.newValue || []);
    updateStreak();
  }
});

// Alarm listener (for future due date notifications)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('task-')) {
    const taskId = alarm.name.split('-')[1];
    chrome.storage.sync.get('tasks', ({ tasks }) => {
      const task = (tasks || []).find(t => t.id == taskId);
      if (task) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Task Due!',
          message: `Your task "${task.text}" is due now.`,
          priority: 2
        });
      }
    });
  }
});
