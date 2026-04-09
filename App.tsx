import React from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { REGISTRATION_JOURNEY } from './src/config/forgerock';
import { ForgerockBiometric } from './src/native/ForgerockBiometric';
import { runJourneyWithJsThenNativeBiometric } from './src/services/jsRegistrationFlow';

export default function App() {
  const [username, setUsername] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [lastStatus, setLastStatus] = React.useState<string | null>(null);

  /** JS SDK walks callbacks; on WebAuthn, native ForgeRock SDK runs biometrics automatically. */
  async function registerJsThenNativeBiometric() {
    const u = username.trim();
    if (!u) {
      Alert.alert('Missing username', 'Enter a username first.');
      return;
    }
    setBusy(true);
    setLastStatus(null);
    try {
      const result = await runJourneyWithJsThenNativeBiometric(u, {
        journeyName: REGISTRATION_JOURNEY,
        triggerNativeOnWebAuthnCallback: true,
      });
      setLastStatus(JSON.stringify(result, null, 2));

      if (result.kind === 'native_biometric_completed') {
        Alert.alert(
          'Native biometric step',
          `${result.native.message}\n\n(authId from JS step: ${result.authId ?? 'n/a'})`,
        );
        setUsername('');
      } else if (result.kind === 'login_success') {
        Alert.alert('Journey complete (JS)', result.sessionToken ?? 'OK');
      } else if (result.kind === 'login_failure') {
        Alert.alert('Journey failed', result.message ?? 'Unknown');
      } else if (result.kind === 'handoff_native_webauthn') {
        Alert.alert('Unexpected handoff', result.detail);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastStatus(msg);
      Alert.alert('Error', msg);
    } finally {
      setBusy(false);
    }
  }

  /** Optional: native-only path for debugging (same journey; does not continue JS authId). */
  async function nativeOnlyRegister() {
    const u = username.trim();
    if (!u) {
      Alert.alert('Missing username', 'Enter a username first.');
      return;
    }
    setBusy(true);
    try {
      const result = await ForgerockBiometric.registerWithBiometrics(
        u,
        REGISTRATION_JOURNEY,
      );
      Alert.alert('Native only', JSON.stringify(result, null, 2));
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          <Text style={styles.title}>JS SDK → native biometric</Text>
          <Text style={styles.subtitle}>
            ForgeRock JavaScript SDK handles the journey first (Name, HiddenValue,
            etc.). When the server returns a WebAuthn callback, this app triggers the
            native ForgeRock SDK — that shows the OS biometric / WebAuthn UI (not a
            custom RN view).
          </Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="username"
            secureTextEntry
            editable={!busy}
            style={styles.input}
          />

          <TouchableOpacity
            disabled={busy}
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={registerJsThenNativeBiometric}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                Register (JS journey → WebAuthn → native biometric)
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            disabled={busy}
            style={[styles.buttonSecondary, busy && styles.buttonDisabled]}
            onPress={nativeOnlyRegister}>
            <Text style={styles.buttonTextSecondary}>
              Debug: native register only
            </Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            URLs: in main app call configureForgeRockJs with your values (see
            src/config/forgerock.ts). Android: mirror forgerock_* in strings.xml.
          </Text>

          {lastStatus ? <Text style={styles.mono}>{lastStatus}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B1020' },
  scroll: { flexGrow: 1 },
  container: { flex: 1, padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: 'white', marginTop: 8 },
  subtitle: { fontSize: 13, color: '#B7C0D8', marginBottom: 6 },
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
  buttonSecondary: {
    backgroundColor: 'transparent',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3d4f7a',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontSize: 15, fontWeight: '600' },
  buttonTextSecondary: { color: '#9aacd6', fontSize: 14, fontWeight: '500' },
  footer: { marginTop: 10, fontSize: 12, color: '#95A0C0' },
  mono: {
    marginTop: 8,
    fontSize: 11,
    color: '#C8D0E8',
    fontFamily: 'monospace',
  },
});
