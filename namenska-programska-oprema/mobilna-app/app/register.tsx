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
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useState, useRef } from 'react'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { CONFIG } from './config'


export default function Register() {
  const router = useRouter()
  const [ime, setIme] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [starost, setStarost] = useState('')
  const [visina, setVisina] = useState('')
  const [teza, setTeza] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomSheetRef = useRef<BottomSheet>(null)

  const handleRegister = async () => {
    if (!ime || !email || !password) {
      Alert.alert('Napaka', 'Ime, email in geslo so obvezni.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      Alert.alert('Napaka', 'Vnesite veljaven email naslov.')
      return
    }

    if (ime.trim().split(' ').length < 2) {
      Alert.alert('Napaka', 'Vnesite ime in priimek.')
      return
    }

    if (!/[A-Z]/.test(password)) {
      Alert.alert(
        'Napaka',
        'Geslo mora vsebovati vsaj eno veliko črko.'
      )
      return
    }

    if (password.length < 6) {
      Alert.alert('Napaka', 'Geslo mora vsebovati vsaj 6 znakov.')
      return
    }

    if (!/\d/.test(password)) {
      Alert.alert('Napaka', 'Geslo mora vsebovati vsaj eno številko.')
      return
    }

    if (starost && isNaN(Number(starost))) {
      Alert.alert('Napaka', 'Starost mora biti število.')
      return
    }

    if (visina && isNaN(Number(visina))) {
      Alert.alert('Napaka', 'Višina mora biti število.')
      return
    }

    if (teza && isNaN(Number(teza))) {
      Alert.alert('Napaka', 'Teža mora biti število.')
      return
    }

    if (starost && (parseInt(starost) < 1 || parseInt(starost) > 120)) {
      Alert.alert('Napaka', 'Neveljavna starost.')
      return
    }

    if (visina && (parseInt(visina) < 50 || parseInt(visina) > 250)) {
      Alert.alert('Napaka', 'Neveljavna višina.')
      return
    }

    if (teza && (parseInt(teza) < 20 || parseInt(teza) > 300)) {
      Alert.alert('Napaka', 'Neveljavna teža.')
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`${CONFIG.API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ime,
          email,
          password,
          starost: parseInt(starost) || null,
          visina: parseInt(visina) || null,
          teza: parseInt(teza) || null,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        Alert.alert('Uspešno!', 'Registracija uspešna. Sedaj se lahko prijavite.', [
          { text: 'OK', onPress: () => router.replace('/login' as any) },
        ])
      } else {
        Alert.alert('Napaka', data.error || 'Napaka pri registraciji.')
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
        snapPoints={['15%', '85%']}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.indicator}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          <Text style={styles.formTitle}>Ustvarite račun</Text>
          <Text style={styles.formSub}>Začnite z varnim načrtovanjem vzponov</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Ime in priimek</Text>
            <TextInput
              style={styles.input}
              placeholder="Ana Grudnik"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={ime}
              onChangeText={setIme}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email naslov</Text>
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

          <View style={styles.row}>
            <View style={[styles.field, styles.rowField]}>
              <Text style={styles.label}>Starost</Text>
              <TextInput
                style={styles.input}
                placeholder="25"
                placeholderTextColor="rgba(255,255,255,0.35)"
                keyboardType="numeric"
                value={starost}
                onChangeText={setStarost}
              />
            </View>
            <View style={[styles.field, styles.rowField]}>
              <Text style={styles.label}>Višina (cm)</Text>
              <TextInput
                style={styles.input}
                placeholder="170"
                placeholderTextColor="rgba(255,255,255,0.35)"
                keyboardType="numeric"
                value={visina}
                onChangeText={setVisina}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Teža (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder="65"
              placeholderTextColor="rgba(255,255,255,0.35)"
              keyboardType="numeric"
              value={teza}
              onChangeText={setTeza}
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Ustvari račun</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/login' as any)}>
            <Text style={styles.switchText}>
              Že imate račun?{' '}
              <Text style={styles.orange}>Prijava</Text>
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </BottomSheetScrollView>
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
    marginBottom: 16,
  },

  features: { gap: 10 },

  feature: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
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

  row: {
    flexDirection: 'row',
    gap: 12,
  },

  rowField: { flex: 1 },

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
})
