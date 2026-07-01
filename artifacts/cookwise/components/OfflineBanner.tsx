import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import React, { useEffect, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

/**
 * Displays a non-intrusive banner at the top of the app whenever the device
 * loses internet connectivity. Fades in/out smoothly and disappears once the
 * connection is restored.
 */
export function OfflineBanner() {
  const colors = useColors();
  const [isOffline, setIsOffline] = useState(false);
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false;
      setIsOffline(offline);
      Animated.timing(opacity, {
        toValue: offline ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });

    return unsubscribe;
  }, [opacity]);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[styles.banner, { backgroundColor: colors.destructive, opacity }]}
      accessibilityRole="alert"
      accessibilityLabel="No internet connection"
    >
      <Ionicons name="cloud-offline-outline" size={15} color="#fff" />
      <Text style={styles.text}>No internet connection</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  text: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
