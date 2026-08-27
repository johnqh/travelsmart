import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  trips: defineTable({
    sessionId: v.string(),
    title: v.string(),
    destinationName: v.string(),
    destinationLat: v.number(),
    destinationLng: v.number(),
    startDate: v.string(),
    endDate: v.string(),
    hasRentalCar: v.boolean(),
    pace: v.union(
      v.literal("relaxed"),
      v.literal("balanced"),
      v.literal("packed"),
    ),
    mealPreferences: v.array(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("readyToRate"),
      v.literal("planning"),
      v.literal("planned"),
      v.literal("saved"),
      v.literal("error"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sessionId_and_updatedAt", ["sessionId", "updatedAt"])
    .index("by_status", ["status"]),

  attractions: defineTable({
    tripId: v.id("trips"),
    name: v.string(),
    category: v.union(
      v.literal("temple"),
      v.literal("viewpoint"),
      v.literal("museum"),
      v.literal("market"),
      v.literal("neighborhood"),
      v.literal("park"),
      v.literal("waterfront"),
      v.literal("experience"),
    ),
    description: v.string(),
    practicalNotes: v.string(),
    lat: v.number(),
    lng: v.number(),
    address: v.string(),
    officialUrl: v.optional(v.string()),
    ticketUrl: v.optional(v.string()),
    sourceUrls: v.array(v.string()),
    photoUrls: v.array(v.string()),
    openingHoursSummary: v.string(),
    costSummary: v.string(),
    estimatedVisitMinutes: v.number(),
    requiresTicket: v.boolean(),
    confidence: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tripId", ["tripId"])
    .index("by_tripId_and_category", ["tripId", "category"]),

  attractionRatings: defineTable({
    tripId: v.id("trips"),
    attractionId: v.id("attractions"),
    sessionId: v.string(),
    rating: v.union(
      v.literal(0),
      v.literal(1),
      v.literal(2),
      v.literal(3),
      v.literal(4),
    ),
    updatedAt: v.number(),
  })
    .index("by_tripId_and_sessionId", ["tripId", "sessionId"])
    .index("by_tripId_and_attractionId_and_sessionId", [
      "tripId",
      "attractionId",
      "sessionId",
    ])
    .index("by_attractionId", ["attractionId"]),

  restaurants: defineTable({
    tripId: v.id("trips"),
    name: v.string(),
    cuisine: v.string(),
    lat: v.number(),
    lng: v.number(),
    neighborhood: v.string(),
    priceLevel: v.union(
      v.literal("$"),
      v.literal("$$"),
      v.literal("$$$"),
      v.literal("$$$$"),
    ),
    openingHoursSummary: v.string(),
    notes: v.string(),
    photoUrls: v.array(v.string()),
    sourceUrls: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tripId", ["tripId"])
    .index("by_tripId_and_cuisine", ["tripId", "cuisine"]),

  plans: defineTable({
    tripId: v.id("trips"),
    sessionId: v.string(),
    name: v.string(),
    status: v.union(
      v.literal("generated"),
      v.literal("saved"),
      v.literal("archived"),
    ),
    plannerVersion: v.string(),
    score: v.number(),
    summary: v.string(),
    excludedAttractionIds: v.array(v.id("attractions")),
    diagnostics: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    savedAt: v.optional(v.number()),
  })
    .index("by_tripId_and_updatedAt", ["tripId", "updatedAt"])
    .index("by_sessionId_and_status_and_updatedAt", [
      "sessionId",
      "status",
      "updatedAt",
    ]),

  planDays: defineTable({
    planId: v.id("plans"),
    tripId: v.id("trips"),
    date: v.string(),
    dayIndex: v.number(),
    transportPolicy: v.union(
      v.literal("walkTransitRideshare"),
      v.literal("carOnly"),
    ),
    summary: v.string(),
    score: v.number(),
  })
    .index("by_planId_and_dayIndex", ["planId", "dayIndex"])
    .index("by_tripId", ["tripId"]),

  planItems: defineTable({
    planId: v.id("plans"),
    planDayId: v.id("planDays"),
    tripId: v.id("trips"),
    type: v.union(
      v.literal("attraction"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("break"),
    ),
    attractionId: v.optional(v.id("attractions")),
    restaurantId: v.optional(v.id("restaurants")),
    name: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    durationMinutes: v.number(),
    notes: v.string(),
    bookingUrl: v.optional(v.string()),
    lat: v.number(),
    lng: v.number(),
    sortOrder: v.number(),
  })
    .index("by_planDayId_and_sortOrder", ["planDayId", "sortOrder"])
    .index("by_planId", ["planId"])
    .index("by_attractionId", ["attractionId"]),

  routeLegs: defineTable({
    planId: v.id("plans"),
    planDayId: v.id("planDays"),
    tripId: v.id("trips"),
    fromItemId: v.id("planItems"),
    toItemId: v.id("planItems"),
    mode: v.union(
      v.literal("walk"),
      v.literal("transit"),
      v.literal("rideshare"),
      v.literal("car"),
    ),
    durationMinutes: v.number(),
    distanceMeters: v.number(),
    polyline: v.array(v.object({ lat: v.number(), lng: v.number() })),
    instructionsSummary: v.string(),
    transitLineNames: v.array(v.string()),
    transferCount: v.number(),
    fallbackReason: v.optional(v.string()),
    sortOrder: v.number(),
  })
    .index("by_planDayId_and_sortOrder", ["planDayId", "sortOrder"])
    .index("by_planId", ["planId"]),

  hotelRecommendations: defineTable({
    tripId: v.id("trips"),
    planId: v.id("plans"),
    sessionId: v.string(),
    areaName: v.string(),
    centerLat: v.number(),
    centerLng: v.number(),
    summary: v.string(),
    safetyNotes: v.string(),
    transportNotes: v.string(),
    nearbyTransitHubs: v.array(v.string()),
    searchUrl: v.string(),
    score: v.number(),
    createdAt: v.number(),
  })
    .index("by_planId", ["planId"])
    .index("by_tripId", ["tripId"])
    .index("by_sessionId", ["sessionId"]),

  outboundEmails: defineTable({
    tripId: v.id("trips"),
    planId: v.id("plans"),
    sessionId: v.string(),
    to: v.string(),
    subject: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("skipped"),
      v.literal("error"),
    ),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
  })
    .index("by_planId", ["planId"])
    .index("by_tripId", ["tripId"])
    .index("by_sessionId", ["sessionId"]),

  featureRequests: defineTable({
    title: v.string(),
    description: v.string(),
    state: v.union(
      v.literal("requested"),
      v.literal("inProgress"),
      v.literal("completed"),
      v.literal("rejected"),
    ),
    voteCount: v.number(),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_state", ["state"]),

  refinementQuestions: defineTable({
    text: v.string(),
    answer: v.optional(v.string()),
    state: v.union(
      v.literal("open"),
      v.literal("answered"),
      v.literal("skipped"),
    ),
    askedAtMs: v.number(),
    answeredAtMs: v.optional(v.number()),
  }).index("by_state", ["state"]),
});
