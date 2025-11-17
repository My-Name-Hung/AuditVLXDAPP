import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/src/components/haptic-tab";
import { Colors } from "@/src/constants/theme";

export default function TabLayout() {
  // Always use light theme
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tint,
        headerShown: false,
        tabBarStyle: { display: "none" },
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="stores"
        options={{
          title: "Cửa hàng",
          tabBarIcon: ({ color }) => (
            <Ionicons name="storefront-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="store-detail/[id]"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
