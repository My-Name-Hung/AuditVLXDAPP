import Header from "@/src/components/Header";
import { Colors } from "@/src/constants/theme";
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
  const [stores, setStores] = useState<Store[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [selectedTerritory, setSelectedTerritory] = useState<number | null>(
    null
  );
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [showTerritoryDropdown, setShowTerritoryDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [territorySearch, setTerritorySearch] = useState("");

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  useEffect(() => {
    fetchTerritories();
    fetchStores();
  }, []);

  useEffect(() => {
    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchStores(true);
    }, 500);

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
        // When loading more, sort the combined array
        setStores((prev) => sortStoresByStatus([...prev, ...sortedData]));
      }

      setHasMore(pagination.page < pagination.totalPages);
      setPage((prev) => (reset ? 2 : prev + 1));
    } catch (error) {
      console.error("Error fetching stores:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      style={styles.storeCard}
      onPress={() => router.push(`/(tabs)/store-detail/${item.Id}`)}
    >
      <View style={styles.storeCardHeader}>
        <View style={styles.storeCardTitleContainer}>
          <Text style={styles.storeName}>{item.StoreName}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.Status) },
            ]}
          >
            <Text style={styles.statusText}>{getStatusLabel(item.Status)}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#999" />
      </View>

      <Text style={styles.storeCode}>{item.StoreCode}</Text>
      <Text style={styles.storeAddress}>{item.Address}</Text>
      <Text style={styles.storeContact}>
        {item.PartnerName || "N/A"} | {item.Phone || "N/A"}
      </Text>
    </TouchableOpacity>
  );

  const filteredTerritories = territories.filter((t) =>
    t.TerritoryName.toLowerCase().includes(territorySearch.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Header />

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <View style={styles.searchContainer}>
            <Ionicons
              name="search-outline"
              size={20}
              color="#666"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Mã/Tên cửa hàng"
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
        </View>

        <View style={styles.filterRow}>
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowTerritoryDropdown(!showTerritoryDropdown)}
            >
              <Text style={styles.dropdownText}>
                {selectedTerritory
                  ? territories.find((t) => t.Id === selectedTerritory)
                      ?.TerritoryName
                  : "Địa bàn phụ trách"}
              </Text>
              <Ionicons
                name={showTerritoryDropdown ? "chevron-up" : "chevron-down"}
                size={20}
                color="#666"
              />
            </TouchableOpacity>
            {showTerritoryDropdown && (
              <View style={styles.dropdownMenu}>
                <TextInput
                  style={styles.dropdownSearch}
                  placeholder="Tìm địa bàn..."
                  value={territorySearch}
                  onChangeText={setTerritorySearch}
                />
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedTerritory(null);
                    setShowTerritoryDropdown(false);
                    setTerritorySearch("");
                  }}
                >
                  <Text style={[styles.dropdownItemText, styles.clearText]}>
                    Tất cả
                  </Text>
                </TouchableOpacity>
                <FlatList
                  data={filteredTerritories}
                  keyExtractor={(item) => item.Id.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedTerritory(item.Id);
                        setShowTerritoryDropdown(false);
                        setTerritorySearch("");
                      }}
                    >
                      <Text style={styles.dropdownItemText}>
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
              style={styles.dropdown}
              onPress={() => setShowStatusDropdown(!showStatusDropdown)}
            >
              <Text style={styles.dropdownText}>
                {selectedStatus ? getStatusLabel(selectedStatus) : "Trạng thái"}
              </Text>
              <Ionicons
                name={showStatusDropdown ? "chevron-up" : "chevron-down"}
                size={20}
                color="#666"
              />
            </TouchableOpacity>
            {showStatusDropdown && (
              <View style={styles.dropdownMenu}>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedStatus(null);
                    setShowStatusDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, styles.clearText]}>
                    Tất cả
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedStatus("not_audited");
                    setShowStatusDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>Chưa thực hiện</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedStatus("audited");
                    setShowStatusDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>Đã thực hiện</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedStatus("passed");
                    setShowStatusDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>Đạt</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedStatus("failed");
                    setShowStatusDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>Không đạt</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Store List */}
      {loading && stores.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
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
          ListFooterComponent={
            loading && stores.length > 0 ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={Colors.light.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Không tìm thấy cửa hàng</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.secondary,
  },
  filtersContainer: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
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
    backgroundColor: "#f5f5f5",
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
    color: "#333",
  },
  dropdownContainer: {
    flex: 1,
    position: "relative",
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  dropdownText: {
    fontSize: 14,
    color: "#333",
  },
  dropdownMenu: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    maxHeight: 300,
    zIndex: 1000,
    elevation: 5,
  },
  dropdownSearch: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    fontSize: 14,
  },
  dropdownList: {
    maxHeight: 150,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#333",
  },
  clearText: {
    color: Colors.light.primary,
    fontWeight: "500",
  },
  listContent: {
    padding: 16,
  },
  storeCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
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
    color: "#333",
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
    color: "#666",
    marginBottom: 4,
  },
  storeAddress: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  storeContact: {
    fontSize: 14,
    color: "#666",
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
    color: "#999",
  },
});
