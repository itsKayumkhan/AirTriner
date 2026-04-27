import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing, Shadows } from '../theme';
import { MapView, Marker, Callout, MAPS_AVAILABLE } from '../lib/maps';

export interface TrainerPin {
    id: string;
    userId: string;
    name: string;
    sport: string;
    rating: number;
    reviewCount: number;
    hourlyRate: number;
    lat: number;
    lng: number;
    avatarUrl?: string | null;
    isFounder?: boolean;
    isTopRated?: boolean;
    isNew?: boolean;
}

interface Props {
    trainers: TrainerPin[];
    centerLat?: number;
    centerLng?: number;
    onTrainerPress?: (userId: string) => void;
}

export default function TrainerMapView({
    trainers,
    centerLat = 39.8,
    centerLng = -98.5,
    onTrainerPress,
}: Props) {
    const mapRef = useRef<any>(null);
    const [mapError, setMapError] = React.useState(false);

    // All hooks must be called unconditionally before any early return
    const validTrainers = useMemo(
        () => trainers.filter((t) => t.lat && t.lng),
        [trainers]
    );

    // Fit map to all trainer markers
    useEffect(() => {
        if (!MAPS_AVAILABLE || mapError) return;
        if (validTrainers.length > 0 && mapRef.current) {
            const coords = validTrainers.map((t) => ({
                latitude: t.lat,
                longitude: t.lng,
            }));
            setTimeout(() => {
                mapRef.current?.fitToCoordinates(coords, {
                    edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
                    animated: true,
                });
            }, 500);
        }
    }, [validTrainers, mapError]);

    // Web fallback or map load error
    if (!MAPS_AVAILABLE || mapError) {
        return (
            <View style={[styles.container, styles.emptyOverlay]}>
                <Ionicons name="map-outline" size={36} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>
                    {mapError ? 'Map failed to load' : 'Map view is available on mobile devices'}
                </Text>
                <Text style={styles.emptySubtext}>
                    {trainers.length} coach{trainers.length !== 1 ? 'es' : ''} available
                </Text>
            </View>
        );
    }

    const renderMarker = (trainer: TrainerPin) => {
        const initials = trainer.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

        // On Android, custom Callout with tooltip causes "addViewAt" crash.
        // Use default callout on Android, custom tooltip only on iOS.
        const isAndroid = Platform.OS === 'android';

        return (
            <Marker
                key={trainer.id}
                coordinate={{ latitude: trainer.lat, longitude: trainer.lng }}
                tracksViewChanges={false}
                onPress={() => {
                    // On Android, directly navigate on marker press to avoid callout crash
                    if (isAndroid) {
                        onTrainerPress?.(trainer.userId);
                    }
                }}
                onCalloutPress={() => onTrainerPress?.(trainer.userId)}
                title={isAndroid ? trainer.name : undefined}
                description={isAndroid ? `${trainer.sport} · $${trainer.hourlyRate}/hr · ${trainer.rating > 0 ? trainer.rating.toFixed(1) + '★' : 'New'}` : undefined}
            >
                {/* Custom marker pin */}
                <View style={markerStyles.pinContainer}>
                    <View style={markerStyles.pinDot}>
                        {trainer.avatarUrl ? (
                            <Image
                                source={{ uri: trainer.avatarUrl }}
                                style={markerStyles.pinAvatar}
                            />
                        ) : (
                            <Text style={markerStyles.pinInitials}>{initials}</Text>
                        )}
                    </View>
                    <View style={markerStyles.pinTail} />
                    {/* Pulse ring */}
                    <View style={markerStyles.pulseRing} />
                </View>

                {/* Custom Callout popup — iOS only (Android uses title/description) */}
                {!isAndroid && (
                    <Callout tooltip onPress={() => onTrainerPress?.(trainer.userId)}>
                        <View style={calloutStyles.container}>
                            <View style={calloutStyles.header}>
                                {trainer.avatarUrl ? (
                                    <Image
                                        source={{ uri: trainer.avatarUrl }}
                                        style={calloutStyles.avatar}
                                    />
                                ) : (
                                    <View style={calloutStyles.avatarPlaceholder}>
                                        <Text style={calloutStyles.avatarInitials}>{initials}</Text>
                                    </View>
                                )}
                                <View style={calloutStyles.info}>
                                    <Text style={calloutStyles.name} numberOfLines={1}>
                                        {trainer.name}
                                    </Text>
                                    <Text style={calloutStyles.sport} numberOfLines={1}>
                                        {trainer.sport}
                                    </Text>
                                </View>
                            </View>

                            <View style={calloutStyles.statsRow}>
                                <View style={calloutStyles.stat}>
                                    <Ionicons name="star" size={13} color="#FFD700" />
                                    <Text style={calloutStyles.statText}>
                                        {trainer.rating > 0 ? trainer.rating.toFixed(1) : 'New'}
                                    </Text>
                                    <Text style={calloutStyles.statSub}>
                                        ({trainer.reviewCount})
                                    </Text>
                                </View>
                                <Text style={calloutStyles.price}>
                                    ${trainer.hourlyRate}
                                    <Text style={calloutStyles.priceSub}>/hr</Text>
                                </Text>
                            </View>

                            {/* Badges */}
                            <View style={calloutStyles.badgeRow}>
                                {trainer.isFounder && (
                                    <View style={[calloutStyles.badge, { backgroundColor: 'rgba(255,215,0,0.15)' }]}>
                                        <Text style={[calloutStyles.badgeText, { color: '#FFD700' }]}>Founding 50</Text>
                                    </View>
                                )}
                                {trainer.isTopRated && (
                                    <View style={[calloutStyles.badge, { backgroundColor: 'rgba(255,149,0,0.15)' }]}>
                                        <Text style={[calloutStyles.badgeText, { color: '#FF9500' }]}>Top Rated</Text>
                                    </View>
                                )}
                                {trainer.isNew && (
                                    <View style={[calloutStyles.badge, { backgroundColor: 'rgba(0,200,83,0.15)' }]}>
                                        <Text style={[calloutStyles.badgeText, { color: '#00c853' }]}>New</Text>
                                    </View>
                                )}
                            </View>

                            <View style={calloutStyles.viewButton}>
                                <Text style={calloutStyles.viewButtonText}>View Profile</Text>
                                <Ionicons name="arrow-forward" size={12} color="#0A0D14" />
                            </View>
                        </View>
                    </Callout>
                )}
            </Marker>
        );
    };

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                    latitude: centerLat,
                    longitude: centerLng,
                    latitudeDelta: 30,
                    longitudeDelta: 30,
                }}
                customMapStyle={darkMapStyle}
                showsUserLocation
                showsMyLocationButton={false}
                onMapReady={() => {}}
                onError={() => setMapError(true)}
            >
                {validTrainers.map(renderMarker)}
            </MapView>

            {/* Trainer count overlay */}
            <View style={styles.countOverlay}>
                <Ionicons name="people" size={14} color={Colors.primary} />
                <Text style={styles.countText}>
                    {validTrainers.length} coach{validTrainers.length !== 1 ? 'es' : ''} on map
                </Text>
            </View>

            {validTrainers.length === 0 && (
                <View style={styles.emptyOverlay}>
                    <Ionicons name="location-outline" size={36} color={Colors.textTertiary} />
                    <Text style={styles.emptyText}>No coaches with location data</Text>
                    <Text style={styles.emptySubtext}>
                        Try adjusting your filters or search area
                    </Text>
                </View>
            )}
        </View>
    );
}

