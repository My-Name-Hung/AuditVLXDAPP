import BoardingTour from "@/src/components/BoardingTour";
import Header from "@/src/components/Header";
import { useTheme } from "@/src/contexts/ThemeContext";
import api from "@/src/services/api";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Territory {
  Id: number;
  TerritoryName: string;
}

interface Store {
  Id: number;
  StoreCode: string;
  StoreName: string;
  Address: string;
  Phone: string;
  Email: string;
  Status: string;
  Rank: number;
  TaxCode: string;
  PartnerName: string;
  TerritoryName: string;
  UserFullName: string;
  UserCode: string;
}

const getStatusLabel = (status: string) => {
  const statusMap: Record<string, string> = {
    not_audited: "Chưa thực hiện",
    audited: "Đã thực hiện",
    passed: "Đạt",
    failed: "Không đạt",
  };
  return statusMap[status] || status;
};

const getStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    not_audited: "#FF9800",
    audited: "#2196F3",
    passed: "#4CAF50",
    failed: "#F44336",
  };
  return colorMap[status] || "#999";
};

const getStatusPriority = (status: string): number => {
  const priorityMap: Record<string, number> = {
    not_audited: 1, // Chưa thực hiện - đầu tiên
    failed: 2, // Không đạt
    passed: 3, // Đạt
    audited: 4, // Đã thực hiện - cuối cùng
  };
  return priorityMap[status] || 99; // Unknown status goes to end
};

const sortStoresByStatus = (stores: Store[]): Store[] => {
  return [...stores].sort((a, b) => {
    const priorityA = getStatusPriority(a.Status);
    const priorityB = getStatusPriority(b.Status);
    return priorityA - priorityB;
  });
};

