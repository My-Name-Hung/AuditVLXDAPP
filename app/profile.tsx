import BackHeader from "@/src/components/BackHeader";
import { Colors } from "@/src/constants/theme";
import { useAuth } from "@/src/contexts/AuthContext";
import api from "@/src/services/api";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [darkMode, setDarkMode] = useState(false); // Always false for light theme

  const handleUploadAvatar = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Quyền truy cập", "Cần quyền truy cập thư viện ảnh");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        const uri = result.assets[0].uri;

        // Upload to backend
        const formData = new FormData();
        formData.append("avatar", {
          uri,
          type: "image/jpeg",
          name: "avatar.jpg",
        } as any);

        try {
          const response = await api.post("/users/avatar", formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });

          updateUser({ avatar: response.data.avatar });
          Alert.alert("Thành công", "Đã cập nhật ảnh đại diện");
        } catch (error: any) {
          Alert.alert(
            "Lỗi",
            error.response?.data?.error || "Upload ảnh thất bại"
          );
        } finally {
          setUploading(false);
        }
      }
    } catch (error) {
      console.error("Image picker error:", error);
      setUploading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const toggleDarkMode = (value: boolean) => {
    setDarkMode(value);
    // Note: Dark mode toggle will be handled by system or theme provider
    // This is just for UI state
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <BackHeader title="Thông tin tài khoản" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackHeader title="Thông tin tài khoản" />
      <ScrollView style={styles.scrollView}>
        {/* Profile Header Section */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={60} color="#fff" />
              </View>
            )}
            {uploading && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            <TouchableOpacity
              style={styles.editAvatarButton}
              onPress={handleUploadAvatar}
              disabled={uploading}
            >
              <Ionicons name="camera" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.fullName}>{user.fullName}</Text>
          <Text style={styles.contactInfo}>
            {user.phone || "Chưa có"} | {user.email || "Chưa có"}
          </Text>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <View style={styles.featureItem}>
            <Ionicons name="person-outline" size={24} color="#333" />
            <Text style={styles.featureText}>Cập nhật thông tin tài khoản</Text>
          </View>

          <View style={styles.featureItem}>
            <Ionicons name="lock-closed-outline" size={24} color="#333" />
            <Text style={styles.featureText}>Thay đổi mật khẩu</Text>
          </View>

          <View style={styles.featureItem}>
            <Ionicons name="color-palette-outline" size={24} color="#333" />
            <Text style={styles.featureText}>Giao diện sáng tối</Text>
            <Switch
              value={darkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: "#767577", true: Colors.light.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.secondary,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  profileHeader: {
    backgroundColor: Colors.light.primary,
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#fff",
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#fff",
  },
  uploadOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primary,
    borderWidth: 3,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  fullName: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.secondary,
    marginBottom: 8,
  },
  contactInfo: {
    fontSize: 14,
    color: Colors.light.secondary,
    opacity: 0.9,
  },
  featuresSection: {
    backgroundColor: Colors.light.secondary,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  featureText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    marginLeft: 12,
  },
  logoutButton: {
    backgroundColor: "#F44336",
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
