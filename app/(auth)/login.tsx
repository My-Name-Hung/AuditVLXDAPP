import { Colors } from "@/src/constants/theme";
import {
  clearSavedCredentials,
  getSavedCredentials,
  saveCredentials,
  useAuth,
} from "@/src/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
      Alert.alert("Lỗi", "Vui lòng nhập tên đăng nhập và mật khẩu");
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
      if (response.user.isChangePassword) {
        setLoading(false);
        // Auto navigate to change password screen
        router.replace("/(auth)/change-password");
        return;
      }

      setLoading(false);
      router.replace("/(tabs)/stores");
    } catch (error: any) {
      setLoading(false);
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Tài khoản hoặc mật khẩu không đúng hãy thử lại.";
      Alert.alert("Đăng nhập thất bại", errorMessage);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require("@/assets/images/icon.jpg")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.title}>Đăng nhập hệ thống</Text>
      <Text style={styles.subtitle}>Quản lý thương vụ XMTĐ</Text>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Ionicons
            name="person-outline"
            size={20}
            color="#666"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Tên đăng nhập hoặc Mã nhân viên"
            placeholderTextColor="#9CA3AF"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color="#666"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Mật khẩu"
            placeholderTextColor="#9CA3AF"
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
              name={showPassword ? "eye-outline" : "eye-off-outline"}
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
            <View
              style={[
                styles.checkbox,
                rememberPassword && styles.checkboxChecked,
              ]}
            >
              {rememberPassword && (
                <Ionicons name="checkmark" size={16} color="#fff" />
              )}
            </View>
            <Text style={styles.rememberText}>Ghi nhớ mật khẩu</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.loginButtonContainer}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.secondary,
    justifyContent: "center",
    padding: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.light.primary,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
  },
  form: {
    width: "100%",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
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
    color: "#333",
  },
  eyeButton: {
    padding: 4,
  },
  rememberContainer: {
    marginBottom: 16,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: Colors.light.primary,
  },
  rememberText: {
    fontSize: 14,
    color: "#666",
  },
  loginButtonContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  loginButton: {
    flex: 1,
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#f5f5f5",
  },
  modalButtonConfirm: {
    backgroundColor: Colors.light.primary,
  },
  modalButtonTextCancel: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  modalButtonTextConfirm: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
