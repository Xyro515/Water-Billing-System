import { PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { router, Stack, useLocalSearchParams, usePathname, type Href } from 'expo-router';
import { Ionicons, type IoniconsIconName } from '@react-native-vector-icons/ionicons';
import { colors, radii, spacing } from '../theme/tokens';
import { SmoothPressable } from './SmoothPressable';

export function Brand({ compact = false }: { compact?: boolean }) {
  return <View style={styles.brandRow} accessibilityLabel="NMMPC, New Murcia Multipurpose Cooperative"><View style={[styles.drop, compact && styles.dropCompact]}><Ionicons name="water" color={colors.surface} size={compact ? 19 : 27} /></View><View><Text maxFontSizeMultiplier={1.35} style={[styles.brand, compact && styles.brandCompact]}>NMMPC</Text>{!compact && <Text style={styles.brandCaption}>NEW MURCIA MULTIPURPOSE COOPERATIVE</Text>}</View></View>;
}

export function ScreenHeader({ title, subtitle, back, backTarget = '/dashboard', onBack, onNotification, notificationCount = 0 }: { title: string; subtitle?: string; back?: boolean; backTarget?: Href; onBack?: () => void; onNotification?: () => void; notificationCount?: number }) {
  const goBack = () => onBack ? onBack() : router.canGoBack() ? router.back() : router.replace(backTarget);
  return <View style={styles.header}>{back ? <SmoothPressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={goBack} style={styles.roundButton}><Ionicons name="chevron-back" size={23} color={colors.ink} /></SmoothPressable> : <Brand compact />}<View style={styles.headerCopy}><Text numberOfLines={1} maxFontSizeMultiplier={1.4} style={styles.headerTitle}>{title}</Text>{subtitle ? <Text numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</Text> : null}</View>{onNotification ? <SmoothPressable accessibilityRole="button" accessibilityLabel={`${notificationCount} notifications`} onPress={onNotification} style={styles.notificationButton}><Ionicons name="notifications-outline" size={20} color={colors.primary} />{notificationCount > 0 ? <View style={styles.notificationDot}><Text style={styles.notificationCount}>{notificationCount}</Text></View> : null}</SmoothPressable> : null}</View>;
}

export function WorkflowProgress({ current, labels = ['Enter reading', 'Verify details', 'Save invoice'] }: { current: 1 | 2 | 3; labels?: [string, string, string] }) {
  return <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 3, now: current }} accessibilityLabel={`Step ${current} of 3: ${labels[current - 1]}`} style={styles.workflowWrap}><View style={styles.workflowSteps}>{labels.map((_, index) => { const step = index + 1; const complete = step < current; const active = step === current; return <View key={step} style={styles.workflowItem}>{index > 0 ? <View style={[styles.workflowLine, step <= current && styles.workflowLineActive]} /> : null}<View style={[styles.workflowStep, (active || complete) && styles.workflowStepActive]}>{complete ? <Ionicons name="checkmark" size={14} color={colors.surface} /> : <Text style={[styles.workflowNumber, active && styles.workflowNumberActive]}>{step}</Text>}</View></View>; })}</View><Text style={styles.workflowLabel}>{labels[current - 1].toUpperCase()}</Text></View>;
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle | ViewStyle[] }>) { return <View style={[styles.card, style]}>{children}</View>; }

export function PrimaryButton({ label, onPress, icon, disabled, loading = false, accessibilityLabel }: { label: string; onPress: () => void; icon?: IoniconsIconName; disabled?: boolean; loading?: boolean; accessibilityLabel?: string }) {
  return <SmoothPressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} disabled={disabled || loading} onPress={onPress} style={[styles.primaryButton, (disabled || loading) && styles.disabled]}>{loading ? <ActivityIndicator color={colors.surface} /> : <>{icon ? <Ionicons name={icon} size={20} color={colors.surface} /> : null}<Text maxFontSizeMultiplier={1.35} style={styles.primaryButtonText}>{label}</Text></>}</SmoothPressable>;
}

export function SecondaryButton({ label, onPress, icon, disabled }: { label: string; onPress: () => void; icon?: IoniconsIconName; disabled?: boolean }) {
  return <SmoothPressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.secondaryButton, disabled && styles.disabled]}>{icon ? <Ionicons name={icon} size={18} color={colors.primary} /> : null}<Text maxFontSizeMultiplier={1.35} style={styles.secondaryButtonText}>{label}</Text></SmoothPressable>;
}

export function StatusBadge({ label }: { label: string }) {
  const tone = label === 'Paid' ? styles.badgeSuccess : label === 'Overdue' ? styles.badgeDanger : styles.badgeWarning;
  return <View accessible accessibilityLabel={`Status: ${label}`} style={[styles.badge, tone]}><Text style={[styles.badgeText, label === 'Overdue' && styles.badgeDangerText]}>{label}</Text></View>;
}

const navItems: { label: string; icon: IoniconsIconName; activeIcon: IoniconsIconName; route: '/dashboard' | '/customers' | '/printer' }[] = [
  { label: 'Home', icon: 'home-outline', activeIcon: 'home', route: '/dashboard' },
  { label: 'Customers', icon: 'people-outline', activeIcon: 'people', route: '/customers' },
  { label: 'Printer', icon: 'print-outline', activeIcon: 'print', route: '/printer' },
];