// ── Dark map style (matches app theme) ──
const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#0A0D14' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0D14' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b7b' }] },
    {
        featureType: 'administrative',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#1a1f2e' }],
    },
    {
        featureType: 'administrative.land_parcel',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#4a4a5a' }],
    },
    {
        featureType: 'poi',
        elementType: 'geometry',
        stylers: [{ color: '#111520' }],
    },
    {
        featureType: 'poi',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#4a4a5a' }],
    },
    {
        featureType: 'road',
        elementType: 'geometry',
        stylers: [{ color: '#161B22' }],
    },
    {
        featureType: 'road',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#1a1f2e' }],
    },
    {
        featureType: 'road.highway',
        elementType: 'geometry',
        stylers: [{ color: '#1a1f2e' }],
    },
    {
        featureType: 'transit',
        elementType: 'geometry',
        stylers: [{ color: '#111520' }],
    },
    {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#0d1018' }],
    },
    {
        featureType: 'water',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#3a3a4a' }],
    },
];

const styles = StyleSheet.create({
    container: {
        flex: 1,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    map: {
        flex: 1,
    },
    countOverlay: {
        position: 'absolute',
        top: 12,
        left: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(10,13,20,0.85)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: BorderRadius.pill,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    countText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    emptyOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(10,13,20,0.8)',
    },
    emptyText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.textSecondary,
        marginTop: Spacing.md,
    },
    emptySubtext: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        marginTop: Spacing.xs,
    },
});

const markerStyles = StyleSheet.create({
    pinContainer: {
        alignItems: 'center',
        width: 44,
        height: 52,
    },
    pinDot: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        ...Shadows.glow,
        zIndex: 2,
    },
    pinAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    pinInitials: {
        fontSize: 12,
        fontWeight: FontWeight.heavy,
        color: '#0A0D14',
    },
    pinTail: {
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#fff',
        marginTop: -1,
        zIndex: 1,
    },
    pulseRing: {
        position: 'absolute',
        top: 0,
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: 'rgba(69,208,255,0.4)',
    },
});

const calloutStyles = StyleSheet.create({
    container: {
        width: 220,
        backgroundColor: '#1a1f2e',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.large,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: Spacing.sm,
        borderWidth: 2,
        borderColor: 'rgba(69,208,255,0.3)',
    },
    avatarPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: Spacing.sm,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(69,208,255,0.3)',
    },
    avatarInitials: {
        fontSize: 13,
        fontWeight: FontWeight.heavy,
        color: Colors.primary,
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.heavy,
        color: '#fff',
    },
    sport: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        fontWeight: FontWeight.semibold,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    statText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: '#fff',
    },
    statSub: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },
    price: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.heavy,
        color: Colors.primary,
    },
    priceSub: {
        fontSize: 10,
        fontWeight: FontWeight.semibold,
        color: 'rgba(69,208,255,0.6)',
    },
    badgeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginBottom: Spacing.sm,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: FontWeight.heavy,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    viewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
        paddingVertical: 6,
    },
    viewButtonText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.heavy,
        color: '#0A0D14',
    },
});
