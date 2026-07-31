import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { BRAND } from "@/lib/e3lani-data";

export default function TabLayout() {
  const colors = useColors();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BRAND.yellowDark,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("home"), tabBarIcon: ({ color }) => <MaterialIcons size={27} name="home" color={color} />,
        }}
      />
      <Tabs.Screen name="categories" options={{ title:t("categories"),tabBarIcon:({color})=><MaterialIcons size={25} name="grid-view" color={color}/> }}/>
      <Tabs.Screen
        name="create"
        options={{
          title: t("create"),
          tabBarIcon: () => (
            <MaterialIcons
              size={34}
              name="add"
              color={BRAND.black}
              style={{
                width: 41,
                height: 41,
                marginTop: -10,
                borderRadius: 21,
                backgroundColor: BRAND.yellow,
                textAlign: "center",
                lineHeight: 41,
                overflow: "hidden",
                elevation: 4,
              }}
            />
          ),
        }}
      />
      <Tabs.Screen name="saved" options={{ title:t("saved"),tabBarIcon:({color})=><MaterialIcons size={25} name="bookmark" color={color}/> }}/>
      <Tabs.Screen name="profile" options={{ title:t("account"),tabBarIcon:({color})=><MaterialIcons size={25} name="person" color={color}/> }}/>
    </Tabs>
  );
}
