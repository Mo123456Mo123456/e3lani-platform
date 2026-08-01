import * as React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/lib/theme';

/** شريط التنقل السفلي مع زر «أضف إعلانًا» في المنتصف بلون أصفر واضح. */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // الارتفاع يُحسب من المنطقة الآمنة للجهاز، وإلا قُصّت التسميات على الأجهزة
  // التي لا شريط إيماءات فيها
  const barHeight = 64 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.ink,
        tabBarInactiveTintColor: theme.colors.inkMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.white,
          borderTopColor: theme.colors.border,
          height: barHeight,
          paddingBottom: insets.bottom + 6,
          paddingTop: 6,
        },
        // النص العربي يحتاج ارتفاع سطر صريحًا، وإلا قُصّت الحروف ذات النزول
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', lineHeight: 16, marginTop: 1 },
        tabBarIconStyle: { marginTop: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'الأقسام',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'أضف إعلانًا',
          tabBarLabel: () => null,
          // زر بارز داخل ارتفاع الشريط نفسه — لو تجاوزه لضغط بقية العناصر وقصّ تسمياتها
          tabBarIcon: () => (
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#111',
                shadowOpacity: 0.22,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              }}
            >
              <Ionicons name="add" size={28} color={theme.colors.ink} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'المحفوظات',
          tabBarIcon: ({ color, size }) => <Ionicons name="bookmark" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
