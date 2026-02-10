// Monthly dashboard view

// eslint-disable-next-line no-unused-vars
function initMonthly(container, msgFn, settingsRef, tasksRef) {
  'use strict';

  let currentMonth = new Date();

  async function render() {
    const monthStart = DashboardUtils.getMonthStart(currentMonth);
    const monthEnd = DashboardUtils.getMonthEnd(currentMonth);

    // Fetch data
    const sessions = await msgFn('getSessions') || [];
    const entries = await msgFn('getTaskTimeEntries') || [];
    const visits = await msgFn('getDomainVisits') || [];
    const allTasks = tasksRef() || [];

    // Filter to this month
    const monthSessions = DashboardUtils.filterByDateRange(sessions, 'startedAt', monthStart, monthEnd)
      .filter((s) => s.status === 'completed');
    const monthEntries = DashboardUtils.filterByDateRange(entries, 'startedAt', monthStart, monthEnd);
    const monthVisits = DashboardUtils.filterByDateRange(visits, 'startedAt', monthStart, monthEnd);

    // Get completed tasks in this month
    const completedTasks = allTasks.filter((t) => {
      if (!t.completedAt) return false;
      const cd = new Date(t.completedAt);
      return cd >= monthStart && cd <= monthEnd;
    });

    container.innerHTML = '';

    // Header
    const header = el('div', 'monthly-header');
    const prevBtn = el('button', 'weekly-nav-btn');
    prevBtn.innerHTML = '&#9664;';
    prevBtn.addEventListener('click', () => navigateMonth(-1));

    const title = el('span', 'weekly-title');
    title.textContent = DashboardUtils.formatMonthYear(currentMonth);

    const nextBtn = el('button', 'weekly-nav-btn');
    nextBtn.innerHTML = '&#9654;';
    nextBtn.addEventListener('click', () => navigateMonth(1));

    header.appendChild(prevBtn);
    header.appendChild(title);
    header.appendChild(nextBtn);
    container.appendChild(header);

    // Tag groups
    const tasksByTag = {};
    completedTasks.forEach((t) => {
      const tag = t.tag || 'untagged';
      if (!tasksByTag[tag]) tasksByTag[tag] = [];
      tasksByTag[tag].push(t);
    });

    // Also include tags from entries that don't have completed tasks
    const tagStats = DashboardUtils.computeTagStats(monthEntries, allTasks);
    Object.keys(tagStats).forEach((tag) => {
      if (!tasksByTag[tag]) tasksByTag[tag] = [];
    });

    const tagGroups = el('div', 'monthly-tag-groups');

    if (Object.keys(tasksByTag).length === 0) {
      tagGroups.innerHTML = '<div class="monthly-empty">No completed tasks this month</div>';
    }

    Object.entries(tasksByTag)
      .sort((a, b) => {
        const aTime = (tagStats[a[0]] || {}).totalTime || 0;
        const bTime = (tagStats[b[0]] || {}).totalTime || 0;
        return bTime - aTime;
      })
      .forEach(([tag, tagTasks]) => {
        const stat = tagStats[tag] || { count: 0, totalTime: 0 };
        const totalTime = stat.totalTime;
        const taskCount = tagTasks.length;
        const color = getTagColor(tag);
        const displayName = getTagDisplayName(tag);

        const group = el('div', 'monthly-tag-group');

        // Group header (clickable to expand/collapse)
        const groupHeader = el('div', 'monthly-tag-header');
        groupHeader.innerHTML = `
          <span class="monthly-tag-arrow">&#9654;</span>
          <span class="monthly-tag-name" style="color:${color || 'inherit'}">#${displayName}</span>
          <span class="monthly-tag-meta">${taskCount} task${taskCount !== 1 ? 's' : ''} &middot; ${TimerCore.formatDuration(totalTime)}</span>
        `;

        const groupContent = el('div', 'monthly-tag-content hidden');

        groupHeader.addEventListener('click', () => {
          const isExpanded = !groupContent.classList.contains('hidden');
          groupContent.classList.toggle('hidden');
          groupHeader.querySelector('.monthly-tag-arrow').innerHTML = isExpanded ? '&#9654;' : '&#9660;';
        });

        // Tasks in group
        tagTasks
          .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
          .forEach((task) => {
            const workingTime = DashboardUtils.getTaskWorkingTime(task.id, monthEntries);
            const taskEl = createMonthlyTaskItem(task, workingTime, allTasks, entries, () => render());
            groupContent.appendChild(taskEl);
          });

        group.appendChild(groupHeader);
        group.appendChild(groupContent);
        tagGroups.appendChild(group);
      });

    container.appendChild(tagGroups);

    // Monthly totals
    const totals = el('div', 'monthly-totals');
    totals.appendChild(renderMonthlyTotals(monthSessions, monthEntries, monthVisits, allTasks));
    container.appendChild(totals);
  }

  function createMonthlyTaskItem(task, workingTime, allTasks, _entries, onSave) {
    const item = el('div', 'monthly-task-item');

    const titleEl = el('span', 'monthly-task-title');
    titleEl.textContent = task.title;

    const metaEl = el('div', 'monthly-task-meta');
    const addedDate = task.createdAt ? DashboardUtils.formatDate(new Date(task.createdAt)) : '-';
    const completedDate = task.completedAt ? DashboardUtils.formatDate(new Date(task.completedAt)) : '-';
    metaEl.textContent = `Added: ${addedDate} | Completed: ${completedDate} | Time: ${TimerCore.formatDuration(workingTime)}`;

    // Inline edit on click
    titleEl.addEventListener('click', () => {
      const input = el('input', 'monthly-task-edit');
      input.type = 'text';
      input.value = task.title;
      item.replaceChild(input, titleEl);
      input.focus();
      input.select();

      const save = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== task.title) {
          // Update the task in the tasks array
          const taskObj = allTasks.find((t) => t.id === task.id);
          if (taskObj) {
            taskObj.title = newTitle;
            const newTag = newTitle.match(/#(\w+)/);
            taskObj.tag = newTag ? newTag[1].toLowerCase() : null;
            await msgFn('saveTasks', { tasks: allTasks });
            onSave();
            return;
          }
        }
        item.replaceChild(titleEl, input);
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') item.replaceChild(titleEl, input);
      });

      input.addEventListener('blur', save);
    });

    item.appendChild(titleEl);
    item.appendChild(metaEl);
    return item;
  }

  function renderMonthlyTotals(sessions, entries, visits, tasks) {
    const wrap = el('div', 'weekly-totals-grid');

    // Session stats
    const sessionStats = DashboardUtils.computeSessionStats(sessions);
    const sessionCard = el('div', 'weekly-totals-card');
    sessionCard.innerHTML = '<h3>Monthly Sessions</h3>';
    const sessionList = el('div', 'totals-list');
    [
      { label: 'Focus', stat: sessionStats.focus, cls: 'focus' },
      { label: 'Short Break', stat: sessionStats.shortBreak, cls: 'short' },
      { label: 'Long Break', stat: sessionStats.longBreak, cls: 'long' },
    ].forEach(({ label, stat, cls }) => {
      const row = el('div', `totals-row ${cls}`);
      row.innerHTML = `<span>${label}</span><span>${stat.count}x (${TimerCore.formatDuration(stat.totalTime)})</span>`;
      sessionList.appendChild(row);
    });
    sessionCard.appendChild(sessionList);
    wrap.appendChild(sessionCard);

    // Tag stats
    const tagStats = DashboardUtils.computeTagStats(entries, tasks);
    const tagCard = el('div', 'weekly-totals-card');
    tagCard.innerHTML = '<h3>Monthly Tags</h3>';
    const tagList = el('div', 'totals-list');
    Object.entries(tagStats)
      .sort((a, b) => b[1].totalTime - a[1].totalTime)
      .forEach(([tag, stat]) => {
        const color = getTagColor(tag);
        const displayName = getTagDisplayName(tag);
        const row = el('div', 'totals-row');
        row.innerHTML = `<span style="color:${color || 'inherit'}">#${displayName}</span>` +
          `<span>${stat.count} tasks (${TimerCore.formatDuration(stat.totalTime)})</span>`;
        tagList.appendChild(row);
      });
    if (Object.keys(tagStats).length === 0) {
      tagList.innerHTML = '<div class="totals-empty">No tags this month</div>';
    }
    tagCard.appendChild(tagList);
    wrap.appendChild(tagCard);

    // Domain stats
    const domainStats = DashboardUtils.computeDomainStats(visits);
    const domainCard = el('div', 'weekly-totals-card');
    domainCard.innerHTML = '<h3>Monthly Domains</h3>';
    const domainList = el('div', 'totals-list');
    Object.entries(domainStats)
      .sort((a, b) => b[1].totalTime - a[1].totalTime)
      .slice(0, 10)
      .forEach(([domain, stat]) => {
        const row = el('div', 'totals-row');
        row.innerHTML = `<span>${domain}</span>` +
          `<span>${stat.visits} visits (${TimerCore.formatDuration(stat.totalTime)})</span>`;
        domainList.appendChild(row);
      });
    if (Object.keys(domainStats).length === 0) {
      domainList.innerHTML = '<div class="totals-empty">No domain visits this month</div>';
    }
    domainCard.appendChild(domainList);
    wrap.appendChild(domainCard);

    return wrap;
  }

  function navigateMonth(direction) {
    currentMonth = new Date(currentMonth);
    currentMonth.setMonth(currentMonth.getMonth() + direction);
    render();
  }

  function getTagColor(tag) {
    const s = settingsRef();
    if (!tag || !s.tags || !s.tags[tag]) return null;
    return s.tags[tag].color;
  }

  function getTagDisplayName(tag) {
    const s = settingsRef();
    if (!tag) return 'untagged';
    if (s.tags && s.tags[tag] && s.tags[tag].displayName) return s.tags[tag].displayName;
    return tag;
  }

  function el(tag, className) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }

  render();

  return { render, navigateMonth };
}
