// Pomofuoco Board — Full page kanban + timer + dashboards

(function () {
  'use strict';

  // --- State ---
  let tasks = [];
  let settings = {};
  let timerState = { status: 'idle' };
  let timerInterval = null;

  // --- DOM refs ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // --- Init ---
  async function init() {
    tasks = await msg('getTasks') || [];
    settings = await msg('getSettings') || {};
    timerState = await msg('getTimerState') || { status: 'idle' };

    renderBoard();
    updateTimerUI();
    updateStats();
    startTimerTick();
    bindEvents();
    highlightSuggested();
  }

  // --- Messaging ---
  function msg(action, data) {
    return chrome.runtime.sendMessage({ action, ...data });
  }

  // --- Timer UI ---
  function updateTimerUI() {
    const timeEl = $('#timerTime');
    const labelEl = $('#timerLabel');
    const cycleEl = $('#timerCycle');
    const progressEl = $('#timerProgress');
    const doingEl = $('#timerDoingTask');

    if (timerState.status === 'running') {
      const remaining = TimerCore.getRemaining(timerState);
      const overtime = TimerCore.isOvertime(timerState);
      const elapsed = (Date.now() - new Date(timerState.startedAt).getTime()) / 1000;
      const displayTime = overtime ? -(elapsed - timerState.duration) : remaining;

      timeEl.textContent = TimerCore.formatTime(displayTime);
      timeEl.classList.toggle('overtime', overtime);

      const typeLabels = { focus: 'Focus', shortBreak: 'Short Break', longBreak: 'Long Break' };
      labelEl.textContent = typeLabels[timerState.type] || '';
      cycleEl.textContent = timerState.type === 'focus' ?
        `#${timerState.cyclePosition}/${CONSTANTS.TIMER.LONG_BREAK_AFTER}` : '';

      const progress = overtime ? 100 : Math.min(100, (elapsed / timerState.duration) * 100);
      progressEl.style.width = `${progress}%`;
      progressEl.className = `timer-progress ${timerState.type}`;

      // Show/hide buttons
      $('#btnFocus').classList.add('hidden');
      $('#btnShortBreak').classList.add('hidden');
      $('#btnLongBreak').classList.add('hidden');
      $('#btnStop').classList.remove('hidden');

      // Highlight active type button
      const activeBtn = timerState.type === 'focus' ? '#btnFocus' :
        timerState.type === 'shortBreak' ? '#btnShortBreak' : '#btnLongBreak';
      $(activeBtn).classList.add('active');

      // Show doing task
      const doingTask = tasks.find((t) => t.column === 'doing');
      doingEl.textContent = doingTask ? `Working on: ${doingTask.title}` : '';
    } else {
      timeEl.textContent = '00:00';
      timeEl.classList.remove('overtime');
      labelEl.textContent = 'Ready';
      cycleEl.textContent = timerState.cyclePosition ?
        `Cycle ${timerState.cyclePosition}/${CONSTANTS.TIMER.LONG_BREAK_AFTER}` : '';
      progressEl.style.width = '0%';
      progressEl.className = 'timer-progress';
      doingEl.textContent = '';

      $('#btnFocus').classList.remove('hidden', 'active');
      $('#btnShortBreak').classList.remove('hidden', 'active');
      $('#btnLongBreak').classList.remove('hidden', 'active');
      $('#btnStop').classList.add('hidden');
    }
  }

  function startTimerTick() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(async () => {
      timerState = await msg('getTimerState') || timerState;
      updateTimerUI();
    }, 1000);
  }

  async function highlightSuggested() {
    const suggested = await msg('getSuggestedNext');
    $$('.btn.suggested').forEach((b) => b.classList.remove('suggested'));
    if (timerState.status === 'idle') {
      const btnMap = { focus: '#btnFocus', shortBreak: '#btnShortBreak', longBreak: '#btnLongBreak' };
      const btn = $(btnMap[suggested]);
      if (btn) btn.classList.add('suggested');
    }
  }

  // --- Kanban Board ---
  function renderBoard() {
    const columns = { todo: [], doing: [], done: [] };
    tasks.filter((t) => t.column !== 'cleared').forEach((t) => {
      if (columns[t.column]) columns[t.column].push(t);
    });

    // Sort by order
    Object.values(columns).forEach((col) => col.sort((a, b) => a.order - b.order));

    renderColumn('todo', columns.todo);
    renderColumn('doing', columns.doing);
    renderColumn('done', columns.done);

    // Update counts
    $('#countTodo').textContent = columns.todo.length;
    $('#countDoing').textContent = columns.doing.length;
    $('#countDone').textContent = columns.done.length;

    // Show/hide clear button
    const clearBtn = $('#btnClearDone');
    if (columns.done.length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }

  function renderColumn(column, columnTasks) {
    const container = $(`#cards${capitalize(column)}`);
    container.innerHTML = '';

    columnTasks.forEach((task) => {
      const card = createTaskCard(task, column);
      container.appendChild(card);
    });
  }

  function createTaskCard(task, column) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.taskId = task.id;
    card.draggable = true;

    // Tag color on left border
    const tagColor = getTagColor(task.tag);
    if (tagColor) {
      card.style.borderLeftColor = tagColor;
    }

    // Title
    const title = document.createElement('span');
    title.className = 'task-card-title';
    title.textContent = task.title;
    card.appendChild(title);

    // Tag pill
    if (task.tag) {
      const tagPill = document.createElement('span');
      tagPill.className = 'task-card-tag';
      tagPill.textContent = `#${getTagDisplayName(task.tag)}`;
      if (tagColor) {
        tagPill.style.background = tagColor + '25';
        tagPill.style.color = tagColor;
      }
      card.appendChild(tagPill);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'task-card-actions';

    if (column === 'todo') {
      actions.appendChild(makeActionBtn('\u2192', 'Move to Doing', () => moveTask(task.id, 'doing')));
      actions.appendChild(makeActionBtn('\u2715', 'Clear', () => clearTask(task.id), 'btn-clear'));
    } else if (column === 'doing') {
      actions.appendChild(makeActionBtn('\u2190', 'Back to To-Do', () => moveTask(task.id, 'todo')));
      actions.appendChild(makeActionBtn('\u2192', 'Move to Done', () => moveTask(task.id, 'done')));
    } else if (column === 'done') {
      actions.appendChild(makeActionBtn('\u2190', 'Back to Doing', () => moveTask(task.id, 'doing')));
      actions.appendChild(makeActionBtn('\u2713', 'Clear', () => clearTask(task.id), 'btn-done'));
    }

    card.appendChild(actions);

    // Drag events
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      $$('.kanban-cards').forEach((c) => c.classList.remove('drag-over'));
    });

    return card;
  }

  function makeActionBtn(text, title, onClick, extraClass) {
    const btn = document.createElement('button');
    btn.className = `task-card-btn${extraClass ? ' ' + extraClass : ''}`;
    btn.textContent = text;
    btn.title = title;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  // --- Task Operations ---
  function extractTag(title) {
    const match = title.match(/#(\w+)/);
    return match ? match[1].toLowerCase() : null;
  }

  async function addTask(title) {
    title = title.trim();
    if (!title) return;

    const tag = extractTag(title);
    const task = {
      id: crypto.randomUUID(),
      title: title,
      tag: tag,
      column: 'todo',
      order: tasks.filter((t) => t.column === 'todo').length,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    // Auto-assign color to new tag
    if (tag && settings.tags && !settings.tags[tag]) {
      const usedColors = Object.values(settings.tags).map((t) => t.color);
      const available = CONSTANTS.PASTEL_COLORS.filter((c) => !usedColors.includes(c));
      const color = available.length > 0 ? available[0] :
        CONSTANTS.PASTEL_COLORS[Math.floor(Math.random() * CONSTANTS.PASTEL_COLORS.length)];
      settings.tags[tag] = { displayName: tag, color: color };
      await msg('saveSettings', { settings });
    }

    tasks.push(task);
    await msg('saveTasks', { tasks });
    renderBoard();
  }

  async function moveTask(taskId, targetColumn) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const previousColumn = task.column;

    // Enforce single task in doing
    if (targetColumn === 'doing') {
      const currentDoing = tasks.find((t) => t.column === 'doing' && t.id !== taskId);
      if (currentDoing) {
        currentDoing.column = 'todo';
        currentDoing.order = tasks.filter((t) => t.column === 'todo').length;
        // Notify background about task leaving doing
        await msg('taskMovedFromDoing', { taskId: currentDoing.id });
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

    // Notify background about doing changes
    if (targetColumn === 'doing') {
      await msg('taskMovedToDoing', { taskId: task.id });
    }
    if (previousColumn === 'doing' && targetColumn !== 'doing') {
      await msg('taskMovedFromDoing', { taskId: task.id });
    }

    await msg('saveTasks', { tasks });
    renderBoard();
    updateTimerUI();
  }

  async function clearTask(taskId) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (task.column === 'doing') {
      await msg('taskMovedFromDoing', { taskId: task.id });
    }

    task.column = 'cleared';
    await msg('saveTasks', { tasks });
    renderBoard();
  }

  async function clearAllDone() {
    let changed = false;
    tasks.forEach((t) => {
      if (t.column === 'done') {
        t.column = 'cleared';
        changed = true;
      }
    });
    if (changed) {
      await msg('saveTasks', { tasks });
      renderBoard();
    }
  }

  // --- Drag & Drop ---
  function initDragDrop() {
    $$('.kanban-cards').forEach((container) => {
      container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        container.classList.add('drag-over');

        // Find insert position
        const afterElement = getDragAfterElement(container, e.clientY);
        const dragging = $('.task-card.dragging');
        if (dragging) {
          if (afterElement) {
            container.insertBefore(dragging, afterElement);
          } else {
            container.appendChild(dragging);
          }
        }
      });

      container.addEventListener('dragleave', (e) => {
        if (!container.contains(e.relatedTarget)) {
          container.classList.remove('drag-over');
        }
      });

      container.addEventListener('drop', async (e) => {
        e.preventDefault();
        container.classList.remove('drag-over');

        const taskId = e.dataTransfer.getData('text/plain');
        const targetColumn = container.closest('.kanban-column').dataset.column;

        await moveTask(taskId, targetColumn);

        // Update order based on DOM position
        const cards = container.querySelectorAll('.task-card');
        cards.forEach((card, index) => {
          const task = tasks.find((t) => t.id === card.dataset.taskId);
          if (task) task.order = index;
        });

        await msg('saveTasks', { tasks });
      });
    });
  }

  function getDragAfterElement(container, y) {
    const elements = [...container.querySelectorAll('.task-card:not(.dragging)')];
    return elements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // --- Stats Panel ---
  async function updateStats() {
    const sessions = await msg('getSessions') || [];
    const entries = await msg('getTaskTimeEntries') || [];
    const visits = await msg('getDomainVisits') || [];
    const streak = await msg('getStreak') || 0;

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

    // Filter today's data
    const todaySessions = sessions.filter((s) => s.startedAt >= todayStart && s.status === 'completed');
    const todayEntries = entries.filter((e) => e.startedAt >= todayStart);
    const todayVisits = visits.filter((v) => v.startedAt >= todayStart);

    // Sessions summary
    const focusCount = todaySessions.filter((s) => s.type === 'focus').length;
    const focusTime = sumSessionTime(todaySessions.filter((s) => s.type === 'focus'));
    const breakCount = todaySessions.filter((s) => s.type !== 'focus').length;
    const breakTime = sumSessionTime(todaySessions.filter((s) => s.type !== 'focus'));

    $('#statSessions').innerHTML =
      `<span style="color:var(--focus-color)">${focusCount} focus (${TimerCore.formatDuration(focusTime)})</span>` +
      `<br><span style="color:var(--short-break-color);font-size:var(--font-size-xs)">${breakCount} breaks (${TimerCore.formatDuration(breakTime)})</span>`;

    // Streak
    $('#statStreak').textContent = streak > 0 ? `${streak} day${streak > 1 ? 's' : ''}` : 'Start today!';

    // Tags
    const tagTimes = {};
    todayEntries.forEach((e) => {
      const task = tasks.find((t) => t.id === e.taskId);
      const tag = task ? (task.tag || 'untagged') : 'untagged';
      const duration = e.endedAt ?
        (new Date(e.endedAt) - new Date(e.startedAt)) / 1000 : 0;
      tagTimes[tag] = (tagTimes[tag] || 0) + duration;
    });

    const tagHtml = Object.entries(tagTimes)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, time]) => {
        const color = getTagColor(tag) || 'var(--text-muted)';
        const name = getTagDisplayName(tag);
        return `<span style="color:${color}">#${name} ${TimerCore.formatDuration(time)}</span>`;
      })
      .join('<br>');
    $('#statTags').innerHTML = tagHtml || '<span style="color:var(--text-muted)">No tags yet</span>';

    // Domains
    const domainTimes = {};
    todayVisits.forEach((v) => {
      const duration = v.endedAt ?
        (new Date(v.endedAt) - new Date(v.startedAt)) / 1000 : 0;
      domainTimes[v.domain] = (domainTimes[v.domain] || 0) + duration;
    });

    const domainHtml = Object.entries(domainTimes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain, time]) =>
        `<span>${domain} ${TimerCore.formatDuration(time)}</span>`
      )
      .join('<br>');
    $('#statDomains').innerHTML = domainHtml || '<span style="color:var(--text-muted)">No visits yet</span>';
  }

  function sumSessionTime(sessions) {
    return sessions.reduce((sum, s) => {
      if (!s.endedAt) return sum;
      return sum + (new Date(s.endedAt) - new Date(s.startedAt)) / 1000;
    }, 0);
  }

  // --- Tag Helpers ---
  function getTagColor(tag) {
    if (!tag || !settings.tags || !settings.tags[tag]) return null;
    return settings.tags[tag].color;
  }

  function getTagDisplayName(tag) {
    if (!tag) return '';
    if (settings.tags && settings.tags[tag] && settings.tags[tag].displayName) {
      return settings.tags[tag].displayName;
    }
    return tag;
  }

  // --- Settings Modal ---
  function renderSettings() {
    // Blocked domains
    const domainList = $('#blockedDomainsList');
    domainList.innerHTML = '';
    (settings.blockedDomains || []).forEach((domain) => {
      const item = document.createElement('div');
      item.className = 'settings-item';
      item.innerHTML = `
        <span class="settings-item-label">${domain}</span>
        <button class="task-card-btn settings-item-remove" title="Remove">\u2715</button>
      `;
      item.querySelector('button').addEventListener('click', async () => {
        settings.blockedDomains = settings.blockedDomains.filter((d) => d !== domain);
        await msg('saveSettings', { settings });
        renderSettings();
      });
      domainList.appendChild(item);
    });

    // Tags
    const tagList = $('#tagSettingsList');
    tagList.innerHTML = '';
    Object.entries(settings.tags || {}).forEach(([tag, config]) => {
      const item = document.createElement('div');
      item.className = 'settings-item';
      item.innerHTML = `
        <span class="settings-item-label">#${tag}</span>
        <input type="text" class="settings-rename" value="${config.displayName || tag}" placeholder="Display name">
        <input type="color" class="settings-color" value="${config.color || '#FFB3BA'}">
        <button class="task-card-btn settings-item-remove" title="Remove tag">\u2715</button>
      `;

      const renameInput = item.querySelector('.settings-rename');
      renameInput.addEventListener('change', async () => {
        settings.tags[tag].displayName = renameInput.value || tag;
        await msg('saveSettings', { settings });
        renderBoard();
      });

      const colorInput = item.querySelector('.settings-color');
      colorInput.addEventListener('input', async () => {
        settings.tags[tag].color = colorInput.value;
        await msg('saveSettings', { settings });
        renderBoard();
      });

      item.querySelector('.settings-item-remove').addEventListener('click', async () => {
        delete settings.tags[tag];
        await msg('saveSettings', { settings });
        renderSettings();
        renderBoard();
      });

      tagList.appendChild(item);
    });
  }

  // --- Event Binding ---
  function bindEvents() {
    // Timer buttons
    $('#btnFocus').addEventListener('click', async () => {
      const result = await msg('startSession', { type: 'focus' });
      if (result) timerState = result.timerState || timerState;
      updateTimerUI();
      highlightSuggested();
    });

    $('#btnShortBreak').addEventListener('click', async () => {
      const result = await msg('startSession', { type: 'shortBreak' });
      if (result) timerState = result.timerState || timerState;
      updateTimerUI();
      highlightSuggested();
    });

    $('#btnLongBreak').addEventListener('click', async () => {
      const result = await msg('startSession', { type: 'longBreak' });
      if (result) timerState = result.timerState || timerState;
      updateTimerUI();
      highlightSuggested();
    });

    $('#btnStop').addEventListener('click', async () => {
      await msg('stopSession');
      timerState = await msg('getTimerState') || { status: 'idle' };
      updateTimerUI();
      updateStats();
      highlightSuggested();
    });

    // Quick entry
    $('#inputTodo').addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        await addTask(e.target.value);
        e.target.value = '';
      }
    });

    // Clear completed
    $('#btnClearDone').addEventListener('click', clearAllDone);

    // Tab navigation
    $$('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.tab-btn').forEach((b) => b.classList.remove('active'));
        $$('.tab-content').forEach((c) => c.classList.remove('active'));
        btn.classList.add('active');
        const tabId = `tab${capitalize(btn.dataset.tab)}`;
        const tabEl = document.getElementById(tabId);
        if (tabEl) tabEl.classList.add('active');

        // Load dashboard data when switching
        if (btn.dataset.tab === 'weekly') loadWeekly();
        if (btn.dataset.tab === 'monthly') loadMonthly();
      });
    });

    // Settings
    $('#btnSettings').addEventListener('click', () => {
      renderSettings();
      $('#settingsModal').classList.remove('hidden');
    });

    $('#btnCloseSettings').addEventListener('click', () => {
      $('#settingsModal').classList.add('hidden');
    });

    $('#settingsModal').addEventListener('click', (e) => {
      if (e.target === $('#settingsModal')) {
        $('#settingsModal').classList.add('hidden');
      }
    });

    // Add domain
    const addDomainHandler = async () => {
      const input = $('#inputNewDomain');
      const domain = input.value.trim().toLowerCase();
      if (domain && !settings.blockedDomains.includes(domain)) {
        settings.blockedDomains.push(domain);
        await msg('saveSettings', { settings });
        input.value = '';
        renderSettings();
      }
    };

    $('#btnAddDomain').addEventListener('click', addDomainHandler);
    $('#inputNewDomain').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addDomainHandler();
    });

    // Init drag & drop
    initDragDrop();

    // Listen for storage changes (other tabs/popup)
    chrome.storage.onChanged.addListener(async (changes) => {
      if (changes.tasks) {
        tasks = changes.tasks.newValue || [];
        renderBoard();
      }
      if (changes.settings) {
        settings = changes.settings.newValue || {};
        renderBoard();
      }
      if (changes.timerState) {
        timerState = changes.timerState.newValue || { status: 'idle' };
        updateTimerUI();
        highlightSuggested();
      }
    });
  }

  // Placeholder functions for weekly/monthly (will be implemented later)
  function loadWeekly() {
    $('#weeklyContainer').innerHTML = '<p style="color:var(--text-muted);text-align:center;margin-top:var(--space-xl)">Weekly view loading...</p>';
  }

  function loadMonthly() {
    $('#monthlyContainer').innerHTML = '<p style="color:var(--text-muted);text-align:center;margin-top:var(--space-xl)">Monthly view loading...</p>';
  }

  // --- Helpers ---
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // --- Start ---
  document.addEventListener('DOMContentLoaded', init);
})();
