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

## 2026-08-27 Phase 4

- Added typed Convex app env declarations for `GOOGLE_MAPS_API_KEY`,
  `FIRECRAWL_API_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`,
  `AGENTMAIL_API_KEY`, and `AGENTMAIL_INBOX_ID`.
- Added `.env.example` and replaced the scaffold app README with TravelSmart
  run/check/env instructions.
- Added `discoveryRuns` and a `discovering` trip state so discovery has a
  visible run record, provider stats, final status, and fallback reason.
- Added `discovery:discoverAttractions`, a Convex action that can call Google
  Places Text Search, Firecrawl Search, and OpenAI structured normalization
  when keys are configured.
- Provider references checked during implementation:
  - Google Places Text Search uses `POST
    https://places.googleapis.com/v1/places:searchText` with required field
    masks.
  - Firecrawl Search uses `POST https://api.firecrawl.dev/v2/search`.
  - OpenAI structured normalization uses Chat Completions `response_format`
    with `json_schema`.
  - Google Routes `computeRoutes` remains the next routing upgrade target.
- Refactored trip creation so the UI creates a draft trip, runs discovery, and
  then displays provider status chips. With no provider keys set locally, the
  action falls back to the Tokyo demo dataset instead of failing the product
  flow.
- Smoke-tested the new flow with trip `jh7b8z27am0zzpfjx1yranx4js8d864c`.
  Discovery recorded `google/firecrawl/openai: not configured`, loaded 12
  attractions and 4 restaurants, and the planner generated plan
  `k574s3wbhfneq1gbgm71qmbqw58d8ecy` from that discovered trip.
- Verification: `npm run typecheck`, `npm run lint`, `npm run build`, and
  `curl -I http://localhost:50665` all completed successfully. Lint warnings
  are still limited to known image optimization/starter warnings.

## 2026-08-27 Phase 5

- Added `routeEstimates`, a Convex route-cache table keyed by rounded origin,
  destination, and requested mode.
- Added `routing:refinePlanRoutes`, a post-planning Convex action that can call
  Google Routes `computeRoutes` for each generated route leg and patch the
  saved leg duration, distance, polyline, transit lines, and transfer count.
- Preserved the no-transfer transit rule: if Google returns a transit route
  with transfers, the action switches that leg to rideshare using a driving
  route fallback.
- Wired the Plan flow so `Plan` / `Plan Again` first creates the deterministic
  itinerary, then asks the route refinement action to improve route legs when
  Google routing is configured.
- Local smoke test against plan `k574s3wbhfneq1gbgm71qmbqw58d8ecy` returned the
  expected fallback message because `GOOGLE_MAPS_API_KEY` is not configured in
  the local Convex environment.
- Verification: `npm run typecheck`, `npm run lint`, and `npm run build`
  completed successfully. Lint warnings remain the known `<img>` and starter
  `_error` warnings.

## 2026-08-27 Phase 6

- Replaced remaining raw `<img>` elements with `next/image` in the main
  TravelSmart UI and the starter error boundary.
- Added remote image host configuration for `chef.convex.dev`,
  `images.unsplash.com`, and `places.googleapis.com`.
- Removed the unused error prop warning from `app/error.tsx`.
- Verification: `npm run typecheck`, `npm run lint`, `npm run build`, and
  `curl -I http://localhost:50665` completed successfully. Lint now exits with
  zero warnings.

## 2026-08-28 Continuation Checkpoint

- Fixed the hydration mismatch caused by reading browser `localStorage` and
  `crypto.randomUUID()` during the initial server render. Browser session and
  active-trip restoration now run after hydration.
- Replaced the temporary CSS/SVG map surface and iframe map layer with Leaflet
  and OpenStreetMap tiles. Attraction pins, meal markers, and route polylines
  now share geographic coordinates and pan/zoom together.
- Added Leaflet dependencies and imported the Leaflet stylesheet before the
  Tailwind layers so the production build succeeds.
- Added `docs/handoff.md` with the current architecture, restart commands,
  provider setup, completed commit history, verification commands, and
  prioritized TODOs.
- Latest commit: `97a63ce Synchronize map pins with map movement`, pushed to
  `origin/main`.
- Verification: `npm run typecheck`, `npm run lint`, `npm run build`, and
  `git diff --check` completed successfully.
- Current limitation: provider secrets are not configured in the local
  environment, so discovery, routing, and email use their documented fallback
  or skipped states. Public deployment and the final demo remain TODOs.
