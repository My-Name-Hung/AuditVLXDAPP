import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '@/src/constants/theme';
import Header from '@/src/components/Header';

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Header title="Chi tiết cửa hàng" />
      <View style={styles.content}>
        <Text style={styles.text}>Store Detail Screen - ID: {id}</Text>
        <Text style={styles.note}>Sẽ được mô tả sau</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.secondary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  text: {
    fontSize: 18,
    color: '#333',
    marginBottom: 8,
  },
  note: {
    fontSize: 14,
    color: '#999',
  },
});

