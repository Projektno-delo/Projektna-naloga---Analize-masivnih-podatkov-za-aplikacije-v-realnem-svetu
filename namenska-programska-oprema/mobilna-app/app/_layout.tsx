import { Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import mqtt from "mqtt";
import { CONFIG } from "./config";

type Orv2faChallenge = {
  type?: string;
  challengeId: string;
  userEmail?: string;
  expectedUser?: string;
  threshold?: number;
  nightMode?: boolean;
  expiresAt?: string;
};

function Orv2faMqttListener() {
  const [challenge, setChallenge] = useState<Orv2faChallenge | null>(null);
  const [status, setStatus] = useState("Caka na potrditev s kamero telefona");
  const [isVerifying, setIsVerifying] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const previewInFlightRef = useRef(false);
  const captureLockRef = useRef(false);

  useEffect(() => {
    const client = mqtt.connect(CONFIG.MQTT_BROKER, {
      reconnectPeriod: 3000,
    });

    client.on("connect", () => {
      client.subscribe(CONFIG.MQTT_TOPIC_ORV_2FA_REQUEST, (error: Error | null) => {
        if (error) {
          console.log("ORV global MQTT subscribe error:", error?.message);
        }
      });
    });

    client.on("message", async (topic, payload) => {
      if (topic !== CONFIG.MQTT_TOPIC_ORV_2FA_REQUEST) {
        return;
      }

      try {
        const challenge = JSON.parse(payload.toString()) as Orv2faChallenge;

        if (challenge.type !== "orv-2fa-request" || !challenge.challengeId) {
          return;
        }

        const rawUser = await AsyncStorage.getItem("user");

        if (!rawUser) {
          return;
        }

        const user = JSON.parse(rawUser);
        const currentEmail = String(user.email || "").trim().toLowerCase();
        const targetEmail = String(challenge.userEmail || "").trim().toLowerCase();

        if (targetEmail && targetEmail !== currentEmail) {
          return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStatus("Caka na potrditev s kamero telefona");
        setChallenge(challenge);
      } catch (error) {
        console.log("ORV global MQTT parse error:", error);
      }
    });

    return () => {
      client.end();
    };
  }, []);

  useEffect(() => {
    if (!challenge || !cameraPermission?.granted) {
      return;
    }

    let stopped = false;

    const sendPreviewFrame = async () => {
      if (
        stopped
        || previewInFlightRef.current
        || captureLockRef.current
        || !cameraRef.current
      ) {
        return;
      }

      try {
        previewInFlightRef.current = true;
        captureLockRef.current = true;

        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.2,
          skipProcessing: true,
        });

        captureLockRef.current = false;

        if (!photo?.base64) {
          return;
        }

        const rawUser = await AsyncStorage.getItem("user");
        const user = rawUser ? JSON.parse(rawUser) : {};
        const userEmail = user.email || challenge.userEmail || "unknown";

        await fetch(`${CONFIG.API_URL}/orv-2fa/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challengeId: challenge.challengeId,
            imageBase64: `data:image/jpeg;base64,${photo.base64}`,
            userEmail,
            nightMode: Boolean(challenge.nightMode),
          }),
        });
      } catch (error) {
        console.log("ORV phone preview error:", error);
      } finally {
        captureLockRef.current = false;
        previewInFlightRef.current = false;
      }
    };

    sendPreviewFrame();
    const previewInterval = setInterval(sendPreviewFrame, 850);

    return () => {
      stopped = true;
      clearInterval(previewInterval);
      fetch(`${CONFIG.API_URL}/orv-2fa/preview-close`, {
        method: "POST",
      }).catch(() => {});
    };
  }, [challenge, cameraPermission?.granted]);

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

      captureLockRef.current = true;
      const photo = await cameraRef.current?.takePictureAsync({
          base64: true,
          quality: 0.55,
          skipProcessing: true,
        });
      captureLockRef.current = false;

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
      setTimeout(() => setChallenge(null), 900);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ORV 2FA napaka";
      setStatus(`Napaka: ${message}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Modal visible={Boolean(challenge)} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>HRIBOVC <Text style={styles.orange}>2FA</Text></Text>
          <Text style={styles.sub}>
            {challenge?.expectedUser || "Uporabnik"} caka na potrditev.
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
              fetch(`${CONFIG.API_URL}/orv-2fa/preview-close`, {
                method: "POST",
              }).catch(() => {});
              setChallenge(null);
            }}
          >
            <Text style={styles.btnText}>ZAVRNI</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function RootLayout() {
  return (
    <>
      <Orv2faMqttListener />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="history" options={{ headerShown: false }} />
      </Stack>
    </>
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
