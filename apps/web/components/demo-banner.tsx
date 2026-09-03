import { IS_DEMO_MODE } from "apps/web/lib/constants";

/**
 * Marks the public demo instance.
 *
 * A demo account is seeded with a month of delivery history, opens, clicks and
 * bounces that nobody ever sent. Without a standing marker those numbers read
 * as a real sending record — which is exactly what makes the demo useful and
 * exactly what makes it misleading.
 */
export function DemoBanner() {
  if (!IS_DEMO_MODE) {
    return null;
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      This is the Senlo demo. The contacts, automations and delivery history in
      this account are sample data — nothing here was ever sent.
    </div>
  );
}
