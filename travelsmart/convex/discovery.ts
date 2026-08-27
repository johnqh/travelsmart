import { v } from "convex/values";
import {
  action,
  env,
  internalMutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";

const categoryValidator = v.union(
  v.literal("temple"),
  v.literal("viewpoint"),
  v.literal("museum"),
  v.literal("market"),
  v.literal("neighborhood"),
  v.literal("park"),
  v.literal("waterfront"),
  v.literal("experience"),
);

const discoveryStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("ready"),
  v.literal("fallback"),
  v.literal("partial"),
  v.literal("error"),
);

const discoverySourceValidator = v.union(
  v.literal("providers"),
  v.literal("demoSeed"),
  v.literal("mixed"),
  v.literal("none"),
);

const providerStatsValidator = v.object({
  google: v.string(),
  firecrawl: v.string(),
  openai: v.string(),
  attractionCount: v.number(),
  restaurantCount: v.number(),
  sourceUrlCount: v.number(),
});

const discoveryRunValidator = v.object({
  _id: v.id("discoveryRuns"),
  _creationTime: v.number(),
  tripId: v.id("trips"),
  status: discoveryStatusValidator,
  message: v.string(),
  source: discoverySourceValidator,
  providerStats: providerStatsValidator,
  startedAt: v.number(),
  finishedAt: v.optional(v.number()),
  error: v.optional(v.string()),
});

const discoveredAttractionValidator = v.object({
  name: v.string(),
  category: categoryValidator,
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
});

const discoveredRestaurantValidator = v.object({
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
});

const discoveryResultValidator = v.object({
  status: discoveryStatusValidator,
  source: discoverySourceValidator,
  message: v.string(),
  attractionCount: v.number(),
  restaurantCount: v.number(),
  sourceUrlCount: v.number(),
});

type Category =
  | "temple"
  | "viewpoint"
  | "museum"
  | "market"
  | "neighborhood"
  | "park"
  | "waterfront"
  | "experience";

type DiscoveryStatus = "ready" | "fallback" | "partial" | "error";
type DiscoverySource = "providers" | "demoSeed" | "mixed" | "none";

type ProviderStats = {
  google: string;
  firecrawl: string;
  openai: string;
  attractionCount: number;
  restaurantCount: number;
  sourceUrlCount: number;
};

type DiscoveryContext = {
  runId: Id<"discoveryRuns">;
  tripId: Id<"trips">;
  destinationName: string;
  destinationLat: number;
  destinationLng: number;
  mealPreferences: string[];
};

type DiscoveryResult = {
  status: DiscoveryStatus;
  source: DiscoverySource;
  message: string;
  attractionCount: number;
  restaurantCount: number;
  sourceUrlCount: number;
};

type Point = { lat: number; lng: number };
type SourceDoc = {
  title: string;
  url: string;
  description: string;
  markdown: string;
};

type GooglePlace = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  googleMapsUri?: string;
  searchUri?: string;
  websiteUri?: string;
  photoUrl?: string;
  openingHoursSummary?: string;
  priceLevel?: "$" | "$$" | "$$$" | "$$$$";
  rating?: number;
  types: string[];
};

type ProviderAttraction = {
  name: string;
  category: Category;
  description: string;
  practicalNotes: string;
  lat: number;
  lng: number;
  address: string;
  officialUrl?: string;
  ticketUrl?: string;
  sourceUrls: string[];
  photoUrls: string[];
  openingHoursSummary: string;
  costSummary: string;
  estimatedVisitMinutes: number;
  requiresTicket: boolean;
  confidence: number;
};

type ProviderRestaurant = {
  name: string;
  cuisine: string;
  lat: number;
  lng: number;
  neighborhood: string;
  priceLevel: "$" | "$$" | "$$$" | "$$$$";
  openingHoursSummary: string;
  notes: string;
  photoUrls: string[];
  sourceUrls: string[];
};

