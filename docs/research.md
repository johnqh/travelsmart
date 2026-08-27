# TravelSmart Research Notes

Date: August 27, 2026

## Hackathon Requirements

Sources:

- Luma event: https://luma.com/convex-allgas-hackathon
- Convex hackathon page: https://www.convex.dev/hackathons/all-gas

Key requirements:

- Build a new full-stack app started on or after August 25, 2026.
- Use Convex as the backend for database, functions, and real-time sync.
- Use Codex or another agent/IDE with the Convex plugin.
- Maintain a `/hackathon` build log that produces `hackathon.md` in the repo.
- Deploy publicly to `convex.site` or `chatgpt.site`.
- Submit a public GitHub repo, a live app URL, and a short video demo on
  `vibeapps.dev`.
- No localhost-only submissions and no private repositories.
- Share the app publicly on X or LinkedIn and tag `@convex`, `@OpenAI`,
  `@firecrawl`, and `@agentmail`.
- Participants must be 18 or older.
- Teams may have up to four people.
- Only one team member needs to register.

Judging priorities:

- Everyday useful apps rather than developer tools.
- Meaningful Convex usage: queries, mutations, live updates, and auth/components
  where relevant.
- Meaningful use of OpenAI, Firecrawl, and AgentMail inside the product.
- Working public deployment.
- Social traction.
- Video demo under three minutes focused on the real product.

## App Concept

TravelSmart is a map-first itinerary planner:

- Input: destination, full-day date range, rental-car availability, and meal
  preferences.
- Discovery agent: finds attractions, photos, descriptions, costs, ticket links,
  opening hours, visit durations, locations, and local transport notes.
- Rating flow: user rates how much they want to visit each attraction.
- Planning agent: creates a multi-day route that fits highly rated places into
  available days while respecting opening hours, meal timing, and transport
  constraints.
- Map UI: route tabs by date, colored route segments by mode, selected-site
  detail panel, and grayed-out pins for skipped attractions.
- Persistence: user saves and reopens plans.
- Post-save recommendation: suggest a hotel area that is safe and close to the
  first/last sites across all days.

## Routing And Map Provider Findings

### Google Maps Platform

Sources:

- Pricing: https://developers.google.com/maps/billing-and-pricing/pricing
- Route travel modes:
  https://developers.google.com/maps/documentation/routes/reference/rest/v2/RouteTravelMode
- Compute Route Matrix:
  https://developers.google.com/maps/documentation/routes/compute_route_matrix

Findings:

- Best current fit for a hackathon implementation.
- Supports `TRANSIT` travel mode where provider coverage exists.
- Route matrix can be used for travel-time scoring across candidate stops.
- Final route geometry can be fetched for map drawing.
- Published free monthly usage includes 10,000 free Compute Routes Essentials
  requests and 10,000 free Route Matrix Essentials elements.
- Transit route matrix requests are capped at 100 elements per request.
- Billing setup is required; quotas and budget alerts should be configured.
- Google may suggest routes with transfers. The app should request fewer
  transfers, inspect the returned transit steps, and reject routes with transfers
  when the user rule requires direct transit only.

Recommended use:

- Use Google Geocoding/Places for destination/place lookup where needed.
- Use Compute Route Matrix to score itinerary candidates.
- Use Compute Routes for final per-leg walking, driving, and transit geometry.
- Treat rideshare as a fallback estimate based on driving route time and
  distance rather than direct Uber integration.

### HERE

Sources:

- Public Transit API:
  https://docs.here.com/transit/reference/public-transit-api-v8-getroutes
- Pricing entry point: https://www.here.com/get-started/pricing
- Limited Plan retirement note:
  https://www.here.com/developer/blog/august-2025-platform-release-notes

Findings:

- Strong transit-specific API.
- Supports departure/arrival time, walking access, transit modes, route
  polylines, and transfer constraints.
- Particularly attractive for the "no transfers" rule because transit routes can
  be constrained by number of changes.
- Current free-tier details are less transparent than Google's public pricing.
- HERE retired its old Limited Plan on August 31, 2025, so old claims about that
  free tier should not be relied on.

Recommended use:

- Consider HERE if we need stronger transit controls than Google offers and can
  confirm account pricing/limits in the active developer console.

### Mapbox

Sources:

- Pricing: https://www.mapbox.com/pricing
- Directions API: https://docs.mapbox.com/api/navigation/directions/

Findings:

- Good map rendering and generous free usage for map display.
- Directions API supports driving, walking, and cycling profiles.
- It does not provide scheduled public-transit routing.

Recommended use:

- Use Mapbox only for map visualization if we prefer its visual style.
- Do not depend on Mapbox for the app's public transit planning requirement.

### Open/Public Transit Options

Source:

- Transitous API policy: https://transitous.org/api/

Findings:

- Free/open transit-routing options exist, including Transitous/MOTIS.
- Coverage, uptime, usage policy, and support are less predictable than Google
  or HERE.

Recommended use:

- Treat as an experimental fallback, not the primary dependency for the judged
  demo.

## Implementation Decision

Use Google Maps Platform as the default routing provider for the first version:

- Better confidence on free monthly allowances.
- Good coverage for major tourist destinations.
- Sufficient transit support for demoable planning.
- Simple path to route polylines for map display.

Product behavior should be explicit:

- Walking is preferred for short distances.
- Public transit is allowed only when a simple route is available and no
  transfers are detected.
- Rideshare is used as fallback when walking or direct transit is impractical.
- If rental car mode is selected for a day, the car is used for all transport
  legs that day and parking notes are included where available.
- Public transit support depends on provider coverage for the destination.

## Data Sources And Agents

Discovery agent:

- Firecrawl crawls official tourism pages, attraction pages, ticketing pages,
  and reputable travel references.
- OpenAI extracts structured data: title, category, description, coordinates,
  hours, cost, booking URL, recommended duration, and photo candidates.
- Convex stores normalized attractions, sources, ratings, plans, route legs, and
  saved trips.

Planner agent:

- Deterministic itinerary builder scores and orders stops.
- OpenAI explains route tradeoffs and fills travel notes.
- Google routing APIs compute travel times and map geometry.
- AgentMail can email saved itineraries, daily summaries, or booking reminders.

## Hackathon MVP Scope

Build first:

- Destination/date/rental-car/preference form.
- Attraction discovery with photos and detail drawer.
- Rating controls.
- Multi-day planning button.
- Date tabs for itinerary display.
- Map with colored route segments:
  - Walking: green.
  - Transit: blue.
  - Rideshare: purple.
  - Car: orange.
- Grayed-out pins for excluded attractions.
- Lunch and dinner insertion based on cuisine preferences and location.
- Save/reopen plans.
- Hotel-area recommendation after saving.

Defer or simplify:

- Direct Uber booking.
- Guaranteed parking availability.
- Full transit optimization across every city.
- Ticket purchasing inside the app.
