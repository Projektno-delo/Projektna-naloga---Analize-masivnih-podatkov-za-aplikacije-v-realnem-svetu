import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { CONFIG } from "./config";

type Orv2faChallenge = {
  challengeId: string;
  userEmail?: string;
  expectedUser?: string;
  threshold?: number;
  nightMode?: boolean;
  expiresAt?: string;
};

export default function Orv2faScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ challenge?: string }>();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [status, setStatus] = useState("Caka na potrditev s kamero telefona");
  const [isVerifying, setIsVerifying] = useState(false);
  const cameraRef = useRef<any>(null);

  const challenge = useMemo<Orv2faChallenge | null>(() => {
    try {
      const rawChallenge = Array.isArray(params.challenge)
        ? params.challenge[0]
        : params.challenge;

      if (!rawChallenge) {
        return null;
      }

      return JSON.parse(rawChallenge) as Orv2faChallenge;
    } catch {
      return null;
    }
  }, [params.challenge]);

  const verifyWithPhoneCamera = async () => {
    if (!challenge) {
      return;
    }

    try {
      setIsVerifying(true);
      setStatus("Zajemam sliko...");

      let permission = cameraPermission;

      if (!permission?.granted) {
        permission = await requestCameraPermission();
      }

      if (!permission?.granted) {
        throw new Error("Dovoljenje za kamero ni odobreno");
      }

      const rawUser = await AsyncStorage.getItem("user");
      const user = rawUser ? JSON.parse(rawUser) : {};
      const userEmail = user.email || challenge.userEmail || "unknown";

      const photo = await cameraRef.current?.takePictureAsync({
        base64: true,
        quality: 0.55,
        skipProcessing: true,
      });

      if (!photo?.base64) {
        throw new Error("Slika ni bila zajeta");
      }

      setStatus("Preverjam obraz...");

      const response = await fetch(`${CONFIG.API_URL}/orv-2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          imageBase64: `data:image/jpeg;base64,${photo.base64}`,
          deviceId: userEmail,
          userEmail,
          nightMode: Boolean(challenge.nightMode),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.verified) {
        throw new Error(data.result?.error || data.error || "ORV preverjanje ni uspelo");
      }

      setStatus("ORV 2FA potrjen");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => router.replace("/" as any), 900);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ORV 2FA napaka";
      setStatus(`Napaka: ${message}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!challenge) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.panel}>
          <Text style={styles.title}>ORV 2FA</Text>
          <Text style={styles.text}>Ni aktivne zahteve za preverjanje.</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace("/" as any)}>
            <Text style={styles.btnText}>NAZAJ</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>HRIBOVC <Text style={styles.orange}>2FA</Text></Text>
        <Text style={styles.sub}>
          {challenge.expectedUser || "Uporabnik"} caka na potrditev.
        </Text>
      </View>

      <View style={styles.cameraShell}>
        {cameraPermission?.granted ? (
          <CameraView ref={cameraRef} style={styles.camera} facing="front" />
        ) : (
          <View style={styles.permissionBox}>
            <Text style={styles.text}>Za preverjanje obraza dovoli kamero.</Text>
            <TouchableOpacity style={styles.mainBtn} onPress={requestCameraPermission}>
              <Text style={styles.btnText}>DOVOLI KAMERO</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.status}>{status}</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.mainBtn, isVerifying && styles.disabledBtn]}
          onPress={verifyWithPhoneCamera}
          disabled={isVerifying}
        >
          {isVerifying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>POTRDI Z OBRAZOM</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => {
            setStatus("ORV 2FA zavrnjen lokalno");
            router.replace("/" as any);
          }}
        >
          <Text style={styles.btnText}>ZAVRNI</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050505",
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 28,
  },
  header: {
    marginBottom: 18,
  },
  logo: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 2,
  },
  orange: {
    color: "#ff6b35",
  },
  sub: {
    color: "#bbb",
    fontSize: 15,
    marginTop: 8,
    lineHeight: 22,
  },
  panel: {
    flex: 1,
    justifyContent: "center",
    gap: 18,
  },
  title: {
    color: "#ff6b35",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  text: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 22,
  },
  cameraShell: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderWidth: 1,
    borderColor: "#ff6b35",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  camera: {
    flex: 1,
  },
  permissionBox: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
    gap: 18,
  },
  status: {
    color: "#777",
    fontSize: 13,
    marginTop: 16,
    minHeight: 40,
    lineHeight: 20,
  },
  actions: {
    gap: 14,
    marginTop: "auto",
  },
  mainBtn: {
    backgroundColor: "#ff6b35",
    paddingVertical: 17,
    borderRadius: 24,
    alignItems: "center",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#ff6b35",
    paddingVertical: 17,
    borderRadius: 24,
    alignItems: "center",
  },
  disabledBtn: {
    opacity: 0.7,
  },
  btnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
});