type CommitResult = {
  attractionCount: number;
  restaurantCount: number;
};

export const getLatestRun = query({
  args: {
    tripId: v.id("trips"),
    sessionId: v.string(),
  },
  returns: v.union(v.null(), discoveryRunValidator),
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("discoveryRuns")
      .withIndex("by_tripId_and_startedAt", (q) => q.eq("tripId", args.tripId))
      .order("desc")
      .first();

    if (!run || run.sessionId !== args.sessionId) {
      return null;
    }

    return {
      _id: run._id,
      _creationTime: run._creationTime,
      tripId: run.tripId,
      status: run.status,
      message: run.message,
      source: run.source,
      providerStats: run.providerStats,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      error: run.error,
    };
  },
});

export const discoverAttractions = action({
  args: {
    tripId: v.id("trips"),
    sessionId: v.string(),
  },
  returns: discoveryResultValidator,
  handler: async (ctx, args): Promise<DiscoveryResult> => {
    const run: DiscoveryContext = await ctx.runMutation(
      internal.discovery.startRun,
      args,
    );
    const stats = emptyProviderStats();
    let center = { lat: run.destinationLat, lng: run.destinationLng };
    let attractions: ProviderAttraction[] = [];
    let restaurants: ProviderRestaurant[] = [];
    let sourceDocs: SourceDoc[] = [];

    try {
      const googleKey = env.GOOGLE_MAPS_API_KEY;
      if (googleKey) {
        try {
          const google = await fetchGoogleDiscovery({
            apiKey: googleKey,
            destinationName: run.destinationName,
            mealPreferences: run.mealPreferences,
            center,
          });
          center = google.center;
          attractions = google.attractions;
          restaurants = google.restaurants;
          stats.google = `ready: ${attractions.length} places, ${restaurants.length} restaurants`;
        } catch (error) {
          stats.google = `error: ${errorMessage(error)}`;
        }
      } else {
        stats.google = "not configured";
      }

      const firecrawlKey = env.FIRECRAWL_API_KEY;
      if (firecrawlKey) {
        try {
          sourceDocs = await searchFirecrawl({
            apiKey: firecrawlKey,
            destinationName: run.destinationName,
          });
          stats.firecrawl = `ready: ${sourceDocs.length} source pages`;
        } catch (error) {
          stats.firecrawl = `error: ${errorMessage(error)}`;
        }
      } else {
        stats.firecrawl = "not configured";
      }

      const openaiKey = env.OPENAI_API_KEY;
      if (openaiKey && (attractions.length > 0 || sourceDocs.length > 0)) {
        try {
          attractions = await normalizeAttractionsWithOpenAI({
            apiKey: openaiKey,
            model: env.OPENAI_MODEL ?? "gpt-5-mini",
            destinationName: run.destinationName,
            attractions,
            sourceDocs,
          });
          stats.openai = `ready: normalized ${attractions.length} attractions`;
        } catch (error) {
          stats.openai = `error: ${errorMessage(error)}`;
        }
      } else {
        stats.openai = openaiKey ? "waiting for provider data" : "not configured";
      }

      if (attractions.length >= 6) {
        const counts: CommitResult = await ctx.runMutation(
          internal.discovery.commitProviderData,
          {
            tripId: run.tripId,
            sessionId: args.sessionId,
            destinationLat: center.lat,
            destinationLng: center.lng,
            attractions,
            restaurants,
          },
        );
        const result: DiscoveryResult = {
          status: sourceDocs.length > 0 ? "partial" : "ready",
          source: sourceDocs.length > 0 ? "mixed" : "providers",
          message: `Discovered ${counts.attractionCount} attractions for ${run.destinationName}.`,
          attractionCount: counts.attractionCount,
          restaurantCount: counts.restaurantCount,
          sourceUrlCount: sourceDocs.length,
        };
        await finishRun(ctx, run.runId, result, {
          ...stats,
          attractionCount: counts.attractionCount,
          restaurantCount: counts.restaurantCount,
          sourceUrlCount: sourceDocs.length,
        });
        return result;
      }

      const fallback: CommitResult = await ctx.runMutation(
        internal.trips.seedDemoData,
        {
          tripId: run.tripId,
          sessionId: args.sessionId,
          destinationLat: center.lat,
          destinationLng: center.lng,
        },
      );
      const result: DiscoveryResult = {
        status: "fallback",
        source: "demoSeed",
        message:
          "Provider discovery returned too little data or is not configured, so the Tokyo demo dataset was loaded.",
        attractionCount: fallback.attractionCount,
        restaurantCount: fallback.restaurantCount,
        sourceUrlCount: sourceDocs.length,
      };
      await finishRun(ctx, run.runId, result, {
        ...stats,
        attractionCount: fallback.attractionCount,
        restaurantCount: fallback.restaurantCount,
        sourceUrlCount: sourceDocs.length,
      });
      return result;
    } catch (error) {
      const fallback: CommitResult = await ctx.runMutation(
        internal.trips.seedDemoData,
        {
          tripId: run.tripId,
          sessionId: args.sessionId,
          destinationLat: center.lat,
          destinationLng: center.lng,
        },
      );
      const result: DiscoveryResult = {
        status: "fallback",
        source: "demoSeed",
        message: `Discovery failed, so the Tokyo demo dataset was loaded: ${errorMessage(
          error,
        )}`,
        attractionCount: fallback.attractionCount,
        restaurantCount: fallback.restaurantCount,
        sourceUrlCount: sourceDocs.length,
      };
      await finishRun(ctx, run.runId, result, {
        ...stats,
        attractionCount: fallback.attractionCount,
        restaurantCount: fallback.restaurantCount,
        sourceUrlCount: sourceDocs.length,
      });
      return result;
    }
  },
});

