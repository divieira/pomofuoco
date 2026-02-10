// Pomofuoco Popup — Timer quick view

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  let timerState = { status: 'idle' };
  let timerInterval = null;

  function msg(action, data) {
    return chrome.runtime.sendMessage({ action, ...data });
  }

  async function init() {
    timerState = await msg('getTimerState') || { status: 'idle' };
    updateUI();
    startTick();
    bindEvents();
    highlightSuggested();
  }

  function updateUI() {
    const timeEl = $('#popupTime');
    const labelEl = $('#popupLabel');
    const cycleEl = $('#popupCycle');
    const progressEl = $('#popupProgress');
    const doingEl = $('#popupDoing');

    if (timerState.status === 'running') {
      const remaining = TimerCore.getRemaining(timerState);
      const overtime = TimerCore.isOvertime(timerState);
      const elapsed = (Date.now() - new Date(timerState.startedAt).getTime()) / 1000;
      const displayTime = overtime ? -(elapsed - timerState.duration) : remaining;

      timeEl.textContent = TimerCore.formatTime(displayTime);
      timeEl.classList.toggle('overtime', overtime);

      const labels = { focus: 'Focus', shortBreak: 'Short Break', longBreak: 'Long Break' };
      labelEl.textContent = labels[timerState.type] || '';
      cycleEl.textContent = timerState.type === 'focus' ?
        `#${timerState.cyclePosition}/${CONSTANTS.TIMER.LONG_BREAK_AFTER}` : '';

      const progress = overtime ? 100 : Math.min(100, (elapsed / timerState.duration) * 100);
      progressEl.style.width = `${progress}%`;
      progressEl.className = `popup-progress ${timerState.type}`;

      $('#popupIdleButtons').classList.add('hidden');
      $('#popupRunningButtons').classList.remove('hidden');

      // Show current doing task
      msg('getTasks').then((tasks) => {
        const doing = (tasks || []).find((t) => t.column === 'doing');
        doingEl.textContent = doing ? doing.title : '';
      });
    } else {
      timeEl.textContent = '00:00';
      timeEl.classList.remove('overtime');
      labelEl.textContent = 'Ready';
      cycleEl.textContent = timerState.cyclePosition ?
        `Cycle ${timerState.cyclePosition}/${CONSTANTS.TIMER.LONG_BREAK_AFTER}` : '';
      progressEl.style.width = '0%';
      progressEl.className = 'popup-progress';
      doingEl.textContent = '';

      $('#popupIdleButtons').classList.remove('hidden');
      $('#popupRunningButtons').classList.add('hidden');
    }
  }

  function startTick() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(async () => {
      timerState = await msg('getTimerState') || timerState;
      updateUI();
    }, 1000);
  }

  async function highlightSuggested() {
    const suggested = await msg('getSuggestedNext');
    document.querySelectorAll('.btn.suggested').forEach((b) => b.classList.remove('suggested'));
    if (timerState.status === 'idle') {
      const btnMap = { focus: '#popupBtnFocus', shortBreak: '#popupBtnShort', longBreak: '#popupBtnLong' };
      const btn = $(btnMap[suggested]);
      if (btn) btn.classList.add('suggested');
    }
  }

  function bindEvents() {
    $('#popupBtnFocus').addEventListener('click', async () => {
      const result = await msg('startSession', { type: 'focus' });
      if (result) timerState = result.timerState || timerState;
      updateUI();
      highlightSuggested();
    });

    $('#popupBtnShort').addEventListener('click', async () => {
      const result = await msg('startSession', { type: 'shortBreak' });
      if (result) timerState = result.timerState || timerState;
      updateUI();
      highlightSuggested();
    });

    $('#popupBtnLong').addEventListener('click', async () => {
      const result = await msg('startSession', { type: 'longBreak' });
      if (result) timerState = result.timerState || timerState;
      updateUI();
      highlightSuggested();
    });

    $('#popupBtnStop').addEventListener('click', async () => {
      await msg('stopSession');
      timerState = await msg('getTimerState') || { status: 'idle' };
      updateUI();
      highlightSuggested();
    });

    $('#popupOpenBoard').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('board/board.html') });
      window.close();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
