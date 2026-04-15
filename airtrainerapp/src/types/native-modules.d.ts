/**
 * Ambient type declarations for native-only packages that are listed in
 * package.json but may not be installed in all environments (e.g. CI, web-only
 * development). The actual implementations are provided by platform-specific
 * files (maps.tsx / maps.web.tsx, stripe.tsx / stripe.web.tsx).
 */

declare module 'react-native-maps' {
    import * as React from 'react';
    import { ViewProps } from 'react-native';

    export interface Region {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
    }

    export interface LatLng {
        latitude: number;
        longitude: number;
    }

    export interface MapViewProps extends ViewProps {
        initialRegion?: Region;
        region?: Region;
        customMapStyle?: object[];
        showsUserLocation?: boolean;
        showsMyLocationButton?: boolean;
        onMapReady?: () => void;
        provider?: string;
        children?: React.ReactNode;
        [key: string]: any;
    }

    export interface MarkerProps {
        coordinate: LatLng;
        title?: string;
        description?: string;
        onCalloutPress?: () => void;
        children?: React.ReactNode;
        [key: string]: any;
    }

    export interface CalloutProps {
        tooltip?: boolean;
        onPress?: () => void;
        children?: React.ReactNode;
        [key: string]: any;
    }

    export interface CircleProps {
        center: LatLng;
        radius: number;
        [key: string]: any;
    }

    export class MapView extends React.Component<MapViewProps> {
        fitToCoordinates(coords: LatLng[], options?: { edgePadding?: object; animated?: boolean }): void;
    }

    export class Marker extends React.Component<MarkerProps> {}
    export class Callout extends React.Component<CalloutProps> {}
    export class Circle extends React.Component<CircleProps> {}

    export const PROVIDER_GOOGLE: string;

    export default MapView;
}

declare module '@stripe/stripe-react-native' {
    import * as React from 'react';

    export interface StripeProviderProps {
        publishableKey: string;
        merchantIdentifier?: string;
        urlScheme?: string;
        children?: React.ReactNode;
        [key: string]: any;
    }

    export class StripeProvider extends React.Component<StripeProviderProps> {}

    export function useStripe(): {
        initPaymentSheet: (params: any) => Promise<any>;
        presentPaymentSheet: () => Promise<any>;
        confirmPayment: (paymentIntentClientSecret: string, params: any) => Promise<any>;
        [key: string]: any;
    };
}
