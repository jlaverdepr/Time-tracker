import * as React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../lib/theme';
import { useConnection } from '../lib/connection';
import { useThemePreference, type ThemePreference } from '../lib/theme-preference';

const APPEARANCE_OPTIONS: { key: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

export default function SettingsScreen() {
  const color = useThemeColors();
  const insets = useSafeAreaInsets();
  const { url, disconnect } = useConnection();
  const { preference, setPreference } = useThemePreference();

  function handleDisconnect() {
    Alert.alert('Disconnect from server?', "You'll need to re-enter the address and pairing token to reconnect.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: disconnect },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: color.background, paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: color.foreground }]}>Settings</Text>

      <View style={[styles.card, { backgroundColor: color.card, borderColor: color.border }]}>
        <Text style={[styles.label, { color: color.mutedForeground }]}>APPEARANCE</Text>
        <View style={styles.appearanceRow}>
          {APPEARANCE_OPTIONS.map(opt => {
            const active = preference === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setPreference(opt.key)}
                style={[
                  styles.appearanceOption,
                  { borderColor: color.border },
                  active && { backgroundColor: color.primary, borderColor: color.primary },
                ]}
              >
                <Ionicons name={opt.icon} size={18} color={active ? color.primaryForeground : color.mutedForeground} />
                <Text style={{ color: active ? color.primaryForeground : color.foreground, fontSize: 12, fontWeight: '600', marginTop: 4 }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: color.card, borderColor: color.border }]}>
        <Text style={[styles.label, { color: color.mutedForeground }]}>CONNECTED SERVER</Text>
        <Text style={[styles.value, { color: color.foreground }]}>{url}</Text>
      </View>

      <TouchableOpacity style={[styles.button, { borderColor: color.destructive }]} onPress={handleDisconnect}>
        <Text style={{ color: color.destructive, fontWeight: '600', fontSize: 14 }}>Disconnect</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  value: { fontSize: 14, fontWeight: '500' },
  appearanceRow: { flexDirection: 'row', gap: 8 },
  appearanceOption: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  button: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
});
