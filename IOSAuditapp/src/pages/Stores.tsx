import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { StoreSkeletonList } from "../components/StoreSkeleton";
import { useTheme } from "../contexts/ThemeContext";
import api from "../services/api";
import "./Stores.css";

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
    not_audited: 1,
    failed: 2,
    passed: 3,
    audited: 4,
  };
  return priorityMap[status] || 99;
};

const sortStoresByStatus = (stores: Store[]): Store[] => {
  return [...stores].sort((a, b) => {
    const priorityA = getStatusPriority(a.Status);
    const priorityB = getStatusPriority(b.Status);
    return priorityA - priorityB;
  });
};

const filterStoresByStatus = (
  stores: Store[],
  selectedStatus: string | null
): Store[] => {
  if (!selectedStatus) return stores;
  if (selectedStatus === "audited") {
    // Any status except "not_audited" is treated as audited
    return stores.filter((store) => store.Status !== "not_audited");
  }
  if (selectedStatus === "not_audited") {
    return stores.filter((store) => store.Status === "not_audited");
  }
  return stores;
};

export default function Stores() {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [stores, setStores] = useState<Store[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [isSearching, setIsSearching] = useState(false);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const fetchTerritories = useCallback(async () => {
    try {
      const response = await api.get("/territories");
      setTerritories(response.data.data || []);
    } catch (error) {
      console.error("Error fetching territories:", error);
      // Set empty array on error to prevent UI blocking
      setTerritories([]);
    }
  }, []);

  const fetchStores = useCallback(
    async (reset = false, currentPage = 1) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      }

        const params: Record<string, string | number> = {
          page: reset ? 1 : currentPage,
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

      const sortedData = sortStoresByStatus(data);
      const filteredData = filterStoresByStatus(sortedData, selectedStatus);

      if (reset) {
        setStores(filteredData);
          setPage(2); // Set next page for pagination
      } else {
        setStores((prev) =>
          sortStoresByStatus([...prev, ...filteredData])
        );
          setPage((prev) => prev + 1);
      }

      setHasMore(pagination.page < pagination.totalPages);
    } catch (error) {
        console.error("Error fetching stores:", error);
        // Set empty array on error to prevent UI blocking
        if (reset) {
          setStores([]);
        }
    } finally {
      setLoading(false);
        setIsSearching(false);
    }
    },
    [searchText, selectedTerritory, selectedStatus]
  );

  useEffect(() => {
    // Add error handling for initial load
    const initData = async () => {
      try {
        await Promise.all([fetchTerritories(), fetchStores(true, 1)]);
      } catch (error) {
        console.error("Error initializing stores page:", error);
        // Don't block the UI, just log the error
      }
    };
    initData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh stores list when page comes into focus (e.g., navigating back from store detail)
  useEffect(() => {
    let isRefreshing = false;
    let wasHidden = document.hidden;
    
    const handleVisibilityChange = () => {
      // Only refresh when page becomes visible (user navigated back)
      if (!document.hidden && wasHidden) {
        wasHidden = false;
        refreshStores();
      } else if (document.hidden) {
        wasHidden = true;
      }
    };
    
    const handleFocus = () => {
      // Only refresh if page was previously hidden
      if (wasHidden) {
        wasHidden = false;
        refreshStores();
      }
    };
    
    // Refresh stores in background without blocking UI
    const refreshStores = async () => {
      // Prevent multiple simultaneous refreshes
      if (isRefreshing) return;
      
      try {
        isRefreshing = true;
        // Small delay to ensure navigation completes
        await new Promise((resolve) => setTimeout(resolve, 300));
        
        const params: Record<string, string | number> = {
          page: 1,
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
        const sortedData = sortStoresByStatus(data);
        const filteredData = filterStoresByStatus(sortedData, selectedStatus);
        
        // Update stores silently without showing loading state
        setStores(filteredData);
      } catch (error) {
        // Silent fail - don't show error to user
        console.error("Background refresh stores error:", error);
      } finally {
        isRefreshing = false;
      }
    };

    // Listen for page visibility change and window focus
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [searchText, selectedTerritory, selectedStatus]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Bật trạng thái đang tìm kiếm để hiển thị skeleton
    if (searchText.trim() || selectedTerritory || selectedStatus) {
      setIsSearching(true);
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchStores(true, 1);
    }, 800);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchText, selectedTerritory, selectedStatus, fetchStores]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchStores(false, page);
    }
  };

  const filteredTerritories = territories.filter((t) =>
    t.TerritoryName.toLowerCase().includes(territorySearch.toLowerCase())
  );

  return (
    <div
      className="stores-container"
      style={{ backgroundColor: colors.secondary }}
    >
      <Header />

      {/* Filters */}
      <div
        className="stores-filters-container"
        style={{
          backgroundColor: colors.background,
          borderBottomColor: colors.icon + "20",
        }}
      >
        <div className="stores-filter-row">
          <div
            className="stores-search-container"
            style={{
              backgroundColor:
                colors.background === "#fefefe" ? "#f5f5f5" : colors.secondary,
            }}
          >
            <span className="stores-search-icon">🔍</span>
            <input
              type="text"
              className="stores-search-input"
              placeholder="Mã/Tên cửa hàng"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ color: colors.text }}
            />
          </div>
        </div>

        <div className="stores-filter-row">
          <div className="stores-dropdown-container">
            <button
              className="stores-dropdown"
              onClick={() => setShowTerritoryDropdown(!showTerritoryDropdown)}
              style={{
                backgroundColor:
                  colors.background === "#fefefe"
                    ? "#f5f5f5"
                    : colors.secondary,
                color: colors.text,
              }}
            >
              <span>
                {selectedTerritory
                  ? territories.find((t) => t.Id === selectedTerritory)
                      ?.TerritoryName
                  : "Địa bàn phụ trách"}
              </span>
              <span>{showTerritoryDropdown ? "▲" : "▼"}</span>
            </button>
            {showTerritoryDropdown && (
              <div
                className="stores-dropdown-menu"
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.icon + "20",
                }}
              >
                <input
                  type="text"
                  className="stores-dropdown-search"
                  placeholder="Tìm địa bàn..."
                  value={territorySearch}
                  onChange={(e) => setTerritorySearch(e.target.value)}
                  style={{
                    color: colors.text,
                    borderBottomColor: colors.icon + "20",
                  }}
                />
                <button
                  className="stores-dropdown-item"
                  onClick={() => {
                    setSelectedTerritory(null);
                    setShowTerritoryDropdown(false);
                    setTerritorySearch("");
                  }}
                  style={{
                    borderBottomColor: colors.secondary,
                    color: colors.primary,
                  }}
                >
                  Tất cả
                </button>
                {filteredTerritories.map((item) => (
                  <button
                    key={item.Id}
                    className="stores-dropdown-item"
                    onClick={() => {
                      setSelectedTerritory(item.Id);
                      setShowTerritoryDropdown(false);
                      setTerritorySearch("");
                    }}
                    style={{
                      borderBottomColor: colors.secondary,
                      color: colors.text,
                    }}
                  >
                    {item.TerritoryName}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="stores-dropdown-container">
            <button
              className="stores-dropdown"
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              style={{
                backgroundColor:
                  colors.background === "#fefefe"
                    ? "#f5f5f5"
                    : colors.secondary,
                color: colors.text,
              }}
            >
              <span>
                {selectedStatus ? getStatusLabel(selectedStatus) : "Trạng thái"}
              </span>
              <span>{showStatusDropdown ? "▲" : "▼"}</span>
            </button>
            {showStatusDropdown && (
              <div
                className="stores-dropdown-menu"
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.icon + "20",
                }}
              >
                <button
                  className="stores-dropdown-item"
                  onClick={() => {
                    setSelectedStatus(null);
                    setShowStatusDropdown(false);
                  }}
                  style={{
                    borderBottomColor: colors.secondary,
                    color: colors.primary,
                  }}
                >
                  Tất cả
                </button>
                <button
                  className="stores-dropdown-item"
                  onClick={() => {
                    setSelectedStatus("not_audited");
                    setShowStatusDropdown(false);
                  }}
                  style={{
                    borderBottomColor: colors.secondary,
                    color: colors.text,
                  }}
                >
                  Chưa thực hiện
                </button>
                <button
                  className="stores-dropdown-item"
                  onClick={() => {
                    setSelectedStatus("audited");
                    setShowStatusDropdown(false);
                  }}
                  style={{
                    borderBottomColor: colors.secondary,
                    color: colors.text,
                  }}
                >
                  Đã thực hiện
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Store List */}
      <div className="stores-list-container">
        {(loading && stores.length === 0) || isSearching ? (
          <div className="stores-list">
            <StoreSkeletonList count={5} />
          </div>
        ) : stores.length === 0 ? (
          <div className="stores-empty-container">
            <p className="stores-empty-text" style={{ color: colors.icon }}>
              Không tìm thấy cửa hàng
            </p>
          </div>
        ) : (
          <div className="stores-list">
            {stores.map((item) => (
              <div
                key={item.Id}
                className="stores-store-card"
                onClick={() => navigate(`/stores/${item.Id}`)}
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.icon + "20",
                }}
              >
                <div className="stores-store-card-header">
                  <div className="stores-store-card-title-container">
                    <h3
                      className="stores-store-name"
                      style={{ color: colors.text }}
                    >
                      {item.StoreName}
                    </h3>
                    <span
                      className="stores-status-badge"
                      style={{ backgroundColor: getStatusColor(item.Status) }}
                    >
                      {getStatusLabel(item.Status)}
                    </span>
                  </div>
                  <span style={{ color: colors.icon }}>→</span>
                </div>

                <p className="stores-store-code" style={{ color: colors.icon }}>
                  {item.StoreCode}
                </p>
                <p
                  className="stores-store-address"
                  style={{ color: colors.icon }}
                >
                  {item.Address}
                </p>
                <p
                  className="stores-store-contact"
                  style={{ color: colors.icon }}
                >
                  {item.PartnerName || "N/A"} | {item.Phone || "N/A"}
                </p>
              </div>
            ))}
            {hasMore && (
              <button
                className="stores-load-more-button"
                onClick={handleLoadMore}
                disabled={loading}
                style={{ color: colors.primary }}
              >
                {loading ? "Đang tải..." : "Tải thêm"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
