# Pomofuoco

A Chrome extension combining a Pomodoro timer, Kanban task board, domain-blocking focus mode, and productivity dashboards with time tracking and reporting.

## Features

- **Pomodoro Timer**: 25m focus / 5m short break / 15m long break, manual transitions, keeps running past alarm
- **Kanban Board**: To-Do / Doing / Done columns with drag-and-drop, quick entry, tag support
- **Focus Mode**: Blocks configurable domains during focus sessions, redirects to interstitial page
- **Activity Tracking**: Tracks task working time during focus, domain visits during breaks
- **Dashboards**: Current day stats, weekly calendar/planner view, monthly report by tag
- **Tag System**: #tag extraction, customizable colors and display names, time reporting

## Install

1. Clone/download this repo
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode"
4. Click "Load unpacked" and select this directory

## Development

```bash
npm install
npm test           # Run all tests (Jest)
npm run lint       # Run ESLint
npm run test:coverage  # Tests with coverage report
```

## Structure

See [CLAUDE.md](CLAUDE.md) for project conventions and [SPEC.md](SPEC.md) for full specification.
