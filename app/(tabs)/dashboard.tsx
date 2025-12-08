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
const GroupedBarChart = ({
  data,
  width,
  height,
  colors: themeColors,
}: {
  data: StoresByDate[];
  width: number;
  height: number;
  colors: any;
}) => {
  const chartHeight = height - 80; // Reserve space for labels (60 for chart + 20 for X-axis labels)
  const chartWidth = width - 50; // Reserve space for Y-axis labels
  const maxValue = Math.max(
    ...data.map((item) =>
      Math.max(item.AuditedCount || 0, item.NotAuditedCount || 0)
    ),
    1
  );

  // Calculate bar dimensions
  // Each group contains 2 bars side by side
  const totalGroups = data.length;
  const availableWidth = chartWidth;
  const groupWidth = availableWidth / totalGroups; // Width for each group (2 bars + spacing)
  const barWidth = groupWidth * 0.35; // Each bar takes 35% of group width
  const barGap = groupWidth * 0.05; // Gap between bars in a group (5% of group width)
  // No extra spacing between groups - groups are adjacent

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
            const auditedValue = item.AuditedCount || 0;
            const notAuditedValue = item.NotAuditedCount || 0;
            const auditedHeight =
              maxValue > 0 ? (auditedValue / maxValue) * chartHeight : 0;
            const notAuditedHeight =
              maxValue > 0 ? (notAuditedValue / maxValue) * chartHeight : 0;

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
                {/* Audited bar (green) */}
                <View
                  style={{
                    alignItems: "center",
                    width: barWidth,
                    position: "relative",
                  }}
                >
                  {auditedValue > 0 && auditedHeight < 20 && (
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
                      {auditedValue}
                    </Text>
                  )}
                  <View
                    style={{
                      width: barWidth,
                      height: Math.max(auditedHeight, auditedValue > 0 ? 2 : 0),
                      backgroundColor: "#10B981",
                      borderRadius: 4,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      justifyContent: "flex-start",
                      alignItems: "center",
                      paddingTop: auditedHeight >= 20 ? 2 : 0,
                    }}
                  >
                    {auditedValue > 0 && auditedHeight >= 20 && (
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
                        {auditedValue}
                      </Text>
                    )}
                  </View>
                </View>
                {/* Not Audited bar (orange) */}
                <View
                  style={{
                    alignItems: "center",
                    width: barWidth,
                    position: "relative",
                  }}
                >
                  {notAuditedValue > 0 && notAuditedHeight < 20 && (
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
                      {notAuditedValue}
                    </Text>
                  )}
                  <View
                    style={{
                      width: barWidth,
                      height: Math.max(
                        notAuditedHeight,
                        notAuditedValue > 0 ? 2 : 0
                      ),
                      backgroundColor: "#F59E0B",
                      borderRadius: 4,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      justifyContent: "flex-start",
                      alignItems: "center",
                      paddingTop: notAuditedHeight >= 20 ? 2 : 0,
                    }}
                  >
                    {notAuditedValue > 0 && notAuditedHeight >= 20 && (
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
                        {notAuditedValue}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* X-axis labels - Aligned with bar groups */}
      <View
        style={{
          position: "absolute",
          left: 60, // paddingHorizontal (20) + marginLeft (40)
          right: 30, // paddingHorizontal (20) + marginRight (10)
          top: chartHeight + 20, // chartHeight + top padding (10) + spacing (10)
          flexDirection: "row",
          width: chartWidth,
          height: 30, // Fixed height for labels
        }}
      >
        {data.map((item, index) => {
          try {
            const date = new Date(item.AuditDate + "T00:00:00");
            if (isNaN(date.getTime())) {
              return (
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
                      fontSize: 12,
                      color: themeColors.text,
                      textAlign: "center",
                      fontWeight: "600",
                    }}
                  >
                    N/A
                  </Text>
                </View>
              );
            }
            const day = date.getDate();
            const month = date.getMonth() + 1;
            return (
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
                    fontSize: 12,
                    color: themeColors.text,
                    textAlign: "center",
                    fontWeight: "600",
                  }}
                >
                  {day}/{month}
                </Text>
              </View>
            );
          } catch {
            return (
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
                    fontSize: 12,
                    color: themeColors.text,
                    textAlign: "center",
                    fontWeight: "600",
                  }}
                >
                  N/A
                </Text>
              </View>
            );
          }
        })}
      </View>
    </View>
  );
};

interface Territory {
  Id: number;
  TerritoryName: string;
}

