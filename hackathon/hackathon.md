# TravelSmart Hackathon Build Log

## 2026-08-27

- Confirmed the app concept and saved the initial product, technical, planner,
  implementation, and hackathon specs.
- Researched routing providers and selected Google Maps Platform as the default
  routing provider for the first build because it has public transit support and
  clearer free monthly allowances than HERE.
- Bootstrapped a Next.js, shadcn/ui, and Convex app using the Convex quickstart
  tooling.
- Started the local app at `http://localhost:50665`.
- Decision: implement in committed phases, updating this build log before each
  phase commit.

## 2026-08-27 Phase 1

- Added the first real Convex schema for trips, attractions, anonymous ratings,
  and restaurant candidates.
- Added a Tokyo demo discovery mutation so the app can show source-backed
  attraction data before Firecrawl/OpenAI integrations are wired.
- Added rating mutation behavior designed to be idempotent on repeated rating
  changes instead of acting like a toggle.
- Added tiny quickstart watcher-compatible feature request/question functions so
  the local Convex logs stay useful while the app is developed.
- Next step: replace the placeholder shell with the map-first TravelSmart
  workspace.
