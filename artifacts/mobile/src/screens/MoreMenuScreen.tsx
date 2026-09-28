import * as React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../lib/theme';

type MoreItem = { name: string; icon: keyof typeof Ionicons.glyphMap };

const MORE_ITEMS: MoreItem[] = [
  { name: 'Sessions', icon: 'list-outline' },
  { name: 'Projects', icon: 'folder-outline' },
  { name: 'Settings', icon: 'settings-outline' },
];

export default function MoreMenuScreen({ navigation }: { navigation: { navigate: (name: string) => void } }) {
  const color = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: color.background, paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: color.foreground }]}>More</Text>
      <View style={[styles.list, { backgroundColor: color.card, borderColor: color.border }]}>
        {MORE_ITEMS.map((item, i) => (
          <TouchableOpacity
            key={item.name}
            style={[styles.row, i < MORE_ITEMS.length - 1 && { borderBottomWidth: 1, borderBottomColor: color.border }]}
            onPress={() => navigation.navigate(item.name)}
          >
            <Ionicons name={item.icon} size={20} color={color.primary} />
            <Text style={[styles.rowText, { color: color.foreground }]}>{item.name}</Text>
            <Ionicons name="chevron-forward" size={18} color={color.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  list: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowText: { flex: 1, fontSize: 15, fontWeight: '500' },
});
