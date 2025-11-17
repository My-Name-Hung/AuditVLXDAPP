import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/src/contexts/ThemeContext";

interface BackHeaderProps {
  title?: string;
  rightComponent?: React.ReactNode;
  fallbackRoute?: string; // Route to navigate if can't go back
}

export default function BackHeader({
  title,
  rightComponent,
  fallbackRoute,
}: BackHeaderProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else if (fallbackRoute) {
      router.replace(fallbackRoute as any);
    } else {
      // Default fallback to stores
      router.replace("/(tabs)/stores");
    }
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ backgroundColor: colors.background }}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.icon + "20",
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        {title && (
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        )}

        {rightComponent ? (
          rightComponent
        ) : (
          <View style={styles.rightPlaceholder} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
  },
  rightPlaceholder: {
    width: 40,
  },
});
