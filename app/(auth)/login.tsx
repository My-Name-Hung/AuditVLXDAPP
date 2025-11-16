import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, saveCredentials, getSavedCredentials, clearSavedCredentials } from '@/src/contexts/AuthContext';
import { Colors } from '@/src/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login, authenticateWithBiometrics, isBiometricAvailable, isBiometricEnabled, enableBiometric } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricModalVisible, setBiometricModalVisible] = useState(false);
  const [fingerprintModalVisible, setFingerprintModalVisible] = useState(false);

  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    const saved = await getSavedCredentials();
    if (saved) {
      setUsername(saved.username);
      setPassword(saved.password);
      setRememberPassword(true);
    }
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên đăng nhập và mật khẩu');
      return;
    }

    setLoading(true);
    try {
      const response = await login(username.trim(), password);
      
      // Save credentials if remember password is checked
      if (rememberPassword) {
        await saveCredentials(username.trim(), password);
      } else {
        await clearSavedCredentials();
      }

      // Check if user needs to change password - if true, redirect to change password screen
      // Backend now blocks login if IsChangePassword is true, so this should not happen
      // But keep this check as a safety measure
      if (response.user.isChangePassword) {
        setLoading(false);
        Alert.alert(
          'Thông báo',
          'Bạn phải thay đổi mật khẩu trước khi đăng nhập.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(auth)/change-password'),
            },
          ]
        );
        return;
      }

      // Show biometric setup modal if available and not enabled
      if (isBiometricAvailable && !isBiometricEnabled) {
        setLoading(false);
        setBiometricModalVisible(true);
      } else {
        setLoading(false);
        router.replace('/(tabs)/stores');
      }
    } catch (error: any) {
      setLoading(false);
      const errorMessage = error.response?.data?.error || error.message || 'Tài khoản hoặc mật khẩu không đúng hãy thử lại.';
      Alert.alert('Đăng nhập thất bại', errorMessage);
    }
  };

  const handleBiometricSetup = async () => {
    setBiometricModalVisible(false);
    try {
      // Skip enabled check for setup
      const success = await authenticateWithBiometrics(true);
      if (success) {
        await enableBiometric();
        Alert.alert('Thành công', 'Đã bật đăng nhập bằng vân tay');
        router.replace('/(tabs)/stores');
      } else {
        Alert.alert('Thất bại', 'Xác thực vân tay không thành công');
        router.replace('/(tabs)/stores');
      }
    } catch (error) {
      console.error('Biometric setup error:', error);
      router.replace('/(tabs)/stores');
    }
  };

  const handleFingerprintLogin = async () => {
    try {
      const success = await authenticateWithBiometrics();
      if (success) {
        const saved = await getSavedCredentials();
        if (saved) {
          setUsername(saved.username);
          setPassword(saved.password);
          await handleLogin();
        } else {
          Alert.alert('Lỗi', 'Không tìm thấy thông tin đăng nhập đã lưu');
        }
      }
    } catch (error) {
      console.error('Fingerprint login error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require('@/assets/images/icon.jpg')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.title}>Đăng nhập hệ thống</Text>
      <Text style={styles.subtitle}>Quản lý thương vụ XMTĐ</Text>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Tên đăng nhập hoặc Mã nhân viên"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Mật khẩu"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}
          >
            <Ionicons
              name={showPassword ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.rememberContainer}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setRememberPassword(!rememberPassword)}
          >
            <View style={[styles.checkbox, rememberPassword && styles.checkboxChecked]}>
              {rememberPassword && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <Text style={styles.rememberText}>Ghi nhớ mật khẩu</Text>
          </TouchableOpacity>
        </View>

        {isBiometricAvailable && isBiometricEnabled && (
          <TouchableOpacity
            style={styles.fingerprintButton}
            onPress={handleFingerprintLogin}
          >
            <Ionicons name="finger-print-outline" size={24} color={Colors.light.primary} />
            <Text style={styles.fingerprintText}>Đăng nhập bằng vân tay</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.loginButton, loading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>Đăng nhập</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Biometric Setup Modal */}
      <Modal
        visible={biometricModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBiometricModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="finger-print" size={64} color={Colors.light.primary} />
            <Text style={styles.modalTitle}>Bật đăng nhập bằng vân tay?</Text>
            <Text style={styles.modalMessage}>
              Bạn có muốn sử dụng vân tay để đăng nhập nhanh hơn không?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setBiometricModalVisible(false);
                  router.replace('/(tabs)/stores');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Bỏ qua</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleBiometricSetup}
              >
                <Text style={styles.modalButtonTextConfirm}>Đồng ý</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.secondary,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.light.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  eyeButton: {
    padding: 4,
  },
  rememberContainer: {
    marginBottom: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.light.primary,
  },
  rememberText: {
    fontSize: 14,
    color: '#666',
  },
  fingerprintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginBottom: 16,
  },
  fingerprintText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f5f5f5',
  },
  modalButtonConfirm: {
    backgroundColor: Colors.light.primary,
  },
  modalButtonTextCancel: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

