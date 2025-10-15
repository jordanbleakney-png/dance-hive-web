import type Stripe from "stripe";

export function getEmailFromStripe(event: Stripe.Event): string | null {
  // Stripe.Event.data.object is a wide union, so we first cast to unknown
  const data = event.data.object as unknown;

  // Narrow to partial types for common Stripe event objects
  const session = data as Partial<Stripe.Checkout.Session>;
  const invoice = data as Partial<Stripe.Invoice>;
  const subscription = data as Partial<Stripe.Subscription>;

  // Safely get an email from multiple possible Stripe sources
  const email =
    session?.customer_details?.email ??
    invoice?.customer_email ??
    (subscription?.metadata?.email as string | undefined) ??
    null;

  return typeof email === "string" ? email.trim().toLowerCase() : null;
}
