import Stripe from "stripe";

/**
 * Extracts a normalized (lowercased) email address from any Stripe event.
 * Handles sessions, invoices, and subscriptions safely.
 */
export function getEmailFromStripe(event: Stripe.Event): string | null {
  try {
    let email: string | undefined;

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        email = session.customer_details?.email || (session.metadata?.email as string | undefined);
        break;
      }

      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        email = invoice.customer_email || (invoice.metadata?.email as string | undefined);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        email = sub.metadata?.email as string | undefined;
        break;
      }

      default: {
        const dataObj = event.data.object;

        // Helper type guard
        const isPlainObject = (obj: unknown): obj is Record<string, unknown> =>
          obj !== null && typeof obj === "object" && !Array.isArray(obj);

        if (isPlainObject(dataObj)) {
          const data = dataObj as Record<string, unknown>;

          const maybeEmail =
            (data["customer_email"] as string | undefined) ||
            (isPlainObject(data["customer_details"]) && (data["customer_details"] as { email?: string }).email) ||
            (isPlainObject(data["metadata"]) && (data["metadata"] as { email?: string }).email);

          if (typeof maybeEmail === "string") {
            email = maybeEmail;
          }
        }
        break;
      }
    }

    if (email) {
      return email.toLowerCase().trim();
    }

    console.warn(`[getEmailFromStripe] No email found for event ${event.type}`);
    return null;
  } catch (err) {
    console.error("[getEmailFromStripe] Error extracting email:", err);
    return null;
  }
}

