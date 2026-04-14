import { Platform, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const Colors = {
    // Primary
    primary: '#45D0FF',
    primaryDark: '#0090d4',
    primaryLight: '#7ee0ff',
    primaryGlow: 'rgba(69, 208, 255, 0.15)',
    primaryMuted: 'rgba(69, 208, 255, 0.08)',

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
    surfaceElevated: '#1e2530',

    // Glass effect colors
    glass: 'rgba(255, 255, 255, 0.05)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    glassLight: 'rgba(255, 255, 255, 0.1)',

    // Text
    text: '#FFFFFF',
    textSecondary: '#9CA3AF',
    textTertiary: '#6B7280',
    textMuted: '#4B5563',
    textInverse: '#0A0D14',

    // Status
    success: '#10B981',
    successLight: 'rgba(16, 185, 129, 0.12)',
    successMuted: 'rgba(16, 185, 129, 0.08)',
    warning: '#F59E0B',
    warningLight: 'rgba(245, 158, 11, 0.12)',
    warningMuted: 'rgba(245, 158, 11, 0.08)',
    error: '#EF4444',
    errorLight: 'rgba(239, 68, 68, 0.12)',
    errorMuted: 'rgba(239, 68, 68, 0.08)',
    info: '#3B82F6',
    infoLight: 'rgba(59, 130, 246, 0.12)',
    infoMuted: 'rgba(59, 130, 246, 0.08)',

    // Borders
    border: 'rgba(255, 255, 255, 0.06)',
    borderLight: 'rgba(255, 255, 255, 0.10)',
    borderActive: 'rgba(69, 208, 255, 0.4)',
    borderFocus: 'rgba(69, 208, 255, 0.6)',

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
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    pill: 100,
};

export const FontSize = {
    xxs: 10,
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    hero: 36,
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

export const Layout = {
    screenPadding: Spacing.xl,
    headerTopPadding: Platform.OS === 'ios' ? 56 : 48,
    screenWidth: SCREEN_WIDTH,
    isSmallScreen: SCREEN_WIDTH < 380,
    cardGap: Spacing.md,
    sectionGap: Spacing.xxl,
};

// ── Shared utility functions ──
export const getStatusColor = (status: string) => {
    switch (status) {
        case 'pending': return Colors.warning;
        case 'confirmed': return Colors.info;
        case 'completed': return Colors.success;
        case 'cancelled': return Colors.error;
        case 'no_show': return Colors.textTertiary;
        case 'disputed': return Colors.error;
        default: return Colors.warning;
    }
};

export const getStatusBg = (status: string) => {
    switch (status) {
        case 'pending': return Colors.warningLight;
        case 'confirmed': return Colors.infoLight;
        case 'completed': return Colors.successLight;
        case 'cancelled': return Colors.errorLight;
        case 'no_show': return 'rgba(107,107,123,0.08)';
        case 'disputed': return Colors.errorLight;
        default: return Colors.warningLight;
    }
};

export const getStatusLabel = (status: string) => {
    switch (status) {
        case 'pending': return 'Pending';
        case 'confirmed': return 'Confirmed';
        case 'completed': return 'Completed';
        case 'cancelled': return 'Cancelled';
        case 'no_show': return 'No Show';
        case 'disputed': return 'Disputed';
        default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
};

export const getInitials = (firstName?: string, lastName?: string) => {
    return ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase() || '?';
};

export const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

export const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};
