import * as React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListSessions, useListProjects, useDeleteSession,
  getListSessionsQueryKey, getGetStatsQueryKey, getGetCalendarQueryKey, getGetRecentSessionsQueryKey,
} from '@workspace/api-client-react';
import type { Session } from '@workspace/api-client-react';
import { useThemeColors, type ThemeColors } from '../lib/theme';
import { formatDuration } from '@workspace/shared';

function SessionRow({ session, color, onDelete }: { session: Session; color: ThemeColors; onDelete: (id: number) => void }) {
  return (
    <View style={[styles.row, { backgroundColor: color.card, borderColor: color.border }]}>
      <View style={styles.rowTop}>
        <Text style={[styles.date, { color: color.foreground }]}>
          {new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
        <Text style={[styles.duration, { color: color.primary }]}>{formatDuration(session.durationMinutes)}</Text>
        <TouchableOpacity onPress={() => onDelete(session.id)} hitSlop={8}>
          <Ionicons name="trash-outline" size={16} color={color.mutedForeground} />
        </TouchableOpacity>
      </View>
      <View style={styles.rowMid}>
        {session.projectName ? (
          <View style={styles.projectTag}>
            <View style={[styles.dot, { backgroundColor: session.projectColor || '#ccc' }]} />
            <Text style={[styles.projectName, { color: color.foreground }]}>{session.projectName}</Text>
          </View>
        ) : (
          <Text style={[styles.projectName, { color: color.mutedForeground }]}>Unassigned</Text>
        )}
        {session.startTime && session.endTime && (
          <Text style={[styles.time, { color: color.mutedForeground }]}>{session.startTime} - {session.endTime}</Text>
        )}
      </View>
      {session.notes && (
        <Text style={[styles.notes, { color: color.mutedForeground }]} numberOfLines={2}>{session.notes}</Text>
      )}
    </View>
  );
}

export default function SessionsScreen() {
  const color = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [projectFilter, setProjectFilter] = React.useState<'all' | 'unassigned' | number>('all');

  const { data: projects = [] } = useListProjects();
  const queryParams = typeof projectFilter === 'number' ? { projectId: projectFilter } : undefined;
  const { data: sessions = [], isLoading } = useListSessions(queryParams);
  const deleteSession = useDeleteSession();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCalendarQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetRecentSessionsQueryKey() });
  }

  function handleDelete(id: number) {
    Alert.alert('Delete session?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSession.mutate({ id }, { onSuccess: invalidate }) },
    ]);
  }

  const filtered = React.useMemo(() => {
    let result = sessions;
    if (projectFilter === 'unassigned') result = result.filter(s => s.projectId == null);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        (s.notes && s.notes.toLowerCase().includes(q)) ||
        (s.projectName && s.projectName.toLowerCase().includes(q))
      );
    }
    return result;
  }, [sessions, search, projectFilter]);

  const filterChips: { label: string; value: 'all' | 'unassigned' | number }[] = [
    { label: 'All Projects', value: 'all' },
    { label: 'Unassigned', value: 'unassigned' },
    ...projects.map(p => ({ label: p.name, value: p.id })),
  ];

  return (
    <View style={[styles.container, { backgroundColor: color.background, paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: color.foreground }]}>Sessions Log</Text>

      <View style={[styles.searchBox, { backgroundColor: color.card, borderColor: color.border }]}>
        <Ionicons name="search" size={16} color={color.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: color.foreground }]}
          placeholder="Search notes or projects..."
          placeholderTextColor={color.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={filterChips}
        keyExtractor={item => String(item.value)}
        style={styles.chipsRow}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
        renderItem={({ item }) => {
          const active = item.value === projectFilter;
          return (
            <TouchableOpacity
              onPress={() => setProjectFilter(item.value)}
              style={[
                styles.chip,
                { borderColor: color.border },
                active && { backgroundColor: color.primary, borderColor: color.primary },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? color.primaryForeground : color.foreground }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {isLoading ? (
        <ActivityIndicator size="large" color={color.primary} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <Text style={[styles.empty, { color: color.mutedForeground }]}>No sessions found matching your filters.</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <SessionRow session={item} color={color} onDelete={handleDelete} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  chipsRow: { flexGrow: 0, marginHorizontal: -20 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '500' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  listContent: { gap: 10, paddingBottom: 20 },
  row: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  date: { fontSize: 14, fontWeight: '600', flex: 1 },
  duration: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rowMid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  projectTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  projectName: { fontSize: 13 },
  time: { fontSize: 12, fontVariant: ['tabular-nums'] },
  notes: { fontSize: 13 },
});
