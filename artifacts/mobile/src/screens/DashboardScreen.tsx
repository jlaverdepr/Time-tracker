import * as React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, SafeAreaView } from 'react-native';
import {
  useGetStats, useGetRecentSessions, useListTodoLists, useListTodoTasks, useListGymWorkouts,
} from '@workspace/api-client-react';
import type { TodoTask } from '@workspace/api-client-react';
import { useThemeColors } from '../lib/theme';
import { formatDuration, isTaskComplete, toDateStr, todayStr } from '@workspace/shared';

// Monday-start week bounds, matching the desktop app's startOfWeek/endOfWeek(weekStartsOn: 1).
function weekBounds(d: Date) {
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { start: toDateStr(start), end: toDateStr(end) };
}

function formatSessionDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type Color = ReturnType<typeof useThemeColors>;

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: Color }) {
  return (
    <View style={[styles.statCard, { backgroundColor: color.muted }]}>
      <Text style={[styles.statLabel, { color: color.mutedForeground }]}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, { color: color.foreground }]}>{value}</Text>
        <Text style={[styles.statSub, { color: color.mutedForeground }]}>{sub}</Text>
      </View>
    </View>
  );
}

function ProgressBar({ pct, trackColor, fillColor }: { pct: number; trackColor: string; fillColor: string }) {
  return (
    <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: fillColor }]} />
    </View>
  );
}

