import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { api, setToken } from '../../src/lib/api';
import { registerForPushNotifications } from '../../src/lib/notifications';
import { startLocationTracking } from '../../src/lib/location';
import { useLang, t } from '../../src/lib/i18n';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLangVal] = useLang();
  const tr = t(lang);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert(tr.errorTitle, tr.enterCredentials);
      return;
    }
    setLoading(true);
    try {
      const { token, user } = await api.auth.login(email.trim().toLowerCase(), password);
      if (user.role !== 'WORKER') {
        Alert.alert(tr.accessDenied, tr.workerOnly);
        return;
      }
      await setToken(token);

      // Register push notifications (non-blocking — don't fail login if unavailable)
      try {
        const pushToken = await registerForPushNotifications();
        if (pushToken && user.worker?.id) {
          await api.workers.registerPushToken(user.worker.id, pushToken).catch(() => {});
        }
      } catch {}

      // Request location permission and start tracking (must await before navigating)
      await startLocationTracking().catch(() => {});

      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert(tr.loginFailed, err.message || tr.invalidCredentials);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {/* Language toggle */}
        <TouchableOpacity
          style={styles.langToggle}
          onPress={() => setLangVal(lang === 'en' ? 'hi' : 'en')}
        >
          <Text style={styles.langToggleText}>
            {lang === 'en' ? 'हिन्दी' : 'English'}
          </Text>
        </TouchableOpacity>

        <View style={styles.logoWrapper}>
          <Text style={styles.logoIcon}>🏠</Text>
          <Text style={styles.logoText}>LivAround</Text>
          <Text style={styles.tagline}>{tr.workerPortal}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{tr.email}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor="#64748b"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>{tr.password}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#64748b"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>{tr.signIn}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  langToggle: {
    position: 'absolute',
    top: 56,
    right: 0,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  langToggleText: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: '600',
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoIcon: {
    fontSize: 56,
    marginBottom: 12,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  form: {
    gap: 8,
  },
  label: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f8fafc',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