export const startRun = internalMutation({
  args: {
    tripId: v.id("trips"),
    sessionId: v.string(),
  },
  returns: v.object({
    runId: v.id("discoveryRuns"),
    tripId: v.id("trips"),
    destinationName: v.string(),
    destinationLat: v.number(),
    destinationLng: v.number(),
    mealPreferences: v.array(v.string()),
  }),
  handler: async (ctx, args): Promise<DiscoveryContext> => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.sessionId !== args.sessionId) {
      throw new Error("Trip not found.");
    }

    const now = Date.now();
    const runId = await ctx.db.insert("discoveryRuns", {
      tripId: args.tripId,
      sessionId: args.sessionId,
      status: "running",
      source: "none",
      message: "Discovery started.",
      providerStats: emptyProviderStats(),
      startedAt: now,
    });
    await ctx.db.patch(args.tripId, {
      status: "discovering",
      updatedAt: now,
    });

    return {
      runId,
      tripId: args.tripId,
      destinationName: trip.destinationName,
      destinationLat: trip.destinationLat,
      destinationLng: trip.destinationLng,
      mealPreferences: trip.mealPreferences,
    };
  },
});

export const finishRunInternal = internalMutation({
  args: {
    runId: v.id("discoveryRuns"),
    result: discoveryResultValidator,
    providerStats: providerStatsValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) {
      return null;
    }

    await ctx.db.patch(args.runId, {
      status: args.result.status,
      source: args.result.source,
      message: args.result.message,
      providerStats: args.providerStats,
      finishedAt: Date.now(),
      error: args.result.status === "error" ? args.result.message : undefined,
    });
    return null;
  },
});

