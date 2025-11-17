import BackHeader from "@/src/components/BackHeader";
import BoardingTour from "@/src/components/BoardingTour";
import { Colors } from "@/src/constants/theme";
import { useAuth } from "@/src/contexts/AuthContext";
import api from "@/src/services/api";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const profileTourSteps = [
    {
      title: "Cập nhật thông tin cá nhân",
      description:
        "Điền họ tên, số điện thoại, email chính xác để quản trị viên có thể liên hệ khi cần.",
    },
    {
      title: "Đồng bộ tài khoản",
      description:
        "Thông tin sau khi lưu sẽ đồng bộ khắp ứng dụng và hiển thị tại phần hồ sơ, danh sách audit.",
    },
    {
      title: "An toàn dữ liệu",
      description:
        "Chúng tôi chỉ sử dụng dữ liệu này cho mục đích xác thực và liên hệ nội bộ.",
    },
  ];

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "");
      setPhone(user.phone || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert("Lỗi", "Họ và tên không được để trống");
      return;
    }

    setLoading(true);
    try {
      const response = await api.put(`/users/${user?.id}`, {
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
      });

      // Map backend response (database format) to frontend format
      const updatedUserData = {
        fullName: response.data.FullName || response.data.fullName,
        email: response.data.Email || response.data.email,
        phone: response.data.Phone || response.data.phone,
        avatar: response.data.Avatar || response.data.avatar,
      };

      updateUser(updatedUserData);
      Alert.alert("Thành công", "Đã cập nhật thông tin", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert(
        "Lỗi",
        error.response?.data?.error || "Cập nhật thông tin thất bại"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <BackHeader title="Cập nhật thông tin" />
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
            placeholder="Họ và tên"
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons
            name="call-outline"
            size={20}
            color="#666"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Số điện thoại"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons
            name="mail-outline"
            size={20}
            color="#666"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Lưu thay đổi</Text>
          )}
        </TouchableOpacity>
      </View>
      <BoardingTour storageKey="profile-edit" steps={profileTourSteps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.secondary,
  },
  form: {
    padding: 24,
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
  button: {
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
