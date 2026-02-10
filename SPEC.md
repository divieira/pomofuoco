# Pomofuoco — Specification

## Overview

Pomofuoco is a Chrome extension (Manifest V3) combining a Pomodoro timer, Kanban task board, domain-blocking focus mode, and productivity dashboards with time tracking and reporting.

---

## 1. Timer

### Durations (defaults)
- **Focus**: 25 minutes
- **Short Break**: 5 minutes
- **Long Break**: 15 minutes (suggested after every 4 focus sessions)

### Behavior
- All transitions are **manual** — user clicks to start each phase.
- Timer keeps running (and blocking stays active) even after alarm time expires. User must explicitly stop.
- **Stop button**: interrupts the current session (no new session starts). Session is marked "completed" with actual end time.
- Automatic stop when computer screen is locked (via `chrome.idle` API).
- `chrome.alarms` for countdown (service workers can't rely on setInterval).
- Timer state persisted in `chrome.storage.local` so it survives popup close / service worker restart.

### Cycle Tracking
- Count focus sessions 1→4, then suggest long break.
- Allow user to pick any type regardless of suggestion.
- Cancelled/stopped sessions still count toward the cycle if they ran for any time.

### Notifications
- `chrome.notifications` with bundled "Timer Ding" sound on session end.
- Notifications blocked from blocked domains during focus.

---

## 2. Kanban Board

### Columns
- **To-Do** → **Doing** → **Done**
- Hidden 4th status: **Cleared** (soft-delete)

### Task Transitions
| From | Actions |
|------|---------|
| To-Do | → Doing (arrow), ✕ Clear |
| Doing | ← To-Do (arrow), → Done (arrow) |
| Done | ✓ Clear (checkmark) |

### Quick Entry
- Permanent empty card at bottom of To-Do column.
- Type title, press Enter → creates task, new empty card appears.
- Supports `#tag` anywhere in title.

### Drag & Drop
- Drag to reorder within a column.
- Drag between columns (To-Do ↔ Doing ↔ Done).
- Only 1 task allowed in Doing. Moving a second auto-moves the first back to To-Do.

### Clear Completed
- "Clear completed" button on Done column → moves all Done tasks to Cleared status.

---

## 3. Tag System

### Extraction
- Tags extracted from `#word` pattern in title (first occurrence).
- Untagged tasks grouped as "(untagged)".

### Customization (Settings)
- Rename display name per tag.
- Color picker per tag.
- First unknown tag auto-assigned a random pastel color.

### Visual
- Card left-border colored by tag.
- Tag shown as pill/badge on card.

---

## 4. Tab Blocking (Focus Mode)

### Blocked Domains
- Default: `x.com`, `web.whatsapp.com`, `mail.google.com`
- Customizable in Settings.

### During Focus
- Existing tabs on blocked domains → redirected to interstitial "You're in focus mode" page.
- New navigation to blocked domains → intercepted and redirected.
- Original URLs stored so tabs restore when focus ends.
- Browser notifications from blocked domains suppressed.

### When Focus Ends (or stopped)
- Blocking lifts.
- Tabs restored to original URLs.

---

## 5. Activity Tracking

### Task Time (during Focus)
- When a task is in Doing during a running focus session → TaskTimeEntry opened.
- When task leaves Doing, or focus ends → TaskTimeEntry closed.
- Multiple tasks can be tracked per session (user can switch).

### Domain Visits (during Breaks)
- Track active tab domain while Chrome is focused and tab is active.
- Track ALL domains (not just blocked list).
- Use `chrome.tabs.onActivated`, `chrome.windows.onFocusChanged`.
- Close visit entry when tab changes, Chrome loses focus, or break ends.

---

## 6. Dashboard

### Layout
- Timer bar always visible at top of full page.
- Tab navigation: **Board** | **Weekly** | **Monthly**
- Board tab includes a "Current" stats panel below the kanban.

### Current Panel (on Board tab, below kanban)
- Today's sessions: count and total time per type.
- Today's tag breakdown: count and total time.
- Today's domain visits: count and total time.
- Streak: consecutive days with at least 1 completed focus session.

### Weekly View
- Calendar/planner layout: **7 columns (Mon–Sun)**, one per day.
- Arrow navigation between weeks.
- Vertical axis: time of day, cropped to `floor(min(startHour))` — `ceil(max(endHour))` for that week's sessions.
- Each session shown as a block:
  - Focus sessions: show task segments with start/end times.
  - Break sessions: show domain visit segments with times.
- Weekly totals bar at bottom:
  - Per-tag: count + total time.
  - Per session type: count + total time.
  - Per domain: visit count + total time.

### Monthly View
- Arrow navigation between months.
- Grouped by tag (collapsible sections):
  - Header: tag name, task count, total time.
  - Expanded: completed tasks with title, added date, completed date, working time.
  - Click task title → inline edit title + tag → on save, re-extract tag, re-sort, totals recompute.
- "(untagged)" group for tasks without tags.
- Monthly totals:
  - Same structure as weekly (tags, sessions, domains).

---

## 7. Settings Modal

- Triggered by gear icon on kanban page.
- Sections:
  - **Blocked Domains**: list with remove (✕) and add (+) input.
  - **Tags**: list of known tags with rename field and color picker.

---

## 8. Data Schema

### Task
```
{
  id: string (uuid)
  title: string              // "Fix bug #work"
  tag: string | null         // "work"
  column: "todo" | "doing" | "done" | "cleared"
  order: number
  createdAt: ISO string
  completedAt: ISO string | null
}
```

### Session
```
{
  id: string (uuid)
  type: "focus" | "shortBreak" | "longBreak"
  startedAt: ISO string
  endedAt: ISO string | null
  status: "running" | "completed"
  cyclePosition: number (1-4)
}
```

### TaskTimeEntry
```
{
  id: string (uuid)
  taskId: string
  sessionId: string
  startedAt: ISO string
  endedAt: ISO string | null
}
```

### DomainVisit
```
{
  id: string (uuid)
  sessionId: string
  domain: string
  startedAt: ISO string
  endedAt: ISO string | null
}
```

### Settings
```
{
  blockedDomains: string[]
  tags: { [name]: { displayName: string, color: string } }
}
```

---

## 9. Technical Stack

- **Chrome Extension Manifest V3**
- **No framework** — vanilla JS, HTML, CSS
- **Storage**: `chrome.storage.local`
- **APIs**: `chrome.alarms`, `chrome.notifications`, `chrome.declarativeNetRequest`, `chrome.tabs`, `chrome.windows`, `chrome.idle`, `chrome.runtime`
- **Testing**: Jest + jsdom for unit tests, with chrome API mocks
