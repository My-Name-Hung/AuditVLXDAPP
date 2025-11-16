import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { useForegroundPermissions } from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERMISSIONS_ASKED_KEY = 'permissions_asked';

interface PermissionModalProps {
  visible: boolean;
  onComplete: () => void;
}

export default function PermissionModal({ visible, onComplete }: PermissionModalProps) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = useForegroundPermissions();

  useEffect(() => {
    if (visible) {
      checkPermissions();
    }
  }, [visible, cameraPermission, locationPermission]);

  const checkPermissions = async () => {
    // If both granted, mark as asked and complete
    if (cameraPermission?.granted && locationPermission?.granted) {
      await AsyncStorage.setItem(PERMISSIONS_ASKED_KEY, 'true');
      onComplete();
    }
  };

  const handleRequestCameraPermission = async () => {
    try {
      const result = await requestCameraPermission();
      
      if (result.granted) {
        if (locationPermission?.granted) {
          await AsyncStorage.setItem(PERMISSIONS_ASKED_KEY, 'true');
          onComplete();
        }
      } else {
        Alert.alert(
          'Quyền truy cập Camera',
          'Ứng dụng cần quyền truy cập camera để chụp ảnh audit. Vui lòng cấp quyền trong Cài đặt.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error);
    }
  };

  const handleRequestLocationPermission = async () => {
    try {
      const result = await requestLocationPermission();
      
      if (result.granted) {
        if (cameraPermission?.granted) {
          await AsyncStorage.setItem(PERMISSIONS_ASKED_KEY, 'true');
          onComplete();
        }
      } else {
        Alert.alert(
          'Quyền truy cập Vị trí',
          'Ứng dụng cần quyền truy cập vị trí để ghi nhận thông tin địa điểm audit. Vui lòng cấp quyền trong Cài đặt.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const handleRequestPermissions = async () => {
    await handleRequestCameraPermission();
    await handleRequestLocationPermission();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Yêu cầu quyền truy cập</Text>
          <Text style={styles.message}>
            Ứng dụng audit cần quyền truy cập camera và vị trí để:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Chụp ảnh audit cửa hàng</Text>
            <Text style={styles.listItem}>• Ghi nhận thông tin vị trí địa điểm</Text>
          </View>

          <View style={styles.statusContainer}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Camera:</Text>
              <Text style={[
                styles.statusValue,
                cameraPermission?.granted ? styles.granted : styles.denied
              ]}>
                {cameraPermission?.granted ? 'Đã cấp' : 'Chưa cấp'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Vị trí:</Text>
              <Text style={[
                styles.statusValue,
                locationPermission?.granted ? styles.granted : styles.denied
              ]}>
                {locationPermission?.granted ? 'Đã cấp' : 'Chưa cấp'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleRequestPermissions}
          >
            <Text style={styles.buttonText}>Cấp quyền</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0138C3',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    lineHeight: 24,
  },
  list: {
    marginBottom: 20,
    paddingLeft: 8,
  },
  listItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  statusContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  granted: {
    color: '#4CAF50',
  },
  denied: {
    color: '#F44336',
  },
  button: {
    backgroundColor: '#0138C3',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

// Helper function to check if permissions were already asked
export const checkPermissionsAsked = async (): Promise<boolean> => {
  const asked = await AsyncStorage.getItem(PERMISSIONS_ASKED_KEY);
  return asked === 'true';
};

