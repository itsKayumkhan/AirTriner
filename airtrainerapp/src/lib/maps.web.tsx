// Platform-specific maps exports - web version (stubs)
// react-native-maps doesn't support web
import React from 'react';
import { View } from 'react-native';

export const MapView = React.forwardRef((props: any, ref: any) => (
    <View ref={ref} style={props.style}>{props.children}</View>
));
MapView.displayName = 'MapView';

export const Marker = (_props: any) => null;
export const Callout = ({ children }: any) => <>{children}</>;
export const Circle = (_props: any) => null;
export const PROVIDER_GOOGLE = undefined;
export const MAPS_AVAILABLE = false;
