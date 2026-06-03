import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import mqtt from "mqtt";
import { CONFIG } from "./config";

type Orv2faChallenge = {
  type?: string;
  challengeId?: string;
  userEmail?: string;
  expectedUser?: string;
  threshold?: number;
  nightMode?: boolean;
  expiresAt?: string;
};

function Orv2faMqttListener() {
  const router = useRouter();

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

        router.push({
          pathname: "/orv-2fa" as any,
          params: {
            challenge: JSON.stringify(challenge),
          },
        } as any);
      } catch (error) {
        console.log("ORV global MQTT parse error:", error);
      }
    });

    return () => {
      client.end();
    };
  }, [router]);

  return null;
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
        <Stack.Screen name="orv-2fa" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
