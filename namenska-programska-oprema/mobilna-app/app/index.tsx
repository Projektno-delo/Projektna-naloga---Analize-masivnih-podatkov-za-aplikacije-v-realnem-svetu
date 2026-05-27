import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useState, useEffect } from 'react'

export default function Index() {
  const router = useRouter()
  const [userName, setUserName] = useState('')

  useEffect(() => {
    AsyncStorage.getItem('user').then((data) => {
      if (data) {
        const user = JSON.parse(data)
        setUserName(user.ime || '')
      }
    })
  }, [])

  return (
    <>
      <StatusBar barStyle="light-content" />
      <ImageBackground
        source={require('../assets/images/hero_mobile_crop.png')}
        style={styles.bg}
        resizeMode="cover"
        blurRadius={1.5}
      >
        <View style={styles.content}>

          {userName ? (
            <>
              <Text style={styles.title}>
                Pozdravljeni,{'\n'}
                <Text style={styles.orange}>{userName}!</Text>
              </Text>
              <Text style={styles.sub}>
                Dobrodošli nazaj. Vaši podatki so pripravljeni za zajem.
              </Text>
              <TouchableOpacity style={styles.btn} onPress={() => router.push('/dashboard' as any)} activeOpacity={0.85}>
                <Text style={styles.btnText}>ODPRI DASHBOARD</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/history' as any)} activeOpacity={0.85}>
                <Text style={styles.secondaryText}>ZGODOVINA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={async () => { await AsyncStorage.removeItem('user'); setUserName(''); }} activeOpacity={0.85}>
                <Text style={styles.secondaryText}>ODJAVA</Text>
              </TouchableOpacity>
            </>
          ) : (
            // Neprijavljen uporabnik
            <>
              <Text style={styles.title}>
                Tvoj partner{'\n'}
                za <Text style={styles.orange}>vsak vrh.</Text>
              </Text>
              <Text style={styles.sub}>
                Pametno načrtuj poti, spremljaj vreme
                v realnem času in izboljšaj svojo
                pripravljenost.
              </Text>
              <TouchableOpacity style={styles.btn} onPress={() => router.push('/login' as any)} activeOpacity={0.85}>
                <Text style={styles.btnText}>ZAČNI NAČRTOVATI</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </ImageBackground>
    </>
  )
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 28,
    paddingBottom: 90,
  },
  title: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 48,
  },
  orange: {
    color: '#ff6b35',
  },
  sub: {
    width: '88%',
    color: 'rgba(255,255,255,0.82)',
    fontSize: 18,
    lineHeight: 30,
    marginTop: 24,
    marginBottom: 38,
  },
  btn: {
    backgroundColor: '#ff6b35',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 8,
    overflow: 'hidden',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 15,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    marginBottom: 14,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  secondaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
})