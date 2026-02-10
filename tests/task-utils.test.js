const CONSTANTS = require('../shared/constants');
global.CONSTANTS = CONSTANTS;

const TaskUtils = require('../shared/task-utils');

describe('TaskUtils', () => {
  describe('extractTag', () => {
    test('extracts tag from title', () => {
      expect(TaskUtils.extractTag('Fix bug #work')).toBe('work');
    });

    test('returns null for no tag', () => {
      expect(TaskUtils.extractTag('Fix bug')).toBeNull();
    });

    test('extracts first tag only', () => {
      expect(TaskUtils.extractTag('Fix #work and #learn')).toBe('work');
    });

    test('lowercases tag', () => {
      expect(TaskUtils.extractTag('Fix #Work')).toBe('work');
    });

    test('handles tag at start', () => {
      expect(TaskUtils.extractTag('#work Fix bug')).toBe('work');
    });

    test('handles tag with numbers', () => {
      expect(TaskUtils.extractTag('Task #project1')).toBe('project1');
    });
  });

  describe('createTask', () => {
    test('creates a task with correct defaults', () => {
      const task = TaskUtils.createTask('Test task #work', []);
      expect(task.title).toBe('Test task #work');
      expect(task.tag).toBe('work');
      expect(task.column).toBe('todo');
      expect(task.order).toBe(0);
      expect(task.completedAt).toBeNull();
      expect(task.id).toBeTruthy();
      expect(task.createdAt).toBeTruthy();
    });

    test('returns null for empty title', () => {
      expect(TaskUtils.createTask('', [])).toBeNull();
      expect(TaskUtils.createTask('   ', [])).toBeNull();
    });

    test('sets order based on existing todo count', () => {
      const existing = [
        { id: '1', column: 'todo' },
        { id: '2', column: 'todo' },
      ];
      const task = TaskUtils.createTask('New task', existing);
      expect(task.order).toBe(2);
    });

    test('creates task without tag', () => {
      const task = TaskUtils.createTask('No tag here', []);
      expect(task.tag).toBeNull();
    });
  });

  describe('moveTask', () => {
    let tasks;

    beforeEach(() => {
      tasks = [
        { id: '1', title: 'Task 1', column: 'todo', order: 0, completedAt: null },
        { id: '2', title: 'Task 2', column: 'todo', order: 1, completedAt: null },
        { id: '3', title: 'Task 3', column: 'doing', order: 0, completedAt: null },
      ];
    });

    test('moves task to doing', () => {
      const result = TaskUtils.moveTask(tasks, '1', 'doing');
      expect(result.tasks.find((t) => t.id === '1').column).toBe('doing');
    });

    test('displaces existing doing task back to todo', () => {
      const result = TaskUtils.moveTask(tasks, '1', 'doing');
      expect(result.displaced).toBeTruthy();
      expect(result.displaced.id).toBe('3');
      expect(result.displaced.column).toBe('todo');
    });

    test('moves task to done and sets completedAt', () => {
      TaskUtils.moveTask(tasks, '3', 'done');
      const doneTask = tasks.find((t) => t.id === '3');
      expect(doneTask.column).toBe('done');
      expect(doneTask.completedAt).toBeTruthy();
    });

    test('clears completedAt when moving back from done', () => {
      tasks[0].column = 'done';
      tasks[0].completedAt = '2026-01-01T00:00:00Z';
      TaskUtils.moveTask(tasks, '1', 'todo');
      expect(tasks[0].completedAt).toBeNull();
    });

    test('returns movedFrom column', () => {
      const result = TaskUtils.moveTask(tasks, '1', 'doing');
      expect(result.movedFrom).toBe('todo');
    });

    test('handles non-existent task', () => {
      const result = TaskUtils.moveTask(tasks, 'nonexistent', 'doing');
      expect(result.movedFrom).toBeNull();
    });
  });

  describe('clearTask', () => {
    test('sets task column to cleared', () => {
      const tasks = [{ id: '1', column: 'todo' }];
      TaskUtils.clearTask(tasks, '1');
      expect(tasks[0].column).toBe('cleared');
    });

    test('handles non-existent task', () => {
      const tasks = [{ id: '1', column: 'todo' }];
      TaskUtils.clearTask(tasks, 'nonexistent');
      expect(tasks[0].column).toBe('todo');
    });
  });

  describe('clearAllDone', () => {
    test('moves all done tasks to cleared', () => {
      const tasks = [
        { id: '1', column: 'done' },
        { id: '2', column: 'done' },
        { id: '3', column: 'todo' },
      ];
      TaskUtils.clearAllDone(tasks);
      expect(tasks[0].column).toBe('cleared');
      expect(tasks[1].column).toBe('cleared');
      expect(tasks[2].column).toBe('todo');
    });
  });

  describe('getColumnTasks', () => {
    test('returns tasks for a column sorted by order', () => {
      const tasks = [
        { id: '2', column: 'todo', order: 1 },
        { id: '1', column: 'todo', order: 0 },
        { id: '3', column: 'doing', order: 0 },
      ];
      const result = TaskUtils.getColumnTasks(tasks, 'todo');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });
  });

  describe('getVisibleTasks', () => {
    test('excludes cleared tasks', () => {
      const tasks = [
        { id: '1', column: 'todo' },
        { id: '2', column: 'cleared' },
        { id: '3', column: 'done' },
      ];
      const visible = TaskUtils.getVisibleTasks(tasks);
      expect(visible).toHaveLength(2);
      expect(visible.map((t) => t.id)).toEqual(['1', '3']);
    });
  });

  describe('assignTagColor', () => {
    test('assigns color to new tag', () => {
      const settings = { tags: {} };
      TaskUtils.assignTagColor('work', settings);
      expect(settings.tags.work).toBeTruthy();
      expect(settings.tags.work.color).toBeTruthy();
      expect(settings.tags.work.displayName).toBe('work');
    });

    test('does not overwrite existing tag', () => {
      const settings = { tags: { work: { displayName: 'Work', color: '#FF0000' } } };
      TaskUtils.assignTagColor('work', settings);
      expect(settings.tags.work.color).toBe('#FF0000');
    });

    test('skips null tag', () => {
      const settings = { tags: {} };
      TaskUtils.assignTagColor(null, settings);
      expect(Object.keys(settings.tags)).toHaveLength(0);
    });

    test('assigns different colors to different tags', () => {
      const settings = { tags: {} };
      TaskUtils.assignTagColor('work', settings);
      TaskUtils.assignTagColor('learn', settings);
      expect(settings.tags.work.color).not.toBe(settings.tags.learn.color);
    });
  });
});
