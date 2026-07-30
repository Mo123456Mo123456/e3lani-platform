import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

const active = "#111111";
const inactive = "#777777";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "center",
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarStyle: { height: 68, paddingBottom: 8 },
        tabBarLabelStyle: { fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "الأقسام",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "أضف إعلانًا",
          tabBarIcon: ({ size }) => (
            <Ionicons
              name="add"
              color="#111111"
              size={size + 8}
              style={{ backgroundColor: "#FFC400", borderRadius: 24, padding: 7, marginTop: -18 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "المحفوظات",
          tabBarIcon: ({ color, size }) => <Ionicons name="bookmark" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "حسابي",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
