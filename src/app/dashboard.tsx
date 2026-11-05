import { useCallback, useState } from 'react';
import { Alert, Modal, SafeAreaView as NativeSafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { BottomNav, Card, MainNavTransition, Metric, PrimaryButton, ScreenHeader, ScreenState, StatusBadge } from '../components/ui';
import { useAuth } from '../contexts/auth';
import { useOffline } from '../contexts/offline';
import { supabase } from '../lib/supabase';
import { loadCustomerPage, type CustomerListItem } from '../services/customers';
import { colors, radii, spacing } from '../theme/tokens';
import { getGreeting, localDateKey } from '../lib/appFlow';
import { SmoothPressable } from '../components/SmoothPressable';

export default function DashboardScreen() {
  const { profile, session, signOut } = useAuth();
  const { online, pendingCount, failedCount, lastSynchronizedAt, synchronize } = useOffline();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [members, setMembers] = useState<CustomerListItem[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);
  const [billedToday, setBilledToday] = useState(0);
  const [memberSource, setMemberSource] = useState<'server' | 'cache'>('server');
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const ownerId = session?.user.id;

  useFocusEffect(useCallback(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!ownerId) return;
      void (async () => {
        setMembersLoading(true); setMembersError(null);
        try {
          const page = await loadCustomerPage('', 0, ownerId);
          if (!active) return;
          const today = localDateKey();
          setMembers(page.items.filter((member) => member.status === 'active' && member.meter && member.latestReading?.read_at.slice(0, 10) !== today).slice(0, 3)); setMemberCount(page.count); setMemberSource(page.source);
          if (page.source === 'server') {
            const now = new Date(); const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const [readings, invoices] = await Promise.all([
              supabase.from('meter_readings').select('customer_id').gte('read_at', startOfDay),
              supabase.from('invoices').select('total_amount').gte('issued_at', startOfDay).neq('status', 'void'),
            ]);
            if (!active) return;
            if (!readings.error) setCompletedToday(new Set(readings.data.map((reading) => reading.customer_id)).size);
            if (!invoices.error) setBilledToday(invoices.data.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0));
          } else {
            setCompletedToday(page.items.filter((member) => member.latestReading?.read_at.slice(0, 10) === today).length);
            setBilledToday(0);
          }
        } catch (reason) { if (active) setMembersError(reason instanceof Error ? reason.message : 'Assigned members could not be loaded.'); }
        finally { if (active) setMembersLoading(false); }
      })();
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [ownerId]));

  const date = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const logout = () => Alert.alert('Sign out?', 'Your secure session on this device will be cleared.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/'); } }]);
  const displayName = profile?.full_name || 'Employee';
  const hour = new Date().getHours();
  const greeting = getGreeting(hour);
  const progress = memberCount ? Math.min(100, Math.round((completedToday / memberCount) * 100)) : 0;

  return <SafeAreaView style={styles.safe}><MainNavTransition /><ScreenHeader title={`${greeting}, ${displayName.split(' ')[0]}`} subtitle={`${date} · ${profile?.role === 'administrator' ? 'Administrator' : 'Employee'}`} notificationCount={pendingCount + failedCount} onNotification={() => setNotificationsOpen(true)} /><ScrollView contentContainerStyle={styles.content}>
    <View style={[styles.connection, (!online || failedCount > 0) && styles.connectionOffline]}><Ionicons name={!online ? 'cloud-offline-outline' : failedCount > 0 ? 'alert-circle-outline' : 'cloud-done-outline'} size={17} color={!online || failedCount > 0 ? colors.warning : colors.success} /><View style={styles.connectionCopy}><Text style={styles.connectionTitle}>{!online ? 'Offline mode' : failedCount > 0 ? `${failedCount} change${failedCount === 1 ? '' : 's'} need review` : pendingCount ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync` : 'Offline data is synchronized'}</Text><Text style={styles.connectionText}>{online ? lastSynchronizedAt ? `Last synchronized ${new Date(lastSynchronizedAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}` : 'Ready to synchronize' : 'Cached members and drafts remain available on this device'}</Text></View>{pendingCount > 0 && online ? <SmoothPressable accessibilityRole="button" accessibilityLabel="Retry pending synchronization" onPress={() => void synchronize(true)}><Text style={styles.retry}>RETRY</Text></SmoothPressable> : null}</View>
    <View style={styles.routeCard}><View style={styles.routeCopy}><Text style={styles.eyebrow}>TODAY&apos;S ROUTE</Text><Text style={styles.routeTitle}>{members[0]?.route_code ?? profile?.employee_code ?? 'Assigned members'}</Text><Text style={styles.routeMeta}>{completedToday} of {memberCount} meters completed</Text></View><View accessibilityLabel={`${progress} percent route progress`} style={styles.progress}><Text style={styles.progressText}>{progress}%</Text></View></View>
    <View style={styles.metrics}><Metric icon="checkmark-done" value={String(completedToday)} label="Read today" detail={`${Math.max(0, memberCount - completedToday)} remaining`} /><Metric icon="wallet-outline" value={`₱${billedToday.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`} label="Billed today" detail={memberSource === 'cache' ? 'Available when online' : 'Authorized invoices'} /></View>
    <PrimaryButton icon="add-circle-outline" label="Record a meter reading" onPress={() => router.push('/customers')} />
    <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Next unread meters</Text><SmoothPressable accessibilityRole="button" accessibilityLabel="View all members" onPress={() => router.navigate('/customers')}><Text style={styles.link}>View all</Text></SmoothPressable></View>
    {membersLoading ? <ScreenState loading title="Loading assigned members" message="Fetching the latest route records." /> : membersError ? <ScreenState icon="cloud-offline-outline" title="Members unavailable" message={membersError} /> : members.length === 0 ? <ScreenState icon="people-outline" title="No assigned members" message="No active member accounts are assigned to this employee." /> : members.map((member) => <SmoothPressable accessibilityRole="button" accessibilityLabel={`Open ${member.full_name}`} key={member.id} onPress={() => router.push({ pathname: '/customers/[id]', params: { id: member.id } })}><Card style={styles.customer}><View style={styles.avatar}><Text style={styles.avatarText}>{member.full_name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</Text></View><View style={styles.customerCopy}><Text style={styles.customerName}>{member.full_name}</Text><Text numberOfLines={1} style={styles.customerMeta}>{member.account_number} · {member.meter?.meter_number ?? 'No active meter'}</Text></View><StatusBadge label={member.status[0].toUpperCase() + member.status.slice(1)} /></Card></SmoothPressable>)}
    <SmoothPressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={logout} style={styles.logout}><Ionicons name="log-out-outline" size={18} color={colors.danger} /><Text style={styles.logoutText}>Sign out</Text></SmoothPressable>
  </ScrollView><BottomNav />
  <Modal visible={notificationsOpen} transparent animationType="slide" onRequestClose={() => setNotificationsOpen(false)}><NativeSafeAreaView style={styles.modalBackdrop}><SmoothPressable style={styles.modalDismiss} onPress={() => setNotificationsOpen(false)} /><View style={styles.sheet}><View style={styles.sheetHead}><Text style={styles.sheetTitle}>Synchronization</Text><SmoothPressable accessibilityRole="button" accessibilityLabel="Close synchronization details" onPress={() => setNotificationsOpen(false)}><Ionicons name="close" size={25} color={colors.ink} /></SmoothPressable></View><Notification icon="sync-outline" title={`${pendingCount} pending change${pendingCount === 1 ? '' : 's'}`} detail={online ? 'Pending records synchronize automatically.' : 'Records will synchronize when internet connectivity returns.'} />{failedCount > 0 ? <Notification icon="alert-circle-outline" title={`${failedCount} change${failedCount === 1 ? '' : 's'} need review`} detail="These records failed validation or authorization and will not retry automatically." /> : null}<Notification icon="people-outline" title={`${memberCount} assigned members`} detail={`Home data loaded from ${memberSource === 'server' ? 'Supabase' : 'the offline database'}.`} /></View></NativeSafeAreaView></Modal>
  </SafeAreaView>;
}

function Notification({ icon, title, detail }: { icon: 'alert-circle-outline' | 'people-outline' | 'sync-outline'; title: string; detail: string }) { return <View style={styles.notification}><View style={styles.notificationIcon}><Ionicons name={icon} size={19} color={colors.primary} /></View><View style={styles.notificationCopy}><Text style={styles.notificationTitle}>{title}</Text><Text style={styles.notificationDetail}>{detail}</Text></View></View>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.surface }, content: { padding: spacing.md, gap: spacing.md, backgroundColor: colors.background }, connection: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 10, borderRadius: radii.md, backgroundColor: '#E8F5ED' }, connectionOffline: { backgroundColor: colors.warningSoft }, connectionCopy: { flex: 1 }, connectionTitle: { color: colors.ink, fontSize: 11, fontWeight: '800' }, connectionText: { color: colors.inkMuted, fontSize: 9, marginTop: 2 }, retry: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, routeCard: { backgroundColor: colors.primaryDark, borderRadius: 22, padding: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, routeCopy: { flex: 1, paddingRight: 12 }, eyebrow: { color: '#8ED8CF', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, routeTitle: { color: colors.surface, fontWeight: '900', fontSize: 20, marginTop: 9 }, routeMeta: { color: '#C5E9E4', fontSize: 12, marginTop: 6 }, progress: { width: 58, height: 58, borderRadius: 29, borderWidth: 5, borderColor: colors.aqua, alignItems: 'center', justifyContent: 'center' }, progressText: { color: colors.surface, fontWeight: '900', fontSize: 14 }, metrics: { flexDirection: 'row', justifyContent: 'space-between' }, sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }, sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' }, link: { color: colors.primary, fontSize: 13, fontWeight: '800' }, customer: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.primary, fontSize: 13, fontWeight: '900' }, customerCopy: { flex: 1 }, customerName: { color: colors.ink, fontWeight: '800', fontSize: 14 }, customerMeta: { color: colors.inkMuted, fontSize: 10, marginTop: 4 }, logout: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, logoutText: { color: colors.danger, fontSize: 13, fontWeight: '800' }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,44,42,0.4)', justifyContent: 'flex-end' }, modalDismiss: { flex: 1 }, sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, gap: 8 }, sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, sheetTitle: { color: colors.ink, fontWeight: '900', fontSize: 20 }, notification: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }, notificationIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, notificationCopy: { flex: 1, marginLeft: 12 }, notificationTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' }, notificationDetail: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 4 } });
