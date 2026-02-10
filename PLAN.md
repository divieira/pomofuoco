# Pomofuoco — Implementation Plan

## Phase 1: Skeleton & Foundation
- [ ] `manifest.json` (MV3, all required permissions)
- [ ] File structure (popup/, board/, blocked/, icons/)
- [ ] Shared CSS (variables, theme, reset)
- [ ] `background.js` service worker shell
- [ ] `CLAUDE.md` with project conventions
- [ ] Jest + chrome mock setup
- [ ] Lint setup (ESLint)

## Phase 2: Timer Core
- [ ] Timer state machine in background.js (idle → running → completed)
- [ ] `chrome.alarms` integration for countdown
- [ ] Timer state persistence in `chrome.storage.local`
- [ ] Start Focus / Short Break / Long Break message handlers
- [ ] Stop (interrupt) handler
- [ ] Cycle tracking (1-4 focus sessions)
- [ ] `chrome.idle` screen lock detection → auto-stop
- [ ] `chrome.notifications` with ding sound on alarm
- [ ] Timer keeps running past alarm (blocking stays active)
- [ ] Unit tests for timer state machine

## Phase 3: Popup Timer UI
- [ ] `popup.html` / `popup.css` / `popup.js`
- [ ] Timer display (mm:ss, progress bar, cycle indicator)
- [ ] Start Focus / Short Break / Long Break buttons
- [ ] Stop button (when running)
- [ ] Show current Doing task name
- [ ] "Open Board" link to full page
- [ ] Syncs with background via `chrome.runtime.sendMessage`

## Phase 4: Full Page — Kanban Board
- [ ] `board/board.html` / `board.css` / `board.js`
- [ ] Timer bar at top (mirrors popup functionality)
- [ ] Three columns: To-Do, Doing, Done
- [ ] Task cards with tag pill, colored left border
- [ ] Quick entry: empty card in To-Do, type + Enter
- [ ] Drag & drop (HTML5 drag API) within and between columns
- [ ] Arrow buttons (→ / ← ) and clear (✕) / check (✓) buttons
- [ ] Only 1 task in Doing (auto-move previous back to To-Do)
- [ ] "Clear completed" button on Done column
- [ ] Persist tasks to `chrome.storage.local`
- [ ] Tab navigation: Board | Weekly | Monthly
- [ ] Tests for task CRUD and state transitions

## Phase 5: Tag System & Settings
- [ ] Tag extraction from `#word` in title
- [ ] Auto-assign pastel colors to new tags
- [ ] Settings modal (gear icon)
- [ ] Blocked domains list (add/remove)
- [ ] Tag rename + color picker
- [ ] Persist settings to `chrome.storage.local`
- [ ] Apply tag colors to cards
- [ ] Tests for tag extraction and settings

## Phase 6: Tab Blocking
- [ ] `chrome.declarativeNetRequest` rules for blocked domains during focus
- [ ] `blocked/blocked.html` interstitial page
- [ ] Redirect existing tabs on blocked domains when focus starts
- [ ] Store original URLs, restore when focus ends
- [ ] Block notifications from blocked domains
- [ ] Tests for blocking logic

## Phase 7: Activity Tracking
- [ ] TaskTimeEntry: create when task enters Doing during focus, close on exit
- [ ] Listen for task column changes during active focus session
- [ ] DomainVisit: track active tab domain during breaks
- [ ] Chrome focus detection (`chrome.windows.onFocusChanged`)
- [ ] Tab activation detection (`chrome.tabs.onActivated`, `onUpdated`)
- [ ] Persist entries to storage
- [ ] Tests for tracking logic

## Phase 8: Dashboard — Current Panel
- [ ] Stats panel below kanban on Board tab
- [ ] Today's sessions (count + time per type)
- [ ] Today's tags (count + time)
- [ ] Today's domains (count + time)
- [ ] Streak calculation (consecutive days with focus sessions)
- [ ] Tests for stat calculations

## Phase 9: Dashboard — Weekly View
- [ ] Calendar/planner layout (7 columns, Mon-Sun)
- [ ] Arrow navigation between weeks
- [ ] Time axis: floor(min start) to ceil(max end)
- [ ] Session blocks with task/domain segments inside
- [ ] Weekly totals: tags, session types, domains
- [ ] Tests for week boundary calculation

## Phase 10: Dashboard — Monthly View
- [ ] Arrow navigation between months
- [ ] Tag groups (collapsible): count + total time
- [ ] Expanded: completed tasks with dates and working time
- [ ] Inline edit task title + tag on click → re-sort + recompute
- [ ] Monthly totals: tags, sessions, domains
- [ ] Tests for monthly aggregation

## Phase 11: Polish
- [ ] Extension icons (16, 48, 128)
- [ ] Timer badge on extension icon
- [ ] Animations (drag, transitions)
- [ ] Edge cases (empty states, long titles, many tasks)
- [ ] Cross-browser testing
