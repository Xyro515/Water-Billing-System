import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href, useFocusEffect } from 'expo-router';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { BottomNav, Card, MainNavTransition, ScreenHeader, ScreenState, StatusBadge } from '../../components/ui';
import { loadCustomerPage, type CustomerListItem } from '../../services/customers';
import { colors, radii, spacing } from '../../theme/tokens';
import { useAuth } from '../../contexts/auth';
import { SmoothPressable as Pressable } from '../../components/SmoothPressable';

type Filter = 'All' | 'Active' | 'Attention';

export default function CustomersScreen() {
  const { session } = useAuth();
  const ownerId = session?.user.id;
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [data, setData] = useState<CustomerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  const load = useCallback(async (nextPage = 0, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      if (!ownerId) throw new Error('A signed-in employee is required.');
      const result = await loadCustomerPage(debouncedQuery, nextPage, ownerId);
      setData((current) => append ? [...current, ...result.items.filter((item) => !current.some((existing) => existing.id === item.id))] : result.items);
      setTotal(result.count); setPage(nextPage);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load assigned customers.'); }
    finally { setLoading(false); setLoadingMore(false); setRefreshing(false); }
  }, [debouncedQuery, ownerId]);
  useFocusEffect(useCallback(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]));

  const filtered = useMemo(() => data.filter((customer) => {
    const localMatch = !query.trim() || `${customer.full_name} ${customer.account_number} ${customer.meter?.meter_number ?? ''} ${customer.meter?.serial_number ?? ''}`.toLowerCase().includes(query.trim().toLowerCase());
    return localMatch && (filter === 'All' || (filter === 'Active' && customer.status === 'active' && Boolean(customer.meter)) || (filter === 'Attention' && (customer.status !== 'active' || !customer.meter)));
  }), [data, filter, query]);

  return <SafeAreaView style={styles.safe}>
    <MainNavTransition />
    <ScreenHeader title="Customers" subtitle={`${total} assigned account${total === 1 ? '' : 's'}`} />
    <View style={styles.search}><Ionicons name="search-outline" size={21} color={colors.primary} /><TextInput accessibilityLabel="Search customers" value={query} onChangeText={setQuery} returnKeyType="search" placeholder="Search name, account, meter, or serial" placeholderTextColor="#8CA09D" style={styles.input} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')}><Ionicons name="close-circle" size={20} color={colors.inkMuted} /></Pressable> : null}</View>
    <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => router.navigate('/meters/scan' as Href)} style={styles.scan}><Ionicons name="qr-code-outline" size={19} color={colors.surface} /><Text style={styles.scanText}>Scan meter QR</Text></Pressable></View>
    <View style={styles.body}><View accessibilityRole="tablist" style={styles.filterRow}>{(['All', 'Active', 'Attention'] as Filter[]).map((item) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: filter === item }} key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}><Text style={[styles.filterText, filter === item && styles.filterActiveText]}>{item}</Text></Pressable>)}</View>
      {loading && !data.length ? <ScreenState loading title="Loading customers" message="Fetching your assigned accounts securely." /> : error && !data.length ? <ScreenState icon="cloud-offline-outline" title="Couldn’t load customers" message={error} actionLabel="Try again" onAction={() => void load()} /> : filtered.length === 0 ? <ScreenState icon="search-outline" title="No customers found" message="Try another name, account number, meter number, serial number, or filter." actionLabel="Clear search" onAction={() => { setQuery(''); setFilter('All'); }} /> : <FlatList data={filtered} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.primary} />} onEndReached={() => { if (data.length < total && !loadingMore) void load(page + 1, true); }} onEndReachedThreshold={0.4} ListHeaderComponent={<Text style={styles.count}>{filtered.length} of {total} account{total === 1 ? '' : 's'}</Text>} ListFooterComponent={loadingMore ? <Text style={styles.loadingMore}>Loading more…</Text> : undefined} renderItem={({ item: customer }) => <Pressable accessibilityRole="button" accessibilityLabel={`Open ${customer.full_name}`} onPress={() => router.navigate({ pathname: '/customers/[id]', params: { id: customer.id } })}><Card style={styles.card}><View style={styles.cardTop}><View style={styles.avatar}><Text style={styles.avatarText}>{customer.full_name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</Text></View><View style={styles.copy}><Text numberOfLines={1} style={styles.name}>{customer.full_name}</Text><Text style={styles.account}>{customer.account_number}</Text></View><StatusBadge label={customer.status[0].toUpperCase() + customer.status.slice(1)} /></View><View style={styles.rule} /><Text numberOfLines={2} style={styles.address}>{customer.service_address}</Text><View style={styles.meterRow}><Text style={styles.meter}>{customer.meter ? `Meter ${customer.meter.meter_number}` : 'No active meter'}</Text><Ionicons name="chevron-forward" size={17} color={colors.primary} /></View></Card></Pressable>} />}
    </View><BottomNav />
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.surface }, search: { marginHorizontal: spacing.md, marginTop: spacing.md, minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }, input: { flex: 1, minHeight: 50, marginLeft: 10, color: colors.ink, fontSize: 14 }, actions: { paddingHorizontal: spacing.md, paddingVertical: 10, alignItems: 'flex-end' }, scan: { minHeight: 42, borderRadius: radii.md, backgroundColor: colors.primary, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 8 }, scanText: { color: colors.surface, fontWeight: '800', fontSize: 12 }, body: { flex: 1, paddingTop: 4, backgroundColor: colors.background }, content: { padding: spacing.md, paddingTop: 12, gap: 12 }, filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md }, filter: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }, filterActive: { backgroundColor: colors.primary, borderColor: colors.primary }, filterText: { color: colors.inkMuted, fontWeight: '700', fontSize: 11 }, filterActiveText: { color: colors.surface }, count: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' }, loadingMore: { color: colors.inkMuted, textAlign: 'center', padding: 16 }, card: { padding: 15 }, cardTop: { flexDirection: 'row', alignItems: 'center' }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.primary, fontWeight: '900' }, copy: { flex: 1, marginLeft: 12 }, name: { color: colors.ink, fontWeight: '900', fontSize: 15 }, account: { color: colors.inkMuted, fontSize: 11, marginTop: 3 }, rule: { height: 1, backgroundColor: colors.line, marginVertical: 12 }, address: { color: colors.inkMuted, fontSize: 12, lineHeight: 18 }, meterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }, meter: { flex: 1, color: colors.ink, fontSize: 11, fontWeight: '800' } });
