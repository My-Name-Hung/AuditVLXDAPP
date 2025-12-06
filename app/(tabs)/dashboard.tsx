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
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BarChart, PieChart } from "react-native-chart-kit";

interface Territory {
  Id: number;
  TerritoryName: string;
}

interface CementProduct {
  Id: number;
  Code: string;
  Name: string;
}

interface StoresByDate {
  AuditDate: string;
  AuditedCount: number;
  NotAuditedCount: number;
}

interface ProductPrice {
  PurchasePrice: number;
  SellingPrice: number;
  Count: number;
}

interface SummaryTableItem {
  StoreId: number;
  StoreCode: string;
  StoreName: string;
  TerritoryName: string;
  AuditStatus: string;
  ProductName: string | null;
  PurchasePrice: number | null;
  SellingPrice: number | null;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [productTypes, setProductTypes] = useState<string[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<string>("");
  const [selectedProductType, setSelectedProductType] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showTerritoryDropdown, setShowTerritoryDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDateValue, setStartDateValue] = useState<Date | null>(null);
  const [endDateValue, setEndDateValue] = useState<Date | null>(null);
  
  // Chart data
  const [storesByDate, setStoresByDate] = useState<StoresByDate[]>([]);
  const [productPrices, setProductPrices] = useState<{
    prices: ProductPrice[];
    totalPurchase: number;
    totalSelling: number;
  } | null>(null);
  
  // Table data
  const [tableData, setTableData] = useState<SummaryTableItem[]>([]);
  const [tablePage, setTablePage] = useState(1);
  const [tableTotalPages, setTableTotalPages] = useState(1);

  useEffect(() => {
    fetchTerritories();
    fetchProductTypes();
    // Fetch all product prices by default
    fetchProductPrices();
  }, []);

  useEffect(() => {
    // Fetch stores by date - if no dates, fetch all data
    fetchStoresByDate();
  }, [startDate, endDate, selectedTerritory]);

  useEffect(() => {
    // Fetch product prices when productType changes (including empty for "all")
    fetchProductPrices();
  }, [selectedProductType]);

  useEffect(() => {
    fetchSummaryTable();
  }, [tablePage, selectedTerritory, startDate, endDate]);

