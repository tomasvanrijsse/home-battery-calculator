# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Nuxt 3 application that visualizes household energy consumption and calculates optimal home battery size. Users upload CSV files containing 15-minute interval energy meter readings (import/export in T1/T2 tariffs), and the app:
- Aggregates data into daily import/export totals
- Displays an interactive Chart.js visualization
- Simulates battery savings by modeling charge/discharge cycles

Deployed as a static site to GitHub Pages at `/home-battery-calculator/` base path.

## Commands

**Development:**
```bash
npm run dev        # Start dev server
npm run build      # Build for production
npm run generate   # Generate static site (used for GitHub Pages)
npm run preview    # Preview production build
```

**Testing:**
```bash
npm test           # Run all Vitest tests
npx vitest         # Run tests in watch mode
```

## Architecture

**Framework:** Nuxt 3 with SSR disabled (`ssr: false` in nuxt.config.ts) — this is a client-side-only application.

**Directory structure:**
- `app/` — all application code
  - `app/app.vue` — root component with file upload UI and battery simulation controls
  - `app/components/EnergyChart.vue` — Chart.js bar chart component
  - `app/composables/useEnergyData.ts` — core business logic
- `tests/` — Vitest unit tests
- `.github/workflows/deploy.yml` — automated GitHub Pages deployment

**Key composable: `useEnergyData.ts`**

This is the application's core. It exports:
- `useEnergyData()` — main reactive composable managing file parsing, state, and battery simulation
- `computeDaily(rows)` — aggregates 15-minute CSV rows into daily totals by calculating cumulative meter reading deltas
- `simulateBattery(rows, capacityKwh)` — interval-by-interval battery charge/discharge simulation

The battery simulation algorithm:
1. Iterates through consecutive CSV rows
2. Calculates net grid flow per interval (import - export)
3. If net < 0 (surplus/exporting): charge battery up to capacity, track saved export
4. If net > 0 (deficit/importing): discharge battery up to available level, track saved import
5. Returns total kWh saved on both import and export

**CSV format expected:**
Columns: `time`, `Import T1 kWh`, `Import T2 kWh`, `Export T1 kWh`, `Export T2 kWh`
Values are cumulative meter readings. The app calculates intervals by subtracting consecutive rows.

**Auto-imports:**
Nuxt automatically imports Vue composables (`ref`, `computed`, `watch`) and components. The vitest.config.ts defines the `~` alias pointing to `app/` for test imports.

**Testing approach:**
Pure unit tests for `computeDaily` and `simulateBattery` functions in `tests/`. Tests use a `row()` helper to construct CSV row objects. No component or integration tests yet.

## Deployment

GitHub Actions workflow (`.github/workflows/deploy.yml`) runs on pushes to `main` and feature branch `claude/nuxt-energy-csv-viewer-WSi9K`. It:
1. Runs `npx nuxt generate` to create static files in `.output/public`
2. Deploys to GitHub Pages

The `baseURL: '/home-battery-calculator/'` in nuxt.config.ts ensures assets load correctly on GitHub Pages.