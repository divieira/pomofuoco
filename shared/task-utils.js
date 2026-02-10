// Task utility functions — shared between board and tests

const TaskUtils = {
  extractTag(title) {
    const match = title.match(/#(\w+)/);
    return match ? match[1].toLowerCase() : null;
  },

  createTask(title, tasks) {
    title = title.trim();
    if (!title) return null;

    const tag = this.extractTag(title);
    return {
      id: crypto.randomUUID(),
      title: title,
      tag: tag,
      column: 'todo',
      order: tasks.filter((t) => t.column === 'todo').length,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
  },

  moveTask(tasks, taskId, targetColumn) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return { tasks, movedFrom: null, displaced: null };

    const previousColumn = task.column;
    let displaced = null;

    // Enforce single task in doing
    if (targetColumn === 'doing') {
      const currentDoing = tasks.find((t) => t.column === 'doing' && t.id !== taskId);
      if (currentDoing) {
        currentDoing.column = 'todo';
        currentDoing.order = tasks.filter((t) => t.column === 'todo').length;
        displaced = currentDoing;
      }
    }

    task.column = targetColumn;
    task.order = tasks.filter((t) => t.column === targetColumn && t.id !== taskId).length;

    if (targetColumn === 'done' && !task.completedAt) {
      task.completedAt = new Date().toISOString();
    }
    if (targetColumn !== 'done') {
      task.completedAt = null;
    }

    return { tasks, movedFrom: previousColumn, displaced };
  },

  clearTask(tasks, taskId) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return tasks;
    task.column = 'cleared';
    return tasks;
  },

  clearAllDone(tasks) {
    tasks.forEach((t) => {
      if (t.column === 'done') {
        t.column = 'cleared';
      }
    });
    return tasks;
  },

  getColumnTasks(tasks, column) {
    return tasks
      .filter((t) => t.column === column)
      .sort((a, b) => a.order - b.order);
  },

  getVisibleTasks(tasks) {
    return tasks.filter((t) => t.column !== 'cleared');
  },

  assignTagColor(tag, settings) {
    if (!tag || (settings.tags && settings.tags[tag])) return settings;

    if (!settings.tags) settings.tags = {};
    const usedColors = Object.values(settings.tags).map((t) => t.color);
    const available = CONSTANTS.PASTEL_COLORS.filter((c) => !usedColors.includes(c));
    const color = available.length > 0 ? available[0] :
      CONSTANTS.PASTEL_COLORS[Math.floor(Math.random() * CONSTANTS.PASTEL_COLORS.length)];
    settings.tags[tag] = { displayName: tag, color: color };
    return settings;
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaskUtils;
}
