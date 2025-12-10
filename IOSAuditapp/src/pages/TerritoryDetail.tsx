import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import { useTheme } from "../contexts/ThemeContext";
import api from "../services/api";
import "./TerritoryDetail.css";

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

export default function TerritoryDetail() {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [searchParams] = useSearchParams();
  const territoryId = searchParams.get("id") || window.location.pathname.split("/").pop() || "";
  const territoryName = searchParams.get("territoryName") || "Địa bàn";
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
    if (!territoryId) return;

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

      const detailRes = await api.get(`/dashboard/territory/${territoryId}`, {
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
  }, [territoryId, startDate, endDate, storeNameFilter, hasLoaded]);

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
      <div
        className="territory-detail-container"
        style={{ backgroundColor: colors.background }}
      >
        <Header />
        <div className="loading-container">
          <div
            className="spinner"
            style={{ borderTopColor: colors.primary }}
          ></div>
          <p style={{ color: colors.text }}>Đang tải dữ liệu...</p>
        </div>
      </div>
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

  // Calculate STT for each date group
  let globalIndex = 1;

  return (
    <div
      className="territory-detail-container"
      style={{ backgroundColor: colors.background }}
    >
      <Header />
      <div className="back-button-container">
        <div
          className="back-button"
          style={{ borderColor: colors.icon + "40", cursor: "pointer" }}
          onClick={() => navigate("/dashboard")}
        >
          <span style={{ fontSize: "16px" }}>←</span>
          <span style={{ color: colors.text }}>Quay lại</span>
        </div>
      </div>
      <div className="territory-detail-content">
        {/* Header */}
        <div className="header-section">
          <p className="page-kicker" style={{ color: colors.icon }}>
            CHI TIẾT
          </p>
          <h1 className="page-title" style={{ color: colors.text }}>
            {decodeURIComponent(territoryName)}
          </h1>
        </div>

        {/* Filters Section */}
        <div
          className="filter-section"
          style={{
            borderColor: colors.icon + "20",
            backgroundColor: colors.secondary,
          }}
        >
          <h3 className="section-title" style={{ color: colors.text }}>
            Bộ lọc
          </h3>

          {/* Date Range Filters */}
          <div className="filter-row">
            <label className="filter-label" style={{ color: colors.text }}>
              Từ ngày:
            </label>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="date"
                className="date-input"
                style={{
                  borderColor: colors.icon + "40",
                  backgroundColor: colors.background,
                  color: colors.text,
                  paddingRight: "40px",
                  width: "100%",
                }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="filter-row">
            <label className="filter-label" style={{ color: colors.text }}>
              Đến ngày:
            </label>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type="date"
                className="date-input"
                style={{
                  borderColor: colors.icon + "40",
                  backgroundColor: colors.background,
                  color: colors.text,
                  paddingRight: "40px",
                  width: "100%",
                }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Store Name Filter */}
          <div className="filter-row">
            <label className="filter-label" style={{ color: colors.text }}>
              Tên NPP/Cửa hàng:
            </label>
            <input
              type="text"
              className="text-input"
              style={{
                borderColor: colors.icon + "40",
                backgroundColor: colors.background,
                color: colors.text,
              }}
              placeholder="Nhập tên cửa hàng..."
              value={storeNameInput}
              onChange={(e) => setStoreNameInput(e.target.value)}
            />
          </div>

          {/* Clear Filters Button */}
          {(startDate || endDate || storeNameInput) && (
            <button
              className="clear-button"
              style={{
                borderColor: colors.icon + "40",
                color: colors.text,
              }}
              onClick={handleClearFilters}
            >
              Xóa bộ lọc
            </button>
          )}

          {isFiltering && (
            <div className="filtering-indicator">
              <div
                className="spinner-small"
                style={{ borderTopColor: colors.primary }}
              ></div>
              <span style={{ color: colors.icon }}>Đang lọc dữ liệu...</span>
            </div>
          )}
        </div>

        {/* Data Table */}
        <div
          className="table-section"
          style={{
            borderColor: colors.icon + "20",
            backgroundColor: colors.secondary,
          }}
        >
          <h3 className="section-title" style={{ color: colors.text }}>
            Danh sách check-in
          </h3>

          {sortedDates.length === 0 ? (
            <div className="no-data-container">
              <p className="no-data-text" style={{ color: colors.icon }}>
                Chưa có dữ liệu
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="territory-detail-table">
                <thead>
                  <tr
                    className="table-header-row"
                    style={{ backgroundColor: colors.primary + "15" }}
                  >
                    <th
                      className="table-header-cell"
                      style={{ color: colors.text, width: "15%" }}
                    >
                      Ngày
                    </th>
                    <th
                      className="table-header-cell"
                      style={{ color: colors.text, width: "15%" }}
                    >
                      STT
                    </th>
                    <th
                      className="table-header-cell"
                      style={{ color: colors.text, width: "40%" }}
                    >
                      NPP/cửa hàng
                    </th>
                    <th
                      className="table-header-cell"
                      style={{ color: colors.text, width: "30%" }}
                    >
                      Thời gian check in
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDates.map((date) => {
                    const items = groupedData[date];
                    return items.map((item) => {
                      const currentIndex = globalIndex++;
                      return (
                        <tr key={`${item.AuditId}-${currentIndex}`} className="table-row">
                          <td
                            className="table-cell"
                            style={{ color: colors.text, textAlign: "center" }}
                          >
                            {formatLocalDate(item.CheckinDate)}
                          </td>
                          <td
                            className="table-cell"
                            style={{ color: colors.text, textAlign: "center" }}
                          >
                            {currentIndex}
                          </td>
                          <td className="table-cell" style={{ color: colors.text }}>
                            {item.StoreName}
                          </td>
                          <td
                            className="table-cell"
                            style={{ color: colors.text, textAlign: "center" }}
                          >
                            {formatLocalTime(item.CheckinTime)}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

