import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, TextInput, StyleSheet, TouchableOpacity,
    FlatList, ActivityIndicator, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing } from '../theme';
import {
    GooglePlacesProvider,
    getGooglePlacesProvider,
    type PlacePrediction,
} from '../lib/location';
import { supabase } from '../lib/supabase';

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
    /** When using the provider, we store the placeId so details are fetched on select */
    placeId?: string;
}

interface Props {
    value: LocationValue | null;
    onChange: (v: LocationValue) => void;
    placeholder?: string;
    /** Google Places API key -- defaults to EXPO_PUBLIC_GOOGLE_PLACES_KEY env var */
    googleApiKey?: string;
}

export default function LocationAutocomplete({
    value,
    onChange,
    placeholder = 'Search city or address...',
    googleApiKey,
}: Props) {
    const [query, setQuery] = useState('');
    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [fallbackResults, setFallbackResults] = useState<LocationResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGpsLoading, setIsGpsLoading] = useState(false);
    const [allowedCountries, setAllowedCountries] = useState<string[]>(["US", "CA"]);
    const [notAvailable, setNotAvailable] = useState(false);
    const [blockedName, setBlockedName] = useState('');
    const [leadSaved, setLeadSaved] = useState(false);
    const [blockedCountry, setBlockedCountry] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Resolve the provider: explicit key > env-var singleton
    const providerRef = useRef<GooglePlacesProvider | null>(null);
    if (!providerRef.current) {
        providerRef.current = googleApiKey
            ? new GooglePlacesProvider(googleApiKey)
            : getGooglePlacesProvider();
    }
    const provider = providerRef.current;
    const usePlaces = provider.isAvailable;

    // Fetch allowed countries from platform settings
    useEffect(() => {
        supabase.from("platform_settings").select("allowed_countries").maybeSingle()
            .then(({ data }) => {
                if (data?.allowed_countries?.length) setAllowedCountries(data.allowed_countries);
            }).catch(() => {});
    }, []);

    // Sync display text with external value
    useEffect(() => {
        if (value?.city) {
            const display = [value.city, value.state].filter(Boolean).join(', ');
            setQuery(display);
        }
    }, [value?.city, value?.state]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (abortRef.current) abortRef.current.abort();
        };
    }, []);

    // -- Fallback: expo-location geocode --
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

    // -- Debounced search (300ms) --
    const handleSearch = useCallback(
        (text: string) => {
            setQuery(text);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (abortRef.current) abortRef.current.abort();

            if (text.length < 2) {
                setPredictions([]);
                setFallbackResults([]);
                setIsOpen(false);
                // Fallback: treat as raw city input
                onChange({ city: text, state: '', country: '', lat: null, lng: null });
                return;
            }

            debounceRef.current = setTimeout(async () => {
                setIsLoading(true);
                const controller = new AbortController();
                abortRef.current = controller;

                try {
                    if (usePlaces) {
                        const preds = await provider.autocomplete(text, {
                            limit: 5,
                            signal: controller.signal,
                        });
                        if (!controller.signal.aborted) {
                            setPredictions(preds);
                            setFallbackResults([]);
                            setIsOpen(preds.length > 0);
                        }
                    } else {
                        const items = await fetchExpoLocationResults(text);
                        if (!controller.signal.aborted) {
                            setFallbackResults(items);
                            setPredictions([]);
                            setIsOpen(items.length > 0);
                        }
                    }
                } catch {
                    // aborted or network error
                } finally {
                    if (!controller.signal.aborted) {
                        setIsLoading(false);
                    }
                }
            }, 300);
        },
        [usePlaces, provider, fetchExpoLocationResults, onChange]
    );

    // -- Select a Google Places prediction --
    const selectPrediction = useCallback(
        async (pred: PlacePrediction) => {
            setIsOpen(false);
            setPredictions([]);
            setIsLoading(true);
            Keyboard.dismiss();

            const details = await provider.getPlaceDetails(pred.placeId);
            setIsLoading(false);

            if (details) {
                // Check if country is allowed
                if (details.country && !allowedCountries.includes(details.country.toUpperCase())) {
                    setNotAvailable(true);
                    setBlockedName(details.city || pred.mainText);
                    setBlockedCountry(details.country || 'Unknown');
                    setLeadSaved(false);
                    setIsLoading(false);
                    return;
                }

                const display = [details.city, details.state].filter(Boolean).join(', ');
                setQuery(display);
                onChange({
                    city: details.city,
                    state: details.state,
                    country: details.country,
                    lat: details.lat,
                    lng: details.lng,
                });
            } else {
                // Fallback: use the prediction text as city name
                setQuery(pred.mainText);
                onChange({
                    city: pred.mainText,
                    state: '',
                    country: '',
                    lat: null,
                    lng: null,
                });
            }
        },
        [provider, onChange, allowedCountries]
    );

    // -- Select a fallback (expo-location) result --
    const selectFallbackResult = (r: LocationResult) => {
        // Check if country is allowed
        if (r.country && !allowedCountries.includes(r.country.toUpperCase())) {
            setNotAvailable(true);
            setBlockedName(r.city || r.displayName);
            setBlockedCountry(r.country || 'Unknown');
            setLeadSaved(false);
            setIsOpen(false);
            setFallbackResults([]);
            Keyboard.dismiss();
            return;
        }

        const display = [r.city, r.state].filter(Boolean).join(', ');
        setQuery(display);
        setIsOpen(false);
        setFallbackResults([]);
        Keyboard.dismiss();
        onChange({
            city: r.city,
            state: r.state,
            country: r.country,
            lat: r.lat,
            lng: r.lng,
        });
    };

    // -- GPS button --
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

    // -- Lead capture for blocked locations --
    const handleNotifyMe = async () => {
        try {
            await supabase.from("location_leads").insert({
                searched_city: blockedName,
                searched_country: blockedCountry,
            });
            setLeadSaved(true);
        } catch {
            // silent fail
        }
    };

    // -- Dismiss not-available banner --
    const dismissNotAvailable = () => {
        setNotAvailable(false);
        setBlockedName('');
        setBlockedCountry('');
        setLeadSaved(false);
    };

    // -- Clear --
    const handleClear = () => {
        setQuery('');
        setPredictions([]);
        setFallbackResults([]);
        setIsOpen(false);
        setNotAvailable(false);
        setBlockedName('');
        setBlockedCountry('');
        setLeadSaved(false);
        onChange({ city: '', state: '', country: '', lat: null, lng: null });
    };

    // Render helpers
    const hasPredictions = usePlaces && predictions.length > 0;
    const hasFallback = !usePlaces && fallbackResults.length > 0;

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
                            if (predictions.length > 0 || fallbackResults.length > 0) setIsOpen(true);
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

            {/* Dropdown: Google Places predictions */}
            {isOpen && hasPredictions && (
                <View style={styles.dropdown}>
                    <FlatList
                        data={predictions}
                        keyExtractor={(item) => item.placeId}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.resultItem}
                                onPress={() => selectPrediction(item)}
                            >
                                <Ionicons
                                    name="location"
                                    size={14}
                                    color={Colors.primary}
                                    style={{ marginRight: 8, marginTop: 2 }}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.resultCity} numberOfLines={1}>
                                        {item.mainText}
                                    </Text>
                                    <Text style={styles.resultCountry} numberOfLines={1}>
                                        {item.secondaryText}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            )}

            {/* Dropdown: Fallback expo-location results */}
            {isOpen && hasFallback && (
                <View style={styles.dropdown}>
                    <FlatList
                        data={fallbackResults}
                        keyExtractor={(_, idx) => String(idx)}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.resultItem}
                                onPress={() => selectFallbackResult(item)}
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

            {/* Not available in your area banner */}
            {notAvailable && (
                <View style={styles.notAvailableBanner}>
                    <View style={styles.notAvailableHeader}>
                        <Ionicons name="warning-outline" size={20} color="#B45309" />
                        <Text style={styles.notAvailableTitle}>Not available in your area yet</Text>
                        <TouchableOpacity onPress={dismissNotAvailable} style={{ marginLeft: 'auto' }}>
                            <Ionicons name="close" size={18} color="#92400E" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.notAvailableSubtitle}>
                        AirTrainr is currently available in {allowedCountries.join(', ')}. We're expanding soon!
                    </Text>
                    {leadSaved ? (
                        <View style={styles.leadSavedRow}>
                            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                            <Text style={styles.leadSavedText}>We'll notify you!</Text>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.notifyButton} onPress={handleNotifyMe}>
                            <Ionicons name="notifications-outline" size={14} color="#FFF" />
                            <Text style={styles.notifyButtonText}>Notify me</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {!usePlaces && (
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
    notAvailableBanner: {
        marginTop: 8,
        backgroundColor: '#FFFBEB',
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: '#F59E0B',
        padding: Spacing.md,
    },
    notAvailableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    notAvailableTitle: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: '#92400E',
    },
    notAvailableSubtitle: {
        fontSize: FontSize.xs,
        color: '#B45309',
        marginBottom: Spacing.sm,
        lineHeight: 18,
    },
    notifyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#F59E0B',
        borderRadius: BorderRadius.md,
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignSelf: 'flex-start',
    },
    notifyButtonText: {
        color: '#FFF',
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
    },
    leadSavedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    leadSavedText: {
        fontSize: FontSize.sm,
        color: '#16A34A',
        fontWeight: FontWeight.semibold,
    },
});
