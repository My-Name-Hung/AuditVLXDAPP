import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme } from '@/src/contexts/ThemeContext';

interface HeaderProps {
  title?: string;
}

export default function Header({ title }: HeaderProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDarkMode } = useTheme();

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.icon + '20' }]}>
        <TouchableOpacity
          style={styles.userSection}
          onPress={() => router.push('/profile')}
        >
          {user?.avatar ? (
            <Image
              source={{ uri: user.avatar }}
              style={styles.avatar}
            />
          ) : (
            <Ionicons name="person-circle-outline" size={28} color={colors.primary} />
          )}
          {user?.fullName && (
            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
              {user.fullName}
            </Text>
          )}
        </TouchableOpacity>

        {title && (
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        )}

        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/icon.jpg')}
            style={[
              styles.logo,
              isDarkMode && { tintColor: '#FFFFFF' }
            ]}
            resizeMode="contain"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    maxWidth: '40%',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  logoContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 4,
  },
});

