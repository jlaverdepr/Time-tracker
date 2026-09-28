import * as React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useThemeColors } from '../lib/theme';
import { DEFAULT_API_URL, useConnection } from '../lib/connection';

export default function ConnectScreen() {
  const color = useThemeColors();
  const { connect } = useConnection();
  const [url, setUrl] = React.useState(DEFAULT_API_URL);
  const [token, setToken] = React.useState('');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: color.background }]}>
      <View style={styles.centered}>
        <Text style={[styles.title, { color: color.foreground }]}>
          Focus<Text style={{ color: color.primary }}>Time</Text>
        </Text>
        <Text style={[styles.subtitle, { color: color.mutedForeground }]}>
          Enter your Mac's address and pairing token. Find both via the Mac app's{' '}
          {'‘'}Mobile Pairing…{'’'} menu item. Both devices must be on the same Wi-Fi.
        </Text>
        <TextInput
          style={[styles.input, { borderColor: color.border, color: color.foreground, backgroundColor: color.card }]}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://your-mac.local:8775"
          placeholderTextColor={color.mutedForeground}
        />
        <TextInput
          style={[styles.input, { borderColor: color.border, color: color.foreground, backgroundColor: color.card }]}
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="Pairing token"
          placeholderTextColor={color.mutedForeground}
        />
        <TouchableOpacity
          style={[styles.button, { backgroundColor: color.primary }, !token.trim() && { opacity: 0.5 }]}
          onPress={() => connect(url, token.trim())}
          disabled={!token.trim()}
        >
          <Text style={[styles.buttonText, { color: color.primaryForeground }]}>Connect</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 8 },
  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, width: '100%', fontSize: 15,
  },
  button: { paddingHorizontal: 24, paddingVertical: 13, borderRadius: 10, marginTop: 8, width: '100%', alignItems: 'center' },
  buttonText: { fontWeight: '600', fontSize: 15 },
});
