import * as React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListGymBodyWeightLogs, useCreateGymBodyWeightLog, useDeleteGymBodyWeightLog,
  getListGymBodyWeightLogsQueryKey,
} from '@workspace/api-client-react';
import type { GymBodyWeightLog } from '@workspace/api-client-react';
import { useThemeColors, type ThemeColors } from '../../lib/theme';
import { SwipeableRow } from '../../components/SwipeableRow';
import { sanitizeNumericInput, todayStr } from '@workspace/shared';

function LogRow({ log, color, onDelete }: { log: GymBodyWeightLog; color: ThemeColors; onDelete: (id: number) => void }) {
  return (
    <SwipeableRow onDelete={() => onDelete(log.id)} destructiveColor={color.destructive} borderRadius={12}>
      <View style={[styles.row, { backgroundColor: color.card, borderColor: color.border }]}>
        <Text style={[styles.date, { color: color.foreground }]}>
          {new Date(log.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </Text>
        <Text style={[styles.weight, { color: color.primary }]}>{log.weightKg} kg</Text>
      </View>
    </SwipeableRow>
  );
}

export default function WeightTrackerTab() {
  const color = useThemeColors();
  const queryClient = useQueryClient();
  const { data: logs = [] } = useListGymBodyWeightLogs();
  const createLog = useCreateGymBodyWeightLog();
  const deleteLog = useDeleteGymBodyWeightLog();
  const [weightText, setWeightText] = React.useState('');

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListGymBodyWeightLogsQueryKey() });
  }

  function handleAdd() {
    const trimmed = weightText.trim();
    if (!trimmed) return;
    const weightVal = Number(trimmed);
    if (Number.isNaN(weightVal)) return;
    createLog.mutate({ data: { date: todayStr(), weightKg: weightVal } }, {
      onSuccess: () => { invalidate(); setWeightText(''); },
    });
  }

  function handleDelete(id: number) {
    Alert.alert('Delete log?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteLog.mutate({ id }, { onSuccess: invalidate }) },
    ]);
  }

  const sortedDesc = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sortedDesc[0];
  const first = [...logs].sort((a, b) => a.date.localeCompare(b.date))[0];
  const change = latest && first && latest.id !== first.id ? latest.weightKg - first.weightKg : null;

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.addBox, { borderColor: color.border, backgroundColor: color.muted }]}>
        <TextInput
          style={[styles.addInput, { color: color.foreground }]}
          value={weightText}
          onChangeText={t => setWeightText(sanitizeNumericInput(t, true))}
          placeholder="Log today's weight (kg)…"
          placeholderTextColor={color.mutedForeground}
          keyboardType="decimal-pad"
          onSubmitEditing={handleAdd}
        />
        {weightText.trim().length > 0 && (
          <TouchableOpacity onPress={handleAdd} style={[styles.addButton, { backgroundColor: color.primary }]}>
            <Text style={{ color: color.primaryForeground, fontWeight: '600' }}>Log Weight</Text>
          </TouchableOpacity>
        )}
      </View>

      {latest && (
        <View style={[styles.statCard, { backgroundColor: color.card, borderColor: color.border }]}>
          <Text style={[styles.statValue, { color: color.foreground }]}>{latest.weightKg} <Text style={styles.statUnit}>kg current</Text></Text>
          {change != null && first && (
            <Text style={{ color: change < 0 ? '#10b981' : change > 0 ? '#f59e0b' : color.mutedForeground, fontSize: 13, fontWeight: '600' }}>
              {change > 0 ? '+' : ''}{change.toFixed(1)} kg since {new Date(first.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
          )}
        </View>
      )}

      <FlatList
        data={sortedDesc}
        keyExtractor={l => String(l.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <LogRow log={item} color={color} onDelete={handleDelete} />}
        ListEmptyComponent={<Text style={[styles.empty, { color: color.mutedForeground }]}>No weight logs yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  addBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  addInput: { fontSize: 14, paddingVertical: 4 },
  addButton: { marginTop: 10, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  statCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12, gap: 4 },
  statValue: { fontSize: 22, fontWeight: '700' },
  statUnit: { fontSize: 13, fontWeight: '400' },
  list: { gap: 8, paddingBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  date: { fontSize: 13, flex: 1 },
  weight: { fontSize: 14, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 24, fontSize: 14 },
});
