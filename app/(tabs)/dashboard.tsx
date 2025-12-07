import Header from "@/src/components/Header";
import { useTheme } from "@/src/contexts/ThemeContext";
import api from "@/src/services/api";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart } from "react-native-chart-kit";

interface Territory {
  Id: number;
  TerritoryName: string;
}

interface Store {
  Id: number;
  StoreCode: string;
  StoreName: string;
}

interface StoresByDate {
  AuditDate: string;
  AuditedCount: number;
  NotAuditedCount: number;
}

interface StoreSurveyDetail {
  StoreId: number;
  StoreName: string;
  PurchasePrice: number | null;
  SellingPrice: number | null;
  AverageStockQuantity: number | null;
  QuantityReceived: number | null;
  IsAudited: boolean;
}

interface DayData {
  date: string;
  dateLabel: string;
  auditedCount: number;
  notAuditedCount: number;
  storeDetails: StoreSurveyDetail[];
}

// Helper function to get week number in month (1-4)
const getWeekInMonth = (date: Date): number => {
  const day = date.getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
};

// Helper function to get all dates in selected weeks
const getDatesInWeeks = (weeks: number[], year: number, month: number): string[] => {
  const dates: string[] = [];
  
  weeks.forEach((week) => {
    let startDay: number;
    let endDay: number;
    
    if (week === 1) {
      startDay = 1;
      endDay = 7;
    } else if (week === 2) {
      startDay = 8;
      endDay = 14;
    } else if (week === 3) {
      startDay = 15;
      endDay = 21;
    } else {
      startDay = 22;
      endDay = new Date(year, month + 1, 0).getDate();
    }
    
    for (let day = startDay; day <= endDay; day++) {
      const date = new Date(year, month, day);
      dates.push(date.toISOString().split("T")[0]);
    }
  });
  
  return dates.sort();
};

