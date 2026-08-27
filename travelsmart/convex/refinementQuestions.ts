import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const refinementQuestionValidator = v.object({
  _id: v.id("refinementQuestions"),
  _creationTime: v.number(),
  text: v.string(),
  answer: v.optional(v.string()),
  state: v.union(
    v.literal("open"),
    v.literal("answered"),
    v.literal("skipped"),
  ),
  askedAtMs: v.number(),
  answeredAtMs: v.optional(v.number()),
});

export const listOpen = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(refinementQuestionValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
    return await ctx.db
      .query("refinementQuestions")
      .withIndex("by_state", (q) => q.eq("state", "open"))
      .order("desc")
      .take(limit);
  },
});

export const ask = mutation({
  args: { text: v.string() },
  returns: v.id("refinementQuestions"),
  handler: async (ctx, args) => {
    const text = args.text.trim();
    if (text.length === 0 || text.length > 500) {
      throw new Error("Question text must be 1-500 characters.");
    }

    return await ctx.db.insert("refinementQuestions", {
      text,
      state: "open",
      askedAtMs: Date.now(),
    });
  },
});

export const answer = mutation({
  args: {
    id: v.id("refinementQuestions"),
    answer: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const question = await ctx.db.get(args.id);
    if (!question) {
      throw new Error("Question not found.");
    }

    await ctx.db.patch(args.id, {
      answer: args.answer.trim().slice(0, 1000),
      state: "answered",
      answeredAtMs: Date.now(),
    });
    return null;
  },
});

export const skip = mutation({
  args: { id: v.id("refinementQuestions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const question = await ctx.db.get(args.id);
    if (!question) {
      throw new Error("Question not found.");
    }

    await ctx.db.patch(args.id, {
      state: "skipped",
      answeredAtMs: Date.now(),
    });
    return null;
  },
});
