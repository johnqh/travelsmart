# TravelSmart Product Spec

## Summary

TravelSmart is a full-stack travel planning app that turns a destination, travel
dates, transport constraints, and meal preferences into an editable multi-day
itinerary. It combines crawled attraction data, user ratings, route-aware
planning, meal insertion, saved plans, hotel-area recommendations, and a
map-first interface.

The product should feel like a practical travel workbench: fast to scan, visual,
editable, and grounded in real hours, costs, routes, and booking links.

## Target User

Primary user:

- A traveler planning a city trip or regional visit.
- Wants a useful plan quickly, without reading dozens of tabs.
- Cares about opening hours, transport effort, meals, photos, and ticket links.
- Is willing to rate places to improve the itinerary.

Best first destinations:

- Dense tourist cities with strong Google transit coverage.
- Examples: Tokyo, Kyoto, Paris, New York, London, San Francisco, Singapore,
  Taipei, Seoul, Barcelona.

Destinations to avoid for first demo:

- Rural areas with weak transit coverage.
- National parks where parking and driving details dominate.
- Destinations where attraction opening hours are sparse.

## Core User Flow

1. User creates a trip.
2. User enters:
   - Destination.
   - Start date.
   - End date.
   - Whether they have a rental car.
   - Meal preferences.
3. Discovery runs.
4. App shows attractions as:
   - Pins on a map.
   - A scannable ranked list.
   - Rich detail panel with photos, description, hours, cost, ticket link, and
     visit-duration estimate.
5. User rates attractions.
6. User clicks `Plan`.
7. Planner creates a date-tabbed itinerary.
8. User selects a date to see:
   - That day's route on the map.
   - Colored route segments by transportation mode.
   - Timeline/list for the day's stops and meals.
   - Grayed-out pins for attractions not included that day.
9. User changes ratings and clicks `Plan Again`.
10. User saves the plan.
11. App recommends a hotel area based on:
   - Safety.
   - Access to first and last stops across all days.
   - Transport simplicity.
   - Proximity to food and transit.
12. User can reopen saved plans later.

## Main Screens

### Trip Setup

Purpose:

- Capture enough inputs to start discovery and planning.

Fields:

- Destination search.
- Date range.
- Rental car toggle.
- Meal preferences, initially cuisine chips plus free text.
- Pace selector:
  - Relaxed.
  - Balanced.
  - Packed.

Default assumptions:

- Full-day planning window: 9:00 AM to 8:30 PM.
- Lunch target: 12:00 PM to 1:00 PM.
- Dinner target: 6:00 PM to 7:30 PM.
- Attraction visit duration may be inferred when not available.

### Discovery View

Purpose:

- Let the user understand and rate candidate attractions before planning.

Left/detail area:

- Attraction list sorted by discovery confidence and likely relevance.
- Category, rating control, cost, rough duration, and status badges.
- Badges:
  - Ticket likely needed.
  - Closed on one or more trip days.
  - Great for photos.
  - Far from cluster.

Map:

- All discovered attractions as category-coded pins.
- Selected attraction highlighted.
- Optional cluster grouping when many pins overlap.

Detail panel:

- Photo gallery.
- Short AI summary.
- Practical notes.
- Opening hours by trip date.
- Cost estimate.
- Ticket/official URL.
- Source links.
- Transport hints.

### Planning View

Purpose:

- Show the generated itinerary and let the user understand why it was chosen.

Top controls:

- Date tabs.
- `Plan Again`.
- Save plan.
- Transport legend.

Map:

- Included stops as active pins.
- Route legs as colored lines:
  - Walking: green.
  - Transit: blue.
  - Rideshare: purple.
  - Car: orange.
- Excluded attractions as gray pins.
- Restaurants as meal pins.

Timeline:

- Chronological list of stops, meals, and transport legs.
- Each item shows start/end time, duration, notes, cost/ticket badge, and
  confidence.
- Each leg shows transport mode, estimated time, distance, and fallback reason
  where relevant.

### Saved Plans

Purpose:

- Let users return to itineraries without rerunning discovery.

Features:

- List saved trips.
- Open saved trip.
- Rename plan.
- Duplicate plan for another revision.
- Email itinerary after save.

### Hotel Recommendation

Purpose:

- Recommend an area, not a specific hotel booking.

Output:

- Neighborhood/area name.
- Why it fits this itinerary.
- Nearby transit hubs.
- Safety summary.
- Travel convenience score.
- Suggested search query/link for hotel booking.

## Rating Model

Initial scale:

- 0: Not interested.
- 1: Maybe.
- 2: Interested.
- 3: Strong interest.
- 4: Must see.

Behavior:

- Unrated attractions use a neutral default.
- 0-rated attractions are excluded unless needed as meals or transit anchors.
- Must-see attractions get strong priority but are still constrained by opening
  hours and feasible routing.

## Meal Preferences

Inputs:

- Cuisine chips: Japanese, American, Italian, Chinese, local food, vegetarian,
  cafe, quick bite.
- Dietary/free-text notes.
- Meal strictness:
  - Flexible.
  - Match when possible.
  - Strong preference.

Behavior:

- Lunch should be near the itinerary item around noon.
- Dinner should be near the final afternoon/evening area.
- Restaurants should not force excessive route detours.
- Restaurants can be replaced when the user replans.

## Transportation Rules

Walking:

- Preferred for short distances.
- Default threshold: 15 minutes or less.

Public transit:

- Allowed only when provider data exists.
- Allowed only when no transfer is detected for the leg.
- Should include route name/line when available.

Rideshare:

- Fallback when walking is too long and direct transit is unavailable.
- Shown as estimated taxi/rideshare, not a direct Uber booking.

Rental car:

- If selected for a day, the itinerary uses car routing for that whole day.
- Car days should include parking notes where discoverable.
- The planner should avoid mixing car and transit on the same day.

## MVP Acceptance Criteria

The first demo-worthy version is complete when:

- A user can create a trip with destination, dates, car availability, and meal
  preferences.
- Discovery returns at least 12 attraction candidates for a supported city.
- Attractions appear on a map and list.
- Each attraction has a detail panel with photo, description, hours, cost or
  unknown cost, and source/ticket link.
- User can rate attractions.
- Planner creates one itinerary day per trip day.
- Each day has stops, lunch, dinner, and route legs.
- Route legs render on the map with mode-specific colors.
- Excluded attractions are still visible as gray pins.
- User can plan again after changing ratings.
- User can save and reopen a plan.
- After saving, the app recommends a hotel area.
- Saved itinerary can be emailed through AgentMail.

## Non-Goals For MVP

- Buying tickets inside the app.
- Real Uber integration.
- Guaranteed live parking availability.
- Offline mode.
- Multi-user collaborative planning.
- Perfect optimization across every possible attraction combination.
- Full global transit correctness.

## Product Risks

- Attraction data may be incomplete or inconsistent.
- Transit availability varies by destination.
- API costs can grow if every candidate pair is routed repeatedly.
- LLM-generated descriptions can overstate certainty.
- Photo rights and attribution must be handled carefully.

Mitigations:

- Show source links and confidence badges.
- Cache discovery and routing aggressively in Convex.
- Limit first demo destinations to places with strong data coverage.
- Use provider photos or crawled official images only where terms permit.
- Use deterministic planning rules for time/route feasibility.
