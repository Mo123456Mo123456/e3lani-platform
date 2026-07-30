import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { colors } from "@/lib/api";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: "#777",
        tabBarLabelStyle: { fontSize: 11 },
        tabBarStyle: { height: 68, paddingBottom: 8, paddingTop: 6 }
      }}
    >
      <Tabs.Screen name="index" options={{ title: "الرئيسية", tabBarIcon: ({ color }) => <Ionicons name="home" size={22} color={color} /> }} />
      <Tabs.Screen name="categories" options={{ title: "الأقسام", tabBarIcon: ({ color }) => <Ionicons name="grid" size={22} color={color} /> }} />
      <Tabs.Screen
        name="create"
        options={{
          title: "أضف إعلانًا",
          tabBarIcon: () => <Ionicons name="add" size={28} color={colors.ink} />,
          tabBarIconStyle: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brand, marginTop: -22 }
        }}
      />
      <Tabs.Screen name="saved" options={{ title: "المحفوظات", tabBarIcon: ({ color }) => <Ionicons name="bookmark" size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "حسابي", tabBarIcon: ({ color }) => <Ionicons name="person" size={22} color={color} /> }} />
    </Tabs>
  );
}
