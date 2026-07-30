import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";

import { useLocale } from "@/lib/app-context";

export default function TabsLayout() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const tabs = {
    index: [ar ? "الرئيسية" : "Home", "home"] as const,
    categories: [ar ? "الأقسام" : "Categories", "grid-view"] as const,
    create: [ar ? "أضف إعلانًا" : "Post ad", "add"] as const,
    saved: [ar ? "المحفوظات" : "Saved", "bookmark-border"] as const,
    profile: [ar ? "حسابي" : "Account", "person-outline"] as const,
  };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#111111",
        tabBarInactiveTintColor: "#777777",
        tabBarStyle: { height: 72, paddingTop: 8, paddingBottom: 9, borderTopColor: "#E5E5E5" },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
      }}
    >
      {Object.entries(tabs).map(([name, [title, icon]]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons
                name={icon}
                color={name === "create" ? "#111111" : color}
                size={name === "create" ? size + 7 : size}
                style={
                  name === "create"
                    ? {
                        backgroundColor: "#FFC400",
                        borderRadius: 20,
                        padding: 7,
                        marginTop: -12,
                      }
                    : undefined
                }
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