interface StoresByDate {
  AuditDate: string;
  AuditedCount: number;
  NotAuditedCount: number;
}

interface TerritorySummary {
  TerritoryId: number;
  TerritoryName: string;
  AuditedCount: number;
  NotAuditedCount: number;
}

interface TerritorySummaryResponse {
  territories: TerritorySummary[];
  totals: {
    AuditedCount: number;
    NotAuditedCount: number;
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
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [showTerritoryModal, setShowTerritoryModal] = useState(false);
  const [territorySearch, setTerritorySearch] = useState("");

  // Chart data
  const [storesByDate, setStoresByDate] = useState<StoresByDate[]>([]);
  const [territorySummary, setTerritorySummary] =
    useState<TerritorySummaryResponse | null>(null);

  useEffect(() => {
    fetchTerritories();
  }, []);

  useEffect(() => {
    fetchStoresByDate();
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

  const fetchStoresByDate = async () => {
    try {
      const weekDates = getWeekDates(selectedYear, selectedMonth, selectedWeek);
      if (weekDates.length === 0) {
        setStoresByDate([]);
        return;
      }

      const startDate = weekDates[0];
      const endDate = weekDates[weekDates.length - 1];

      const params: any = {
        startDate,
        endDate,
      };
      if (selectedTerritory) params.territoryId = selectedTerritory;

      const response = await api.get("/dashboard/stores-by-date", { params });

      // Create a map of dates from API response
      // Normalize dates to YYYY-MM-DD format for comparison
      const normalizeDate = (dateStr: string | Date): string => {
        if (!dateStr) return "";
        const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
        if (isNaN(date.getTime())) return "";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const dataMap = new Map<string, StoresByDate>();
      const responseData = response.data?.success
        ? response.data.data
        : response.data || [];

      console.log("API Response data:", responseData);
      console.log("Week dates:", weekDates);

      responseData.forEach((item: StoresByDate) => {
        const normalizedDate = normalizeDate(item.AuditDate);
        if (normalizedDate) {
          dataMap.set(normalizedDate, {
            ...item,
            AuditDate: normalizedDate,
          });
        }
      });

      // Fill in all 7 days of the week, even if no data
      const filledData: StoresByDate[] = weekDates.map((date) => {
        const existing = dataMap.get(date);
        return (
          existing || {
            AuditDate: date,
            AuditedCount: 0,
            NotAuditedCount: 0,
          }
        );
      });

      console.log("Filled data:", filledData);
      setStoresByDate(filledData);
    } catch (error) {
      console.error("Error fetching stores by date:", error);
      setStoresByDate([]);
    }
  };

  const fetchStoresByTerritory = async () => {
    try {
      const weekDates = getWeekDates(selectedYear, selectedMonth, selectedWeek);
      if (weekDates.length === 0) {
        setTerritorySummary(null);
        return;
      }

      const startDate = weekDates[0];
      const endDate = weekDates[weekDates.length - 1];

      const params: any = {
        startDate,
        endDate,
      };

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

        {/* Bar Chart Section */}
        {storesByDate.length > 0 ? (
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
              Thống kê cửa hàng theo tuần
            </Text>
            <Text style={[styles.chartSubtitle, { color: colors.icon }]}>
              {getWeekLabel(selectedWeek)} - {getMonthName(selectedMonth)}{" "}
              {selectedYear}
            </Text>
            <View style={{ alignItems: "center", minHeight: 360 }}>
              <GroupedBarChart
                data={storesByDate}
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
                  Đã thực hiện:{" "}
                  {storesByDate.reduce(
                    (sum, item) => sum + item.AuditedCount,
                    0
                  )}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendColor, { backgroundColor: "#F59E0B" }]}
                />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  Chưa thực hiện:{" "}
                  {storesByDate.reduce(
                    (sum, item) => sum + item.NotAuditedCount,
                    0
                  )}
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
              Thống kê cửa hàng theo tuần
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
                  Đã thực hiện
                </Text>
                <Text
                  style={[
                    styles.tableHeaderText,
                    { color: colors.text, flex: 0.8, textAlign: "center" },
                  ]}
                >
                  Chưa thực hiện
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
                      {item.AuditedCount}
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
                      {item.NotAuditedCount}
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
                  >
                    Tổng
                  </Text>
                  <Text
                    style={[
                      styles.tableFooterText,
                      { color: colors.text, flex: 1 },
                    ]}
                  >
                    -
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
                    {territorySummary.totals.AuditedCount}
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
                    {territorySummary.totals.NotAuditedCount}
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
