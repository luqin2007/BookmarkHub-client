```
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
```

## Commands
- **Run the app**: Use a local server (e.g., Live Server) to serve `index.html` (no build step required).
- **Test**: Open `test.html` in a browser, load sample data, and run functional tests (no test framework—tests are manual via the test page).

## High-Level Architecture
- **Core Modules**:
  - `StorageManager` (js/storage.js): Manages IndexedDB local storage.
  - `GitHubManager` (js/github.js): Integrates with GitHub API to fetch/sync Gist data.
  - `BookmarkManager` (js/bookmarks.js): Handles bookmark CRUD and data logic.
  - `UIManager` (js/ui.js): Manages UI rendering and user interactions.
  - `App` (js/app.js): Main controller coordinating modules.
- **Data Flow**:
  1. User configures GitHub Token/Gist ID.
  2. Fetch bookmark data from GitHub Gist via `GitHubManager`.
  3. Store parsed data in IndexedDB via `StorageManager`.
  4. Render UI via `UIManager` using data from `BookmarkManager`.
  5. User actions trigger updates to `BookmarkManager`, which syncs to storage (and optionally back to Gist).

## Project Structure
Key files/folders (focus on high-level organization):
- `index.html`: Main application page.
- `styles.css`: Global styles.
- `js/`: Contains core modules (storage.js, github.js, bookmarks.js, ui.js, app.js).
- `test.html`: Functional test page for validating features.