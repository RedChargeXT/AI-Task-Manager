document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    const statusEl = document.getElementById('status');

    exportBtn.addEventListener('click', async () => {
        const { tasks } = await chrome.storage.sync.get('tasks');
        if (!tasks || tasks.length === 0) {
            statusEl.textContent = 'No tasks to export.';
            return;
        }

        const dataStr = JSON.stringify(tasks, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tasks-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        statusEl.textContent = 'Export successful!';
    });

    importBtn.addEventListener('click', () => {
        importFile.click();
    });

    importFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedTasks = JSON.parse(e.target.result);
                // Basic validation
                if (!Array.isArray(importedTasks)) throw new Error("Invalid format");

                chrome.storage.sync.set({ tasks: importedTasks }, () => {
                    statusEl.textContent = 'Import successful! Please reopen the extension to see changes.';
                    // Notify background to update badge
                    chrome.runtime.sendMessage({ action: 'updateBadge', tasks: importedTasks });
                });
            } catch (error) {
                statusEl.textContent = `Error importing file: ${error.message}`;
            }
        };
        reader.readAsText(file);
    });
});
