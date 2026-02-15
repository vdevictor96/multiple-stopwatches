# Multiple Stopwatches

Find the deployed website [here](https://eberleant.github.io/multiple-stopwatches/).

## Summary

This tool allows you to create, name, and run multiple stopwatches at the same time. It includes persistent state (names, elapsed times, and visual order) plus a sidebar summary panel with per-stopwatch totals and an overall total.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)

### Install dependencies

```bash
npm install
```

### Run locally

Starts a static server on `http://localhost:3000`:

```bash
npm start
```

### Run locally with live-reload (dev mode)

Starts a dev server that **watches for file changes** and automatically reloads the browser — useful when developing:

```bash
npm run dev
```

This watches all `.html`, `.css`, and `.js` files and refreshes the browser on every save.

## Tests

Test scripts and test artifacts are stored in `tests/`.

Example runs:

```bash
node tests/test-stopwatch.js
node tests/test-stopwatch-puppeteer.js
node tests/test-localstorage-persistence.js
```
