import Header from "@/src/components/Header";
import { useTheme } from "@/src/contexts/ThemeContext";
import api from "@/src/services/api";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface TerritoryDetailItem {
  CheckinDate: string;
  AuditId: number;
  StoreId: number;
  StoreName: string;
  Address: string;
  TerritoryName: string | null;
  CheckinTime: string;
  Notes: string;
}

const formatLocalDate = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
};

const formatLocalTime = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("vi-VN", {
    hour12: false,
    timeZone: "UTC",
  });
};

export default function TerritoryDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id, territoryName } = useLocalSearchParams<{
    id: string;
    territoryName?: string;
  }>();
  const [detailData, setDetailData] = useState<TerritoryDetailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [storeNameInput, setStoreNameInput] = useState<string>("");
  const [storeNameFilter, setStoreNameFilter] = useState<string>("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);

  const fetchTerritoryDetail = useCallback(async () => {
    if (!id) return;

    const isFirstLoad = !hasLoaded;
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setIsFiltering(true);
    }

    if (requestAbortRef.current) {
      requestAbortRef.current.abort();
    }
    const controller = new AbortController();
    requestAbortRef.current = controller;

    try {
      const params: Record<string, string> = {};

      if (startDate) {
        params.startDate = startDate;
      }
      if (endDate) {
        params.endDate = endDate;
      }
      if (storeNameFilter && storeNameFilter.trim()) {
        params.storeName = storeNameFilter.trim();
      }

      const detailRes = await api.get(`/dashboard/territory/${id}`, {
        params,
        signal: controller.signal,
      });
      setDetailData((detailRes.data.data as TerritoryDetailItem[]) || []);
      setHasLoaded(true);
    } catch (error: unknown) {
      const typedError = error as { name?: string; code?: string };
      if (
        typedError?.name !== "CanceledError" &&
        typedError?.code !== "ERR_CANCELED"
      ) {
        console.error("Error fetching territory detail:", error);
      }
    } finally {
      if (isFirstLoad) {
        setLoading(false);
      }
      setIsFiltering(false);
    }
  }, [id, startDate, endDate, storeNameFilter, hasLoaded]);

  useEffect(() => {
    fetchTerritoryDetail();
  }, [fetchTerritoryDetail]);

  // Debounce storeNameInput to storeNameFilter
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setStoreNameFilter(storeNameInput);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [storeNameInput]);

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setStoreNameInput("");
    setStoreNameFilter("");
  };

  if (loading && !hasLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Đang tải dữ liệu...
          </Text>
        </View>
      </View>
    );
  }

  // Group data by date
  const groupedData = detailData.reduce(
    (acc, item) => {
      const date = item.CheckinDate;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(item);
      return acc;
    },
    {} as Record<string, TerritoryDetailItem[]>
  );

  const sortedDates = Object.keys(groupedData).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header />
      <View style={styles.backButtonContainer}>
        <TouchableOpacity
          style={[styles.backButton, { borderColor: colors.icon + "40" }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={[styles.backButtonText, { color: colors.text }]}>
            Quay lại
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={[styles.pageKicker, { color: colors.icon }]}>
            CHI TIẾT
          </Text>
          <Text style={[styles.pageTitle, { color: colors.text }]}>
            {territoryName || "Địa bàn"}
          </Text>
        </View>

        {/* Filters Section */}
        <View
          style={[
            styles.filterSection,
            {
              borderColor: colors.icon + "20",
              backgroundColor: colors.secondary,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Bộ lọc
          </Text>

          {/* Date Range Filters */}
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              Từ ngày:
            </Text>
            <TextInput
              style={[
                styles.dateInput,
                {
                  borderColor: colors.icon + "40",
                  backgroundColor: colors.background,
                  color: colors.text,
                },
              ]}
              placeholder="dd/mm/yyyy"
              placeholderTextColor={colors.icon}
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>

          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              Đến ngày:
            </Text>
            <TextInput
              style={[
                styles.dateInput,
                {
                  borderColor: colors.icon + "40",
                  backgroundColor: colors.background,
                  color: colors.text,
                },
              ]}
              placeholder="dd/mm/yyyy"
              placeholderTextColor={colors.icon}
              value={endDate}
              onChangeText={setEndDate}
            />
          </View>

          {/* Store Name Filter */}
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              Tên NPP/Cửa hàng:
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  borderColor: colors.icon + "40",
                  backgroundColor: colors.background,
                  color: colors.text,
                },
              ]}
              placeholder="Nhập tên cửa hàng..."
              placeholderTextColor={colors.icon}
              value={storeNameInput}
              onChangeText={setStoreNameInput}
            />
          </View>

          {/* Clear Filters Button */}
          {(startDate || endDate || storeNameInput) && (
            <TouchableOpacity
              style={[styles.clearButton, { borderColor: colors.icon + "40" }]}
              onPress={handleClearFilters}
            >
              <Text style={[styles.clearButtonText, { color: colors.text }]}>
                Xóa bộ lọc
              </Text>
            </TouchableOpacity>
          )}

          {isFiltering && (
            <View style={styles.filteringIndicator}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.filteringText, { color: colors.icon }]}>
                Đang lọc dữ liệu...
              </Text>
            </View>
          )}
        </View>

        {/* Data Table */}
        <View
          style={[
            styles.tableSection,
            {
              borderColor: colors.icon + "20",
              backgroundColor: colors.secondary,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Danh sách check-in
          </Text>

          {sortedDates.length === 0 ? (
            <View style={styles.noDataContainer}>
              <Text style={[styles.noDataText, { color: colors.icon }]}>
                Chưa có dữ liệu
              </Text>
            </View>
          ) : (
            <View style={styles.tableContainer}>
              {/* Table Header */}
              <View
                style={[
                  styles.tableRow,
                  styles.tableHeader,
                  { backgroundColor: colors.primary + "15" },
                ]}
              >
                <Text
                  style={[
                    styles.tableHeaderText,
                    { color: colors.text, flex: 0.15, textAlign: "center" },
                  ]}
                >
                  Ngày
                </Text>
                <Text
                  style={[
                    styles.tableHeaderText,
                    { color: colors.text, flex: 0.15, textAlign: "center" },
                  ]}
                >
                  STT
                </Text>
                <Text
                  style={[
                    styles.tableHeaderText,
                    { color: colors.text, flex: 0.4 },
                  ]}
                >
                  NPP/cửa hàng
                </Text>
                <Text
                  style={[
                    styles.tableHeaderText,
                    { color: colors.text, flex: 0.3, textAlign: "center" },
                  ]}
                >
                  Thời gian check in
                </Text>
              </View>

              {/* Table Rows */}
              {sortedDates.map((date) => {
                const items = groupedData[date];
                return items.map((item, index) => (
                  <View
                    key={`${item.AuditId}-${index}`}
                    style={[
                      styles.tableRow,
                      { borderBottomColor: colors.icon + "20" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tableCellText,
                        {
                          color: colors.text,
                          flex: 0.15,
                          textAlign: "center",
                          fontSize: 12,
                        },
                      ]}
                    >
                      {formatLocalDate(item.CheckinDate)}
                    </Text>
                    <Text
                      style={[
                        styles.tableCellText,
                        {
                          color: colors.text,
                          flex: 0.15,
                          textAlign: "center",
                        },
                      ]}
                    >
                      {index + 1}
                    </Text>
                    <Text
                      style={[
                        styles.tableCellText,
                        { color: colors.text, flex: 0.4 },
                      ]}
                      numberOfLines={2}
                    >
                      {item.StoreName}
                    </Text>
                    <Text
                      style={[
                        styles.tableCellText,
                        {
                          color: colors.text,
                          flex: 0.3,
                          textAlign: "center",
                        },
                      ]}
                    >
                      {formatLocalTime(item.CheckinTime)}
                    </Text>
                  </View>
                ));
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  backButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  headerSection: {
    marginBottom: 8,
  },
  pageKicker: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  filterSection: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "500",
    minWidth: 120,
  },
  dateInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  clearButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  filteringIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filteringText: {
    fontSize: 12,
  },
  tableSection: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  tableContainer: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    marginTop: 12,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  tableHeader: {
    paddingVertical: 14,
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: "700",
  },
  tableCellText: {
    fontSize: 13,
    fontWeight: "500",
  },
  noDataContainer: {
    padding: 20,
    alignItems: "center",
  },
  noDataText: {
    fontSize: 14,
    fontStyle: "italic",
  },
});

