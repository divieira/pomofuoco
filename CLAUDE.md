# Pomofuoco — Claude Code Guide

## Project Overview
Chrome extension (Manifest V3) — Pomodoro timer + Kanban board + Focus mode + Dashboards.

## Commands
- **Lint**: `npx eslint .`
- **Test**: `npx jest`
- **Test single file**: `npx jest path/to/file.test.js`
- **Test with coverage**: `npx jest --coverage`

## Project Structure
```
pomofuoco/
├── manifest.json           # MV3 extension manifest
├── background.js           # Service worker (timer, blocking, tracking)
├── popup/                  # Extension popup (timer quick-view)
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── board/                  # Full page (kanban + dashboards)
│   ├── board.html
│   ├── board.css
│   └── board.js
├── blocked/                # Focus-mode interstitial
│   ├── blocked.html
│   └── blocked.css
├── shared/                 # Shared modules
│   ├── theme.css           # CSS variables and reset
│   ├── storage.js          # Storage helpers
│   └── constants.js        # Shared constants
├── sounds/                 # Notification sounds
│   └── ding.mp3
├── icons/                  # Extension icons
├── tests/                  # Jest tests
│   ├── setup.js            # Chrome API mocks
│   └── *.test.js
├── SPEC.md
├── PLAN.md
└── CLAUDE.md
```

## Conventions
- **Vanilla JS** — no frameworks, no build step.
- **ES modules** where Chrome extension supports them, otherwise IIFE.
- **CSS variables** for theming in `shared/theme.css`.
- **Storage**: always use `chrome.storage.local` (not localStorage).
- **UUIDs**: use `crypto.randomUUID()`.
- **Timestamps**: ISO 8601 strings via `new Date().toISOString()`.
- **Lint before commit**: run `npx eslint .` and fix errors.
- **Test before commit**: run `npx jest` and ensure all pass.
- **Commit messages**: concise imperative ("Add timer core", "Fix tag extraction").

## Data Schema
See SPEC.md §8 for full schema. Key entities:
- **Task**: id, title, tag, column (todo/doing/done/cleared), order, createdAt, completedAt
- **Session**: id, type, startedAt, endedAt, status, cyclePosition
- **TaskTimeEntry**: id, taskId, sessionId, startedAt, endedAt
- **DomainVisit**: id, sessionId, domain, startedAt, endedAt
- **Settings**: blockedDomains[], tags { name → { displayName, color } }

## Chrome APIs Used
- `chrome.alarms` — timer countdown
- `chrome.notifications` — end-of-session alerts
- `chrome.declarativeNetRequest` — domain blocking
- `chrome.tabs` — tab management and domain tracking
- `chrome.windows` — focus detection
- `chrome.idle` — screen lock detection
- `chrome.storage.local` — all persistence
- `chrome.runtime` — message passing between popup/board/background

## Testing
- Jest with jsdom environment.
- Chrome API mocks in `tests/setup.js`.
- Test files colocated in `tests/` directory.
- Run full suite before every commit.
