/**
 * billing.js — Stripe Webhooks and Billing Router for Hono server.
 *
 * Webhook events are verified using Stripe's cryptographic signature
 * via stripe.webhooks.constructEvent() before any data is processed.
 */

import { Hono } from "hono";
import Stripe from "stripe";
import { getUserSubscription, updateUserSubscription } from "../db/database.js";

const billingRouter = new Hono();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET_KEY) {
  console.warn("[Billing] STRIPE_SECRET_KEY not set — billing endpoints are in mock mode.");
}
if (!STRIPE_WEBHOOK_SECRET) {
  console.warn("[Billing] STRIPE_WEBHOOK_SECRET not set — webhook signature verification is disabled (dev mode only).");
}

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// POST /api/billing/webhook — Handle Stripe events with signature verification
billingRouter.post("/webhook", async (c) => {
  const stripeSignature = c.req.header("stripe-signature");
  const rawBody = await c.req.text();
  let event;

  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    // Dev-only fallback: parse JSON directly but log a loud warning
    console.warn("[Billing] WARNING: Processing webhook WITHOUT signature verification (dev mode). Never do this in production.");
    try {
      event = JSON.parse(rawBody);
    } catch {
      return c.json({ error: "Webhook error", message: "Invalid JSON body" }, 400);
    }
  } else {
    if (!stripeSignature) {
      console.warn("[Billing] Webhook rejected: missing stripe-signature header.");
      return c.json({ error: "Webhook error", message: "Missing stripe-signature header" }, 400);
    }
    try {
      // Cryptographically verify the webhook came from Stripe
      event = stripe.webhooks.constructEvent(rawBody, stripeSignature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.warn("[Billing] Webhook signature verification failed:", err.message);
      return c.json({ error: "Webhook signature verification failed", message: err.message }, 400);
    }
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.client_reference_id || session.customer_details?.email;
      if (userId) {
        updateUserSubscription(userId, {
          status: "active",
          tier: "pro",
          customerId: session.customer,
          subscriptionId: session.subscription,
          updatedAt: Date.now(),
        });
        console.log(`[Billing] Subscription activated for user: ${userId}`);
      } else {
        console.warn("[Billing] checkout.session.completed: no userId found in client_reference_id or customer_details.email");
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      updateUserSubscription(customerId, {
        status: "canceled",
        tier: "free",
        updatedAt: Date.now(),
      });
      console.log(`[Billing] Subscription canceled for customer: ${customerId}`);
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const status = subscription.status === "active" ? "active" : "inactive";
      const tier = subscription.status === "active" ? "pro" : "free";
      updateUserSubscription(subscription.customer, {
        status,
        tier,
        updatedAt: Date.now(),
      });
      break;
    }
    default:
      // Unhandled event type — acknowledged but not processed
      break;
  }

  return c.json({ received: true });
});

// GET /api/billing/subscription-status
billingRouter.get("/subscription-status", async (c) => {
  const user = c.get("user") || { id: "guest_user" };
  const sub = getUserSubscription(user.id);
  return c.json({
    userId: user.id,
    subscription: sub,
  });
});

export { billingRouter };
