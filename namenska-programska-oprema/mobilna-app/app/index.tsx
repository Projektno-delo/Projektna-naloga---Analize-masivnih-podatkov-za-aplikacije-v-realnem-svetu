import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native'

import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'

export default function Index() {
  const router = useRouter()

  return (
    <>
      <StatusBar barStyle="light-content" />

      <ImageBackground
        source={require('../assets/images/hero_mobile_crop.png')}
        style={styles.bg}
        resizeMode="cover"
        blurRadius={1.5}
      >
        <View style={styles.overlay}>
          <SafeAreaView style={styles.safe}>
            <View style={styles.logoContainer}>
              <Text style={styles.logo}>HRIBOVC</Text>
            </View>

            <View style={styles.content}>
              <Text style={styles.title}>
                Tvoj partner{'\n'}
                za <Text style={styles.orange}>vsak vrh.</Text>
              </Text>

              <Text style={styles.sub}>
                Pametno načrtuj poti, spremljaj vreme
                v realnem času in izboljšaj svojo
                pripravljenost.
              </Text>

              <TouchableOpacity
                style={styles.btn}
                onPress={() => router.push('/login' as any)}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>
                  ZAČNI NAČRTOVATI
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryText}>
                  RAZIŠČI POTI
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </ImageBackground>
    </>
  )
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },

  safe: {
    flex: 1,
  },

  logoContainer: {
    paddingHorizontal: 28,
    paddingTop: 16,
  },

  logo: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
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

    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {
      width: 0,
      height: 3,
    },
    textShadowRadius: 10,
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

    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {
      width: 0,
      height: 2,
    },
    textShadowRadius: 8,
  },

  btn: {
    backgroundColor: '#ff6b35',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 14,

    shadowColor: '#ff6b35',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.28,
    shadowRadius: 14,
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