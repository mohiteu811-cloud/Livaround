import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api, setToken } from '../../src/lib/api';
import { registerForPushNotifications } from '../../src/lib/notifications';
import { connectSocket } from '../../src/lib/socket';

export default function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  async function handlePostAuth(token: string, user: any) {
    if (user.role !== 'HOST') {
      Alert.alert('Access Denied', 'This app is for hosts only. Please use the worker app or dashboard.');
      return;
    }
    await setToken(token);

    // Register push notifications
    const pushToken = await registerForPushNotifications();
    if (pushToken) {
      await api.hostApp.registerPushToken(pushToken).catch(() => {});
    }

    // Connect Socket.IO
    connectSocket().catch(() => {});

    router.replace('/(tabs)');
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const { token, user } = await api.auth.login(email.trim().toLowerCase(), password);
      await handlePostAuth(token, user);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const { token, user } = await api.auth.register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
      });
      await handlePostAuth(token, user);
    } catch (err: any) {
      Alert.alert('Sign Up Failed', err.message || 'Could not create account');
    } finally {
      setLoading(false);
    }
  }

  function toggleMode() {
    setIsSignUp((prev) => !prev);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inner}>
            <View style={styles.logoWrapper}>
              <Text style={styles.logoIcon}>🏠</Text>
              <Text style={styles.logoText}>LivAround</Text>
              <Text style={styles.tagline}>Host Portal</Text>
            </View>

            <View style={styles.form}>
              {isSignUp && (
                <>
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Your full name"
                    placeholderTextColor="#64748b"
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </>
              )}

              <Text style={styles.label}>Email</Text>
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

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#64748b"
                secureTextEntry
              />

              {isSignUp && (
                <>
                  <Text style={styles.label}>Phone (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+1 (555) 123-4567"
                    placeholderTextColor="#64748b"
                    keyboardType="phone-pad"
                    autoCorrect={false}
                  />
                </>
              )}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={isSignUp ? handleSignUp : handleLogin}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.toggleRow} onPress={toggleMode}>
                <Text style={styles.toggleText}>
                  {isSignUp
                    ? 'Already have an account? '
                    : "Don't have an account? "
                  }
                  <Text style={styles.toggleLink}>
                    {isSignUp ? 'Sign In' : 'Sign Up'}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoWrapper: { alignItems: 'center', marginBottom: 48 },
  logoIcon: { fontSize: 56, marginBottom: 12 },
  logoText: { fontSize: 32, fontWeight: '700', color: '#f8fafc', letterSpacing: 0.5 },
  tagline: { fontSize: 14, color: '#3b82f6', fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1.5 },
  form: { gap: 8 },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 4, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#f8fafc', fontSize: 16 },
  button: { backgroundColor: '#3b82f6', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  toggleRow: { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
  toggleText: { color: '#94a3b8', fontSize: 14 },
  toggleLink: { color: '#3b82f6', fontWeight: '600' },
});
