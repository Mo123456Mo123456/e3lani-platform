import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Platform, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useI18n } from "@/lib/i18n";
import { BRAND } from "@/lib/e3lani-data";

export default function TabLayout() {
  const colors = useColors();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 8 : Math.max(insets.bottom, 6);
  const tabBarHeight = 64 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BRAND.black,
        tabBarInactiveTintColor: "#777777",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        tabBarStyle: {
          paddingTop: 6,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
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
            <View style={styles.createIcon}>
              <MaterialIcons size={31} name="add" color={BRAND.black} />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="saved" options={{ title:t("saved"),tabBarIcon:({color})=><MaterialIcons size={25} name="bookmark" color={color}/> }}/>
      <Tabs.Screen name="profile" options={{ title:t("account"),tabBarIcon:({color})=><MaterialIcons size={25} name="person" color={color}/> }}/>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 10, lineHeight: 14, fontWeight: "900" },
  item: { minHeight: 54 },
  createIcon: {
    width: 43,
    height: 43,
    marginTop: -17,
    borderRadius: 22,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BRAND.black,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 7 },
    elevation: 7,
  },
});