export default function DashboardScreen() {
  const color = useThemeColors();
  const { data: stats, isLoading, isError, error } = useGetStats();
  const { data: recentSessions, isLoading: isSessionsLoading } = useGetRecentSessions({ limit: 10 });
  const { data: lists = [] } = useListTodoLists();
  const { data: allTasks = [] } = useListTodoTasks();
  const { data: gymWorkouts = [] } = useListGymWorkouts();

  const workoutsThisWeek = React.useMemo(() => {
    const { start, end } = weekBounds(new Date());
    return gymWorkouts.filter(w => w.date >= start && w.date <= end).length;
  }, [gymWorkouts]);

  const listStats = React.useMemo(() => lists.map(list => {
    const tasks = allTasks.filter(t => t.listId === list.id);
    const total = tasks.length;
    const done = tasks.filter(t => isTaskComplete(t, list.resetDaily)).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { list, total, done, pct };
  }), [lists, allTasks]);

  const overallTotal = listStats.reduce((s, l) => s + l.total, 0);
  const overallDone = listStats.reduce((s, l) => s + l.done, 0);
  const overallPct = overallTotal === 0 ? 0 : Math.round((overallDone / overallTotal) * 100);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: color.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: color.foreground }]}>Dashboard</Text>

        {isLoading && <ActivityIndicator size="large" color={color.primary} style={{ marginTop: 40 }} />}

        {isError && (
          <Text style={[styles.error, { color: color.destructive }]}>
            Couldn't reach the server: {(error as Error)?.message ?? 'unknown error'}
          </Text>
        )}

        {stats && (
          <View style={styles.statsGrid}>
            <StatCard label="Today" value={formatDuration(stats.todayMinutes)} sub={`${stats.todaySessions} session${stats.todaySessions === 1 ? '' : 's'}`} color={color} />
            <StatCard label="This week" value={formatDuration(stats.weekMinutes)} sub={`${stats.weekSessions} session${stats.weekSessions === 1 ? '' : 's'}`} color={color} />
            <StatCard label="This month" value={formatDuration(stats.monthMinutes)} sub={`${stats.monthSessions} session${stats.monthSessions === 1 ? '' : 's'}`} color={color} />
            <StatCard label="Workouts this week" value={String(workoutsThisWeek)} sub={workoutsThisWeek === 1 ? 'workout logged' : 'workouts logged'} color={color} />
          </View>
        )}

        {lists.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: color.foreground }]}>Task Completion</Text>
              <Text style={[styles.sectionMeta, { color: color.mutedForeground }]}>{overallDone}/{overallTotal} tasks done</Text>
            </View>

            <View style={[styles.overallCard, { backgroundColor: color.card, borderColor: color.border }]}>
              <View style={styles.overallHeaderRow}>
                <Text style={[styles.overallLabel, { color: color.mutedForeground }]}>Overall</Text>
                <Text style={[styles.overallPct, { color: color.foreground }]}>{overallPct}%</Text>
              </View>
              <ProgressBar pct={overallPct} trackColor={color.muted} fillColor={color.primary} />
              <View style={styles.legendRow}>
                {listStats.map(({ list, pct }) => (
                  <View key={list.id} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: list.color }]} />
                    <Text style={[styles.legendText, { color: color.mutedForeground }]}>{list.name}</Text>
                    <Text style={[styles.legendPct, { color: list.color }]}>{pct}%</Text>
                  </View>
                ))}
              </View>
            </View>

            {listStats.map(({ list, total, done, pct }) => (
              <View key={list.id} style={[styles.listCard, { backgroundColor: color.card, borderColor: color.border }]}>
                <View style={[styles.listCardBar, { backgroundColor: list.color }]} />
                <View style={styles.listCardBody}>
                  <View style={styles.listCardHeaderRow}>
                    <View style={[styles.listBadge, { backgroundColor: list.color }]}>
                      <Text style={styles.listBadgeText}>{list.letter}</Text>
                    </View>
                    <Text style={[styles.listCardTitle, { color: color.foreground }]}>{list.name}</Text>
                    {list.resetDaily && (
                      <View style={[styles.dailyPill, { backgroundColor: color.muted }]}>
                        <Text style={[styles.dailyPillText, { color: color.mutedForeground }]}>daily</Text>
                      </View>
                    )}
                    <Text style={[styles.listCardPct, { color: list.color }]}>{pct}%</Text>
                  </View>
                  <View style={styles.listCardProgressRow}>
                    <ProgressBar pct={pct} trackColor={color.muted} fillColor={list.color} />
                    <Text style={[styles.listCardCount, { color: color.mutedForeground }]}>{done}/{total}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: color.foreground }]}>Recent Sessions</Text>
          <View style={[styles.sessionsCard, { backgroundColor: color.card, borderColor: color.border }]}>
            {isSessionsLoading ? (
              <Text style={[styles.empty, { color: color.mutedForeground }]}>Loading...</Text>
            ) : !recentSessions || recentSessions.length === 0 ? (
              <Text style={[styles.empty, { color: color.mutedForeground }]}>No recent sessions found. Log some time!</Text>
            ) : (
              recentSessions.map((session, i) => (
                <View
                  key={session.id}
                  style={[
                    styles.sessionRow,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
                  ]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.sessionTopRow}>
                      {session.projectName ? (
                        <View style={styles.sessionProjectRow}>
                          <View style={[styles.dot, { backgroundColor: session.projectColor || '#ccc' }]} />
                          <Text style={[styles.sessionProject, { color: color.foreground }]}>{session.projectName}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.sessionProject, { color: color.mutedForeground }]}>Unassigned</Text>
                      )}
                      <View style={[styles.dateBadge, { backgroundColor: color.secondary }]}>
                        <Text style={[styles.dateBadgeText, { color: color.mutedForeground }]}>{formatSessionDate(session.date)}</Text>
                      </View>
                    </View>
                    {session.subprojectName && (
                      <Text style={[styles.sessionSub, { color: color.mutedForeground }]}>↳ {session.subprojectName}</Text>
                    )}
                    {session.notes && (
                      <Text style={[styles.sessionNotes, { color: color.mutedForeground }]} numberOfLines={1}>{session.notes}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text style={[styles.sessionDuration, { color: color.foreground }]}>{formatDuration(session.durationMinutes)}</Text>
                    {session.startTime && session.endTime && (
                      <Text style={[styles.sessionTime, { color: color.mutedForeground }]}>{session.startTime} - {session.endTime}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 24 },
  title: { fontSize: 28, fontWeight: '700' },
  error: { marginTop: 24, textAlign: 'center' },
  statsGrid: { gap: 12 },
  statCard: { borderRadius: 16, padding: 16 },
  statLabel: { fontSize: 13, marginBottom: 4 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  statValue: { fontSize: 22, fontWeight: '700' },
  statSub: { fontSize: 13 },

  section: { gap: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionMeta: { fontSize: 13 },

  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  overallCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  overallHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overallLabel: { fontSize: 13, fontWeight: '600' },
  overallPct: { fontSize: 17, fontWeight: '700' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
  legendPct: { fontSize: 11, fontWeight: '700' },

  listCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', flexDirection: 'row' },
  listCardBar: { width: 4 },
  listCardBody: { flex: 1, padding: 14, gap: 10 },
  listCardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listBadge: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  listBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  listCardTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  dailyPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  dailyPillText: { fontSize: 9, fontWeight: '600' },
  listCardPct: { fontSize: 13, fontWeight: '700' },
  listCardProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listCardCount: { fontSize: 11, fontVariant: ['tabular-nums'] },

  sessionsCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  empty: { padding: 20, textAlign: 'center', fontSize: 13 },
  sessionRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 14, gap: 10 },
  sessionTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  sessionProjectRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sessionProject: { fontSize: 13, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dateBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  dateBadgeText: { fontSize: 11 },
  sessionSub: { fontSize: 11, marginLeft: 14 },
  sessionNotes: { fontSize: 12 },
  sessionDuration: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sessionTime: { fontSize: 11, fontVariant: ['tabular-nums'] },
});
