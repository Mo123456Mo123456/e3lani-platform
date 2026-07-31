import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Platform, StyleSheet, View } from "react-native";
import { useI18n } from "@/lib/i18n";
import { BRAND } from "@/lib/e3lani-data";

export default function TabLayout() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BRAND.black,
        tabBarInactiveTintColor: "#777777",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 10,
          lineHeight: 13,
          fontWeight: "900",
        },
        tabBarStyle: {
          paddingTop: 7,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: BRAND.white,
          borderTopColor: BRAND.border,
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
              <MaterialIcons size={30} name="add" color={BRAND.black} />
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
  createIcon: {
    width: 42,
    height: 42,
    marginTop: -16,
    borderRadius: 21,
    backgroundColor: BRAND.yellow,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BRAND.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 7,
  },
});
