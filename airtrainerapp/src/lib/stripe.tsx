// Platform-specific Stripe exports - native version
// This file is used on iOS and Android
import React from 'react';
import { StripeProvider as NativeStripeProvider } from '@stripe/stripe-react-native';
import { Config } from './config';

export function StripeWrapper({ children }: { children: React.ReactNode }) {
    return (
        <NativeStripeProvider
            publishableKey={Config.stripePublishableKey || 'pk_test_placeholder'}
            merchantIdentifier="merchant.com.airtrainr"
        >
            {children}
        </NativeStripeProvider>
    );
}
