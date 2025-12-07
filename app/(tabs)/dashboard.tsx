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
}

interface WeekData {
  week: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  auditedCount: number;
  notAuditedCount: number;
  totalPurchasePrice: number;
  totalSellingPrice: number;
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

// Helper function to get start and end date of a week in current month
const getWeekDates = (week: number, year: number, month: number) => {
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
    endDay = new Date(year, month + 1, 0).getDate(); // Last day of month
  }
  
  const startDate = new Date(year, month, startDay);
  const endDate = new Date(year, month, endDay);
  
  return {
    start: startDate.toISOString().split("T")[0],
    end: endDate.toISOString().split("T")[0],
  };
};

export default function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<string>("");
  const [showTerritoryModal, setShowTerritoryModal] = useState(false);
  const [territorySearch, setTerritorySearch] = useState("");
  
  // Week filter - default to current week
  const now = new Date();
  const currentWeek = getWeekInMonth(now);
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([currentWeek]);
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  
  // Chart data
  const [weekData, setWeekData] = useState<WeekData[]>([]);
  const [hasSurveyData, setHasSurveyData] = useState(false);

  useEffect(() => {
    fetchTerritories();
  }, []);

  useEffect(() => {
    if (selectedWeeks.length > 0) {
      fetchWeekData();
    }
  }, [selectedWeeks, selectedMonth, selectedYear, selectedTerritory]);

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

  const fetchWeekData = async () => {
    try {
      const allWeekData: WeekData[] = [];
      let hasAnySurveyData = false;

      for (const week of selectedWeeks) {
        const weekDates = getWeekDates(week, selectedYear, selectedMonth);
        
        const params: any = {
          startDate: weekDates.start,
          endDate: weekDates.end,
        };
        if (selectedTerritory) params.territoryId = selectedTerritory;

        // Fetch stores by date
        const storesResponse = await api.get("/dashboard/stores-by-date", { params });
        const storesData = storesResponse.data?.success 
          ? storesResponse.data.data || []
          : storesResponse.data || [];

        // Calculate totals for the week
        let auditedCount = 0;
        let notAuditedCount = 0;
        const dateMap = new Map<string, { audited: number; notAudited: number }>();

        storesData.forEach((item: StoresByDate) => {
          const date = new Date(item.AuditDate);
          const itemWeek = getWeekInMonth(date);
          if (itemWeek === week) {
            auditedCount += item.AuditedCount || 0;
            notAuditedCount += item.NotAuditedCount || 0;
          }
        });

        // Fetch survey details for this week
        const surveyParams = { ...params };
        const surveyResponse = await api.get("/dashboard/store-survey-details", { params: surveyParams }).catch(() => null);
        
        let totalPurchasePrice = 0;
        let totalSellingPrice = 0;
        const storeDetails: StoreSurveyDetail[] = [];

        if (surveyResponse?.data?.success && surveyResponse.data.data) {
          hasAnySurveyData = true;
          const surveyData = surveyResponse.data.data;
          
          surveyData.forEach((store: any) => {
            if (store.PurchasePrice) totalPurchasePrice += store.PurchasePrice;
            if (store.SellingPrice) totalSellingPrice += store.SellingPrice;
            
            storeDetails.push({
              StoreId: store.StoreId,
              StoreName: store.StoreName,
              PurchasePrice: store.PurchasePrice,
              SellingPrice: store.SellingPrice,
              AverageStockQuantity: store.AverageStockQuantity,
              QuantityReceived: store.QuantityReceived,
            });
          });
        }

        allWeekData.push({
          week,
          weekLabel: `Tuần ${week}`,
          startDate: weekDates.start,
          endDate: weekDates.end,
          auditedCount,
          notAuditedCount,
          totalPurchasePrice,
          totalSellingPrice,
          storeDetails,
        });
      }

      setHasSurveyData(hasAnySurveyData);
      setWeekData(allWeekData);
    } catch (error) {
      console.error("Error fetching week data:", error);
      setWeekData([]);
      setHasSurveyData(false);
    }
  };

  const toggleWeek = (week: number) => {
    setSelectedWeeks((prev) => {
      if (prev.includes(week)) {
        // Don't allow deselecting if it's the only selected week
        if (prev.length === 1) return prev;
        return prev.filter((w) => w !== week);
      } else {
        // Max 4 weeks
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

  // Prepare chart data
  const chartLabels = weekData.map((w) => w.weekLabel);
  const auditedData = weekData.map((w) => w.auditedCount);
  const notAuditedData = weekData.map((w) => w.notAuditedCount);
  const purchasePriceData = weekData.map((w) => Math.round(w.totalPurchasePrice / 1000000)); // Convert to millions
  const sellingPriceData = weekData.map((w) => Math.round(w.totalSellingPrice / 1000000));

  // Get all store details for survey chart
  const allStoreDetails = weekData.flatMap((w) => w.storeDetails);

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

        {/* Main Bar Chart - Stores by Week */}
        {weekData.length > 0 ? (
          <View style={[styles.chartSection, { borderColor: colors.icon + "20" }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Thống kê cửa hàng theo tuần
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
                    {
                      data: purchasePriceData,
                      color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // Blue for purchase price
                      strokeWidth: 2,
                    },
                    {
                      data: sellingPriceData,
                      color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`, // Purple for selling price
                      strokeWidth: 2,
                    },
                  ],
                  legend: [
                    "Đã thực hiện",
                    "Chưa thực hiện",
                    "Giá mua (triệu VNĐ)",
                    "Giá bán (triệu VNĐ)",
                  ],
                }}
                width={Math.max(
                  Dimensions.get("window").width - 64,
                  Math.max(weekData.length * 80, 300)
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
                  Đã thực hiện: {weekData.reduce((sum, w) => sum + w.auditedCount, 0)}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#F59E0B" }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  Chưa thực hiện: {weekData.reduce((sum, w) => sum + w.notAuditedCount, 0)}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#3B82F6" }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  Tổng giá mua: {weekData.reduce((sum, w) => sum + w.totalPurchasePrice, 0).toLocaleString("vi-VN")} VNĐ
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#8B5CF6" }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  Tổng giá bán: {weekData.reduce((sum, w) => sum + w.totalSellingPrice, 0).toLocaleString("vi-VN")} VNĐ
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.chartSection, { borderColor: colors.icon + "20" }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Thống kê cửa hàng theo tuần
            </Text>
            <Text style={[styles.noDataText, { color: colors.icon }]}>
              Chưa có dữ liệu.
            </Text>
          </View>
        )}

        {/* Survey Details Bar Chart - Only show if has survey data */}
        {hasSurveyData && allStoreDetails.length > 0 && (
          <View style={[styles.chartSection, { borderColor: colors.icon + "20" }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Chi tiết khảo sát cửa hàng
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: allStoreDetails.map((s) => s.StoreName.length > 10 ? s.StoreName.substring(0, 10) + "..." : s.StoreName),
                  datasets: [
                    {
                      data: allStoreDetails.map((s) => s.PurchasePrice ? Math.round(s.PurchasePrice / 1000) : 0),
                      color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                      strokeWidth: 2,
                    },
                    {
                      data: allStoreDetails.map((s) => s.SellingPrice ? Math.round(s.SellingPrice / 1000) : 0),
                      color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                      strokeWidth: 2,
                    },
                    {
                      data: allStoreDetails.map((s) => s.AverageStockQuantity || 0),
                      color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                      strokeWidth: 2,
                    },
                    {
                      data: allStoreDetails.map((s) => s.QuantityReceived || 0),
                      color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`,
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
