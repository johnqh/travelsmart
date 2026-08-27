import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const featureRequestValidator = v.object({
  _id: v.id("featureRequests"),
  _creationTime: v.number(),
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
});

const stateValidator = v.union(
  v.literal("requested"),
  v.literal("inProgress"),
  v.literal("completed"),
  v.literal("rejected"),
);

export const listPublic = query({
  args: {
    state: v.optional(stateValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(featureRequestValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
    const state = args.state;
    if (state) {
      return await ctx.db
        .query("featureRequests")
        .withIndex("by_state", (q) => q.eq("state", state))
        .order("desc")
        .take(limit);
    }

    return await ctx.db.query("featureRequests").order("desc").take(limit);
  },
});

export const listPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(featureRequestValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("featureRequests")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const submit = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  returns: v.id("featureRequests"),
  handler: async (ctx, args) => {
    const title = args.title.trim();
    if (title.length === 0 || title.length > 120) {
      throw new Error("Feature request title must be 1-120 characters.");
    }

    return await ctx.db.insert("featureRequests", {
      title,
      description: (args.description ?? "").trim().slice(0, 1000),
      state: "requested",
      voteCount: 0,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
  },
});

export const upvote = mutation({
  args: { id: v.id("featureRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) {
      throw new Error("Feature request not found.");
    }

    await ctx.db.patch(args.id, { voteCount: request.voteCount + 1 });
    return null;
  },
});

export const setState = mutation({
  args: {
    id: v.id("featureRequests"),
    state: stateValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) {
      throw new Error("Feature request not found.");
    }

    await ctx.db.patch(args.id, { state: args.state });
    return null;
  },
});
