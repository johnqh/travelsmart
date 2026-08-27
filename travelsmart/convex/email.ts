import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

const emailStatusValidator = v.union(
  v.literal("queued"),
  v.literal("sent"),
  v.literal("skipped"),
  v.literal("error"),
);

const outboundEmailValidator = v.object({
  _id: v.id("outboundEmails"),
  _creationTime: v.number(),
  tripId: v.id("trips"),
  planId: v.id("plans"),
  to: v.string(),
  subject: v.string(),
  status: emailStatusValidator,
  providerMessageId: v.optional(v.string()),
  error: v.optional(v.string()),
  createdAt: v.number(),
  sentAt: v.optional(v.number()),
});

type EmailStatus = "queued" | "sent" | "skipped" | "error";
type EmailPayload = {
  subject: string;
  text: string;
  html: string;
};
type SendSavedPlanResult = {
  status: EmailStatus;
  message: string;
};

export const listForPlan = query({
  args: {
    planId: v.id("plans"),
    sessionId: v.string(),
  },
  returns: v.array(outboundEmailValidator),
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.sessionId !== args.sessionId) {
      return [];
    }

    const emails = await ctx.db
      .query("outboundEmails")
      .withIndex("by_planId", (q) => q.eq("planId", args.planId))
      .order("desc")
      .take(10);

    return emails.map((email) => ({
      _id: email._id,
      _creationTime: email._creationTime,
      tripId: email.tripId,
      planId: email.planId,
      to: email.to,
      subject: email.subject,
      status: email.status,
      providerMessageId: email.providerMessageId,
      error: email.error,
      createdAt: email.createdAt,
      sentAt: email.sentAt,
    }));
  },
});

export const sendSavedPlan = action({
  args: {
    tripId: v.id("trips"),
    planId: v.id("plans"),
    sessionId: v.string(),
    to: v.string(),
  },
  returns: v.object({
    status: emailStatusValidator,
    message: v.string(),
  }),
  handler: async (ctx, args): Promise<SendSavedPlanResult> => {
    const to = args.to.trim();
    if (!isEmailAddress(to)) {
      throw new Error("Enter a valid email address.");
    }

    const payload: EmailPayload | null = await ctx.runQuery(
      internal.plans.getPlanEmailPayload,
      {
        tripId: args.tripId,
        planId: args.planId,
        sessionId: args.sessionId,
      },
    );
    if (!payload) {
      throw new Error("Save the plan before emailing it.");
    }

    const emailId = await ctx.runMutation(internal.email.recordQueued, {
      tripId: args.tripId,
      planId: args.planId,
      sessionId: args.sessionId,
      to,
      subject: payload.subject,
    });

    const apiKey = getEnv("AGENTMAIL_API_KEY");
    const inboxId = getEnv("AGENTMAIL_INBOX_ID");
    if (!apiKey || !inboxId) {
      const message =
        "AgentMail is wired, but AGENTMAIL_API_KEY and AGENTMAIL_INBOX_ID are not configured for this deployment.";
      await ctx.runMutation(internal.email.markSkipped, {
        emailId,
        error: message,
      });
      return { status: "skipped", message };
    }

    const response: Response = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(
        inboxId,
      )}/messages/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          subject: payload.subject,
          text: payload.text,
          html: payload.html,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      await ctx.runMutation(internal.email.markError, {
        emailId,
        error: error.slice(0, 1000),
      });
      return {
        status: "error",
        message: `AgentMail send failed with HTTP ${response.status}.`,
      };
    }

    const providerMessageId = extractMessageId(
      await response.json().catch(() => null),
    );
    await ctx.runMutation(internal.email.markSent, {
      emailId,
      providerMessageId,
    });
    return { status: "sent", message: "Itinerary email sent." };
  },
});

export const recordQueued = internalMutation({
  args: {
    tripId: v.id("trips"),
    planId: v.id("plans"),
    sessionId: v.string(),
    to: v.string(),
    subject: v.string(),
  },
  returns: v.id("outboundEmails"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("outboundEmails", {
      tripId: args.tripId,
      planId: args.planId,
      sessionId: args.sessionId,
      to: args.to,
      subject: args.subject,
      status: "queued",
      createdAt: Date.now(),
    });
  },
});

export const markSent = internalMutation({
  args: {
    emailId: v.id("outboundEmails"),
    providerMessageId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailId, {
      status: "sent",
      providerMessageId: args.providerMessageId,
      sentAt: Date.now(),
    });
    return null;
  },
});

export const markSkipped = internalMutation({
  args: {
    emailId: v.id("outboundEmails"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailId, {
      status: "skipped",
      error: args.error,
      sentAt: Date.now(),
    });
    return null;
  },
});

export const markError = internalMutation({
  args: {
    emailId: v.id("outboundEmails"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailId, {
      status: "error",
      error: args.error,
      sentAt: Date.now(),
    });
    return null;
  },
});

function isEmailAddress(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getEnv(name: string) {
  const maybeProcess = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process;
  return maybeProcess?.env?.[name];
}

function extractMessageId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  for (const key of ["message_id", "messageId", "id"]) {
    if (typeof record[key] === "string") {
      return record[key];
    }
  }
  return undefined;
}
