import { Tabs } from 'expo-router';
import { Text, Platform } from 'react-native';
import { useLang, t } from '../../src/lib/i18n';

function Icon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const [lang] = useLang();
  const tr = t(lang);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
          paddingTop: 8,
          paddingBottom: Platform.OS === 'android' ? 12 : 8,
          height: Platform.OS === 'android' ? 72 : 64,
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#475569',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: tr.tabJobs,
          tabBarIcon: ({ focused }) => <Icon emoji="🔧" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: tr.tabProfile,
          tabBarIcon: ({ focused }) => <Icon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