  const fetchTerritories = async () => {
    try {
      const response = await api.get("/territories");
      console.log("Territories response:", response.data);
      // Handle different response structures - API returns {success: true, data: [...]}
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        setTerritories(response.data.data);
      } else if (Array.isArray(response.data)) {
        setTerritories(response.data);
      } else if (response.data && Array.isArray(response.data.data)) {
        setTerritories(response.data.data);
      } else {
        setTerritories([]);
      }
    } catch (error) {
      console.error("Error fetching territories:", error);
      setTerritories([]);
    }
  };

  const fetchProductTypes = async () => {
    try {
      const response = await api.get("/dashboard/product-types");
      console.log("Product types response:", response.data);
      if (response.data && response.data.success) {
        setProductTypes(response.data.data || []);
      } else {
        setProductTypes(response.data || []);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching product types:", error);
      setProductTypes([]);
      setLoading(false);
    }
  };

  const fetchStoresByDate = async () => {
    try {
      const params: any = {};
      // Only add date params if both are provided, otherwise fetch all
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      if (selectedTerritory) params.territoryId = selectedTerritory;

      const response = await api.get("/dashboard/stores-by-date", { params });
      console.log("Stores by date response:", response.data);
      if (response.data && response.data.success) {
        setStoresByDate(response.data.data || []);
      } else {
        setStoresByDate(response.data || []);
      }
    } catch (error) {
      console.error("Error fetching stores by date:", error);
      setStoresByDate([]);
    }
  };

  const fetchProductPrices = async () => {
    try {
      const params: any = {};
      // Only add productType if selected, otherwise fetch all
      if (selectedProductType) {
        params.productType = selectedProductType;
      }
      const response = await api.get("/dashboard/product-prices", { params });
      console.log("Product prices response:", response.data);
      if (response.data && response.data.success) {
        setProductPrices(response.data.data || null);
      } else {
        setProductPrices(response.data || null);
      }
    } catch (error) {
      console.error("Error fetching product prices:", error);
      setProductPrices(null);
    }
  };

  const fetchSummaryTable = async () => {
    try {
      const params: any = {
        page: tablePage,
        pageSize: 20,
      };
      if (selectedTerritory) params.territoryId = selectedTerritory;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await api.get("/dashboard/summary-table", { params });
      console.log("Summary table response:", response.data);
      if (response.data && response.data.success) {
        setTableData(response.data.data || []);
        setTableTotalPages(response.data.pagination?.totalPages || 1);
      } else {
        setTableData(response.data?.data || response.data || []);
        setTableTotalPages(response.data?.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error fetching summary table:", error);
      setTableData([]);
      setTableTotalPages(1);
    }
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
          
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              Địa bàn:
            </Text>
            <View style={styles.dropdownContainer}>
              <TouchableOpacity
                style={[
                  styles.dropdown,
                  { borderColor: colors.icon + "40", backgroundColor: colors.background },
                ]}
                onPress={() => setShowTerritoryDropdown(!showTerritoryDropdown)}
              >
                <Text style={[styles.dropdownText, { color: colors.text }]}>
                  {selectedTerritory && territories && Array.isArray(territories)
                    ? territories.find((t) => t.Id.toString() === selectedTerritory)?.TerritoryName || "Tất cả"
                    : "Tất cả"}
                </Text>
                <Ionicons
                  name={showTerritoryDropdown ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.icon}
                />
              </TouchableOpacity>
              {showTerritoryDropdown && (
                <View style={[styles.dropdownMenu, { backgroundColor: colors.background, borderColor: colors.icon + "40" }]}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedTerritory("");
                      setShowTerritoryDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, { color: colors.text }]}>
                      Tất cả
                    </Text>
                  </TouchableOpacity>
                  <ScrollView
                    nestedScrollEnabled={true}
                    style={styles.dropdownList}
                  >
                    {territories && Array.isArray(territories) && territories.map((item) => (
                      <TouchableOpacity
                        key={item.Id.toString()}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setSelectedTerritory(item.Id.toString());
                          setShowTerritoryDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.text }]}>
                          {item.TerritoryName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              Từ ngày:
            </Text>
            <View style={[styles.dateInputContainer, { borderColor: colors.icon + "40" }]}>
              <TextInput
                style={[styles.dateInput, { color: colors.text }]}
                value={startDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.icon + "80"}
                editable={false}
              />
              <TouchableOpacity
                onPress={() => setShowStartDatePicker(true)}
                style={styles.calendarIconButton}
              >
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {showStartDatePicker && (
              <DateTimePicker
                value={startDateValue || new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, selectedDate) => {
                  setShowStartDatePicker(Platform.OS === "ios");
                  if (selectedDate) {
                    setStartDateValue(selectedDate);
                    const formattedDate = selectedDate.toISOString().split("T")[0];
                    setStartDate(formattedDate);
                  }
                }}
              />
            )}
          </View>

          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              Đến ngày:
            </Text>
            <View style={[styles.dateInputContainer, { borderColor: colors.icon + "40" }]}>
              <TextInput
                style={[styles.dateInput, { color: colors.text }]}
                value={endDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.icon + "80"}
                editable={false}
              />
              <TouchableOpacity
                onPress={() => setShowEndDatePicker(true)}
                style={styles.calendarIconButton}
              >
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {showEndDatePicker && (
              <DateTimePicker
                value={endDateValue || new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, selectedDate) => {
                  setShowEndDatePicker(Platform.OS === "ios");
                  if (selectedDate) {
                    setEndDateValue(selectedDate);
                    const formattedDate = selectedDate.toISOString().split("T")[0];
                    setEndDate(formattedDate);
                  }
                }}
              />
            )}
          </View>
        </View>

        {/* Bar Chart Section */}
        {storesByDate.length > 0 ? (
          <View style={[styles.chartSection, { borderColor: colors.icon + "20" }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Biểu đồ số cửa hàng theo ngày
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: storesByDate.map((item) => {
                    const date = new Date(item.AuditDate);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                  }),
                  datasets: [
                    {
                      data: storesByDate.map((item) => item.AuditedCount),
                      color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`, // Blue for audited
                      strokeWidth: 2,
                    },
                    {
                      data: storesByDate.map((item) => item.NotAuditedCount),
                      color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`, // Orange for not audited
                      strokeWidth: 2,
                    },
                  ],
                  legend: ["Đã thực hiện", "Chưa thực hiện"],
                }}
                width={Math.max(Dimensions.get("window").width - 64, Math.max(storesByDate.length * 60, 300))}
                height={220}
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
                <View style={[styles.legendColor, { backgroundColor: "#2196F3" }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  Đã thực hiện: {storesByDate.reduce((sum, item) => sum + item.AuditedCount, 0)}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#FF9800" }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>
                  Chưa thực hiện: {storesByDate.reduce((sum, item) => sum + item.NotAuditedCount, 0)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.chartSection, { borderColor: colors.icon + "20" }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Biểu đồ số cửa hàng theo ngày
            </Text>
            <Text style={[styles.noDataText, { color: colors.icon }]}>
              Chưa có dữ liệu.
            </Text>
          </View>
        )}

        {/* Pie Chart Section */}
        <View style={[styles.chartSection, { borderColor: colors.icon + "20" }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Biểu đồ giá sản phẩm
          </Text>
          
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              Chọn loại sản phẩm:
            </Text>
            <View style={styles.dropdownContainer}>
              <TouchableOpacity
                style={[
                  styles.dropdown,
                  { borderColor: colors.icon + "40", backgroundColor: colors.background },
                ]}
                onPress={() => setShowProductDropdown(!showProductDropdown)}
              >
                <Text style={[styles.dropdownText, { color: colors.text }]}>
                  {selectedProductType || "Tất cả"}
                </Text>
                <Ionicons
                  name={showProductDropdown ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.icon}
                />
              </TouchableOpacity>
              {showProductDropdown && (
                <View style={[styles.dropdownMenu, { backgroundColor: colors.background, borderColor: colors.icon + "40" }]}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedProductType("");
                      setShowProductDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, { color: colors.text }]}>
                      Tất cả
                    </Text>
                  </TouchableOpacity>
                  <ScrollView
                    nestedScrollEnabled={true}
                    style={styles.dropdownList}
                  >
                    {productTypes && Array.isArray(productTypes) && productTypes.map((productType, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setSelectedProductType(productType);
                          setShowProductDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.text }]}>
                          {productType}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          {productPrices && productPrices.totalPurchase > 0 && productPrices.totalSelling > 0 ? (
            <View style={styles.pieChartContainer}>
              <PieChart
                data={[
                  {
                    name: "Giá mua",
                    population: productPrices.totalPurchase,
                    color: "#2196F3",
                    legendFontColor: colors.text,
                    legendFontSize: 12,
                  },
                  {
                    name: "Giá bán",
                    population: productPrices.totalSelling,
                    color: "#4CAF50",
                    legendFontColor: colors.text,
                    legendFontSize: 12,
                  },
                ]}
                width={Dimensions.get("window").width - 64}
                height={220}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
              <View style={styles.chartInfoContainer}>
                <Text style={[styles.chartInfo, { color: colors.text }]}>
                  Tổng giá mua: {productPrices.totalPurchase.toLocaleString("vi-VN")} VNĐ
                </Text>
                <Text style={[styles.chartInfo, { color: colors.text }]}>
                  Tổng giá bán: {productPrices.totalSelling.toLocaleString("vi-VN")} VNĐ
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.noDataText, { color: colors.icon }]}>
              Chưa có dữ liệu. Vui lòng chọn sản phẩm.
            </Text>
          )}
        </View>

        {/* Summary Table */}
        <View style={[styles.tableSection, { borderColor: colors.icon + "20" }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Bảng tổng hợp
          </Text>
          
          {tableData.length > 0 ? (
            <>
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[styles.tableHeaderText, { color: colors.text }]}>Cửa hàng</Text>
                  <Text style={[styles.tableHeaderText, { color: colors.text }]}>Trạng thái</Text>
                  <Text style={[styles.tableHeaderText, { color: colors.text }]}>Sản phẩm</Text>
                  <Text style={[styles.tableHeaderText, { color: colors.text }]}>Giá mua</Text>
                  <Text style={[styles.tableHeaderText, { color: colors.text }]}>Giá bán</Text>
                </View>
                {tableData.map((item, index) => (
                  <View key={index} style={[styles.tableRow, { borderTopColor: colors.icon + "20" }]}>
                    <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>
                      {item.StoreName}
                    </Text>
                    <Text style={[styles.tableCell, { color: colors.text }]}>
                      {item.AuditStatus === "Chua th?c hi?n" ? "Chưa thực hiện" : 
                       item.AuditStatus === "Ðã th?c hi?n" ? "Đã thực hiện" : 
                       item.AuditStatus}
                    </Text>
                    <Text style={[styles.tableCell, { color: colors.text }]} numberOfLines={1}>
                      {item.ProductName || "-"}
                    </Text>
                    <Text style={[styles.tableCell, { color: colors.text }]}>
                      {item.PurchasePrice ? item.PurchasePrice.toLocaleString("vi-VN") : "-"}
                    </Text>
                    <Text style={[styles.tableCell, { color: colors.text }]}>
                      {item.SellingPrice ? item.SellingPrice.toLocaleString("vi-VN") : "-"}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Pagination */}
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    { backgroundColor: colors.primary },
                    tablePage === 1 && styles.paginationButtonDisabled,
                  ]}
                  onPress={() => setTablePage(Math.max(1, tablePage - 1))}
                  disabled={tablePage === 1}
                >
                  <Text style={styles.paginationButtonText}>Trước</Text>
                </TouchableOpacity>
                <Text style={[styles.paginationText, { color: colors.text }]}>
                  Trang {tablePage} / {tableTotalPages}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    { backgroundColor: colors.primary },
                    tablePage >= tableTotalPages && styles.paginationButtonDisabled,
                  ]}
                  onPress={() => setTablePage(Math.min(tableTotalPages, tablePage + 1))}
                  disabled={tablePage >= tableTotalPages}
                >
                  <Text style={styles.paginationButtonText}>Sau</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={[styles.noDataText, { color: colors.icon }]}>
              Chưa có dữ liệu.
            </Text>
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
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
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
    minWidth: 80,
  },
  dropdownContainer: {
    flex: 1,
    position: "relative",
    zIndex: 10,
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
  },
  dropdownText: {
    flex: 1,
    fontSize: 14,
  },
  dropdownMenu: {
    position: "absolute",
    top: 42,
    left: 0,
    right: 0,
    maxHeight: 200,
    borderWidth: 1,
    borderRadius: 4,
    zIndex: 1000,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownList: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  dropdownItemText: {
    fontSize: 14,
  },
  dateInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 4,
    paddingRight: 8,
  },
  dateInput: {
    flex: 1,
    height: 40,
    borderWidth: 0,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  calendarIconButton: {
    padding: 4,
  },
  chartSection: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 12,
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
    fontSize: 12,
  },
  pieChartContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  chartInfoContainer: {
    marginTop: 12,
    alignItems: "center",
    gap: 4,
  },
  chartInfo: {
    fontSize: 14,
  },
  noDataText: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    padding: 20,
  },
  tableSection: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  table: {
    marginTop: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
  },
  tableHeader: {
    paddingVertical: 12,
    borderTopWidth: 0,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
    textAlign: "center",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    gap: 12,
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  paginationText: {
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
});

