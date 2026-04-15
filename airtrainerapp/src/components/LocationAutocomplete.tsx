import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, TextInput, StyleSheet, TouchableOpacity,
    FlatList, ActivityIndicator, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing } from '../theme';

export interface LocationValue {
    city: string;
    state: string;
    country: string;
    lat: number | null;
    lng: number | null;
}

interface LocationResult {
    city: string;
    state: string;
    country: string;
    lat: number;
    lng: number;
    displayName: string;
}

interface Props {
    value: LocationValue | null;
    onChange: (v: LocationValue) => void;
    placeholder?: string;
    /** Google Places API key - when provided, enables Places autocomplete */
    googleApiKey?: string;
}

export default function LocationAutocomplete({
    value,
    onChange,
    placeholder = 'Search city or address...',
    googleApiKey,
}: Props) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<LocationResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGpsLoading, setIsGpsLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Sync display text with external value
    useEffect(() => {
        if (value?.city) {
            const display = [value.city, value.state].filter(Boolean).join(', ');
            setQuery(display);
        }
    }, [value?.city, value?.state]);

    // Cleanup debounce timer and pending requests on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (abortRef.current) abortRef.current.abort();
        };
    }, []);

    // ── Google Places Autocomplete ──
    const fetchGooglePlaces = useCallback(
        async (text: string, signal: AbortSignal) => {
            if (!googleApiKey) return [];
            try {
                const url =
                    `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
                    `?input=${encodeURIComponent(text)}` +
                    `&types=(cities)` +
                    `&key=${googleApiKey}`;
                const res = await fetch(url, { signal });
                const data = await res.json();

                if (data.status !== 'OK' || !data.predictions) return [];

                // Get details for each prediction
                const items: LocationResult[] = [];
                for (const pred of data.predictions.slice(0, 5)) {
                    try {
                        const detailUrl =
                            `https://maps.googleapis.com/maps/api/place/details/json` +
                            `?place_id=${pred.place_id}` +
                            `&fields=geometry,address_components` +
                            `&key=${googleApiKey}`;
                        const detailRes = await fetch(detailUrl, { signal });
                        const detail = await detailRes.json();

                        if (detail.status === 'OK' && detail.result) {
                            const components = detail.result.address_components || [];
                            const city =
                                components.find((c: any) => c.types.includes('locality'))
                                    ?.long_name || '';
                            const state =
                                components.find((c: any) =>
                                    c.types.includes('administrative_area_level_1')
                                )?.short_name || '';
                            const country =
                                components.find((c: any) => c.types.includes('country'))
                                    ?.long_name || '';

                            items.push({
                                city,
                                state,
                                country,
                                lat: detail.result.geometry.location.lat,
                                lng: detail.result.geometry.location.lng,
                                displayName: pred.description,
                            });
                        }
                    } catch {
                        // skip failed detail fetch
                    }
                }
                return items;
            } catch {
                return [];
            }
        },
        [googleApiKey]
    );

    // ── Fallback: expo-location reverse geocode search ──
    const fetchExpoLocationResults = useCallback(
        async (text: string): Promise<LocationResult[]> => {
            try {
                const geocoded = await Location.geocodeAsync(text);
                if (!geocoded || geocoded.length === 0) return [];

                const items: LocationResult[] = [];
                for (const geo of geocoded.slice(0, 5)) {
                    const [reverseResult] = await Location.reverseGeocodeAsync({
                        latitude: geo.latitude,
                        longitude: geo.longitude,
                    });
                    if (reverseResult) {
                        const city = reverseResult.city || reverseResult.subregion || '';
                        const state = reverseResult.region || '';
                        const country = reverseResult.country || '';
                        items.push({
                            city,
                            state,
                            country,
                            lat: geo.latitude,
                            lng: geo.longitude,
                            displayName: [city, state, country].filter(Boolean).join(', '),
                        });
                    }
                }
                return items;
            } catch {
                return [];
            }
        },
        []
    );

    // ── Debounced search ──
    const handleSearch = useCallback(
        (text: string) => {
            setQuery(text);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (abortRef.current) abortRef.current.abort();

            if (text.length < 2) {
                setResults([]);
                setIsOpen(false);
                // Fallback: treat as raw city input
                onChange({ city: text, state: '', country: '', lat: null, lng: null });
                return;
            }

            debounceRef.current = setTimeout(async () => {
                setIsLoading(true);
                const controller = new AbortController();
                abortRef.current = controller;

                let items: LocationResult[];
                if (googleApiKey) {
                    items = await fetchGooglePlaces(text, controller.signal);
                } else {
                    items = await fetchExpoLocationResults(text);
                }

                if (!controller.signal.aborted) {
                    setResults(items);
                    setIsOpen(items.length > 0);
                    setIsLoading(false);
                }
            }, 400);
        },
        [googleApiKey, fetchGooglePlaces, fetchExpoLocationResults, onChange]
    );

    // ── Select a result ──
    const selectResult = (r: LocationResult) => {
        const display = [r.city, r.state].filter(Boolean).join(', ');
        setQuery(display);
        setIsOpen(false);
        setResults([]);
        Keyboard.dismiss();
        onChange({
            city: r.city,
            state: r.state,
            country: r.country,
            lat: r.lat,
            lng: r.lng,
        });
    };

    // ── GPS button ──
    const handleGps = async () => {
        setIsGpsLoading(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setIsGpsLoading(false);
                return;
            }
            const loc = await Location.getCurrentPositionAsync({});
            const [geo] = await Location.reverseGeocodeAsync({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
            });

            const city = geo?.city || geo?.subregion || '';
            const state = geo?.region || '';
            const country = geo?.country || '';
            const display = [city, state].filter(Boolean).join(', ');
            setQuery(display);
            setIsOpen(false);
            onChange({
                city,
                state,
                country,
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
            });
        } catch {
            // permission denied or location error
        } finally {
            setIsGpsLoading(false);
        }
    };

    // ── Clear ──
    const handleClear = () => {
        setQuery('');
        setResults([]);
        setIsOpen(false);
        onChange({ city: '', state: '', country: '', lat: null, lng: null });
    };

    return (
        <View style={styles.wrapper}>
            <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                    <Ionicons
                        name="location-outline"
                        size={16}
                        color={Colors.textTertiary}
                        style={styles.inputIcon}
                    />
                    <TextInput
                        style={styles.input}
                        value={query}
                        onChangeText={handleSearch}
                        placeholder={placeholder}
                        placeholderTextColor={Colors.textMuted}
                        onFocus={() => {
                            if (results.length > 0) setIsOpen(true);
                        }}
                        returnKeyType="search"
                    />
                    {isLoading && (
                        <ActivityIndicator
                            size="small"
                            color={Colors.primary}
                            style={{ marginRight: 8 }}
                        />
                    )}
                    {query.length > 0 && !isLoading && (
                        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* GPS Button */}
                <TouchableOpacity
                    style={styles.gpsButton}
                    onPress={handleGps}
                    disabled={isGpsLoading}
                >
                    {isGpsLoading ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                        <Ionicons name="navigate" size={18} color={Colors.primary} />
                    )}
                </TouchableOpacity>
            </View>

            {/* Dropdown results */}
            {isOpen && results.length > 0 && (
                <View style={styles.dropdown}>
                    <FlatList
                        data={results}
                        keyExtractor={(_, idx) => String(idx)}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.resultItem}
                                onPress={() => selectResult(item)}
                            >
                                <Ionicons
                                    name="location"
                                    size={14}
                                    color={Colors.primary}
                                    style={{ marginRight: 8, marginTop: 2 }}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.resultCity} numberOfLines={1}>
                                        {item.city}{item.state ? `, ${item.state}` : ''}
                                    </Text>
                                    <Text style={styles.resultCountry} numberOfLines={1}>
                                        {item.country}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            )}

            {!googleApiKey && (
                <Text style={styles.hint}>
                    <Ionicons name="information-circle-outline" size={11} color={Colors.textMuted} />{' '}
                    Type a city name and select from suggestions, or use GPS
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        zIndex: 100,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    inputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        height: 44,
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        color: Colors.text,
        fontSize: FontSize.sm,
    },
    clearButton: {
        padding: 4,
    },
    gpsButton: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dropdown: {
        marginTop: 4,
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        maxHeight: 200,
        overflow: 'hidden',
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    resultCity: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
    },
    resultCountry: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: 1,
    },
    hint: {
        fontSize: 10,
        color: Colors.textMuted,
        marginTop: 4,
        paddingHorizontal: 2,
    },
});