export default function StoresScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [stores, setStores] = useState<Store[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [selectedTerritory, setSelectedTerritory] = useState<number | null>(
    null
  );
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [showTerritoryDropdown, setShowTerritoryDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [territorySearch, setTerritorySearch] = useState("");
  const storesTourSteps = [
    {
      title: "Tìm kiếm nhanh",
      description:
        "Sử dụng ô tìm kiếm để lọc theo mã hoặc tên cửa hàng. Kết quả sẽ cập nhật sau khi bạn dừng nhập khoảng 0.8 giây để tối ưu hiệu suất.",
    },
    {
      title: "Bộ lọc nâng cao",
      description:
        "Chọn địa bàn hoặc trạng thái để ưu tiên các cửa hàng cần audit. Dropdown cho phép chọn lại Tất cả bất cứ lúc nào.",
    },
    {
      title: "Thẻ trạng thái",
      description:
        "Mỗi thẻ hiển thị mã, địa chỉ, người phụ trách và trạng thái màu hóa (Đạt/Không đạt/Chưa làm) để bạn nắm tiến độ.",
    },
    {
      title: "Mở chi tiết",
      description:
        "Chạm vào thẻ để đi đến màn hình chi tiết và bắt đầu quy trình audit, chụp ảnh, ghi chú.",
    },
  ];

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  useEffect(() => {
    fetchTerritories();
    fetchStores();
  }, []);

  useEffect(() => {
    // Debounce search and show searching state
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchText.trim() || selectedTerritory || selectedStatus) {
      setIsSearching(true);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchStores(true);
    }, 800);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchText, selectedTerritory, selectedStatus]);

  const fetchTerritories = async () => {
    try {
      const response = await api.get("/territories");
      setTerritories(response.data.data || []);
    } catch (error) {
      console.error("Error fetching territories:", error);
    }
  };

  const fetchStores = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      }

      const params: any = {
        page: reset ? 1 : page,
        pageSize: 50,
      };

      if (searchText.trim()) {
        params.storeName = searchText.trim();
      }
      if (selectedTerritory) {
        params.territoryId = selectedTerritory;
      }
      if (selectedStatus) {
        params.status = selectedStatus;
      }

      const response = await api.get("/stores", { params });
      const data = response.data.data || [];
      const pagination = response.data.pagination || {};

      // Sort stores by status priority
      const sortedData = sortStoresByStatus(data);

      if (reset) {
        setStores(sortedData);
      } else {
        // When loading more, remove duplicates by Id before combining
        setStores((prev) => {
          const existingIds = new Set(prev.map((store) => store.Id));
          const newStores = sortedData.filter(
            (store) => !existingIds.has(store.Id)
          );
          return sortStoresByStatus([...prev, ...newStores]);
        });
      }

      setHasMore(pagination.page < pagination.totalPages);
      setPage((prev) => (reset ? 2 : prev + 1));
    } catch (error) {
      console.error("Error fetching stores:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsSearching(false);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchStores();
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchStores(true);
  };

  const renderStoreItem = ({ item }: { item: Store }) => (
    <TouchableOpacity
      style={[
        styles.storeCard,
        { backgroundColor: colors.background, borderColor: colors.icon + "20" },
      ]}
      onPress={() => router.push(`/(tabs)/store-detail/${item.Id}`)}
    >
      <View style={styles.storeCardHeader}>
        <View style={styles.storeCardTitleContainer}>
          <Text style={[styles.storeName, { color: colors.text }]}>
            {item.StoreName}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.Status) },
            ]}
          >
            <Text style={styles.statusText}>{getStatusLabel(item.Status)}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={24} color={colors.icon} />
      </View>

      <Text style={[styles.storeCode, { color: colors.icon }]}>
        {item.StoreCode}
      </Text>
      <Text style={[styles.storeAddress, { color: colors.icon }]}>
        {item.Address}
      </Text>
      <Text style={[styles.storeContact, { color: colors.icon }]}>
        {item.PartnerName || "N/A"} | {item.Phone || "N/A"}
      </Text>
    </TouchableOpacity>
  );

  const filteredTerritories = territories.filter((t) =>
    t.TerritoryName.toLowerCase().includes(territorySearch.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.secondary }]}>
      <Header />

      {/* Filters */}
      <View
        style={[
          styles.filtersContainer,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.icon + "20",
          },
        ]}
      >
        <View style={styles.filterRow}>
          <View
            style={[
              styles.searchContainer,
              {
                backgroundColor:
                  colors.background === "#fefefe"
                    ? "#f5f5f5"
                    : colors.secondary,
              },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.icon}
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Mã/Tên cửa hàng"
              placeholderTextColor={colors.icon}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
        </View>

        <View style={styles.filterRow}>
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={[
                styles.dropdown,
                {
                  backgroundColor:
                    colors.background === "#fefefe"
                      ? "#f5f5f5"
                      : colors.secondary,
                },
              ]}
              onPress={() => setShowTerritoryDropdown(!showTerritoryDropdown)}
            >
              <Text style={[styles.dropdownText, { color: colors.text }]}>
                {selectedTerritory
                  ? territories.find((t) => t.Id === selectedTerritory)
                      ?.TerritoryName
                  : "Địa bàn phụ trách"}
              </Text>
              <Ionicons
                name={showTerritoryDropdown ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.icon}
              />
            </TouchableOpacity>
            {showTerritoryDropdown && (
              <View
                style={[
                  styles.dropdownMenu,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.icon + "20",
                  },
                ]}
              >
                <TextInput
                  style={[
                    styles.dropdownSearch,
                    {
                      color: colors.text,
                      borderBottomColor: colors.icon + "20",
                    },
                  ]}
                  placeholder="Tìm địa bàn..."
                  placeholderTextColor={colors.icon}
                  value={territorySearch}
                  onChangeText={setTerritorySearch}
                />
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    { borderBottomColor: colors.secondary },
                  ]}
                  onPress={() => {
                    setSelectedTerritory(null);
                    setShowTerritoryDropdown(false);
                    setTerritorySearch("");
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      styles.clearText,
                      { color: colors.primary },
                    ]}
                  >
                    Tất cả
                  </Text>
                </TouchableOpacity>
                <FlatList
                  data={filteredTerritories}
                  keyExtractor={(item) => item.Id.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.dropdownItem,
                        { borderBottomColor: colors.secondary },
                      ]}
                      onPress={() => {
                        setSelectedTerritory(item.Id);
                        setShowTerritoryDropdown(false);
                        setTerritorySearch("");
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          { color: colors.text },
                        ]}
                      >
                        {item.TerritoryName}
                      </Text>
                    </TouchableOpacity>
                  )}
                  style={styles.dropdownList}
                />
              </View>
            )}
          </View>

          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={[
                styles.dropdown,
                {
                  backgroundColor:
                    colors.background === "#fefefe"
                      ? "#f5f5f5"
                      : colors.secondary,
                },
              ]}
              onPress={() => setShowStatusDropdown(!showStatusDropdown)}
            >
              <Text style={[styles.dropdownText, { color: colors.text }]}>
                {selectedStatus ? getStatusLabel(selectedStatus) : "Trạng thái"}
              </Text>
              <Ionicons
                name={showStatusDropdown ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.icon}
              />
            </TouchableOpacity>
            {showStatusDropdown && (
              <View
                style={[
                  styles.dropdownMenu,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.icon + "20",
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    { borderBottomColor: colors.secondary },
                  ]}
                  onPress={() => {
                    setSelectedStatus(null);
                    setShowStatusDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      styles.clearText,
                      { color: colors.primary },
                    ]}
                  >
                    Tất cả
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    { borderBottomColor: colors.secondary },
                  ]}
                  onPress={() => {
                    setSelectedStatus("not_audited");
                    setShowStatusDropdown(false);
                  }}
                >
                  <Text
                    style={[styles.dropdownItemText, { color: colors.text }]}
                  >
                    Chưa thực hiện
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    { borderBottomColor: colors.secondary },
                  ]}
                  onPress={() => {
                    setSelectedStatus("audited");
                    setShowStatusDropdown(false);
                  }}
                >
                  <Text
                    style={[styles.dropdownItemText, { color: colors.text }]}
                  >
                    Đã thực hiện
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    { borderBottomColor: colors.secondary },
                  ]}
                  onPress={() => {
                    setSelectedStatus("passed");
                    setShowStatusDropdown(false);
                  }}
                >
                  <Text
                    style={[styles.dropdownItemText, { color: colors.text }]}
                  >
                    Đạt
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    { borderBottomColor: colors.secondary },
                  ]}
                  onPress={() => {
                    setSelectedStatus("failed");
                    setShowStatusDropdown(false);
                  }}
                >
                  <Text
                    style={[styles.dropdownItemText, { color: colors.text }]}
                  >
                    Không đạt
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Store List */}
      {loading && stores.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={stores}
          renderItem={renderStoreItem}
          keyExtractor={(item) => item.Id.toString()}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListHeaderComponent={
            isSearching ? (
              <View style={styles.skeletonContainer}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.storeCard,
                      styles.skeletonCard,
                      { borderColor: colors.icon + "10" },
                    ]}
                  >
                    <View style={[styles.skeletonLine, styles.skeletonTitle]} />
                    <View style={[styles.skeletonLine, styles.skeletonCode]} />
                    <View style={[styles.skeletonLine, styles.skeletonAddress]} />
                    <View style={[styles.skeletonLine, styles.skeletonContact]} />
                  </View>
                ))}
              </View>
            ) : null
          }
          ListFooterComponent={
            loading && stores.length > 0 ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.icon }]}>
                Không tìm thấy cửa hàng
              </Text>
            </View>
          }
        />
      )}
      <BoardingTour storageKey="stores-list" steps={storesTourSteps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filtersContainer: {
    padding: 16,
    borderBottomWidth: 1,
  },
  filterRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  dropdownContainer: {
    flex: 1,
    position: "relative",
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  dropdownText: {
    fontSize: 14,
  },
  dropdownMenu: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 300,
    zIndex: 1000,
    elevation: 5,
  },
  dropdownSearch: {
    padding: 12,
    borderBottomWidth: 1,
    fontSize: 14,
  },
  dropdownList: {
    maxHeight: 150,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: 14,
  },
  clearText: {
    fontWeight: "500",
  },
  listContent: {
    padding: 16,
  },
  storeCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  storeCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  storeCardTitleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  storeName: {
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  storeCode: {
    fontSize: 14,
    marginBottom: 4,
  },
  storeAddress: {
    fontSize: 14,
    marginBottom: 4,
  },
  storeContact: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  footerLoading: {
    padding: 16,
    alignItems: "center",
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
  },
});
