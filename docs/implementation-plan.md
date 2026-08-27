# TravelSmart Implementation Plan

## Objective

Build a demo-quality, public, Convex-backed travel itinerary app for the Convex
All Gas Hackathon. The first version should show the full loop: create trip,
discover attractions, rate places, generate a route-aware plan, save it, email
it, and recommend a hotel area.

## Build Strategy

Build in vertical slices:

1. Scaffold app and data model.
2. Implement trip creation and mock discovery.
3. Build the map/list/rating UI.
4. Replace mock discovery with Firecrawl/OpenAI/Google data.
5. Implement deterministic planner with cached routing.
6. Add saved plans, AgentMail email, and hotel recommendation.
7. Polish demo destination and deployment.

This avoids waiting for every external integration before the product is usable.

## Phase 0: Project Bootstrap

Tasks:

- Scaffold Next.js + Convex + shadcn project.
- Add environment variable documentation.
- Add `/hackathon` logging workflow.
- Configure lint/typecheck/build commands.
- Set up deployment target.

Deliverable:

- App runs locally.
- Convex dev environment is connected.
- Blank trip setup screen exists.

Verification:

- `bun run build` or project equivalent passes.
- Convex functions generate types.

## Phase 1: Core Data And Trip Setup

Tasks:

- Define Convex schema for trips, attractions, ratings, plans, plan days, plan
  items, route legs, restaurants, hotel recommendations, and outbound emails.
- Implement create/update trip mutations.
- Implement trip detail query.
- Build trip setup UI.

Deliverable:

- User can create a trip and view its setup state.

Verification:

- Trip creation persists in Convex.
- Frontend updates from Convex subscription.

## Phase 2: Mock Discovery And Rating UI

Tasks:

- Add seeded/mock attraction data for one demo destination.
- Render attraction list.
- Render map pins.
- Implement attraction detail drawer.
- Implement rating mutation and optimistic UI.

Deliverable:

- User can inspect and rate attractions before any external API is wired.

Verification:

- Rating changes persist.
- Selected list item highlights map pin.
- Selected map pin opens the same detail panel.

## Phase 3: Real Discovery

Tasks:

- Add Convex action for discovery.
- Geocode destination with Google.
- Use Firecrawl to gather destination and attraction source pages.
- Use OpenAI structured outputs to normalize attraction records.
- Enrich with Google Places data where useful.
- Deduplicate and upsert attractions.
- Add discovery progress states.

Deliverable:

- Supported city returns real attractions with location, description, photo,
  hours/cost when available, and source links.

Verification:

- Discovery run stores provider stats.
- At least 12 useful attractions are available for the demo city.
- Duplicate attractions are merged.
- UI handles partial/unknown fields cleanly.

## Phase 4: Planner MVP

Tasks:

- Implement route cache.
- Fetch walking/driving/transit route estimates.
- Implement mode selection rules.
- Implement attraction scoring.
- Implement day building and meal insertion.
- Persist plan graph.
- Render date tabs, timeline, colored route lines, and gray excluded pins.

Deliverable:

- User can generate a multi-day itinerary with transport-colored map routes.

Verification:

- Each date has a plan day.
- Route legs have mode, duration, distance, and geometry.
- Public transit legs have zero detected transfers.
- Excluded attractions remain selectable gray pins.
- Replanning after rating changes creates a visibly different plan when ratings
  justify it.

## Phase 5: Save, Email, And Hotel Area

Tasks:

- Implement save plan mutation.
- Implement saved plans list and reopen flow.
- Implement AgentMail saved-itinerary email action.
- Implement hotel-area recommendation action.
- Show hotel recommendation after save.

Deliverable:

- User can save a plan, reopen it, email it, and see where to stay.

Verification:

- Saved plan is immutable unless renamed/archived.
- Email send status is recorded.
- Hotel recommendation references actual route anchors.

## Phase 6: Polish And Demo Prep

Tasks:

- Pick one excellent demo destination.
- Add loading/progress states for discovery and planning.
- Add empty/error states.
- Tune map styling and route colors.
- Add plan score/reasoning snippets.
- Add mobile layout pass.
- Add source/confidence labels.
- Write final `hackathon.md`.
- Record video demo under three minutes.

Deliverable:

- Public app ready for hackathon submission.

Verification:

- Deployed URL works without localhost.
- Public GitHub repo is current.
- Demo flow completes from setup through saved plan.
- Video shows real product behavior.

## Suggested First Demo Destination

Primary pick:

- Tokyo.

Why:

- Strong public transit coverage.
- Many attractions and restaurants.
- Good availability of photos and official/tourism source pages.
- Route planning is visually interesting.

Fallbacks:

- Paris.
- New York.
- London.
- Singapore.

## Initial UI Layout

Desktop:

- Left sidebar: trip controls, attraction/itinerary list, ratings.
- Main area: full-height map.
- Right drawer: selected attraction/stop details.

Mobile:

- Map as primary view.
- Bottom sheet for list/timeline.
- Detail drawer as full-screen sheet.

Avoid:

- Landing-page hero.
- Decorative cards inside cards.
- Text-heavy instructions inside the UI.

## Engineering Priorities

High priority:

- Convex schema and clean data flow.
- Route caching.
- Deterministic planning rules.
- Useful map interactions.
- Clear partial-data handling.
- Real source links.

Medium priority:

- Auth.
- Plan duplication.
- Multiple demo destinations.
- Cuisine preference refinement.

Low priority:

- Direct booking integrations.
- Exact rideshare pricing.
- Collaborative editing.

## Risk Register

Transit data unavailable:

- Fallback to rideshare.
- Show note on leg.

Discovery too noisy:

- Limit sources.
- Improve extraction schema.
- Add confidence scoring.

API cost overruns:

- Cap candidates.
- Cache route calls.
- Use quota limits.

Planning feels arbitrary:

- Store and display concise reasons.
- Make rating changes visibly affect results.

Photos unavailable:

- Use provider place photos where allowed.
- Otherwise fall back to attractive map/list layout without fake images.

## Definition Of Done For MVP

- Trip setup works.
- Discovery works for one supported city.
- Rating works.
- Planner produces feasible date-tabbed plans.
- Route lines render with transportation colors.
- Meals are inserted.
- Save and reopen works.
- AgentMail sends itinerary.
- Hotel area recommendation appears after save.
- App deploys publicly.
- Repo contains final `hackathon.md`.
