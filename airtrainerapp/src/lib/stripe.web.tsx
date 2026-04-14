// Platform-specific Stripe exports - web version (no-op)
// Stripe React Native SDK doesn't support web
import React from 'react';

export function StripeWrapper({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