export function MainNavTransition() {
  const { navDirection } = useLocalSearchParams<{ navDirection?: 'back' | 'forward' }>();
  return <Stack.Screen options={{ animation: navDirection === 'back' ? 'slide_from_left' : navDirection === 'forward' ? 'slide_from_right' : 'fade' }} />;
}

export function BottomNav() {
  const pathname = usePathname();
  const currentIndex = Math.max(0, navItems.findIndex((item) => pathname === item.route || (item.route === '/customers' && pathname.startsWith('/customers'))));
  return <View accessibilityRole="tablist" style={styles.nav}>{navItems.map((item, targetIndex) => { const active = targetIndex === currentIndex; const direction = targetIndex < currentIndex ? 'back' : 'forward'; return <SmoothPressable accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={item.label} key={item.label} disabled={active} onPress={() => router.replace({ pathname: item.route, params: { navDirection: direction } } as Href)} style={styles.navItem}><View style={[styles.navIcon, active && styles.navIconActive]}><Ionicons name={active ? item.activeIcon : item.icon} size={21} color={active ? colors.primary : colors.inkMuted} /></View><Text style={[styles.navLabel, active && styles.navActive]}>{item.label}</Text></SmoothPressable>; })}</View>;
}

export function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: IoniconsIconName }) {
  return <Card style={styles.metric}><View style={styles.metricIcon}><Ionicons name={icon} size={19} color={colors.primary} /></View><Text maxFontSizeMultiplier={1.25} style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricDetail}>{detail}</Text></Card>;
}

export function ScreenState({ title, message, icon = 'information-circle-outline', loading = false, actionLabel, onAction }: { title: string; message: string; icon?: IoniconsIconName; loading?: boolean; actionLabel?: string; onAction?: () => void }) {
  return <View style={styles.state} accessibilityRole={loading ? 'progressbar' : 'summary'}>{loading ? <ActivityIndicator size="large" color={colors.primary} /> : <Ionicons name={icon} size={38} color={colors.primary} />}<Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateMessage}>{message}</Text>{actionLabel && onAction ? <SecondaryButton label={actionLabel} onPress={onAction} /> : null}</View>;
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, drop: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderBottomLeftRadius: 12 }, dropCompact: { width: 38, height: 38, borderRadius: 19, borderBottomLeftRadius: 9 }, brand: { color: colors.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }, brandCompact: { fontSize: 18 }, brandCaption: { color: colors.primary, fontSize: 7, fontWeight: '800', letterSpacing: 0.45, marginTop: 2 },
  header: { minHeight: 72, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface }, headerCopy: { flex: 1, marginLeft: 14 }, headerTitle: { fontSize: 18, fontWeight: '800', color: colors.ink }, headerSubtitle: { fontSize: 12, color: colors.inkMuted, marginTop: 2 }, roundButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, borderRadius: 19 }, notificationButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, notificationDot: { position: 'absolute', right: -1, top: -2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }, notificationCount: { color: colors.surface, fontSize: 8, fontWeight: '900' },
  card: { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md }, primaryButton: { minHeight: 54, borderRadius: radii.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, gap: 10 }, primaryButtonText: { color: colors.surface, fontSize: 16, fontWeight: '800' }, secondaryButton: { minHeight: 52, borderRadius: radii.md, borderWidth: 1, borderColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, gap: 8 }, secondaryButtonText: { color: colors.primary, fontSize: 15, fontWeight: '800' }, disabled: { opacity: 0.5 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, alignSelf: 'flex-start' }, badgeWarning: { backgroundColor: colors.warningSoft }, badgeSuccess: { backgroundColor: colors.primarySoft }, badgeDanger: { backgroundColor: '#FCE8E8' }, badgeText: { fontSize: 11, fontWeight: '800', color: colors.warning }, badgeDangerText: { color: colors.danger },
  nav: { minHeight: 70, paddingBottom: 8, flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line }, navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }, navIcon: { minWidth: 44, minHeight: 30, paddingHorizontal: 13, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' }, navIconActive: { backgroundColor: colors.primarySoft }, navLabel: { fontSize: 11, fontWeight: '700', color: colors.inkMuted }, navActive: { color: colors.primary },
  metric: { width: '48%', minHeight: 150 }, metricIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, metricValue: { color: colors.ink, fontSize: 27, fontWeight: '900' }, metricLabel: { color: colors.ink, fontSize: 13, fontWeight: '700', marginTop: 2 }, metricDetail: { color: colors.inkMuted, fontSize: 11, marginTop: 6 },
  state: { minHeight: 260, padding: spacing.xl, alignItems: 'center', justifyContent: 'center' }, stateTitle: { color: colors.ink, fontWeight: '900', fontSize: 17, marginTop: 13, textAlign: 'center' }, stateMessage: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7, marginBottom: 17, maxWidth: 290 },
  workflowWrap: { alignItems: 'center', paddingTop: 4 }, workflowSteps: { flexDirection: 'row', alignItems: 'center' }, workflowItem: { flexDirection: 'row', alignItems: 'center' }, workflowLine: { width: 54, height: 2, backgroundColor: colors.line }, workflowLineActive: { backgroundColor: colors.primary }, workflowStep: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, workflowStepActive: { backgroundColor: colors.primary, borderColor: colors.primary }, workflowNumber: { color: colors.inkMuted, fontWeight: '900' }, workflowNumberActive: { color: colors.surface }, workflowLabel: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginTop: 8 },
});
