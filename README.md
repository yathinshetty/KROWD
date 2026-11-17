# KROWD — City Intelligence & Map Discovery for Karnataka

KROWD is a mobile-first spatial city intelligence and place discovery application covering **189 verified locations** across Karnataka—spanning Bengaluru, Mysuru, Mangaluru, Udupi, Coorg, Chikkamagaluru, Hassan, Tumakuru, Shivamogga, Davangere, Hubballi-Dharwad, Belagavi, Hampi, Vijayapura, Kalaburagi, and Bidar.

It pairs an interactive map-first interface with live **Open-Meteo** weather telemetry, viewport-scoped **TomTom Live Traffic Flow** speeds, IST time-of-day crowd intelligence, and anonymous 90-minute community crowd reports.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 8
- **Styling & Motion:** Tailwind CSS v4 (`@tailwindcss/vite`), Motion (`motion/react`)
- **Mapping & Data Visualization:** MapLibre GL JS, Recharts, Lucide React
- **Backend & API Proxy:** Express (`server.ts`, served via `tsx` in development)
- **Live Intelligence APIs:**
  - **Open-Meteo Forecast API** (live temperature, rain probability, humidity, UV, visibility, hourly & 7-day forecasts)
  - **TomTom Traffic Flow Segment API** (live road speeds vs. free-flow speeds, delay minutes, and congestion levels)
- **PWA Support:** `vite-plugin-pwa` with offline awareness and install prompt

---

## Design System & Aesthetics

KROWD uses an Apple Maps-inspired spatial layout styled with a crisp **Neo-Mint & Obsidian** palette:

| Token | Hex | Role |
| :--- | :--- | :--- |
| Neo-Mint Canvas | `#E6F4D7` | Primary app canvas and map framing |
| Soft Mint Surface | `#F2FAE8` | Secondary hover and subtle tinted pills |
| Card Surface | `#FFFFFF` | Elevated cards, popovers, and bottom sheet |
| Obsidian Ink | `#121814` | High-contrast dark intelligence cards & active pills |
| Primary Text | `#1A211C` | Headings and primary UI copy |
| Muted Sage Text | `#627065` | Metadata, timestamps, and secondary labels |
| Electric Lime Accent | `#84CC16` / `#A3E635` | Primary action buttons, active highlights, GPS indicator |
| Sage Border | `#D1E7BD` | Crisp hairline borders on cards and controls |
| Crowd Semantic Colors | `#4ADE80` / `#FACC15` / `#F87171` / `#EF4444` | Low, Moderate, High, and Very High crowd states |

- **Typography:** `Plus Jakarta Sans` for display headings (`font-display`) paired with clean system sans UI typography (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`) and `tabular-nums` for live telemetry.
- **60fps Micro-Interactions:** Kept-alive tab views with `180ms` GPU-accelerated opacity/transform cross-fades (`cubic-bezier(0.22, 1, 0.36, 1)`), zero-tap-delay global rules (`touch-action: manipulation`), `-webkit-overflow-scrolling: touch`, `150ms` tactile `active:scale-[0.97]` press feedback, and a sliding floating bottom navigation bar.
- **Responsive Mobile-First Views:** Mobile 3-state expandable bottom sheet (`collapsed`, `half`, `expanded`) and floating glass bottom navigation pill (`Explore`, `Nearby`, `Insights`), transitioning cleanly to a desktop discovery rail and right-side location intelligence drawer.

---

## Core Features

### 1. Transport vs. Visiting Data Architecture
- **Visiting Destinations (`137` places):** Curated temples, malls, parks, tourist landmarks, restaurants, markets, and event venues rendered as the primary discovery layer.
- **Transport Hubs (`52` places):** Metro stations, KSRTC/BMTC terminals, railway junctions, BRTS corridors, and airports excluded from default sightseeing clutter and surfaced automatically when searching transit keywords or filtering by the **Transport** category.

### 2. Curved Sort & Distance Range Slider Filtering
- In the **Nearby** view, a curved pill **`Sort:`** dropdown animates smoothly (`160ms` scale-and-fade) with five ranking modes:
  - *Nearest*
  - *Nearby & less crowded*
  - *Least crowded*
  - *Most popular*
  - *Best weather conditions*
- Integrated horizontal distance range slider (`2 km` – `100 km`, plus `Any`) filters nearby places in real time via Haversine distance calculations.

### 3. Direct Google Maps Turn-by-Turn Navigation Redirect
- Tapping **Get Directions** on any location detail sheet opens the official Google Maps Universal Navigation URL (`https://www.google.com/maps/dir/?api=1&destination=LAT,LON&travelmode=driving&dir_action=navigate`) in a new tab or native Google Maps app so users can tap **Start** immediately.

### 4. Dynamic City-Aware Insights & Real-Time Crowd Metrics
- **GPS-Aware City Insights:** Automatically resolves the user's nearest Karnataka hub (e.g., Bengaluru, Mysuru, Mangaluru, Coorg, Hubballi, Udupi) to localize the **Insights** header, live weather card, corridor traffic status, hourly crowd rhythm chart, notable activity spikes, and regional busy vs. less crowded lists while displaying the full directory count badge (`189 places`).
- **Live + Community Crowd Engine:** Combines IST category curves, live TomTom road congestion, Open-Meteo rain adjustments, and anonymous visitor reports persisted over a 90-minute rolling window.

---

## Getting Started

### Prerequisites
- Node.js 20+ (or compatible runtime with `npm` / `tsx`)

### Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and add optional API keys as needed:
   ```bash
   cp .env.example .env
   ```
   - `VITE_TOMTOM_API_KEY`: TomTom Traffic Flow Segment API key for live road speeds.
   - `PORT`: Server port (defaults to `3000`).

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The Express + Vite middleware server listens on `http://localhost:3000`.

4. **Typecheck & Production Build:**
   ```bash
   npm run lint
   npm run build
   ```

---

## Project Structure

```text
├── server.ts                        # Express API server (/api/places, /api/insights, /api/weather, /api/reports)
├── server/
│   ├── data/bengaluruPlaces.ts      # 189 Karnataka places dataset (visiting & transport hubs)
│   └── services/                    # Server-side crowd engine, traffic, weather, and report store
├── src/
│   ├── App.tsx                      # Root shell, mounted tab panels, desktop & mobile navigation
│   ├── index.css                    # Tailwind v4 theme tokens, scrollbars, and GPU transition utilities
│   ├── components/
│   │   ├── common/                  # SortDropdown, CategoryIcon, PlacePhoto, CrowdIndicator, Logo
│   │   ├── discover/                # DiscoverDrawer and PlaceCard
│   │   ├── map/                     # MapLibre GL BengaluruMap with custom neo-mint theme
│   │   ├── place/                   # MobileBottomSheet, LocationDetailsContent, CrowdPredictionSection, ReportCrowdModal
│   │   └── search/                  # SearchBar with recent searches and category quick-picks
│   ├── hooks/                       # useGeolocation and useRecentSearches
│   ├── pages/                       # NearbyPage and city-aware InsightsPage
│   ├── services/                    # Client API client and live TomTom/Open-Meteo signal orchestrator
│   ├── types/                       # TypeScript domain contracts (krowd.ts)
│   └── utils/                       # Styling helpers, Google Maps URL builder, and Karnataka city hub resolver
└── .env.example                     # Environment variable template
```
