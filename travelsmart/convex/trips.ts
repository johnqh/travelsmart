import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const paceValidator = v.union(
  v.literal("relaxed"),
  v.literal("balanced"),
  v.literal("packed"),
);

const ratingValidator = v.union(
  v.literal(0),
  v.literal(1),
  v.literal(2),
  v.literal(3),
  v.literal(4),
);

const tripSummaryValidator = v.object({
  _id: v.id("trips"),
  _creationTime: v.number(),
  title: v.string(),
  destinationName: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  hasRentalCar: v.boolean(),
  pace: paceValidator,
  mealPreferences: v.array(v.string()),
  status: v.union(
    v.literal("draft"),
    v.literal("readyToRate"),
    v.literal("planning"),
    v.literal("planned"),
    v.literal("saved"),
    v.literal("error"),
  ),
  updatedAt: v.number(),
});

const attractionWithRatingValidator = v.object({
  _id: v.id("attractions"),
  _creationTime: v.number(),
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
  rating: ratingValidator,
});

const restaurantValidator = v.object({
  _id: v.id("restaurants"),
  _creationTime: v.number(),
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

export const listTrips = query({
  args: { sessionId: v.string() },
  returns: v.array(tripSummaryValidator),
  handler: async (ctx, args) => {
    const trips = await ctx.db
      .query("trips")
      .withIndex("by_sessionId_and_updatedAt", (q) =>
        q.eq("sessionId", args.sessionId),
      )
      .order("desc")
      .take(20);

    return trips.map((trip) => ({
      _id: trip._id,
      _creationTime: trip._creationTime,
      title: trip.title,
      destinationName: trip.destinationName,
      startDate: trip.startDate,
      endDate: trip.endDate,
      hasRentalCar: trip.hasRentalCar,
      pace: trip.pace,
      mealPreferences: trip.mealPreferences,
      status: trip.status,
      updatedAt: trip.updatedAt,
    }));
  },
});

export const getTripWorkspace = query({
  args: {
    tripId: v.id("trips"),
    sessionId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      trip: v.object({
        _id: v.id("trips"),
        _creationTime: v.number(),
        title: v.string(),
        destinationName: v.string(),
        destinationLat: v.number(),
        destinationLng: v.number(),
        startDate: v.string(),
        endDate: v.string(),
        hasRentalCar: v.boolean(),
        pace: paceValidator,
        mealPreferences: v.array(v.string()),
        status: v.union(
          v.literal("draft"),
          v.literal("readyToRate"),
          v.literal("planning"),
          v.literal("planned"),
          v.literal("saved"),
          v.literal("error"),
        ),
        updatedAt: v.number(),
      }),
      attractions: v.array(attractionWithRatingValidator),
      restaurants: v.array(restaurantValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.sessionId !== args.sessionId) {
      return null;
    }

    const attractions = await ctx.db
      .query("attractions")
      .withIndex("by_tripId", (q) => q.eq("tripId", args.tripId))
      .take(40);

    const ratings = await ctx.db
      .query("attractionRatings")
      .withIndex("by_tripId_and_sessionId", (q) =>
        q.eq("tripId", args.tripId).eq("sessionId", args.sessionId),
      )
      .take(60);

    const restaurants = await ctx.db
      .query("restaurants")
      .withIndex("by_tripId", (q) => q.eq("tripId", args.tripId))
      .take(40);

    const ratingByAttraction = new Map(
      ratings.map((rating) => [rating.attractionId, rating.rating]),
    );

    return {
      trip: {
        _id: trip._id,
        _creationTime: trip._creationTime,
        title: trip.title,
        destinationName: trip.destinationName,
        destinationLat: trip.destinationLat,
        destinationLng: trip.destinationLng,
        startDate: trip.startDate,
        endDate: trip.endDate,
        hasRentalCar: trip.hasRentalCar,
        pace: trip.pace,
        mealPreferences: trip.mealPreferences,
        status: trip.status,
        updatedAt: trip.updatedAt,
      },
      attractions: attractions.map((attraction) => ({
        _id: attraction._id,
        _creationTime: attraction._creationTime,
        name: attraction.name,
        category: attraction.category,
        description: attraction.description,
        practicalNotes: attraction.practicalNotes,
        lat: attraction.lat,
        lng: attraction.lng,
        address: attraction.address,
        officialUrl: attraction.officialUrl,
        ticketUrl: attraction.ticketUrl,
        sourceUrls: attraction.sourceUrls,
        photoUrls: attraction.photoUrls,
        openingHoursSummary: attraction.openingHoursSummary,
        costSummary: attraction.costSummary,
        estimatedVisitMinutes: attraction.estimatedVisitMinutes,
        requiresTicket: attraction.requiresTicket,
        confidence: attraction.confidence,
        rating: ratingByAttraction.get(attraction._id) ?? 2,
      })),
      restaurants: restaurants.map((restaurant) => ({
        _id: restaurant._id,
        _creationTime: restaurant._creationTime,
        name: restaurant.name,
        cuisine: restaurant.cuisine,
        lat: restaurant.lat,
        lng: restaurant.lng,
        neighborhood: restaurant.neighborhood,
        priceLevel: restaurant.priceLevel,
        openingHoursSummary: restaurant.openingHoursSummary,
        notes: restaurant.notes,
        photoUrls: restaurant.photoUrls,
        sourceUrls: restaurant.sourceUrls,
      })),
    };
  },
});

export const createDemoTrip = mutation({
  args: {
    sessionId: v.string(),
    destinationName: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    hasRentalCar: v.boolean(),
    pace: paceValidator,
    mealPreferences: v.array(v.string()),
  },
  returns: v.id("trips"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const mealPreferences = args.mealPreferences
      .map((preference) => preference.trim())
      .filter((preference) => preference.length > 0)
      .slice(0, 8);

    const tripId = await ctx.db.insert("trips", {
      sessionId: args.sessionId,
      title: `${args.destinationName} discovery plan`,
      destinationName: args.destinationName,
      destinationLat: 35.6764,
      destinationLng: 139.65,
      startDate: args.startDate,
      endDate: args.endDate,
      hasRentalCar: args.hasRentalCar,
      pace: args.pace,
      mealPreferences,
      status: "readyToRate",
      createdAt: now,
      updatedAt: now,
    });

    for (const attraction of tokyoAttractions) {
      await ctx.db.insert("attractions", {
        tripId,
        ...attraction,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const restaurant of tokyoRestaurants) {
      await ctx.db.insert("restaurants", {
        tripId,
        ...restaurant,
        createdAt: now,
        updatedAt: now,
      });
    }

    return tripId;
  },
});

export const setRating = mutation({
  args: {
    tripId: v.id("trips"),
    attractionId: v.id("attractions"),
    sessionId: v.string(),
    rating: ratingValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.sessionId !== args.sessionId) {
      throw new Error("Trip not found");
    }

    const attraction = await ctx.db.get(args.attractionId);
    if (!attraction || attraction.tripId !== args.tripId) {
      throw new Error("Attraction not found");
    }

    const existingRating = await ctx.db
      .query("attractionRatings")
      .withIndex("by_tripId_and_attractionId_and_sessionId", (q) =>
        q
          .eq("tripId", args.tripId)
          .eq("attractionId", args.attractionId)
          .eq("sessionId", args.sessionId),
      )
      .unique();

    const now = Date.now();
    if (existingRating) {
      await ctx.db.patch(existingRating._id, {
        rating: args.rating,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("attractionRatings", {
        tripId: args.tripId,
        attractionId: args.attractionId,
        sessionId: args.sessionId,
        rating: args.rating,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.tripId, { updatedAt: now });
    return null;
  },
});

const tokyoAttractions = [
  {
    name: "Senso-ji Temple",
    category: "temple" as const,
    description:
      "Tokyo's oldest temple anchors Asakusa with a dramatic gate, lantern-lined shopping street, and a lively approach that feels ceremonial without being quiet.",
    practicalNotes:
      "Arrive early for calmer photos. Nakamise-dori gets crowded, but snack stands make it easy to pair this with lunch.",
    lat: 35.7148,
    lng: 139.7967,
    address: "2 Chome-3-1 Asakusa, Taito City, Tokyo",
    officialUrl: "https://www.senso-ji.jp/english/",
    sourceUrls: ["https://www.senso-ji.jp/english/"],
    photoUrls: [
      "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=900&q=80",
    ],
    openingHoursSummary: "Temple grounds are generally open daily; shops vary.",
    costSummary: "Free",
    estimatedVisitMinutes: 90,
    requiresTicket: false,
    confidence: 0.94,
  },
  {
    name: "Tokyo Skytree",
    category: "viewpoint" as const,
    description:
      "A tall observation tower with sweeping views across Tokyo and direct access to Solamachi shops and restaurants.",
    practicalNotes:
      "Best near sunset when visibility is good. Timed tickets reduce waiting, especially on weekends.",
    lat: 35.7101,
    lng: 139.8107,
    address: "1 Chome-1-2 Oshiage, Sumida City, Tokyo",
    officialUrl: "https://www.tokyo-skytree.jp/en/",
    ticketUrl: "https://www.tokyo-skytree.jp/en/ticket/",
    sourceUrls: ["https://www.tokyo-skytree.jp/en/"],
    photoUrls: [
      "https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?auto=format&fit=crop&w=900&q=80",
    ],
    openingHoursSummary: "Usually open daily with ticketed observation decks.",
    costSummary: "Paid observation decks",
    estimatedVisitMinutes: 120,
    requiresTicket: true,
    confidence: 0.9,
  },
  {
    name: "Ueno Park",
    category: "park" as const,
    description:
      "A broad park district with museums, ponds, shrines, and easy links to Ameyoko and the Yamanote Line.",
    practicalNotes:
      "Good flexible stop because several museums and food streets sit nearby if weather changes.",
    lat: 35.7156,
    lng: 139.773,
    address: "Uenokoen, Taito City, Tokyo",
    officialUrl: "https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/en_index.html",
    sourceUrls: [
      "https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/en_index.html",
    ],
    photoUrls: [
      "https://images.unsplash.com/photo-1554797589-7241bb691973?auto=format&fit=crop&w=900&q=80",
    ],
    openingHoursSummary: "Park areas are generally open daily; museums vary.",
    costSummary: "Park free; museums paid separately",
    estimatedVisitMinutes: 120,
    requiresTicket: false,
    confidence: 0.86,
  },
  {
    name: "Meiji Jingu",
    category: "temple" as const,
    description:
      "A forested shrine beside Harajuku that gives central Tokyo a calm, spacious break from neon and shopping streets.",
    practicalNotes:
      "Pair with Harajuku or Shibuya. The main approach involves a pleasant walk under tall trees.",
    lat: 35.6764,
    lng: 139.6993,
    address: "1-1 Yoyogikamizonocho, Shibuya City, Tokyo",
    officialUrl: "https://www.meijijingu.or.jp/en/",
    sourceUrls: ["https://www.meijijingu.or.jp/en/"],
    photoUrls: [
      "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=900&q=80",
    ],
    openingHoursSummary: "Shrine hours vary by season, generally daytime.",
    costSummary: "Free",
    estimatedVisitMinutes: 90,
    requiresTicket: false,
    confidence: 0.91,
  },
  {
    name: "Shibuya Crossing",
    category: "neighborhood" as const,
    description:
      "Tokyo's famous scramble crossing sits at the center of a dense shopping, nightlife, and dining district.",
    practicalNotes:
      "Quick to visit but best after dark. Use it as an evening anchor rather than a long daytime stop.",
    lat: 35.6595,
    lng: 139.7005,
    address: "2 Chome-2-1 Dogenzaka, Shibuya City, Tokyo",
    officialUrl: "https://www.gotokyo.org/en/destinations/western-tokyo/shibuya/index.html",
    sourceUrls: [
      "https://www.gotokyo.org/en/destinations/western-tokyo/shibuya/index.html",
    ],
    photoUrls: [
      "https://images.unsplash.com/photo-1542931287-023b922fa89b?auto=format&fit=crop&w=900&q=80",
    ],
    openingHoursSummary: "Public area open daily.",
    costSummary: "Free",
    estimatedVisitMinutes: 45,
    requiresTicket: false,
    confidence: 0.88,
  },
  {
    name: "Tsukiji Outer Market",
    category: "market" as const,
    description:
      "A compact food market known for seafood, street snacks, knives, and early-day eating near Ginza.",
    practicalNotes:
      "Best in the morning or for an early lunch. Many stalls close by mid-afternoon.",
    lat: 35.6655,
    lng: 139.7707,
    address: "4 Chome-16-2 Tsukiji, Chuo City, Tokyo",
    officialUrl: "https://www.tsukiji.or.jp/english/",
    sourceUrls: ["https://www.tsukiji.or.jp/english/"],
    photoUrls: [
      "https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=900&q=80",
    ],
    openingHoursSummary: "Most shops operate morning to early afternoon.",
    costSummary: "Free to browse; food varies",
    estimatedVisitMinutes: 90,
    requiresTicket: false,
    confidence: 0.84,
  },
  {
    name: "teamLab Planets",
    category: "experience" as const,
    description:
      "An immersive digital-art museum with water, light, and room-scale installations that photograph well.",
    practicalNotes:
      "Book ahead and wear clothing suitable for mirrored floors and water installations.",
    lat: 35.6491,
    lng: 139.7898,
    address: "6 Chome-1-16 Toyosu, Koto City, Tokyo",
    officialUrl: "https://www.teamlab.art/e/planets/",
    ticketUrl: "https://www.teamlab.art/e/planets/#tickets",
    sourceUrls: ["https://www.teamlab.art/e/planets/"],
    photoUrls: [
      "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=80",
    ],
    openingHoursSummary: "Ticketed hours vary by date.",
    costSummary: "Paid timed ticket",
    estimatedVisitMinutes: 120,
    requiresTicket: true,
    confidence: 0.89,
  },
  {
    name: "Tokyo Tower",
    category: "viewpoint" as const,
    description:
      "A classic orange-and-white tower near Zojoji Temple with observation decks and an old-school Tokyo feel.",
    practicalNotes:
      "Works well in late afternoon or evening. Nearby temples and parks make a compact route.",
    lat: 35.6586,
    lng: 139.7454,
    address: "4 Chome-2-8 Shibakoen, Minato City, Tokyo",
    officialUrl: "https://www.tokyotower.co.jp/en.html",
    ticketUrl: "https://www.tokyotower.co.jp/en/price/",
    sourceUrls: ["https://www.tokyotower.co.jp/en.html"],
    photoUrls: [
      "https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=900&q=80",
    ],
    openingHoursSummary: "Usually open daily with ticketed decks.",
    costSummary: "Paid observation decks",
    estimatedVisitMinutes: 90,
    requiresTicket: true,
    confidence: 0.88,
  },
  {
    name: "Ginza",
    category: "neighborhood" as const,
    description:
      "A polished shopping and dining district close to Tsukiji, Tokyo Station, and the Imperial Palace area.",
    practicalNotes:
      "Good dinner anchor. Pedestrianized streets may appear on weekend afternoons.",
    lat: 35.6717,
    lng: 139.765,
    address: "Ginza, Chuo City, Tokyo",
    officialUrl: "https://www.gotokyo.org/en/destinations/central-tokyo/ginza/index.html",
    sourceUrls: [
      "https://www.gotokyo.org/en/destinations/central-tokyo/ginza/index.html",
    ],
    photoUrls: [
      "https://images.unsplash.com/photo-1533050487297-09b450131914?auto=format&fit=crop&w=900&q=80",
    ],
    openingHoursSummary: "Public area open daily; shops and restaurants vary.",
    costSummary: "Free to explore",
    estimatedVisitMinutes: 90,
    requiresTicket: false,
    confidence: 0.82,
  },
  {
    name: "Akihabara",
    category: "neighborhood" as const,
    description:
      "A dense district for electronics, anime, games, arcades, collectibles, and themed cafes.",
    practicalNotes:
      "Best for travelers who enjoy pop culture. Many stores open later than temples and markets.",
    lat: 35.6984,
    lng: 139.773,
    address: "Akihabara, Taito City, Tokyo",
    officialUrl: "https://www.gotokyo.org/en/destinations/central-tokyo/akihabara/index.html",
    sourceUrls: [
      "https://www.gotokyo.org/en/destinations/central-tokyo/akihabara/index.html",
    ],
    photoUrls: [
      "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=900&q=80",
    ],
    openingHoursSummary: "Public area open daily; shops often open late morning.",
    costSummary: "Free to explore",
    estimatedVisitMinutes: 120,
    requiresTicket: false,
    confidence: 0.84,
  },
  {
    name: "Imperial Palace East Gardens",
    category: "park" as const,
    description:
      "Formal gardens and historic castle grounds near Tokyo Station with open lawns, stone walls, and seasonal flowers.",
    practicalNotes:
      "Closed on some days, so the planner should verify hours before locking it into a route.",
    lat: 35.6852,
    lng: 139.7586,
    address: "1-1 Chiyoda, Chiyoda City, Tokyo",
    officialUrl: "https://www.kunaicho.go.jp/e-event/higashigyoen/higashigyoen.html",
    sourceUrls: [
      "https://www.kunaicho.go.jp/e-event/higashigyoen/higashigyoen.html",
    ],
    photoUrls: [
      "https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=900&q=80",
    ],
    openingHoursSummary: "Daytime hours; often closed Monday and Friday.",
    costSummary: "Free",
    estimatedVisitMinutes: 90,
    requiresTicket: false,
    confidence: 0.85,
  },
  {
    name: "Odaiba Seaside Park",
    category: "waterfront" as const,
    description:
      "A bayfront area with skyline views, shopping centers, waterfront walks, and evening light across Rainbow Bridge.",
    practicalNotes:
      "Best as a late-day stop if the route already reaches Toyosu or the bay area.",
    lat: 35.63,
    lng: 139.7765,
    address: "1 Chome-4 Daiba, Minato City, Tokyo",
    officialUrl: "https://www.tptc.co.jp/en/park/01_02",
    sourceUrls: ["https://www.tptc.co.jp/en/park/01_02"],
    photoUrls: [
      "https://images.unsplash.com/photo-1551641506-ee5bf4cb45f1?auto=format&fit=crop&w=900&q=80",
    ],
    openingHoursSummary: "Public waterfront areas generally open daily.",
    costSummary: "Free",
    estimatedVisitMinutes: 90,
    requiresTicket: false,
    confidence: 0.78,
  },
];

const tokyoRestaurants = [
  {
    name: "Tsukiji Sushicho",
    cuisine: "Japanese seafood",
    lat: 35.6651,
    lng: 139.7701,
    neighborhood: "Tsukiji",
    priceLevel: "$$" as const,
    openingHoursSummary: "Best for lunch; market-area hours can end early.",
    notes: "Use as a lunch candidate near Tsukiji and Ginza.",
    photoUrls: [
      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=80",
    ],
    sourceUrls: ["https://www.tsukiji.or.jp/english/"],
  },
  {
    name: "Asakusa Tempura Stand",
    cuisine: "Japanese",
    lat: 35.7139,
    lng: 139.7959,
    neighborhood: "Asakusa",
    priceLevel: "$$" as const,
    openingHoursSummary: "Lunch and dinner hours vary.",
    notes: "Good pairing for Senso-ji and Skytree days.",
    photoUrls: [
      "https://images.unsplash.com/photo-1607301406259-dfb186e15de8?auto=format&fit=crop&w=900&q=80",
    ],
    sourceUrls: ["https://www.gotokyo.org/en/destinations/northern-tokyo/asakusa/index.html"],
  },
  {
    name: "Shibuya Izakaya Lane",
    cuisine: "Japanese casual",
    lat: 35.6604,
    lng: 139.6997,
    neighborhood: "Shibuya",
    priceLevel: "$$" as const,
    openingHoursSummary: "Evening-focused.",
    notes: "Use as a dinner candidate after Meiji Jingu and Shibuya Crossing.",
    photoUrls: [
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=80",
    ],
    sourceUrls: ["https://www.gotokyo.org/en/destinations/western-tokyo/shibuya/index.html"],
  },
  {
    name: "Toyosu Ramen Counter",
    cuisine: "Ramen",
    lat: 35.6484,
    lng: 139.791,
    neighborhood: "Toyosu",
    priceLevel: "$" as const,
    openingHoursSummary: "Lunch and early dinner.",
    notes: "Useful near teamLab Planets when the route reaches Toyosu.",
    photoUrls: [
      "https://images.unsplash.com/photo-1557872943-16a5ac26437e?auto=format&fit=crop&w=900&q=80",
    ],
    sourceUrls: ["https://www.teamlab.art/e/planets/"],
  },
];
