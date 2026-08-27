# TravelSmart Technical Spec

## Stack

Frontend:

- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Map rendering with Google Maps JavaScript API or Mapbox GL JS.

Backend:

- Convex database, queries, mutations, actions, and real-time subscriptions.
- Convex scheduled/internal functions for longer-running discovery and planning
  steps where needed.

AI and external services:

- OpenAI for structured extraction, itinerary explanations, and hotel-area
  reasoning.
- Firecrawl for attraction and ticketing page discovery/extraction.
- Google Maps Platform for geocoding, routing, transit, route matrices, places,
  and map geometry.
- AgentMail for emailing saved itineraries and reminders.

## System Responsibilities

Frontend:

- Capture trip setup inputs.
- Show discovery progress.
- Render attraction list, detail panel, ratings, and map.
- Render itinerary tabs, timeline, map route layers, and save/replan controls.
- Subscribe to Convex for live updates.

Convex:

- Store trips, attractions, ratings, discovery sources, plans, route legs,
  restaurants, hotel recommendations, and email events.
- Run server-side actions that call OpenAI, Firecrawl, Google Maps, and
  AgentMail.
- Cache route and place lookups to control cost.
- Provide authorization boundaries once auth is added.

OpenAI:

- Convert crawled/search results into normalized attractions.
- Infer recommended visit duration and practical notes.
- Summarize attraction details from sources.
- Explain itinerary choices and fallback transportation decisions.
- Generate hotel-area recommendation text from structured route facts.

Firecrawl:

- Crawl official destination/tourism pages.
- Crawl attraction official pages and ticket pages.
- Return markdown/html content for extraction.

Google Maps Platform:

- Geocode destination and place names.
- Fetch route matrix estimates for candidate scoring.
- Fetch final route legs with geometry.
- Provide transit details where available.
- Optionally provide place photos and opening hours.

AgentMail:

- Send saved itinerary emails.
- Optional: send daily plan summaries and booking reminders.

## External API Policy

All external API calls must happen server-side from Convex actions or trusted
server code. API keys must not be exposed to the browser.

Required environment variables:

- `OPENAI_API_KEY`
- `FIRECRAWL_API_KEY`
- `GOOGLE_MAPS_API_KEY`
- `AGENTMAIL_API_KEY`
- `AGENTMAIL_FROM`

Optional environment variables:

- `MAPBOX_TOKEN`, if Mapbox is chosen for visual map rendering.
- `GOOGLE_MAP_ID`, if using styled Google maps.

## Data Model

### users

Auth-backed user profile.

Fields:

- `name`
- `email`
- `createdAt`

MVP note:

- If auth is deferred, use anonymous session IDs first and migrate later.

### trips

Trip setup and current state.

Fields:

- `ownerId`
- `title`
- `destinationName`
- `destinationPlaceId`
- `destinationLat`
- `destinationLng`
- `startDate`
- `endDate`
- `hasRentalCar`
- `pace`
- `mealPreferences`
- `status`: `draft`, `discovering`, `readyToRate`, `planning`, `planned`,
  `saved`, `error`
- `createdAt`
- `updatedAt`

Indexes:

- by owner and updated time.
- by status for background task monitoring.

### discoveryRuns

Records each discovery attempt.

Fields:

- `tripId`
- `status`
- `startedAt`
- `finishedAt`
- `query`
- `providerStats`
- `error`

### attractions

Normalized attraction candidates.

Fields:

- `tripId`
- `name`
- `category`
- `description`
- `practicalNotes`
- `lat`
- `lng`
- `placeId`
- `address`
- `officialUrl`
- `ticketUrl`
- `sourceUrls`
- `photoUrls`
- `openingHoursByDate`
- `costSummary`
- `estimatedVisitMinutes`
- `requiresTicket`
- `confidence`
- `createdAt`
- `updatedAt`

Indexes:

- by trip.
- by trip and category.

### attractionRatings

User rating per attraction.

Fields:

- `tripId`
- `attractionId`
- `userId`
- `rating`
- `updatedAt`

Indexes:

- by trip.
- by trip and attraction.

### routeCache

Cached routing calls to reduce API cost.

Fields:

- `originKey`
- `destinationKey`
- `mode`
- `date`
- `departureTime`
- `provider`
- `requestHash`
- `durationMinutes`
- `distanceMeters`
- `polyline`
- `transitTransfers`
- `transitLineNames`
- `rawSummary`
- `expiresAt`

Indexes:

- by request hash.
- by expiration.

### plans

Generated or saved itinerary version.

Fields:

- `tripId`
- `ownerId`
- `name`
- `status`: `draft`, `generated`, `saved`, `archived`
- `plannerVersion`
- `score`
- `summary`
- `createdAt`
- `updatedAt`
- `savedAt`

Indexes:

- by trip.
- by owner and saved time.

### planDays

One day within a plan.

Fields:

- `planId`
- `tripId`
- `date`
- `dayIndex`
- `transportPolicy`: `walkTransitRideshare` or `carOnly`
- `summary`
- `score`

Indexes:

- by plan and day index.

### planItems

Stops and meals in a day.

Fields:

- `planDayId`
- `type`: `attraction`, `lunch`, `dinner`, `break`
- `attractionId`
- `restaurantId`
- `name`
- `startTime`
- `endTime`
- `durationMinutes`
- `notes`
- `bookingUrl`
- `lat`
- `lng`
- `sortOrder`

