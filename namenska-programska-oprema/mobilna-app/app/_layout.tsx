import { Stack } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
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

type OrvPreviewFeedback = {
  success?: boolean;
  faceDetected?: boolean;
  expectedUser?: string | null;
  predictedUser?: string | null;
  probability?: number;
  threshold?: number;
  verified?: boolean;
  message?: string;
};

const isExpiredOrvChallenge = (challenge: Orv2faChallenge) => {
  if (!challenge.expiresAt) {
    return false;
  }

  const expiresAt = new Date(challenge.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
};

function Orv2faMqttListener() {
  const [challenge, setChallenge] = useState<Orv2faChallenge | null>(null);
  const [status, setStatus] = useState("Caka na potrditev s kamero telefona");
  const [previewFeedback, setPreviewFeedback] = useState<OrvPreviewFeedback | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const previewInFlightRef = useRef(false);
  const captureLockRef = useRef(false);
  const isVerifyingRef = useRef(false);
  const bestPreviewImageRef = useRef<string | null>(null);
  const bestPreviewProbabilityRef = useRef(0);
  const readyFrameCountRef = useRef(0);
  const autoVerifyInFlightRef = useRef(false);

  const previewProbability = Math.max(
    0,
    Math.min(1, Number(previewFeedback?.probability || 0))
  );
  const previewPercent = Math.round(previewProbability * 100);
  const thresholdValue = Number(previewFeedback?.threshold ?? challenge?.threshold ?? 0.7);
  const thresholdPercent = Math.round(Math.max(0, Math.min(1, thresholdValue)) * 100);
  const previewHasFace = Boolean(previewFeedback?.faceDetected);
  const previewReady = Boolean(previewFeedback?.verified);
  const previewColor = previewReady
    ? "#57d66b"
    : previewHasFace
      ? "#ffb84d"
      : "#ff6b35";
  const previewLabel = !cameraPermission?.granted
    ? "Kamera ni dovoljena"
    : previewFeedback?.message
      || (previewHasFace ? "Obraz zaznan, preverjam ujemanje." : "Drzi obraz v okvirju kamere.");

  const verifyWithImageBase64 = useCallback(async (
    imageBase64: string,
    successStatus = "ORV 2FA potrjen"
  ) => {
    if (!challenge) {
      return;
    }

    try {
      setIsVerifying(true);
      setStatus("Preverjam najboljši frame...");

      const rawUser = await AsyncStorage.getItem("user");
      const user = rawUser ? JSON.parse(rawUser) : {};
      const userEmail = user.email || challenge.userEmail || "unknown";

      const response = await fetch(`${CONFIG.API_URL}/orv-2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          imageBase64,
          deviceId: userEmail,
          userEmail,
          nightMode: Boolean(challenge.nightMode),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.verified) {
        throw new Error(data.result?.error || data.error || "ORV preverjanje ni uspelo");
      }

      setPreviewFeedback(data.result || data);
      setStatus(successStatus);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setChallenge(null), 900);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ORV 2FA napaka";
      setStatus(`Napaka: ${message}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      readyFrameCountRef.current = 0;
    } finally {
      setIsVerifying(false);
      autoVerifyInFlightRef.current = false;
    }
  }, [challenge]);

  const handleRequestCameraPermission = useCallback(async () => {
    const permission = await requestCameraPermission();

    if (permission?.granted) {
      setStatus("Kamera dovoljena. Pripravljam preverjanje obraza...");
      return permission;
    }

    setStatus("Dovoljenje za kamero ni odobreno");

    if (permission && permission.canAskAgain === false) {
      Alert.alert(
        "Kamera ni dovoljena",
        "Expo Go nima dovoljenja za kamero. Odpri nastavitve telefona in dovoli kamero za Expo Go.",
        [
          { text: "Preklici", style: "cancel" },
          { text: "Nastavitve", onPress: () => Linking.openSettings() },
        ]
      );
    }

    return permission;
  }, [requestCameraPermission]);

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

        if (isExpiredOrvChallenge(challenge)) {
          return;
        }

        const rawUser = await AsyncStorage.getItem("user");
        const user = rawUser ? JSON.parse(rawUser) : {};
        const currentEmail = String(user.email || "").trim().toLowerCase();
        const targetEmail = String(challenge.userEmail || "").trim().toLowerCase();

        if (targetEmail && currentEmail && targetEmail !== currentEmail) {
          return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStatus("Vzpostavljam live preverjanje obraza...");
        setPreviewFeedback(null);
        bestPreviewImageRef.current = null;
        bestPreviewProbabilityRef.current = 0;
        readyFrameCountRef.current = 0;
        autoVerifyInFlightRef.current = false;
        setChallenge(challenge);
        handleRequestCameraPermission();
      } catch (error) {
        console.log("ORV global MQTT parse error:", error);
      }
    });

    return () => {
      client.end();
    };
  }, [handleRequestCameraPermission]);

  useEffect(() => {
    isVerifyingRef.current = isVerifying;
  }, [isVerifying]);

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
          quality: 0.28,
        });

        captureLockRef.current = false;

        if (!photo?.base64) {
          return;
        }

        const rawUser = await AsyncStorage.getItem("user");
        const user = rawUser ? JSON.parse(rawUser) : {};
        const userEmail = user.email || challenge.userEmail || "unknown";

        const imageBase64 = `data:image/jpeg;base64,${photo.base64}`;

        const response = await fetch(`${CONFIG.API_URL}/orv-2fa/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challengeId: challenge.challengeId,
            imageBase64,
            userEmail,
            nightMode: Boolean(challenge.nightMode),
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.detail || data.error || "ORV preview ni uspel");
        }

        const preview = (data.preview || data) as OrvPreviewFeedback;
        setPreviewFeedback(preview);

        const probability = Number(preview.probability || 0);

        if (preview.faceDetected && probability >= bestPreviewProbabilityRef.current) {
          bestPreviewImageRef.current = imageBase64;
          bestPreviewProbabilityRef.current = probability;
        }

        if (!isVerifyingRef.current) {
          if (preview.verified) {
            readyFrameCountRef.current += 1;
            setStatus("Ujemanje je dovolj dobro. Samodejno potrjujem...");

            if (
              readyFrameCountRef.current >= 1
              && !autoVerifyInFlightRef.current
              && bestPreviewImageRef.current
            ) {
              autoVerifyInFlightRef.current = true;
              verifyWithImageBase64(
                bestPreviewImageRef.current,
                "ORV 2FA potrjen samodejno"
              );
            }
          } else if (preview.faceDetected) {
            readyFrameCountRef.current = 0;
            setStatus(preview.message || "Obraz je zaznan, poravnaj ga za boljse ujemanje.");
          } else {
            readyFrameCountRef.current = 0;
            setStatus("Obraz ni zaznan. Premakni telefon ali obraz v okvir.");
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "ORV preview ni uspel";
        setStatus(`Napaka pri preview: ${message}`);
        console.log("ORV phone preview error:", error);
      } finally {
        captureLockRef.current = false;
        previewInFlightRef.current = false;
      }
    };

    sendPreviewFrame();
    const previewInterval = setInterval(sendPreviewFrame, 450);

    return () => {
      stopped = true;
      clearInterval(previewInterval);
      setPreviewFeedback(null);
      bestPreviewImageRef.current = null;
      bestPreviewProbabilityRef.current = 0;
      readyFrameCountRef.current = 0;
      autoVerifyInFlightRef.current = false;
      fetch(`${CONFIG.API_URL}/orv-2fa/preview-close`, {
        method: "POST",
      }).catch(() => {});
    };
  }, [challenge, cameraPermission?.granted, verifyWithImageBase64]);

  const verifyWithPhoneCamera = async () => {
    if (!challenge) {
      return;
    }

    try {
      setIsVerifying(true);
      setStatus("Pripravljam preverjanje...");

      let permission = cameraPermission;

      if (!permission?.granted) {
        permission = await handleRequestCameraPermission();
      }

      if (!permission?.granted) {
        throw new Error("Dovoljenje za kamero ni odobreno");
      }

      if (bestPreviewImageRef.current && bestPreviewProbabilityRef.current > 0) {
        await verifyWithImageBase64(bestPreviewImageRef.current);
        return;
      }

      captureLockRef.current = true;
      const photo = await cameraRef.current?.takePictureAsync({
          base64: true,
          quality: 0.55,
        });
      captureLockRef.current = false;

      if (!photo?.base64) {
        throw new Error("Slika ni bila zajeta");
      }

      setStatus("Preverjam obraz...");
      await verifyWithImageBase64(`data:image/jpeg;base64,${photo.base64}`);
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
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
                <TouchableOpacity style={styles.mainBtn} onPress={handleRequestCameraPermission}>
                  <Text style={styles.btnText}>
                    {cameraPermission?.canAskAgain === false ? "ODPRI NASTAVITVE" : "DOVOLI KAMERO"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.matchPanel}>
            <View style={styles.matchHeader}>
              <Text style={styles.matchLabel}>{previewLabel}</Text>
              <Text style={[styles.matchValue, { color: previewColor }]}>
                {previewHasFace ? `${previewPercent}%` : "--"}
              </Text>
            </View>
            <View style={styles.matchTrack}>
              <View
                style={[
                  styles.matchFill,
                  {
                    width: `${previewHasFace ? previewPercent : 0}%`,
                    backgroundColor: previewColor,
                  },
                ]}
              />
            </View>
            <Text style={styles.matchHint}>
              Prag: {thresholdPercent}% | Najboljse: {Math.round(bestPreviewProbabilityRef.current * 100)}% | Prepoznan: {previewFeedback?.predictedUser || "-"}
            </Text>
          </View>

          <Text style={styles.status}>{status}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.mainBtn, previewReady && styles.readyBtn, isVerifying && styles.disabledBtn]}
              onPress={verifyWithPhoneCamera}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>
                  {previewReady ? "POTRJUJEM..." : "POTRDI NAJBOLJSI FRAME"}
                </Text>
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
        </ScrollView>
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
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 12,
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
    aspectRatio: 1,
    maxHeight: 340,
    borderWidth: 1,
    borderColor: "#ff6b35",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  camera: {
    flex: 1,
  },
  matchPanel: {
    borderWidth: 1,
    borderColor: "#242424",
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
    backgroundColor: "#101010",
  },
  matchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  matchLabel: {
    color: "#f4f4f4",
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  matchValue: {
    fontSize: 22,
    fontWeight: "900",
  },
  matchTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#242424",
    marginTop: 12,
    overflow: "hidden",
  },
  matchFill: {
    height: "100%",
    borderRadius: 999,
  },
  matchHint: {
    color: "#888",
    fontSize: 12,
    marginTop: 10,
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
    marginTop: 12,
    minHeight: 34,
    lineHeight: 20,
  },
  actions: {
    gap: 10,
    marginTop: 12,
  },
  mainBtn: {
    backgroundColor: "#ff6b35",
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#ff6b35",
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
  },
  disabledBtn: {
    opacity: 0.7,
  },
  readyBtn: {
    backgroundColor: "#2fbf5b",
  },
  btnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
});
