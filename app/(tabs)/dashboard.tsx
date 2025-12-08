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
  TouchableOpacity,
  View,
} from "react-native";
// Custom Grouped Bar Chart Component for Mobile
// Chart component for territory data
const TerritoryBarChart = ({
  data,
  width,
  height,
  colors: themeColors,
}: {
  data: TerritorySummary[];
  width: number;
  height: number;
  colors: any;
}) => {
  const chartHeight = height - 80;
  const chartWidth = width - 50;
  const maxValue = Math.max(
    ...data.map((item) =>
      Math.max(item.StoresChecked || 0, item.CheckinDays || 0)
    ),
    1
  );

  const totalGroups = data.length;
  const availableWidth = chartWidth;
  const groupWidth = availableWidth / totalGroups;
  const barWidth = groupWidth * 0.35;
  const barGap = groupWidth * 0.05;

  return (
    <View
      style={{
        width,
        height,
        paddingHorizontal: 20,
        paddingVertical: 10,
        overflow: "visible",
      }}
    >
      {/* Y-axis labels and grid lines */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 10,
          bottom: 50,
          width: 35,
          justifyContent: "space-between",
        }}
      >
        {[0, 1, 2, 3, 4].map((segment) => {
          const value = Math.round((maxValue / 4) * (4 - segment));
          return (
            <View key={segment} style={{ alignItems: "flex-end" }}>
              <Text
                style={{
                  fontSize: 11,
                  color: themeColors.text,
                  fontWeight: "500",
                }}
              >
                {value}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Grid lines */}
      <View
        style={{
          marginLeft: 40,
          marginRight: 10,
          height: chartHeight,
          position: "absolute",
          top: 10,
          left: 0,
          right: 0,
        }}
      >
        {[0, 1, 2, 3, 4].map((segment) => {
          const yPosition = (chartHeight / 4) * segment;
          return (
            <View
              key={segment}
              style={{
                position: "absolute",
                top: yPosition,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: themeColors.icon + "20",
              }}
            />
          );
        })}
      </View>

      {/* Chart area with bars */}
      <View
        style={{
          marginLeft: 40,
          marginRight: 10,
          height: chartHeight,
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            height: chartHeight,
            width: chartWidth,
          }}
        >
          {data.map((item, index) => {
            const storesValue = item.StoresChecked || 0;
            const daysValue = item.CheckinDays || 0;
            const storesHeight =
              maxValue > 0 ? (storesValue / maxValue) * chartHeight : 0;
            const daysHeight =
              maxValue > 0 ? (daysValue / maxValue) * chartHeight : 0;

            return (
              <View
                key={index}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  gap: barGap,
                  width: groupWidth,
                }}
              >
                {/* Stores checked bar (green) */}
                <View
                  style={{
                    alignItems: "center",
                    width: barWidth,
                    position: "relative",
                  }}
                >
                  {storesValue > 0 && storesHeight < 20 && (
                    <Text
                      style={{
                        position: "absolute",
                        top: -16,
                        fontSize: 10,
                        color: themeColors.text,
                        fontWeight: "600",
                        textAlign: "center",
                        width: barWidth,
                      }}
                    >
                      {storesValue}
                    </Text>
                  )}
                  <View
                    style={{
                      width: barWidth,
                      height: Math.max(storesHeight, storesValue > 0 ? 2 : 0),
                      backgroundColor: "#10B981",
                      borderRadius: 4,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      justifyContent: "flex-start",
                      alignItems: "center",
                      paddingTop: storesHeight >= 20 ? 2 : 0,
                    }}
                  >
                    {storesValue > 0 && storesHeight >= 20 && (
                      <Text
                        style={{
                          fontSize: 9,
                          color: "#fff",
                          fontWeight: "700",
                          textAlign: "center",
                          textShadowColor: "rgba(0, 0, 0, 0.3)",
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 2,
                        }}
                      >
                        {storesValue}
                      </Text>
                    )}
                  </View>
                </View>
                {/* Checkin days bar (orange) */}
                <View
                  style={{
                    alignItems: "center",
                    width: barWidth,
                    position: "relative",
                  }}
                >
                  {daysValue > 0 && daysHeight < 20 && (
                    <Text
                      style={{
                        position: "absolute",
                        top: -16,
                        fontSize: 10,
                        color: themeColors.text,
                        fontWeight: "600",
                        textAlign: "center",
                        width: barWidth,
                      }}
                    >
                      {daysValue}
                    </Text>
                  )}
                  <View
                    style={{
                      width: barWidth,
                      height: Math.max(daysHeight, daysValue > 0 ? 2 : 0),
                      backgroundColor: "#F59E0B",
                      borderRadius: 4,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      justifyContent: "flex-start",
                      alignItems: "center",
                      paddingTop: daysHeight >= 20 ? 2 : 0,
                    }}
                  >
                    {daysValue > 0 && daysHeight >= 20 && (
                      <Text
                        style={{
                          fontSize: 9,
                          color: "#fff",
                          fontWeight: "700",
                          textAlign: "center",
                          textShadowColor: "rgba(0, 0, 0, 0.3)",
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 2,
                        }}
                      >
                        {daysValue}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* X-axis labels - Territory names */}
      <View
        style={{
          position: "absolute",
          left: 60,
          right: 30,
          top: chartHeight + 20,
          flexDirection: "row",
          width: chartWidth,
          height: 30,
        }}
      >
        {data.map((item, index) => (
          <View
            key={index}
            style={{
              width: groupWidth,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 11,
                color: themeColors.text,
                textAlign: "center",
                fontWeight: "600",
              }}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {item.TerritoryName}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

interface Territory {
  Id: number;
  TerritoryName: string;
}

interface TerritorySummary {
  TerritoryId: number;
  TerritoryName: string;
  StoresChecked: number;
  CheckinDays: number;
}

interface TerritorySummaryResponse {
  territories: TerritorySummary[];
  totals: {
    StoresChecked: number;
    CheckinDays: number;
  };
}

// Helper function to get week dates (7 days) for a given month and week number
const getWeekDates = (
  year: number,
  month: number,
  weekNumber: number
): string[] => {
  // Month is 0-indexed in JavaScript Date (0 = January, 11 = December)
  const monthIndex = month - 1;

  // Calculate start day of the week
  // Week 1: days 1-7, Week 2: days 8-14, Week 3: days 15-21, Week 4: days 22-end
  let startDay: number;
  if (weekNumber === 1) {
    startDay = 1;
  } else if (weekNumber === 2) {
    startDay = 8;
  } else if (weekNumber === 3) {
    startDay = 15;
  } else {
    startDay = 22;
  }

  const dates: string[] = [];
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  for (let i = 0; i < 7; i++) {
    const day = startDay + i;
    if (day <= daysInMonth) {
      const date = new Date(year, monthIndex, day);
      dates.push(date.toISOString().split("T")[0]);
    } else {
      // If week extends beyond month, use last day of month
      const date = new Date(year, monthIndex, daysInMonth);
      dates.push(date.toISOString().split("T")[0]);
      break;
    }
  }

  return dates;
};

// Helper function to get month start and end dates
const getMonthDates = (
  year: number,
  month: number
): { startDate: string; endDate: string } => {
  const monthIndex = month - 1;
  const startDate = new Date(year, monthIndex, 1);
  const endDate = new Date(year, monthIndex + 1, 0); // Last day of month

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
};

export default function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth() + 1
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [selectedWeek, setSelectedWeek] = useState<number>(0); // 0 = Tất cả, 1-4 = Tuần 1-4
  const [showTerritoryModal, setShowTerritoryModal] = useState(false);
  const [territorySearch, setTerritorySearch] = useState("");

  // Chart data
  // Removed storesByDate - chart now always shows by territory
  // const [storesByDate, setStoresByDate] = useState<StoresByDate[]>([]);
  const [territorySummary, setTerritorySummary] =
    useState<TerritorySummaryResponse | null>(null);

  useEffect(() => {
    fetchTerritories();
  }, []);

  // Removed fetchStoresByDate - chart now always shows by territory

  useEffect(() => {
    fetchStoresByTerritory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear, selectedWeek, selectedTerritory]);

  const fetchTerritories = async () => {
    try {
      const response = await api.get("/territories");
      if (
        response.data &&
        response.data.success &&
        Array.isArray(response.data.data)
      ) {
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

  const fetchStoresByTerritory = async () => {
    try {
      let startDate: string;
      let endDate: string;

      // Nếu selectedWeek = 0 (Tất cả), dùng date range của cả tháng
      // Nếu selectedWeek > 0, dùng date range của tuần đó
      if (selectedWeek === 0) {
        const monthDates = getMonthDates(selectedYear, selectedMonth);
        startDate = monthDates.startDate;
        endDate = monthDates.endDate;
      } else {
        const weekDates = getWeekDates(
          selectedYear,
          selectedMonth,
          selectedWeek
        );
        if (weekDates.length === 0) {
          setTerritorySummary(null);
          return;
        }
        startDate = weekDates[0];
        endDate = weekDates[weekDates.length - 1];
      }

      const params: any = {
        startDate,
        endDate,
      };

      // Thêm filter theo địa bàn nếu có
      if (selectedTerritory) {
        params.territoryId = selectedTerritory;
      }

      const response = await api.get("/dashboard/stores-by-territory", {
        params,
      });

      console.log("Territory summary response:", response.data);

      if (response.data.success) {
        setTerritorySummary(response.data.data);
        console.log("Territory summary set:", response.data.data);
      } else {
        setTerritorySummary(null);
      }
    } catch (error) {
      console.error("Error fetching stores by territory:", error);
      setTerritorySummary(null);
    }
  };

  const getMonthName = (month: number): string => {
    const months = [
      "Tháng 1",
      "Tháng 2",
      "Tháng 3",
      "Tháng 4",
      "Tháng 5",
      "Tháng 6",
      "Tháng 7",
      "Tháng 8",
      "Tháng 9",
      "Tháng 10",
      "Tháng 11",
      "Tháng 12",
    ];
    return months[month - 1] || "";
  };

  const getWeekLabel = (week: number): string => {
    return `Tuần ${week}`;
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header />
      <View style={styles.backButtonContainer}>
        <TouchableOpacity
          style={[styles.backButton, { borderColor: colors.icon + "40" }]}
          onPress={() => router.push("/(tabs)/stores")}
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

          {/* Territory Filter */}
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              Địa bàn:
            </Text>
            <TouchableOpacity
              style={[
                styles.dropdown,
                {
                  borderColor: colors.icon + "40",
                  backgroundColor: colors.background,
                },
              ]}
              onPress={() => setShowTerritoryModal(true)}
            >
              <Text style={[styles.dropdownText, { color: colors.text }]}>
                {selectedTerritory && territories && Array.isArray(territories)
                  ? territories.find(
                      (t) => t.Id.toString() === selectedTerritory
                    )?.TerritoryName || "Tất cả"
                  : "Tất cả"}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.icon} />
            </TouchableOpacity>
          </View>

          {/* Month Filter */}
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              Tháng:
            </Text>
            <View style={styles.monthYearContainer}>
              <TouchableOpacity
                style={[
                  styles.monthButton,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.icon + "40",
                  },
                ]}
                onPress={() => {
                  if (selectedMonth > 1) {
                    setSelectedMonth(selectedMonth - 1);
                  } else {
                    setSelectedMonth(12);
                    setSelectedYear(selectedYear - 1);
                  }
                }}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.monthYearText, { color: colors.text }]}>
                {getMonthName(selectedMonth)} {selectedYear}
              </Text>
              <TouchableOpacity
                style={[
                  styles.monthButton,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.icon + "40",
                  },
                ]}
                onPress={() => {
                  if (selectedMonth < 12) {
                    setSelectedMonth(selectedMonth + 1);
                  } else {
                    setSelectedMonth(1);
                    setSelectedYear(selectedYear + 1);
                  }
                }}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Week Filter */}
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              Tuần:
            </Text>
            <View style={styles.weekContainer}>
              <TouchableOpacity
                style={[
                  styles.weekButton,
                  {
                    backgroundColor:
                      selectedWeek === 0 ? colors.primary : colors.background,
                    borderColor: colors.icon + "40",
                  },
                ]}
                onPress={() => setSelectedWeek(0)}
              >
                <Text
                  style={[
                    styles.weekButtonText,
                    { color: selectedWeek === 0 ? "#fff" : colors.text },
                  ]}
                >
                  Tất cả
                </Text>
              </TouchableOpacity>
              {[1, 2, 3, 4].map((week) => (
                <TouchableOpacity
                  key={week}
                  style={[
                    styles.weekButton,
                    {
                      backgroundColor:
                        selectedWeek === week
                          ? colors.primary
                          : colors.background,
                      borderColor: colors.icon + "40",
                    },
                  ]}
                  onPress={() => setSelectedWeek(week)}
                >
                  <Text
                    style={[
                      styles.weekButtonText,
                      { color: selectedWeek === week ? "#fff" : colors.text },
                    ]}
                  >
                    {getWeekLabel(week)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Bar Chart Section - Luôn hiển thị theo địa bàn */}
        {territorySummary &&
        territorySummary.territories &&
        territorySummary.territories.length > 0 ? (
          <View
            style={[
              styles.chartSection,
              {
                borderColor: colors.icon + "20",
                backgroundColor: colors.secondary,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Thống kê theo địa bàn
            </Text>
            <Text style={[styles.chartSubtitle, { color: colors.icon }]}>
              {selectedWeek === 0
                ? `${getMonthName(selectedMonth)} ${selectedYear}`
                : `${getWeekLabel(selectedWeek)} - ${getMonthName(
                    selectedMonth
                  )} ${selectedYear}`}
            </Text>
            <View style={{ alignItems: "center", minHeight: 360 }}>
              <TerritoryBarChart
                data={territorySummary.territories}
                width={Dimensions.get("window").width - 32}
                height={360}
                colors={colors}
              />
            </View>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendColor, { backgroundColor: "#10B981" }]}
                />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  Số cửa hàng checkin:{" "}
                  {territorySummary.totals?.StoresChecked || 0}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendColor, { backgroundColor: "#F59E0B" }]}
                />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  Số ngày checkin: {territorySummary.totals?.CheckinDays || 0}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.chartSection,
              {
                borderColor: colors.icon + "20",
                backgroundColor: colors.secondary,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Thống kê theo địa bàn
            </Text>
            <Text style={[styles.chartSubtitle, { color: colors.icon }]}>
              {selectedWeek === 0
                ? `${getMonthName(selectedMonth)} ${selectedYear}`
                : `${getWeekLabel(selectedWeek)} - ${getMonthName(
                    selectedMonth
                  )} ${selectedYear}`}
            </Text>
            <Text style={[styles.noDataText, { color: colors.icon }]}>
              Chưa có dữ liệu.
            </Text>
          </View>
        )}

        {/* Territory Summary Table */}
        {territorySummary && (
          <View
            style={[
              styles.chartSection,
              {
                borderColor: colors.icon + "20",
                backgroundColor: colors.secondary,
                marginTop: 16,
              },
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.text, marginBottom: 12 },
              ]}
            >
              Tổng hợp theo địa bàn
            </Text>
            <Text
              style={[
                styles.chartSubtitle,
                { color: colors.icon, marginBottom: 12 },
              ]}
            >
              {getMonthName(selectedMonth)} {selectedYear}
            </Text>
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
                    { color: colors.text, flex: 0.3, textAlign: "center" },
                  ]}
                >
                  STT
                </Text>
                <Text
                  style={[
                    styles.tableHeaderText,
                    { color: colors.text, flex: 1 },
                  ]}
                >
                  Địa bàn
                </Text>
                <Text
                  style={[
                    styles.tableHeaderText,
                    { color: colors.text, flex: 0.8, textAlign: "center" },
                  ]}
                >
                  Số cửa hàng checkin
                </Text>
                <Text
                  style={[
                    styles.tableHeaderText,
                    { color: colors.text, flex: 0.8, textAlign: "center" },
                  ]}
                >
                  Số ngày checkin
                </Text>
              </View>
              {/* Table Rows */}
              {territorySummary.territories &&
              territorySummary.territories.length > 0 ? (
                territorySummary.territories.map((item, index) => (
                  <View
                    key={item.TerritoryId}
                    style={[
                      styles.tableRow,
                      { borderBottomColor: colors.icon + "20" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tableCellText,
                        { color: colors.text, flex: 0.3, textAlign: "center" },
                      ]}
                    >
                      {index + 1}
                    </Text>
                    <Text
                      style={[
                        styles.tableCellText,
                        { color: colors.text, flex: 1 },
                      ]}
                    >
                      {item.TerritoryName}
                    </Text>
                    <Text
                      style={[
                        styles.tableCellText,
                        {
                          color: "#10B981",
                          flex: 0.8,
                          textAlign: "center",
                          fontWeight: "600",
                        },
                      ]}
                    >
                      {item.StoresChecked}
                    </Text>
                    <Text
                      style={[
                        styles.tableCellText,
                        {
                          color: "#F59E0B",
                          flex: 0.8,
                          textAlign: "center",
                          fontWeight: "600",
                        },
                      ]}
                    >
                      {item.CheckinDays}
                    </Text>
                  </View>
                ))
              ) : (
                <View style={[styles.tableRow, { paddingVertical: 20 }]}>
                  <Text
                    style={[
                      styles.tableCellText,
                      { color: colors.icon, textAlign: "center", flex: 1 },
                    ]}
                  >
                    Chưa có dữ liệu
                  </Text>
                </View>
              )}
              {/* Table Footer (Totals) */}
              {territorySummary.totals && (
                <View
                  style={[
                    styles.tableRow,
                    styles.tableFooter,
                    {
                      backgroundColor: colors.primary + "10",
                      borderTopWidth: 2,
                      borderTopColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tableFooterText,
                      { color: colors.text, flex: 0.3, textAlign: "center" },
                    ]}
                    numberOfLines={1}
                  ></Text>
                  <Text
                    style={[
                      styles.tableFooterText,
                      { color: colors.text, flex: 1, textAlign: "center" },
                    ]}
                    numberOfLines={1}
                  >
                    Tổng
                  </Text>
                  <Text
                    style={[
                      styles.tableFooterText,
                      {
                        color: "#10B981",
                        flex: 0.8,
                        textAlign: "center",
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {territorySummary.totals.StoresChecked}
                  </Text>
                  <Text
                    style={[
                      styles.tableFooterText,
                      {
                        color: "#F59E0B",
                        flex: 0.8,
                        textAlign: "center",
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {territorySummary.totals.CheckinDays}
                  </Text>
                </View>
              )}
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
            <ScrollView style={styles.modalScrollView}>
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  {
                    backgroundColor: !selectedTerritory
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
    minWidth: 80,
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
  monthYearContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  monthButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: 120,
    textAlign: "center",
  },
  weekContainer: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  weekButton: {
    flex: 1,
    minWidth: 70,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  weekButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  chartSection: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  chartSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 16,
    flexWrap: "wrap",
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
    fontSize: 13,
    fontWeight: "500",
  },
  noDataText: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    padding: 20,
  },
  tableContainer: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
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
  tableFooter: {
    paddingVertical: 14,
    borderBottomWidth: 0,
  },
  tableFooterText: {
    fontSize: 14,
    fontWeight: "600",
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