Indexes:

- by plan day and sort order.

### routeLegs

Transport legs between plan items.

Fields:

- `planDayId`
- `fromItemId`
- `toItemId`
- `mode`: `walk`, `transit`, `rideshare`, `car`
- `durationMinutes`
- `distanceMeters`
- `polyline`
- `instructionsSummary`
- `transitLineNames`
- `transferCount`
- `fallbackReason`
- `sortOrder`

Indexes:

- by plan day and sort order.

### restaurants

Meal candidates.

Fields:

- `tripId`
- `name`
- `cuisine`
- `lat`
- `lng`
- `placeId`
- `address`
- `photoUrls`
- `priceLevel`
- `rating`
- `openingHoursByDate`
- `bookingUrl`
- `sourceUrls`
- `confidence`

Indexes:

- by trip.
- by trip and cuisine.

### hotelRecommendations

Post-save hotel-area recommendation.

Fields:

- `tripId`
- `planId`
- `areaName`
- `centerLat`
- `centerLng`
- `summary`
- `safetyNotes`
- `transportNotes`
- `nearbyTransitHubs`
- `searchUrl`
- `score`
- `createdAt`

Indexes:

- by trip.
- by plan.

### outboundEmails

AgentMail history.

Fields:

- `tripId`
- `planId`
- `to`
- `subject`
- `status`
- `providerMessageId`
- `sentAt`
- `error`

## Convex API Shape

Queries:

- `trips:listSaved`
- `trips:get`
- `attractions:listForTrip`
- `ratings:listForTrip`
- `plans:getCurrent`
- `plans:listSaved`
- `hotelRecommendations:getForPlan`

Mutations:

- `trips:create`
- `trips:updateSetup`
- `ratings:set`
- `plans:save`
- `plans:rename`
- `plans:archive`

Actions:

- `discovery:start`
- `planning:generate`
- `planning:regenerate`
- `hotelRecommendations:generate`
- `email:sendSavedPlan`

Internal functions:

- Normalize discovery results.
- Upsert attractions/restaurants.
- Cache route responses.
- Persist generated plan graph.

## Discovery Pipeline

Input:

- Destination.
- Date range.
- Meal preferences.

Steps:

1. Geocode destination.
2. Generate discovery queries for top attractions, official tourism pages, and
   ticketed experiences.
3. Use Firecrawl to crawl relevant pages.
4. Use OpenAI structured outputs to extract candidate attractions.
5. Enrich candidates with Google Places where practical.
6. Deduplicate by place ID, name/address similarity, and coordinates.
7. Store attractions with source links and confidence.
8. Discover restaurant candidates near attraction clusters and likely meal
   windows.

Deduping rules:

- Same Google place ID means same attraction.
- Otherwise, merge if name similarity is high and coordinates are within 100
  meters.
- Keep all useful source URLs.

Quality gates:

- Candidate must have name and location.
- Opening hours can be unknown, but the planner should penalize unknown hours.
- Ticket links should prefer official or reputable ticketing pages.

## Planning Pipeline

Input:

- Trip.
- Attractions.
- Ratings.
- Restaurants.
- Cached or fresh route data.

Output:

- Plan.
- Plan days.
- Plan items.
- Route legs.
- Excluded attractions.
- Planner explanation.

Planner details are specified in
[itinerary-planner-spec.md](itinerary-planner-spec.md).

## Map Rendering

Map objects:

- Attraction pins.
- Restaurant pins.
- Hotel-area recommendation marker.
- Route polylines.
- Date-specific visible layers.
- Gray excluded pins.

Color tokens:

- Walking: green.
- Transit: blue.
- Rideshare: purple.
- Car: orange.
- Excluded: neutral gray.

Interactions:

- Click pin to open detail panel.
- Click route leg to show transport details.
- Date tab filters visible route and active pins.
- Hover timeline item highlights matching map pin/route segment.

## Cost Controls

- Cache all route calls.
- Batch route matrix requests.
- Cap discovery candidates for first version.
- Avoid recomputing routes when only low-impact ratings change.
- Store source extraction results by URL hash.
- Use provider quotas and budget alerts.

Initial caps:

- 24 attractions per trip.
- 40 restaurants per trip.
- 4 trip days for demo path.
- 100 route matrix elements per request.

## Security And Privacy

- API keys remain server-side.
- Source URLs are safe to expose; raw provider payloads should stay server-side
  unless needed for debugging.
- User trips are private to the owner once auth is enabled.
- Saved-plan email requires explicit user action.
- Do not store sensitive payment or booking credentials.

## Observability

Each long-running task should record:

- Status.
- Started/finished timestamps.
- Provider call counts.
- Error message.
- Retry count.
- Human-readable progress label.

The frontend should show live discovery/planning progress from Convex.

## Failure Behavior

Discovery failure:

- Show partial results if at least five attractions were saved.
- Allow retry.

Transit failure:

- Fall back to rideshare unless rental-car-only mode applies.
- Add a visible note to the route leg.

Opening hours unavailable:

- Penalize but do not automatically exclude.
- Show "hours not verified" in the detail panel.

Planning failure:

- Save debug summary to the planning run.
- Keep ratings and discovered attractions intact.
- Allow `Plan Again`.
