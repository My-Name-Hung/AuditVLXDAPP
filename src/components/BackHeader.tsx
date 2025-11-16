import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/src/hooks/use-color-scheme';
import { Colors } from '@/src/constants/theme';

interface BackHeaderProps {
  title?: string;
  rightComponent?: React.ReactNode;
}

export default function BackHeader({ title, rightComponent }: BackHeaderProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.icon + '20' }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      {title && (
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      )}

      {rightComponent ? (
        rightComponent
      ) : (
        <View style={styles.rightPlaceholder} />
      )}
    </View>
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
  backButton: {
    padding: 4,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  rightPlaceholder: {
    width: 40,
  },
});

