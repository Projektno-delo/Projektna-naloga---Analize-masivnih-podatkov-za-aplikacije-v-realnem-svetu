import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ImageBackground,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useState, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { CONFIG } from './config'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomSheetRef = useRef<BottomSheet>(null)

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Napaka', 'Prosim vnesite email in geslo.')
      return
    }

    // Mock login za testiranje
    if (email === 'test@test.com' && password === '1234') {
      await AsyncStorage.setItem('user', JSON.stringify({ ime: 'Anja', email }))
      router.replace('/' as any)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${CONFIG.API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (response.ok) {
        await AsyncStorage.setItem('user', JSON.stringify(data.user))
        router.replace('/' as any)
      } else {
        Alert.alert('Napaka', data.error || 'Napačen email ali geslo.')
      }
    } catch (error) {
      Alert.alert('Napaka', 'Ni mogoče vzpostaviti povezave s strežnikom.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <ImageBackground
        source={require('../assets/images/hero_mobile_crop.png')}
        style={styles.bg}
        resizeMode="cover"
        blurRadius={1.5}
      >
        <View style={styles.overlay}>
          <SafeAreaView style={styles.safe}>
            <View style={styles.topSection}>
              <Text style={styles.logo}>HRIBOVC</Text>
              <Text style={styles.tagline}>
                Tvoj partner za{'\n'}
                <Text style={styles.orange}>vsak vrh.</Text>
              </Text>
              <Text style={styles.sub}>
                Pametno načrtuj poti, spremljaj vreme{'\n'}
                v realnem času in izboljšaj svojo pripravljenost.
              </Text>
              <View style={styles.features}>
                <Text style={styles.feature}>△  Pametno načrtovanje poti</Text>
                <Text style={styles.feature}>◎  Natančno vreme po višinah</Text>
                <Text style={styles.feature}>♡  Prilagojeno tvoji pripravljenosti</Text>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </ImageBackground>

      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={['15%', '80%']}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.indicator}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.formTitle}>Dobrodošli nazaj</Text>
          <Text style={styles.formSub}>Prijavite se v svoj račun</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="vas@email.com"
              placeholderTextColor="rgba(255,255,255,0.35)"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Geslo</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.35)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Prijava</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/register' as any)}>
            <Text style={styles.switchText}>
              Nimate računa?{' '}
              <Text style={styles.orange}>Registracija</Text>
            </Text>
          </TouchableOpacity>

        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  safe: { flex: 1 },
  topSection: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
    justifyContent: 'flex-end',
    paddingBottom: 180,
  },
  logo: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 16,
  },
  tagline: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 48,
    marginBottom: 16,
  },
  orange: { color: '#ff6b35' },
  sub: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 16,
    lineHeight: 26,
  },
  sheetBg: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  indicator: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    width: 40,
  },
  sheetContent: {
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  formTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 4,
  },
  formSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginBottom: 24,
  },
  field: { marginBottom: 16 },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
  },
  btn: {
    backgroundColor: '#ff6b35',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    elevation: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  switchText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
  },
  features: {
    marginTop: 16,
    gap: 10,
  },
  feature: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
})