# Outliners · World Cup 2026 Analytics

[English](README.md) · [简体中文](README.zh-CN.md)

## Contact

Want to collaborate or build something? Contact me.

**Telegram:** [t.me/soladity](https://t.me/soladity)

**Live demo:** [worldcup2026-prediction-market.vercel.app](https://worldcup2026-prediction-market.vercel.app/) · English (default) · Spanish [`/es`](https://worldcup2026-prediction-market.vercel.app/es)

---

Monte Carlo simulator and interactive analytics for the **FIFA World Cup 2026** — ELO + Poisson engine, injury-adjusted squads, prediction-market demo, and bookmaker edge analysis.

![FIFA World Cup 2026 Analytics](public/banner.png)

> *Inspired by [I Simulated the World Cup, and the US won*](https://www.youtube.com/watch?v=w5NK7bPjQkw) — same core idea, extended with absences, penalties, markets demo, and historical backtests.*

**Live app:** [worldcup2026-prediction-market.vercel.app](https://worldcup2026-prediction-market.vercel.app/)  
**Run locally:** `npm run dev` → [http://localhost:3000](http://localhost:3000)  
**Languages:** English (default) · Spanish (`/es`) · [中文说明](README.zh-CN.md)

---

## Features

### Simulator (home page)

- **Monte Carlo engine** — run **1K / 10K / 50K / 100K** full tournaments in the browser via **Web Worker** (~15–25K sims/sec).
- **Dual simulation pass** — every run computes probabilities **with** and **without** squad absences (injuries/suspensions), so you can compare the impact on champion odds.
- **Rich dashboard** after each run:
  - **Prediction delta** — how absences shift top-team probabilities
  - **Champion probabilities** with Wilson 95% confidence intervals and with/without toggle
  - **Stage matrix** — reach R32 / R16 / QF / SF / Final / win %
  - **Group standings** — expected finish distribution per team
  - **Bracket tree** — most likely knockout path
  - **Match calendar** — 104 fixtures with modal W/D/L and score distributions (click a row for detail)
  - **Tournament & goal stats**, **surprise teams**, **market edge vs Polymarket/Kalshi**
- **Team & match drawers** — ELO, absences, stage probabilities, score heatmaps, scorers
- **Sticky section nav**, confetti on sim completion, hero image gallery
- **Mobile responsive** — hamburger nav, scroll-friendly tables, stacked demo layouts

### Prediction markets demo (`/demo`)

Play-money sandbox that **reuses the home-page simulation** — no second run when you open the demo.

| Tab | What you can do |
|-----|-----------------|
| **Markets** | Buy/sell **YES/NO** on winner, group winner, and head-to-head markets priced from sim probabilities |
| **Tickets** | Synthetic **secondary-market listings** with face / fair / ask pricing |
| **Portfolio** | Cash, open positions, ticket holdings, settlement history |

- **$1,000 play-money wallet** (persisted in `localStorage`)
- **Settle markets** against a random sampled tournament outcome from your sim
- **Confetti** on successful YES/NO trades
- Filters: all · winner · groups · matches

### Backtest (`/backtest`)

Historical validation on **World Cups 2014, 2018, 2022** — calibration buckets, home-bonus sweep, recent-form blend, and penalty-shootout model evaluation.

### Methodology (`/methodology`)

Full write-up of ELO expectancy, Poisson goals, knockout penalties (Bayesian shrinkage on 103 historical shoot-outs), Monte Carlo aggregation, Wilson CIs, and known limitations.

### UI highlights

- Hero: **“Who will win the 2026 World Cup?”** with live sim controls
- Header **developer contact card** (Dexoryn · Telegram · Discord · X) on every page
- Footer credits + **Made by Dexorynlabs** with social links

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 · React 19 · TypeScript |
| Styling | Tailwind CSS v4 (OKLCH palette, Outliners brand teal) |
| i18n | next-intl (EN / ES) |
| Animation | GSAP · canvas-confetti |
| Charts / viz | D3 |
| State | Zustand (selection drawers) |
| Engine | Pure TypeScript · xoshiro128\*\* PRNG · Web Worker |

**Performance:** ~35K sims/sec in Node; ~15–25K in browser worker. 100K dual-pass run typically **~5–10 s** depending on device.

**Data:** official FIFA 2026 draw (5 Dec 2025) · ELO from [eloratings.net](https://www.eloratings.net/) · optional live odds via `/api/odds`

---

## Quick start

```bash
npm install --legacy-peer-deps
npm run dev          # http://localhost:3000
npm run build        # production build
npm test             # vitest
```

### Data refresh scripts

```bash
npm run scrape-elo       # refresh national-team ELO
npm run fetch-odds       # Polymarket / Kalshi winner odds
npm run fetch-absences   # squad absences (injuries, suspensions)
npm run fetch-backtest   # historical WC match data for backtest
npm run fetch-results    # live results (ESPN)
npm run fetch-cards      # card accumulation data
```

---

## Model (short)

### ELO win expectancy

```
We = 1 / (10^(-dr/400) + 1)
dr = ELO_A − ELO_B + home_bonus   (+100 for host nations in group stage)
```

### Goals (independent Poisson)

```
λ_team = clamp(1.30 + 0.18 · (ELO_team − ELO_opp + home_bonus) / 100,  0.15,  6.0)
goals ~ Poisson(λ_team)
```

### Knockout ties

Regulation draw → **penalty shoot-out** modeled with Bayesian shrinkage on historical PK rates (not a coin flip). Penalty goals are excluded from goal aggregates.

### Absences

Key players out (injury/suspension) apply an ELO penalty per squad before each tournament draw. The worker runs a **counterfactual pass** with absences disabled for comparison.

### Sanity checks

- Champion probabilities sum to **100%** (exact over N sims)
- Average goals per match ≈ **2.6** (in line with WC history 2.5–2.7)
- Top contenders align with ELO / bookmaker consensus (Spain, Argentina, France, Brazil, Portugal)

See `/methodology` in the app for the full spec.

---

## Project structure

```
src/
├── app/[locale]/           App Router pages
│   ├── page.tsx            Home · simulator + dashboard
│   ├── demo/               Prediction markets & ticket demo
│   ├── backtest/           Historical model validation
│   ├── methodology/        Model documentation
│   └── api/odds/           Live market odds endpoint
├── components/
│   ├── demo/               DemoHub · MarketsTab · TicketsTab · PortfolioTab
│   ├── hero/               HeroGallery · HeroDemoPromo · MeshGradient
│   ├── layout/             Header · HeaderProfile · Footer · SectionNav
│   └── …                   Dashboard widgets + drawers
├── hooks/
│   ├── useSimulation.ts    Shared Web Worker + sim state (survives navigation)
│   └── useDemoWallet.ts    Play-money wallet (localStorage)
├── i18n/messages/          es.json · en.json
├── lib/
│   ├── sim/                engine · tournament · group · knockout · absences · worker
│   ├── demo/               markets · tickets · cache · flags
│   ├── social.ts           Telegram, Discord & X URLs (header + footer)
│   └── confetti.ts         Shared celebration effect
├── data/                   teams.json · groups.json · bracket.json · absences · odds
└── scripts/                ELO scrape · odds fetch · backtest data · eval sweeps

public/
├── banner.png              README banner
├── worldcup1.jpg           Hero trophy image
├── Dexoryn.png             Developer avatar (header contact card)
├── logo-worldcup2026.webp
└── …                       Gallery & brand assets
```

---

## Routes

**Production base:** [https://worldcup2026-prediction-market.vercel.app](https://worldcup2026-prediction-market.vercel.app)

| Path | Description | Live |
|------|-------------|------|
| `/` | Simulate → dashboard (EN) | [Open](https://worldcup2026-prediction-market.vercel.app/) |
| `/es` | Home (ES) | [Open](https://worldcup2026-prediction-market.vercel.app/es) |
| `/demo` | Play-money markets & tickets | [Open](https://worldcup2026-prediction-market.vercel.app/demo) |
| `/backtest` | 2014 / 2018 / 2022 validation | [Open](https://worldcup2026-prediction-market.vercel.app/backtest) |
| `/methodology` | Model docs | [Open](https://worldcup2026-prediction-market.vercel.app/methodology) |
| `/es/…` | Spanish locale prefix | e.g. [/es/demo](https://worldcup2026-prediction-market.vercel.app/es/demo) |

---

## Credits & contact

Want to collaborate or build something? Contact me.

**Telegram:** [t.me/soladity](https://t.me/soladity)

**Data & references**  
ELO ratings — [eloratings.net](https://www.eloratings.net/)  
Official draw — [FIFA World Cup 2026](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026)  
Reference methodology — [Luke Benz — World Cup simulation](https://www.youtube.com/watch?v=w5NK7bPjQkw)  
Flags — [circle-flags](https://hatscripts.github.io/circle-flags/) (MIT)

---

## License

Private / all rights reserved unless otherwise noted in repository settings.
