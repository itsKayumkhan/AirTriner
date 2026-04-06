import { Platform } from 'react-native';

export const Colors = {
    // Primary
    primary: '#45D0FF',
    primaryDark: '#0090d4',
    primaryLight: '#7ee0ff',
    primaryGlow: 'rgba(69, 208, 255, 0.15)',

    // Accent
    accent: '#0047AB',
    accentDark: '#003380',
    accentLight: '#0066ff',

    // Background
    background: '#0A0D14',
    backgroundSecondary: '#0d1018',
    backgroundTertiary: '#111520',
    card: '#161B22',
    cardHover: '#1c2230',
    surface: '#1a1f2e',

    // Glass effect colors
    glass: 'rgba(255, 255, 255, 0.05)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    glassLight: 'rgba(255, 255, 255, 0.1)',

    // Text
    text: '#ffffff',
    textSecondary: '#a0a0b0',
    textTertiary: '#6b6b7b',
    textMuted: '#4a4a5a',

    // Status
    success: '#00c853',
    successLight: 'rgba(0, 200, 83, 0.15)',
    warning: '#ffab00',
    warningLight: 'rgba(255, 171, 0, 0.15)',
    error: '#ff1744',
    errorLight: 'rgba(255, 23, 68, 0.15)',
    info: '#00b0ff',
    infoLight: 'rgba(0, 176, 255, 0.15)',

    // Borders
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.12)',
    borderActive: 'rgba(69, 208, 255, 0.4)',

    // Sports Colors
    sportHockey: '#45D0FF',
    sportBaseball: '#d63031',
    sportBasketball: '#e17055',
    sportSoccer: '#00b894',
    sportFootball: '#6c5ce7',
    sportTennis: '#fdcb6e',
    sportGolf: '#55efc4',
    sportSwimming: '#0984e3',
    sportBoxing: '#d63031',
    sportLacrosse: '#a29bfe',

    // Gradient
    gradientStart: '#45D0FF',
    gradientEnd: '#0047AB',
    gradientAccent: '#0090d4',

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.6)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 48,
};

export const BorderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    pill: 100,
};

export const FontSize = {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    hero: 42,
};

export const FontWeight = {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
};

const makeShadow = (native: any, webBoxShadow: string) =>
    Platform.OS === 'web' ? { boxShadow: webBoxShadow } : native;

export const Shadows = {
    small: makeShadow(
        { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
        '0 2px 4px rgba(0,0,0,0.15)'
    ),
    medium: makeShadow(
        { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
        '0 4px 8px rgba(0,0,0,0.2)'
    ),
    large: makeShadow(
        { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
        '0 8px 16px rgba(0,0,0,0.3)'
    ),
    glow: makeShadow(
        { shadowColor: '#45D0FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5 },
        '0 0 12px rgba(69,208,255,0.3)'
    ),
};
