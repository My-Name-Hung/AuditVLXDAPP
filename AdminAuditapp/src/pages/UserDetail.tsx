import { useCallback, useEffect, useRef, useState } from "react";
import { HiArrowLeft } from "react-icons/hi2";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../services/api";
import "./UserDetail.css";

interface UserDetailItem {
  CheckinDate: string;
  AuditId: number;
  StoreName: string;
  Address: string;
  CheckinTime: string;
  Notes: string;
}

interface UserInfo {
  Id: number;
  FullName: string;
  [key: string]: unknown;
}

const formatUtcDate = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN", {
    timeZone: "UTC",
  });
};

const formatUtcTime = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("vi-VN", {
    hour12: false,
    timeZone: "UTC",
  });
};

export default function UserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [detailData, setDetailData] = useState<UserDetailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [storeNameInput, setStoreNameInput] = useState<string>("");
  const [storeNameFilter, setStoreNameFilter] = useState<string>("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const [searchParams] = useSearchParams();
  const territoryId = searchParams.get("territoryId") || "";
  const territoryName = searchParams.get("territoryName") || "";

  const fetchUserInfo = useCallback(async () => {
    if (!userId) return;
    try {
      const userRes = await api.get(`/users/${userId}`);
      setUserInfo(userRes.data as UserInfo);
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  }, [userId]);

  const fetchUserDetail = useCallback(async () => {
    if (!userId) return;

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
      if (territoryId) {
        params.territoryId = territoryId;
      }

      const detailRes = await api.get(`/dashboard/user/${userId}`, {
        params,
        signal: controller.signal,
      });
      setDetailData((detailRes.data.data as UserDetailItem[]) || []);
      setHasLoaded(true);
    } catch (error: any) {
      if (error?.name !== "CanceledError" && error?.code !== "ERR_CANCELED") {
      console.error("Error fetching user detail:", error);
      }
    } finally {
      if (isFirstLoad) {
      setLoading(false);
      }
      setIsFiltering(false);
    }
  }, [userId, startDate, endDate, storeNameFilter, territoryId, hasLoaded]);

  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);

  useEffect(() => {
    fetchUserDetail();
  }, [fetchUserDetail]);

  // Debounce storeNameInput to storeNameFilter
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer to update filter after 500ms of no typing
    debounceTimerRef.current = setTimeout(() => {
      setStoreNameFilter(storeNameInput);
    }, 500);

    // Cleanup on unmount or when storeNameInput changes
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
    return <div className="loading">Đang tải dữ liệu...</div>;
  }

  return (
    <div className="user-detail">
      <div className="user-detail-header">
        <button className="btn-back" onClick={() => navigate("/")}>
          <HiArrowLeft /> Quay lại
        </button>
        <div>
          <p className="page-kicker">Chi tiết</p>
          <h2>{userInfo?.FullName || "Chi tiết checkin"}</h2>
          {territoryName && (
            <p className="user-detail-territory">
              Địa bàn phụ trách: <strong>{territoryName}</strong>
            </p>
          )}
        </div>
      </div>

      <div className="user-detail-filters">
        <div className="filter-group">
          <label>Từ ngày</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="filter-input"
          />
        </div>
        <div className="filter-group">
          <label>Đến ngày</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="filter-input"
          />
        </div>
        <div className="filter-group">
          <label>Tên NPP/Cửa hàng</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              value={storeNameInput}
              onChange={(e) => setStoreNameInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  setStoreNameFilter(storeNameInput);
                  if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                  }
                }
              }}
              placeholder="Nhập tên cửa hàng..."
              className="filter-input"
              style={{ flex: 1 }}
            />
            <button
              className="btn-search"
              onClick={() => {
                setStoreNameFilter(storeNameInput);
                if (debounceTimerRef.current) {
                  clearTimeout(debounceTimerRef.current);
                }
              }}
            >
              Tìm
            </button>
          </div>
        </div>
        {(startDate || endDate || storeNameFilter) && (
          <button className="btn-clear-filters" onClick={handleClearFilters}>
            Xóa bộ lọc
          </button>
        )}
      </div>

      <div className="table-container">
        <table className="detail-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>STT</th>
              <th>NPP/Cửa hàng</th>
              <th>Địa chỉ cửa hàng</th>
              <th>Thời Gian Checkin</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {isFiltering ? (
              <>
                {Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="skeleton-row">
                    <td className="skeleton-cell" />
                    <td className="skeleton-cell" />
                    <td className="skeleton-cell" />
                    <td className="skeleton-cell" />
                    <td className="skeleton-cell" />
                    <td className="skeleton-cell" />
                  </tr>
                ))}
              </>
            ) : detailData.length === 0 ? (
              <tr>
                <td colSpan={6} className="no-data-cell">
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              detailData.map((item, index) => (
                <tr key={item.AuditId}>
                  <td>{formatUtcDate(item.CheckinDate)}</td>
                  <td>{index + 1}</td>
                  <td>{item.StoreName}</td>
                  <td>{item.Address || ""}</td>
                  <td>{formatUtcTime(item.CheckinTime)}</td>
                  <td>{item.Notes || ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
