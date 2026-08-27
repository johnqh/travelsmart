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

## 2026-08-27 Phase 2

- Added planned itinerary tables for generated plans, per-date days, timeline
  items, and route legs.
- Implemented the first deterministic planner as a local heuristic so ratings,
  geography, meals, car mode, and no-transfer transit behavior can be exercised
  before external Google routing is wired.
- Wired the UI with a `Plan` / `Plan Again` button, date tabs, route timeline,
  meal stops, colored transport legs, and gray pins for attractions excluded by
  the day-window cap or user ratings.
- Smoke-tested plan generation against a Tokyo demo trip. The current planner
  generated three days, included 10 of 12 rated attractions, inserted lunch and
  dinner each day, and exposed two skipped attractions for gray map pins.

## 2026-08-27 Phase 3

- Added saved-plan persistence by marking generated plans and trips as `saved`
  without deleting older saved plans when the user later clicks `Plan Again`.
- Added hotel-area recommendation storage and a first heuristic that recommends
  a Tokyo base from the first and last attraction stops across all planned days.
- Added an AgentMail-ready Convex action for sending saved itineraries, with
  queued/sent/skipped/error email records stored in Convex.
- Wired the UI with Save/Saved state, a `Stay & Share` panel, hotel search link,
  nearby transit hub chips, email form, and recent email activity.
- Fixed Convex return validation for outbound email history by returning an
  explicit public shape instead of raw documents with `sessionId`.
- Smoke-tested `plans:savePlan`, `plans:getHotelRecommendation`, and
  `email:sendSavedPlan`. Local email sending records `skipped` until
  `AGENTMAIL_API_KEY` and `AGENTMAIL_INBOX_ID` are configured.
- Verification: `npm run typecheck`, `npm run lint`, `npm run build`, and
  `curl -I http://localhost:50665` all completed successfully. Lint currently
  reports only known `<img>` optimization warnings and the starter
  `app/error.tsx` unused `_error` warning.
