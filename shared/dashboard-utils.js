// Dashboard utility functions for computing stats

const DashboardUtils = {
  // --- Date Helpers ---
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    // Monday = 1, Sunday = 0 -> offset
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  getWeekEnd(date) {
    const start = this.getWeekStart(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  },

  getMonthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  },

  getMonthEnd(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  },

  getDayStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  getDayEnd(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  },

  isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  },

  formatDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  },

  formatTime24(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  },

  formatWeekRange(weekStart) {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return `${this.formatDate(weekStart)} - ${this.formatDate(end)}`;
  },

  formatMonthYear(date) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  },

  getDayName(date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  },

  // --- Filtering ---
  filterByDateRange(items, startField, rangeStart, rangeEnd) {
    return items.filter((item) => {
      const d = new Date(item[startField]);
      return d >= rangeStart && d <= rangeEnd;
    });
  },

  // --- Aggregations ---
  sumDuration(items, startField, endField) {
    return items.reduce((sum, item) => {
      if (!item[endField]) return sum;
      return sum + (new Date(item[endField]) - new Date(item[startField])) / 1000;
    }, 0);
  },

  groupByField(items, field) {
    const groups = {};
    items.forEach((item) => {
      const key = item[field] || 'untagged';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  },

  // --- Session Stats ---
  computeSessionStats(sessions) {
    const stats = {
      focus: { count: 0, totalTime: 0 },
      shortBreak: { count: 0, totalTime: 0 },
      longBreak: { count: 0, totalTime: 0 },
    };

    sessions.forEach((s) => {
      if (s.status !== 'completed' || !stats[s.type]) return;
      stats[s.type].count++;
      if (s.endedAt) {
        stats[s.type].totalTime +=
          (new Date(s.endedAt) - new Date(s.startedAt)) / 1000;
      }
    });

    return stats;
  },

  // --- Tag Stats ---
  computeTagStats(entries, tasks) {
    const tagMap = {};
    tasks.forEach((t) => { tagMap[t.id] = t.tag || 'untagged'; });

    const stats = {};
    entries.forEach((e) => {
      const tag = tagMap[e.taskId] || 'untagged';
      if (!stats[tag]) stats[tag] = { count: 0, totalTime: 0, taskIds: new Set() };
      stats[tag].totalTime += this.sumDuration([e], 'startedAt', 'endedAt');
      stats[tag].taskIds.add(e.taskId);
    });

    // Convert sets to counts
    Object.values(stats).forEach((s) => {
      s.count = s.taskIds.size;
      delete s.taskIds;
    });

    return stats;
  },

  // --- Domain Stats ---
  computeDomainStats(visits) {
    const stats = {};
    visits.forEach((v) => {
      if (!stats[v.domain]) stats[v.domain] = { visits: 0, totalTime: 0 };
      stats[v.domain].visits++;
      if (v.endedAt) {
        stats[v.domain].totalTime +=
          (new Date(v.endedAt) - new Date(v.startedAt)) / 1000;
      }
    });
    return stats;
  },

  // --- Weekly View Helpers ---
  getWeekDays(weekStart) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  },

  getTimeRange(sessions) {
    if (sessions.length === 0) return { minHour: 9, maxHour: 17 };

    let minHour = 23;
    let maxHour = 0;

    sessions.forEach((s) => {
      const start = new Date(s.startedAt);
      const end = s.endedAt ? new Date(s.endedAt) : new Date();
      minHour = Math.min(minHour, start.getHours());
      maxHour = Math.max(maxHour, end.getHours() + (end.getMinutes() > 0 ? 1 : 0));
    });

    return {
      minHour: Math.floor(minHour),
      maxHour: Math.ceil(Math.min(24, maxHour + 1)),
    };
  },

  // --- Task Working Time ---
  getTaskWorkingTime(taskId, entries) {
    const taskEntries = entries.filter((e) => e.taskId === taskId);
    return this.sumDuration(taskEntries, 'startedAt', 'endedAt');
  },

  // --- Monthly Completed Tasks by Tag ---
  getCompletedTasksByTag(tasks, entries) {
    const completed = tasks.filter((t) =>
      t.column === 'done' || t.column === 'cleared'
    );

    const byTag = {};
    completed.forEach((t) => {
      const tag = t.tag || 'untagged';
      if (!byTag[tag]) byTag[tag] = [];
      byTag[tag].push({
        ...t,
        workingTime: this.getTaskWorkingTime(t.id, entries),
      });
    });

    return byTag;
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DashboardUtils;
}
