import React from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ForgerockBiometric } from './src/native/ForgerockBiometric';

export default function App() {
  const [username, setUsername] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function onBiometricLogin() {
    // Keep username in-memory only; do not persist it.
    const u = username.trim();
    if (!u) {
      Alert.alert('Missing username', 'Enter a username first.');
      return;
    }

    setBusy(true);
    try {
      const result = await ForgerockBiometric.loginWithBiometrics(u);
      Alert.alert('Success', JSON.stringify(result, null, 2));
      setUsername(''); // clear after use
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>ForgeRock Biometric Sample</Text>
        <Text style={styles.subtitle}>
          Username is kept in memory only (cleared after login).
        </Text>

        <Text style={styles.label}>Username</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="enter username"
          secureTextEntry
          editable={!busy}
          style={styles.input}
        />

        <TouchableOpacity
          disabled={busy}
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={onBiometricLogin}>
          {busy ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.buttonText}>Login with Biometrics</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footer}>
          Configure your ForgeRock/Ping server details in native config files
          before running a real journey.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B1020' },
  container: { flex: 1, padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: 'white', marginTop: 8 },
  subtitle: { fontSize: 13, color: '#B7C0D8', marginBottom: 10 },
  label: { fontSize: 13, color: '#B7C0D8' },
  input: {
    backgroundColor: '#121A33',
    borderColor: '#243157',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: 'white',
  },
  button: {
    marginTop: 6,
    backgroundColor: '#4E6CFF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontSize: 15, fontWeight: '600' },
  footer: { marginTop: 18, fontSize: 12, color: '#95A0C0' },
});
