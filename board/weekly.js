// Weekly calendar/planner view

// eslint-disable-next-line no-unused-vars
function initWeekly(container, msgFn, settingsRef, tasksRef) {
  'use strict';

  let currentWeekStart = DashboardUtils.getWeekStart(new Date());

  async function render() {
    const weekEnd = DashboardUtils.getWeekEnd(currentWeekStart);
    const days = DashboardUtils.getWeekDays(currentWeekStart);

    // Fetch data
    const sessions = await msgFn('getSessions') || [];
    const entries = await msgFn('getTaskTimeEntries') || [];
    const visits = await msgFn('getDomainVisits') || [];
    const tasks = tasksRef() || [];

    // Filter to this week
    const weekSessions = DashboardUtils.filterByDateRange(sessions, 'startedAt', currentWeekStart, weekEnd)
      .filter((s) => s.status === 'completed');
    const weekEntries = DashboardUtils.filterByDateRange(entries, 'startedAt', currentWeekStart, weekEnd);
    const weekVisits = DashboardUtils.filterByDateRange(visits, 'startedAt', currentWeekStart, weekEnd);

    // Time range
    const { minHour, maxHour } = DashboardUtils.getTimeRange(weekSessions);
    const totalHours = maxHour - minHour;

    container.innerHTML = '';

    // Header with navigation
    const header = el('div', 'weekly-header');
    const prevBtn = el('button', 'weekly-nav-btn');
    prevBtn.innerHTML = '&#9664;';
    prevBtn.addEventListener('click', () => { navigateWeek(-1); });

    const title = el('span', 'weekly-title');
    title.textContent = DashboardUtils.formatWeekRange(currentWeekStart);

    const nextBtn = el('button', 'weekly-nav-btn');
    nextBtn.innerHTML = '&#9654;';
    nextBtn.addEventListener('click', () => { navigateWeek(1); });

    header.appendChild(prevBtn);
    header.appendChild(title);
    header.appendChild(nextBtn);
    container.appendChild(header);

    // Calendar grid
    const calendar = el('div', 'weekly-calendar');

    // Time column
    const timeCol = el('div', 'weekly-time-col');
    for (let h = minHour; h < maxHour; h++) {
      const hourLabel = el('div', 'weekly-hour-label');
      hourLabel.textContent = `${String(h).padStart(2, '0')}:00`;
      hourLabel.style.height = `${100 / totalHours}%`;
      timeCol.appendChild(hourLabel);
    }
    calendar.appendChild(timeCol);

    // Day columns
    days.forEach((day) => {
      const dayCol = el('div', 'weekly-day-col');

      // Day header
      const dayHeader = el('div', 'weekly-day-header');
      const isToday = DashboardUtils.isSameDay(day, new Date());
      if (isToday) dayHeader.classList.add('today');
      dayHeader.innerHTML = `<span class="weekly-day-name">${DashboardUtils.getDayName(day)}</span>` +
        `<span class="weekly-day-date">${day.getDate()}</span>`;
      dayCol.appendChild(dayHeader);

      // Session blocks
      const dayContent = el('div', 'weekly-day-content');
      dayContent.style.position = 'relative';

      // Hour grid lines
      for (let h = minHour; h < maxHour; h++) {
        const gridLine = el('div', 'weekly-grid-line');
        gridLine.style.top = `${((h - minHour) / totalHours) * 100}%`;
        dayContent.appendChild(gridLine);
      }

      const daySessions = weekSessions.filter((s) =>
        DashboardUtils.isSameDay(new Date(s.startedAt), day)
      );

      daySessions.forEach((session) => {
        const block = createSessionBlock(session, entries, visits, tasks, minHour, totalHours);
        dayContent.appendChild(block);
      });

      dayCol.appendChild(dayContent);
      calendar.appendChild(dayCol);
    });

    container.appendChild(calendar);

    // Weekly totals
    const totals = el('div', 'weekly-totals');
    totals.appendChild(renderTotals(weekSessions, weekEntries, weekVisits, tasks));
    container.appendChild(totals);
  }

  function createSessionBlock(session, entries, visits, tasks, minHour, totalHours) {
    const start = new Date(session.startedAt);
    const end = new Date(session.endedAt);
    const startOffset = (start.getHours() + start.getMinutes() / 60 - minHour) / totalHours;
    const duration = (end - start) / 3600000; // hours
    const height = duration / totalHours;

    const block = el('div', `weekly-session-block ${session.type}`);
    block.style.top = `${startOffset * 100}%`;
    block.style.height = `${Math.max(height * 100, 2)}%`;

    const timeLabel = el('div', 'weekly-session-time');
    timeLabel.textContent = `${DashboardUtils.formatTime24(start)}-${DashboardUtils.formatTime24(end)}`;
    block.appendChild(timeLabel);

    if (session.type === 'focus') {
      // Show task segments
      const sessionEntries = entries.filter((e) => e.sessionId === session.id);
      sessionEntries.forEach((entry) => {
        const task = tasks.find((t) => t.id === entry.taskId);
        const entryEl = el('div', 'weekly-session-entry');
        const entryStart = new Date(entry.startedAt);
        const entryEnd = entry.endedAt ? new Date(entry.endedAt) : end;
        const taskTitle = task ? task.title : 'Unknown task';
        entryEl.textContent = `${taskTitle}`;
        entryEl.title = `${DashboardUtils.formatTime24(entryStart)}-${DashboardUtils.formatTime24(entryEnd)}`;
        block.appendChild(entryEl);
      });
    } else {
      // Show domain visits
      const sessionVisits = visits.filter((v) => v.sessionId === session.id);
      const domainGroups = {};
      sessionVisits.forEach((v) => {
        if (!domainGroups[v.domain]) domainGroups[v.domain] = 0;
        if (v.endedAt) {
          domainGroups[v.domain] += (new Date(v.endedAt) - new Date(v.startedAt)) / 1000;
        }
      });

      Object.entries(domainGroups)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .forEach(([domain, time]) => {
          const visitEl = el('div', 'weekly-session-entry visit');
          visitEl.textContent = `${domain} (${TimerCore.formatDuration(time)})`;
          block.appendChild(visitEl);
        });
    }

    return block;
  }

  function renderTotals(sessions, entries, visits, tasks) {
    const wrap = el('div', 'weekly-totals-grid');

    // Session stats
    const sessionStats = DashboardUtils.computeSessionStats(sessions);
    const sessionCard = el('div', 'weekly-totals-card');
    sessionCard.innerHTML = '<h3>Sessions</h3>';
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
    tagCard.innerHTML = '<h3>Tags</h3>';
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
      tagList.innerHTML = '<div class="totals-empty">No tags this week</div>';
    }
    tagCard.appendChild(tagList);
    wrap.appendChild(tagCard);

    // Domain stats
    const domainStats = DashboardUtils.computeDomainStats(visits);
    const domainCard = el('div', 'weekly-totals-card');
    domainCard.innerHTML = '<h3>Domains</h3>';
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
      domainList.innerHTML = '<div class="totals-empty">No domain visits this week</div>';
    }
    domainCard.appendChild(domainList);
    wrap.appendChild(domainCard);

    return wrap;
  }

  function navigateWeek(direction) {
    currentWeekStart = new Date(currentWeekStart);
    currentWeekStart.setDate(currentWeekStart.getDate() + direction * 7);
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

  // Initial render
  render();

  return { render, navigateWeek };
}