export default function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<string>("");
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [showTerritoryModal, setShowTerritoryModal] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [territorySearch, setTerritorySearch] = useState("");
  const [storeSearch, setStoreSearch] = useState("");
  
  // Week filter - default to current week
  const now = new Date();
  const currentWeek = getWeekInMonth(now);
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([currentWeek]);
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  
  // Chart data - by day instead of week
  const [dayData, setDayData] = useState<DayData[]>([]);
  const [hasSurveyData, setHasSurveyData] = useState(false);

  useEffect(() => {
    fetchTerritories();
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedWeeks.length > 0) {
      fetchDayData();
    }
  }, [selectedWeeks, selectedMonth, selectedYear, selectedTerritory, selectedStore]);

  const fetchTerritories = async () => {
    try {
      const response = await api.get("/territories");
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        setTerritories(response.data.data);
      } else if (Array.isArray(response.data)) {
        setTerritories(response.data);
      } else if (response.data && Array.isArray(response.data.data)) {
        setTerritories(response.data.data);
      } else {
        setTerritories([]);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching territories:", error);
      setTerritories([]);
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const response = await api.get("/stores", {
        params: { page: 1, pageSize: 1000 },
      });
      const data = response.data?.data || response.data || [];
      setStores(
        data.map((s: { Id: number; StoreCode?: string; StoreName?: string }) => ({
          Id: s.Id,
          StoreCode: s.StoreCode || "",
          StoreName: s.StoreName || "",
        }))
      );
    } catch (error) {
      console.error("Error fetching stores:", error);
      setStores([]);
    }
  };

  const fetchDayData = async () => {
    try {
      const dates = getDatesInWeeks(selectedWeeks, selectedYear, selectedMonth);
      if (dates.length === 0) {
        setDayData([]);
        setHasSurveyData(false);
        return;
      }

      // Get date range for all selected weeks
      const startDate = dates[0];
      const endDate = dates[dates.length - 1];

      console.log("Fetching dashboard data:", { 
        selectedWeeks, 
        selectedMonth, 
        selectedYear, 
        startDate, 
        endDate,
        dates 
      });

      const params: any = {
        startDate: startDate,
        endDate: endDate,
      };
      if (selectedTerritory) params.territoryId = selectedTerritory;
      if (selectedStore) params.storeId = selectedStore;

      // Fetch stores by date for the entire range
      const storesResponse = await api.get("/dashboard/stores-by-date", { params });
      const storesData = storesResponse.data?.success 
        ? storesResponse.data.data || []
        : storesResponse.data || [];

      console.log("Stores by date response:", storesData);

      // Fetch stores with audit status for the entire range
      const auditStatusParams = { ...params };
      const auditStatusResponse = await api.get("/dashboard/stores-with-audit-status", { params: auditStatusParams }).catch(() => null);
      
      // Fetch survey details for the entire range
      const surveyParams = { ...params };
      const surveyResponse = await api.get("/dashboard/store-survey-details", { params: surveyParams }).catch(() => null);
      
      // Create a map of date -> data
      const dateDataMap = new Map<string, { auditedCount: number; notAuditedCount: number; storeDetails: StoreSurveyDetail[] }>();
      
      // Initialize all dates with 0 counts
      dates.forEach((date) => {
        dateDataMap.set(date, {
          auditedCount: 0,
          notAuditedCount: 0,
          storeDetails: [],
        });
      });

      // Process stores by date data
      storesData.forEach((item: StoresByDate) => {
        // Normalize AuditDate to YYYY-MM-DD format
        let auditDateStr: string;
        try {
          if (item.AuditDate instanceof Date) {
            auditDateStr = item.AuditDate.toISOString().split("T")[0];
          } else if (typeof item.AuditDate === "string") {
            // Handle different date string formats (YYYY-MM-DD or Date object string)
            if (item.AuditDate.includes("T")) {
              auditDateStr = item.AuditDate.split("T")[0];
            } else {
              const dateObj = new Date(item.AuditDate);
              if (!isNaN(dateObj.getTime())) {
                auditDateStr = dateObj.toISOString().split("T")[0];
              } else {
                return;
              }
            }
          } else {
            return;
          }

          if (dateDataMap.has(auditDateStr)) {
            const dayData = dateDataMap.get(auditDateStr)!;
            dayData.auditedCount += item.AuditedCount || 0;
            dayData.notAuditedCount += item.NotAuditedCount || 0;
          }
        } catch (error) {
          console.error("Error processing audit date:", item.AuditDate, error);
        }
      });

      // Process survey data
      const surveyDataMap = new Map<number, any>();
      let hasAnySurveyData = false;

      if (surveyResponse?.data?.success && surveyResponse.data.data) {
        hasAnySurveyData = true;
        surveyResponse.data.data.forEach((store: any) => {
          surveyDataMap.set(store.StoreId, store);
        });
      }

      // Process audit status data - track which stores were audited on which dates
      if (auditStatusResponse?.data?.success && auditStatusResponse.data.data) {
        auditStatusResponse.data.data.forEach((store: any) => {
          const surveyData = surveyDataMap.get(store.StoreId);
          const storeDetail: StoreSurveyDetail = {
            StoreId: store.StoreId,
            StoreName: store.StoreName,
            PurchasePrice: surveyData?.PurchasePrice || null,
            SellingPrice: surveyData?.SellingPrice || null,
            AverageStockQuantity: surveyData?.AverageStockQuantity || null,
            QuantityReceived: surveyData?.QuantityReceived || null,
            IsAudited: store.IsAudited,
          };

          // If store has audit dates, add to those specific dates
          if (store.AuditDates && Array.isArray(store.AuditDates) && store.AuditDates.length > 0) {
            store.AuditDates.forEach((auditDate: string) => {
              if (dateDataMap.has(auditDate)) {
                const dayData = dateDataMap.get(auditDate)!;
                if (!dayData.storeDetails.find((s) => s.StoreId === store.StoreId)) {
                  dayData.storeDetails.push(storeDetail);
                }
              }
            });
          } else if (store.IsAudited) {
            // If audited but no specific dates, add to dates that have audit data
            dates.forEach((date) => {
              const dayData = dateDataMap.get(date)!;
              // Check if this store appears in storesData for this date
              const hasDataForDate = storesData.some((item: StoresByDate) => {
                let itemDateStr: string;
                if (item.AuditDate instanceof Date) {
                  itemDateStr = item.AuditDate.toISOString().split("T")[0];
                } else if (typeof item.AuditDate === "string") {
                  itemDateStr = new Date(item.AuditDate).toISOString().split("T")[0];
                } else {
                  return false;
                }
                return itemDateStr === date && item.AuditedCount > 0;
              });
              
              if (hasDataForDate && !dayData.storeDetails.find((s) => s.StoreId === store.StoreId)) {
                dayData.storeDetails.push(storeDetail);
              }
            });
          } else {
            // Not audited stores - add to all dates
            dates.forEach((date) => {
              const dayData = dateDataMap.get(date)!;
              if (!dayData.storeDetails.find((s) => s.StoreId === store.StoreId)) {
                dayData.storeDetails.push(storeDetail);
              }
            });
          }
        });
      }

      // Convert map to array
      const allDayData: DayData[] = dates.map((date) => {
        const dayData = dateDataMap.get(date)!;
        const dateObj = new Date(date);
        return {
          date,
          dateLabel: `${dateObj.getDate()}/${dateObj.getMonth() + 1}`,
          auditedCount: dayData.auditedCount,
          notAuditedCount: dayData.notAuditedCount,
          storeDetails: dayData.storeDetails,
        };
      });

      setHasSurveyData(hasAnySurveyData);
      setDayData(allDayData);
    } catch (error) {
      console.error("Error fetching day data:", error);
      setDayData([]);
      setHasSurveyData(false);
    }
  };

  const toggleWeek = (week: number) => {
    setSelectedWeeks((prev) => {
      if (prev.includes(week)) {
        if (prev.length === 1) return prev;
        return prev.filter((w) => w !== week);
      } else {
        if (prev.length >= 4) return prev;
        return [...prev, week].sort();
      }
    });
  };

  const selectAllWeeks = () => {
    setSelectedWeeks([1, 2, 3, 4]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // Prepare chart data - by day
  const chartLabels = dayData.map((d) => d.dateLabel);
  const auditedData = dayData.map((d) => d.auditedCount);
  const notAuditedData = dayData.map((d) => d.notAuditedCount);

  // Get all store details for charts
  const allStoreDetails = dayData.flatMap((d) => d.storeDetails);
  
  // Separate stores by audit status
  const auditedStores = allStoreDetails.filter((s) => s.IsAudited);
  const notAuditedStores = allStoreDetails.filter((s) => !s.IsAudited);
  
  // For store detail chart - show audited vs not audited
  const storeDetailLabels = allStoreDetails.map((s) => 
    s.StoreName.length > 10 ? s.StoreName.substring(0, 10) + "..." : s.StoreName
  );
  const storeAuditedData = allStoreDetails.map((s) => s.IsAudited ? 1 : 0);
  const storeNotAuditedData = allStoreDetails.map((s) => s.IsAudited ? 0 : 1);

  // Filter stores
  const filteredStores = stores.filter((store) =>
    store.StoreName.toLowerCase().includes(storeSearch.toLowerCase()) ||
    store.StoreCode.toLowerCase().includes(storeSearch.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header />
      <View style={styles.backButtonContainer}>
        <TouchableOpacity
          style={[styles.backButton, { borderColor: colors.icon + "40" }]}
          onPress={() => router.push("/(tabs)/stores")}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={[styles.backButtonText, { color: colors.text }]}>Quay lại</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Filters */}
        <View style={[styles.filterSection, { borderColor: colors.icon + "20" }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Bộ lọc
          </Text>
          
          {/* Territory Filter */}
          <View style={styles.filterRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>
                Địa bàn:
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.dropdown,
                { borderColor: colors.icon + "40", backgroundColor: colors.background },
              ]}
              onPress={() => setShowTerritoryModal(true)}
            >
              <Text style={[styles.dropdownText, { color: colors.text }]}>
                {selectedTerritory && territories && Array.isArray(territories)
                  ? territories.find((t) => t.Id.toString() === selectedTerritory)?.TerritoryName || "Tất cả"
                  : "Tất cả"}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.icon} />
            </TouchableOpacity>
          </View>

          {/* Store Filter */}
          <View style={styles.filterRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>
                Cửa hàng:
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.dropdown,
                { borderColor: colors.icon + "40", backgroundColor: colors.background },
              ]}
              onPress={() => setShowStoreModal(true)}
            >
              <Text style={[styles.dropdownText, { color: colors.text }]}>
                {selectedStore && stores && Array.isArray(stores)
                  ? stores.find((s) => s.Id.toString() === selectedStore)?.StoreName || "Tất cả"
                  : "Tất cả"}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.icon} />
            </TouchableOpacity>
          </View>

          {/* Week Filter */}
          <View style={styles.weekFilterContainer}>
            <View style={styles.weekFilterHeader}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>
                Chọn tuần trong tháng:
              </Text>
              <TouchableOpacity
                onPress={selectAllWeeks}
                style={[styles.selectAllButton, { backgroundColor: colors.primary + "20" }]}
              >
                <Text style={[styles.selectAllText, { color: colors.primary }]}>
                  Chọn tất cả
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.weekCheckboxContainer}>
              {[1, 2, 3, 4].map((week) => (
                <TouchableOpacity
                  key={week}
                  style={[
                    styles.weekCheckbox,
                    {
                      backgroundColor: selectedWeeks.includes(week)
                        ? colors.primary
                        : colors.background,
                      borderColor: colors.icon + "40",
                    },
                  ]}
                  onPress={() => toggleWeek(week)}
                >
                  <Ionicons
                    name={selectedWeeks.includes(week) ? "checkmark" : "square-outline"}
                    size={20}
                    color={selectedWeeks.includes(week) ? "#fff" : colors.icon}
                  />
                  <Text
                    style={[
                      styles.weekCheckboxText,
                      {
                        color: selectedWeeks.includes(week) ? "#fff" : colors.text,
                      },
                    ]}
                  >
                    Tuần {week}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Main Bar Chart - Stores by Day (Đã/Chưa thực hiện) */}
        {dayData.length > 0 ? (
          <View style={[styles.chartSection, { borderColor: colors.icon + "20" }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Thống kê cửa hàng theo ngày
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: chartLabels,
                  datasets: [
                    {
                      data: auditedData,
                      color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Green for audited
                      strokeWidth: 2,
                    },
                    {
                      data: notAuditedData,
                      color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`, // Amber for not audited
                      strokeWidth: 2,
                    },
                  ],
                  legend: ["Đã thực hiện", "Chưa thực hiện"],
                }}
                width={Math.max(
                  Dimensions.get("window").width - 64,
                  Math.max(dayData.length * 60, 300)
                )}
                height={280}
                chartConfig={{
                  backgroundColor: colors.background,
                  backgroundGradientFrom: colors.background,
                  backgroundGradientTo: colors.background,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  propsForBackgroundLines: {
                    strokeDasharray: "",
                    stroke: colors.icon + "40",
                  },
                }}
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
                yAxisLabel=""
                yAxisSuffix=""
                showValuesOnTopOfBars
                fromZero
              />
            </ScrollView>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#10B981" }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  Đã thực hiện: {dayData.reduce((sum, d) => sum + d.auditedCount, 0)}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#F59E0B" }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  Chưa thực hiện: {dayData.reduce((sum, d) => sum + d.notAuditedCount, 0)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.chartSection, { borderColor: colors.icon + "20" }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Thống kê cửa hàng theo ngày
            </Text>
            <Text style={[styles.noDataText, { color: colors.icon }]}>
              Chưa có dữ liệu.
            </Text>
          </View>
        )}

        {/* Store Details Bar Chart - Đã/Chưa thực hiện */}
        {allStoreDetails.length > 0 && (
          <View style={[styles.chartSection, { borderColor: colors.icon + "20" }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Chi tiết cửa hàng
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: storeDetailLabels,
                  datasets: [
                    {
                      data: storeAuditedData,
                      color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Green for audited
                      strokeWidth: 2,
                    },
                    {
                      data: storeNotAuditedData,
                      color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`, // Amber for not audited
                      strokeWidth: 2,
                    },
                  ],
                  legend: ["Đã thực hiện", "Chưa thực hiện"],
                }}
                width={Math.max(
                  Dimensions.get("window").width - 64,
                  Math.max(allStoreDetails.length * 100, 400)
                )}
                height={280}
                chartConfig={{
                  backgroundColor: colors.background,
                  backgroundGradientFrom: colors.background,
                  backgroundGradientTo: colors.background,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  propsForBackgroundLines: {
                    strokeDasharray: "",
                    stroke: colors.icon + "40",
                  },
                }}
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
                yAxisLabel=""
                yAxisSuffix=""
                showValuesOnTopOfBars
                fromZero
              />
            </ScrollView>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#10B981" }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  Đã thực hiện: {auditedStores.length}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#F59E0B" }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  Chưa thực hiện: {notAuditedStores.length}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Survey Details Bar Chart - Tách nhiều cột */}
        {hasSurveyData && auditedStores.length > 0 && (
          <View style={[styles.chartSection, { borderColor: colors.icon + "20" }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Chi tiết khảo sát cửa hàng
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: auditedStores.map((s) => s.StoreName.length > 10 ? s.StoreName.substring(0, 10) + "..." : s.StoreName),
                  datasets: [
                    {
                      data: auditedStores.map((s) => s.PurchasePrice ? Math.round(s.PurchasePrice / 1000) : 0),
                      color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // Blue
                      strokeWidth: 2,
                    },
                    {
                      data: auditedStores.map((s) => s.SellingPrice ? Math.round(s.SellingPrice / 1000) : 0),
                      color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`, // Purple
                      strokeWidth: 2,
                    },
                    {
                      data: auditedStores.map((s) => s.AverageStockQuantity || 0),
                      color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Green
                      strokeWidth: 2,
                    },
                    {
                      data: auditedStores.map((s) => s.QuantityReceived || 0),
                      color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`, // Amber
                      strokeWidth: 2,
                    },
                  ],
                  legend: [
                    "Giá mua (nghìn VNĐ)",
                    "Giá bán (nghìn VNĐ)",
                    "Tồn bình quân (tấn)",
                    "Sản lượng (tấn)",
                  ],
                }}
                width={Math.max(
                  Dimensions.get("window").width - 64,
                  Math.max(auditedStores.length * 100, 400)
                )}
                height={280}
                chartConfig={{
                  backgroundColor: colors.background,
                  backgroundGradientFrom: colors.background,
                  backgroundGradientTo: colors.background,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  propsForBackgroundLines: {
                    strokeDasharray: "",
                    stroke: colors.icon + "40",
                  },
                }}
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
                yAxisLabel=""
                yAxisSuffix=""
                showValuesOnTopOfBars
                fromZero
              />
            </ScrollView>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#3B82F6" }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  Giá mua (nghìn VNĐ)
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#8B5CF6" }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  Giá bán (nghìn VNĐ)
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#10B981" }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  Tồn bình quân (tấn)
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#F59E0B" }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  Sản lượng (tấn)
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Territory Picker Modal */}
      <Modal
        visible={showTerritoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowTerritoryModal(false);
          setTerritorySearch("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Chọn địa bàn
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowTerritoryModal(false);
                  setTerritorySearch("");
                }}
              >
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[
                styles.modalSearchInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.icon + "40",
                  marginBottom: 12,
                },
              ]}
              value={territorySearch}
              onChangeText={setTerritorySearch}
              placeholder="Tìm kiếm địa bàn"
              placeholderTextColor={colors.icon + "80"}
            />
            <ScrollView style={styles.modalScrollView}>
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  {
                    backgroundColor:
                      !selectedTerritory
                        ? colors.primary + "20"
                        : "transparent",
                  },
                ]}
                onPress={() => {
                  setSelectedTerritory("");
                  setShowTerritoryModal(false);
                  setTerritorySearch("");
                }}
              >
                <Text style={[styles.modalOptionText, { color: colors.text }]}>
                  Tất cả
                </Text>
              </TouchableOpacity>
              {territories &&
                Array.isArray(territories) &&
                territories
                  .filter((territory) =>
                    territory.TerritoryName.toLowerCase().includes(
                      territorySearch.toLowerCase()
                    )
                  )
                  .map((territory) => (
                    <TouchableOpacity
                      key={territory.Id.toString()}
                      style={[
                        styles.modalOption,
                        {
                          backgroundColor:
                            selectedTerritory === territory.Id.toString()
                              ? colors.primary + "20"
                              : "transparent",
                        },
                      ]}
                      onPress={() => {
                        setSelectedTerritory(territory.Id.toString());
                        setShowTerritoryModal(false);
                        setTerritorySearch("");
                      }}
                    >
                      <Text
                        style={[styles.modalOptionText, { color: colors.text }]}
                      >
                        {territory.TerritoryName}
                      </Text>
                    </TouchableOpacity>
                  ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Store Picker Modal */}
      <Modal
        visible={showStoreModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowStoreModal(false);
          setStoreSearch("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Chọn cửa hàng
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowStoreModal(false);
                  setStoreSearch("");
                }}
              >
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[
                styles.modalSearchInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.icon + "40",
                  marginBottom: 12,
                },
              ]}
              value={storeSearch}
              onChangeText={setStoreSearch}
              placeholder="Tìm kiếm cửa hàng"
              placeholderTextColor={colors.icon + "80"}
            />
            <ScrollView style={styles.modalScrollView}>
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  {
                    backgroundColor:
                      !selectedStore
                        ? colors.primary + "20"
                        : "transparent",
                  },
                ]}
                onPress={() => {
                  setSelectedStore("");
                  setShowStoreModal(false);
                  setStoreSearch("");
                }}
              >
                <Text style={[styles.modalOptionText, { color: colors.text }]}>
                  Tất cả
                </Text>
              </TouchableOpacity>
              {filteredStores.map((store) => (
                <TouchableOpacity
                  key={store.Id.toString()}
                  style={[
                    styles.modalOption,
                    {
                      backgroundColor:
                        selectedStore === store.Id.toString()
                          ? colors.primary + "20"
                          : "transparent",
                    },
                  ]}
                  onPress={() => {
                    setSelectedStore(store.Id.toString());
                    setShowStoreModal(false);
                    setStoreSearch("");
                  }}
                >
                  <Text
                    style={[styles.modalOptionText, { color: colors.text }]}
                  >
                    {store.StoreName} ({store.StoreCode})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  filterSection: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  filterLabel: {
    fontSize: 14,
    minWidth: 100,
    fontWeight: "500",
  },
  dropdown: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  dropdownText: {
    flex: 1,
    fontSize: 14,
  },
  weekFilterContainer: {
    gap: 12,
  },
  weekFilterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: "600",
  },
  weekCheckboxContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  weekCheckbox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100,
  },
  weekCheckboxText: {
    fontSize: 14,
    fontWeight: "500",
  },
  chartSection: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  chartLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
  },
  noDataText: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    padding: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalSearchInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  modalOptionText: {
    fontSize: 14,
  },
});
