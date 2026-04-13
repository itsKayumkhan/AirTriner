/**
 * No-op fallback location provider.
 *
 * Used when `NEXT_PUBLIC_LOCATIONIQ_KEY` is not configured.
 * Autocomplete returns `[]`, geocode returns `null`, and the app
 * gracefully degrades to a plain text input.
 */

import type { LocationProvider, LocationResult } from "./index";

let _loggedOnce = false;

function logOnce(): void {
  if (_loggedOnce) return;
  _loggedOnce = true;
  console.info(
    "[location] LocationIQ key not set \u2014 autocomplete disabled",
  );
}

export class FallbackProvider implements LocationProvider {
  isConfigured(): boolean {
    return false;
  }

  async autocomplete(
    _query: string,
    _signal?: AbortSignal,
  ): Promise<LocationResult[]> {
    logOnce();
    return [];
  }

  async geocode(_address: string): Promise<LocationResult | null> {
    logOnce();
    return null;
  }
}