export const commitProviderData = internalMutation({
  args: {
    tripId: v.id("trips"),
    sessionId: v.string(),
    destinationLat: v.number(),
    destinationLng: v.number(),
    attractions: v.array(discoveredAttractionValidator),
    restaurants: v.array(discoveredRestaurantValidator),
  },
  returns: v.object({
    attractionCount: v.number(),
    restaurantCount: v.number(),
  }),
  handler: async (ctx, args): Promise<CommitResult> => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.sessionId !== args.sessionId) {
      throw new Error("Trip not found.");
    }

    const now = Date.now();
    const existingAttractions = await ctx.db
      .query("attractions")
      .withIndex("by_tripId", (q) => q.eq("tripId", args.tripId))
      .take(80);
    const attractionByName = new Map(
      existingAttractions.map((attraction) => [
        normalizeName(attraction.name),
        attraction,
      ]),
    );

    for (const attraction of args.attractions.slice(0, 30)) {
      const existing = attractionByName.get(normalizeName(attraction.name));
      if (existing) {
        await ctx.db.patch(existing._id, {
          ...attraction,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("attractions", {
          tripId: args.tripId,
          ...attraction,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const existingRestaurants = await ctx.db
      .query("restaurants")
      .withIndex("by_tripId", (q) => q.eq("tripId", args.tripId))
      .take(80);
    const restaurantByName = new Map(
      existingRestaurants.map((restaurant) => [
        normalizeName(restaurant.name),
        restaurant,
      ]),
    );

    for (const restaurant of args.restaurants.slice(0, 20)) {
      const existing = restaurantByName.get(normalizeName(restaurant.name));
      if (existing) {
        await ctx.db.patch(existing._id, {
          ...restaurant,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("restaurants", {
          tripId: args.tripId,
          ...restaurant,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(args.tripId, {
      destinationLat: args.destinationLat,
      destinationLng: args.destinationLng,
      status: "readyToRate",
      updatedAt: now,
    });

    return {
      attractionCount: args.attractions.length,
      restaurantCount: args.restaurants.length,
    };
  },
});

async function finishRun(
  ctx: ActionCtx,
  runId: Id<"discoveryRuns">,
  result: DiscoveryResult,
  providerStats: ProviderStats,
) {
  await ctx.runMutation(internal.discovery.finishRunInternal, {
    runId,
    result,
    providerStats,
  });
}

async function fetchGoogleDiscovery({
  apiKey,
  center,
  destinationName,
  mealPreferences,
}: {
  apiKey: string;
  center: Point;
  destinationName: string;
  mealPreferences: string[];
}) {
  const destinationMatches = await searchGooglePlaces({
    apiKey,
    textQuery: destinationName,
    pageSize: 1,
  });
  const resolvedCenter = destinationMatches[0]
    ? { lat: destinationMatches[0].lat, lng: destinationMatches[0].lng }
    : center;

  const placeMatches = await searchGooglePlaces({
    apiKey,
    textQuery: `top tourist attractions in ${destinationName}`,
    pageSize: 16,
    center: resolvedCenter,
  });
  const restaurantMatches = await searchGooglePlaces({
    apiKey,
    textQuery: `${mealPreferences.join(" ") || "local"} restaurants in ${destinationName}`,
    pageSize: 8,
    center: resolvedCenter,
  });

  return {
    center: resolvedCenter,
    attractions: placeMatches
      .map((place, index) => googlePlaceToAttraction(place, index))
      .filter((place): place is ProviderAttraction => Boolean(place)),
    restaurants: restaurantMatches
      .map((place, index) => googlePlaceToRestaurant(place, index))
      .filter((place): place is ProviderRestaurant => Boolean(place)),
  };
}

async function searchGooglePlaces({
  apiKey,
  center,
  pageSize,
  textQuery,
}: {
  apiKey: string;
  center?: Point;
  pageSize: number;
  textQuery: string;
}) {
  const body: Record<string, unknown> = {
    textQuery,
    pageSize,
    languageCode: "en",
  };
  if (center) {
    body.locationBias = {
      circle: {
        center: {
          latitude: center.lat,
          longitude: center.lng,
        },
        radius: 35000,
      },
    };
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.searchUri,places.websiteUri,places.photos,places.primaryType,places.types,places.regularOpeningHours,places.priceLevel,places.rating",
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw new Error(`Google Places HTTP ${response.status}`);
  }

  const payload = asRecord(await response.json());
  const places = asArray(payload?.places);
  return places
    .map((place) => parseGooglePlace(place, apiKey))
    .filter((place): place is GooglePlace => Boolean(place));
}

async function searchFirecrawl({
  apiKey,
  destinationName,
}: {
  apiKey: string;
  destinationName: string;
}) {
  const response = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `official tourism attractions ${destinationName}`,
      limit: 6,
      sources: ["web"],
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true,
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Firecrawl HTTP ${response.status}`);
  }

  const payload = asRecord(await response.json());
  const data = asRecord(payload?.data);
  const web = asArray(data?.web);
  return web
    .map((item): SourceDoc | null => {
      const record = asRecord(item);
      const url = getString(record, "url");
      if (!record || !url) {
        return null;
      }
      return {
        title: getString(record, "title") ?? "Travel source",
        url,
        description: getString(record, "description") ?? "",
        markdown: clampText(getString(record, "markdown") ?? "", 1800),
      };
    })
    .filter((source): source is SourceDoc => Boolean(source));
}

async function normalizeAttractionsWithOpenAI({
  apiKey,
  attractions,
  destinationName,
  model,
  sourceDocs,
}: {
  apiKey: string;
  attractions: ProviderAttraction[];
  destinationName: string;
  model: string;
  sourceDocs: SourceDoc[];
}) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "Normalize travel attraction candidates. Keep facts conservative, grounded in the provided places and source excerpts, and never invent addresses or coordinates.",
        },
        {
          role: "user",
          content: JSON.stringify({
            destinationName,
            candidates: attractions.slice(0, 20).map((attraction) => ({
              name: attraction.name,
              category: attraction.category,
              address: attraction.address,
              description: attraction.description,
              openingHoursSummary: attraction.openingHoursSummary,
              costSummary: attraction.costSummary,
              sourceUrls: attraction.sourceUrls,
            })),
            sourceDocs: sourceDocs.slice(0, 6),
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "travelsmart_discovery",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              attractions: {
                type: "array",
                maxItems: 20,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    category: {
                      type: "string",
                      enum: [
                        "temple",
                        "viewpoint",
                        "museum",
                        "market",
                        "neighborhood",
                        "park",
                        "waterfront",
                        "experience",
                      ],
                    },
                    description: { type: "string" },
                    practicalNotes: { type: "string" },
                    openingHoursSummary: { type: "string" },
                    costSummary: { type: "string" },
                    estimatedVisitMinutes: { type: "number" },
                    requiresTicket: { type: "boolean" },
                    confidence: { type: "number" },
                  },
                  required: [
                    "name",
                    "category",
                    "description",
                    "practicalNotes",
                    "openingHoursSummary",
                    "costSummary",
                    "estimatedVisitMinutes",
                    "requiresTicket",
                    "confidence",
                  ],
                },
              },
            },
            required: ["attractions"],
          },
        },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI HTTP ${response.status}`);
  }

  const content = extractOpenAIContent(await response.json());
  const normalized = asRecord(JSON.parse(content));
  const items = asArray(normalized?.attractions);
  const byName = new Map(
    attractions.map((attraction) => [normalizeName(attraction.name), attraction]),
  );

  for (const item of items) {
    const record = asRecord(item);
    const name = getString(record, "name");
    if (!record || !name) {
      continue;
    }

    const existing = byName.get(normalizeName(name));
    if (!existing) {
      continue;
    }

    existing.category = parseCategory(getString(record, "category")) ?? existing.category;
    existing.description = clampText(
      getString(record, "description") ?? existing.description,
      480,
    );
    existing.practicalNotes = clampText(
      getString(record, "practicalNotes") ?? existing.practicalNotes,
      320,
    );
    existing.openingHoursSummary = clampText(
      getString(record, "openingHoursSummary") ?? existing.openingHoursSummary,
      220,
    );
    existing.costSummary = clampText(
      getString(record, "costSummary") ?? existing.costSummary,
      160,
    );
    existing.estimatedVisitMinutes = clampNumber(
      getNumber(record, "estimatedVisitMinutes") ?? existing.estimatedVisitMinutes,
      30,
      180,
    );
    existing.requiresTicket =
      getBoolean(record, "requiresTicket") ?? existing.requiresTicket;
    existing.confidence = clampNumber(
      getNumber(record, "confidence") ?? existing.confidence,
      0.55,
      0.98,
    );
  }

  return attractions;
}

function parseGooglePlace(value: unknown, apiKey: string): GooglePlace | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const location = asRecord(record.location);
  const lat = getNumber(location, "latitude");
  const lng = getNumber(location, "longitude");
  const name = getNestedString(record, "displayName", "text");
  if (!name || lat === undefined || lng === undefined) {
    return null;
  }

  const photos = asArray(record.photos);
  const photoName = photos
    .map((photo) => getString(asRecord(photo), "name"))
    .find((candidate): candidate is string => Boolean(candidate));
  const types = asArray(record.types)
    .map((type) => (typeof type === "string" ? type : null))
    .filter((type): type is string => Boolean(type));

  return {
    name,
    address: getString(record, "formattedAddress") ?? name,
    lat,
    lng,
    googleMapsUri: getString(record, "googleMapsUri"),
    searchUri: getString(record, "searchUri"),
    websiteUri: getString(record, "websiteUri"),
    photoUrl: photoName
      ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=900&key=${encodeURIComponent(
          apiKey,
        )}`
      : undefined,
    openingHoursSummary: openingHoursSummary(record),
    priceLevel: priceLevel(record),
    rating: getNumber(record, "rating"),
    types,
  };
}

function googlePlaceToAttraction(
  place: GooglePlace,
  index: number,
): ProviderAttraction | null {
  const sourceUrls = compact([
    place.websiteUri,
    place.googleMapsUri,
    place.searchUri,
  ]);

  return {
    name: clampText(place.name, 90),
    category: categoryFromPlace(place),
    description: `${place.name} is a candidate attraction discovered from Google Places for this route.`,
    practicalNotes:
      "Verify same-day hours, ticket availability, and crowd conditions before locking this into the final trip.",
    lat: place.lat,
    lng: place.lng,
    address: place.address,
    officialUrl: place.websiteUri ?? place.googleMapsUri,
    ticketUrl: undefined,
    sourceUrls,
    photoUrls: compact([place.photoUrl, fallbackPhoto(index)]),
    openingHoursSummary: place.openingHoursSummary ?? "Hours vary by date.",
    costSummary: place.priceLevel ? `Typical cost level ${place.priceLevel}` : "Cost varies",
    estimatedVisitMinutes: estimatedVisitMinutes(place),
    requiresTicket: requiresTicket(place),
    confidence: clampNumber(0.72 + (place.rating ?? 4) / 25, 0.7, 0.92),
  };
}

function googlePlaceToRestaurant(
  place: GooglePlace,
  index: number,
): ProviderRestaurant | null {
  return {
    name: clampText(place.name, 90),
    cuisine: cuisineFromTypes(place.types),
    lat: place.lat,
    lng: place.lng,
    neighborhood: place.address.split(",")[0] ?? "Nearby",
    priceLevel: place.priceLevel ?? "$$",
    openingHoursSummary: place.openingHoursSummary ?? "Meal hours vary.",
    notes: "Meal candidate discovered near the trip route area.",
    photoUrls: compact([place.photoUrl, fallbackFoodPhoto(index)]),
    sourceUrls: compact([place.websiteUri, place.googleMapsUri, place.searchUri]),
  };
}

function emptyProviderStats(): ProviderStats {
  return {
    google: "queued",
    firecrawl: "queued",
    openai: "queued",
    attractionCount: 0,
    restaurantCount: 0,
    sourceUrlCount: 0,
  };
}

function categoryFromPlace(place: GooglePlace): Category {
  const joined = place.types.join(" ");
  if (/shrine|temple|church|mosque|hindu_temple|synagogue/.test(joined)) {
    return "temple";
  }
  if (/museum|art_gallery/.test(joined)) {
    return "museum";
  }
  if (/park|garden|zoo/.test(joined)) {
    return "park";
  }
  if (/aquarium|amusement_park|tourist_attraction/.test(joined)) {
    return "experience";
  }
  if (/shopping_mall|market|store/.test(joined)) {
    return "market";
  }
  if (/natural_feature|water|pier/.test(joined)) {
    return "waterfront";
  }
  if (/observation|landmark|point_of_interest/.test(joined)) {
    return "viewpoint";
  }
  return "neighborhood";
}

function parseCategory(value: string | undefined): Category | undefined {
  const categories: Category[] = [
    "temple",
    "viewpoint",
    "museum",
    "market",
    "neighborhood",
    "park",
    "waterfront",
    "experience",
  ];
  return categories.find((category) => category === value);
}

function cuisineFromTypes(types: string[]) {
  if (types.some((type) => type.includes("sushi"))) {
    return "Sushi";
  }
  if (types.some((type) => type.includes("ramen"))) {
    return "Ramen";
  }
  return "Local";
}

function estimatedVisitMinutes(place: GooglePlace) {
  const joined = place.types.join(" ");
  if (/museum|amusement_park|aquarium|zoo/.test(joined)) {
    return 120;
  }
  if (/park|garden|shopping_mall/.test(joined)) {
    return 90;
  }
  return 75;
}

function requiresTicket(place: GooglePlace) {
  const joined = place.types.join(" ");
  return /museum|amusement_park|aquarium|zoo|tourist_attraction/.test(joined);
}

function openingHoursSummary(record: Record<string, unknown>) {
  const hours = asRecord(record.regularOpeningHours);
  const descriptions = asArray(hours?.weekdayDescriptions)
    .map((value) => (typeof value === "string" ? value : null))
    .filter((value): value is string => Boolean(value));
  if (descriptions.length === 0) {
    return undefined;
  }
  return clampText(descriptions.slice(0, 2).join("; "), 220);
}

function priceLevel(record: Record<string, unknown>) {
  const value = getString(record, "priceLevel");
  if (value === "PRICE_LEVEL_INEXPENSIVE") {
    return "$";
  }
  if (value === "PRICE_LEVEL_EXPENSIVE") {
    return "$$$";
  }
  if (value === "PRICE_LEVEL_VERY_EXPENSIVE") {
    return "$$$$";
  }
  if (value) {
    return "$$";
  }
  return undefined;
}

function extractOpenAIContent(payload: unknown) {
  const record = asRecord(payload);
  const choices = asArray(record?.choices);
  const firstChoice = asRecord(choices[0]);
  const message = asRecord(firstChoice?.message);
  const content = getString(message, "content");
  if (!content) {
    throw new Error("OpenAI response did not include content");
  }
  return content;
}

function compact(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value));
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function getString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getNestedString(
  record: Record<string, unknown>,
  parentKey: string,
  childKey: string,
) {
  return getString(asRecord(record[parentKey]), childKey);
}

function getNumber(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1).trim()}...`;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replaceAll(/\s+/g, " ");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function fallbackPhoto(index: number) {
  const photos = [
    "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1533050487297-09b450131914?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=900&q=80",
  ];
  return photos[index % photos.length];
}

function fallbackFoodPhoto(index: number) {
  const photos = [
    "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1557872943-16a5ac26437e?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=80",
  ];
  return photos[index % photos.length];
}
