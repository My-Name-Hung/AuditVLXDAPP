import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import './MultiSelect.css';

interface Option {
  id: number;
  name: string;
  territoryName?: string | null;
}

interface MultiSelectProps {
  options: Option[];
  selected: number[];
  onChange: (selected: number[]) => void;
  placeholder?: string;
  itemLabel?: string;
  searchPlaceholder?: string;
  enableSelectAll?: boolean;
  selectAllLabel?: string;
  enableTerritoryFilter?: boolean;
  territoryFilterLabel?: string;
  selectAllTerritoriesLabel?: string;
  allTerritoriesLabel?: string;
}

const ITEMS_PER_PAGE = 100;

export default function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Chọn...",
  itemLabel = "mục",
  searchPlaceholder = "Tìm kiếm...",
  enableSelectAll = false,
  selectAllLabel = "Chọn tất cả",
  enableTerritoryFilter = false,
  territoryFilterLabel = "Lọc theo địa bàn",
  selectAllTerritoriesLabel = "Chọn tất cả trong địa bàn",
  allTerritoriesLabel = "Tất cả địa bàn",
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [displayedItemsCount, setDisplayedItemsCount] = useState(ITEMS_PER_PAGE);
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsContainerRef = useRef<HTMLDivElement>(null);

  // Build unique territory list from options
  const territories = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    options.forEach(opt => {
      if (opt.territoryName) {
        map.set(opt.territoryName, { id: opt.territoryName, name: opt.territoryName });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [options]);

  // Reset territory filter when dropdown opens fresh
  useEffect(() => {
    if (isOpen) {
      setSelectedTerritory(null);
      setDisplayedItemsCount(ITEMS_PER_PAGE);
    }
  }, [isOpen]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setDisplayedItemsCount(ITEMS_PER_PAGE);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setDebouncedSearchTerm('');
        setDisplayedItemsCount(ITEMS_PER_PAGE);
        setSelectedTerritory(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options: territory filter + search
  const filteredOptions = useMemo(() => {
    let result = options;

    // Territory filter
    if (selectedTerritory) {
      result = result.filter(opt => opt.territoryName === selectedTerritory);
    }

    // Search filter
    if (debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      result = result.filter(opt =>
        opt.name.toLowerCase().includes(searchLower) ||
        (opt.territoryName && opt.territoryName.toLowerCase().includes(searchLower))
      );
    }

    return result;
  }, [options, selectedTerritory, debouncedSearchTerm]);

  // Paginate displayed options
  const displayedOptions = useMemo(() => {
    const hasFilter = debouncedSearchTerm.trim() || selectedTerritory;
    if (hasFilter || filteredOptions.length <= ITEMS_PER_PAGE) {
      return filteredOptions;
    }
    return filteredOptions.slice(0, displayedItemsCount);
  }, [filteredOptions, displayedItemsCount, debouncedSearchTerm, selectedTerritory]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const hasFilter = debouncedSearchTerm.trim() || selectedTerritory;
    if (hasFilter) return;
    const target = e.currentTarget;
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (scrollBottom < 100 && displayedItemsCount < filteredOptions.length) {
      setDisplayedItemsCount(prev => Math.min(prev + ITEMS_PER_PAGE, filteredOptions.length));
    }
  }, [displayedItemsCount, filteredOptions.length, debouncedSearchTerm, selectedTerritory]);

  const toggleOption = (id: number) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  // All options (no territory filter applied — the "full list")
  const allSelected = options.length > 0 && selected.length === options.length;
  // All filtered options (territory-aware)
  const filteredAllSelected = filteredOptions.length > 0 && selected.length === filteredOptions.length &&
    filteredOptions.every(opt => selected.includes(opt.id));

  // "Select all in current view" — respects territory + search filter
  const toggleFilteredAll = () => {
    if (filteredAllSelected) {
      // Deselect all filtered items
      onChange(selected.filter(id => !filteredOptions.find(o => o.id === id)));
    } else {
      // Select all filtered items, keeping existing selections
      const newIds = [...selected];
      filteredOptions.forEach(opt => {
        if (!newIds.includes(opt.id)) newIds.push(opt.id);
      });
      onChange(newIds);
    }
  };

  // "Select all" — always selects from the FULL options list (ignores filters)
  const toggleAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(options.map((option) => option.id));
    }
  };

  const selectedNames = options
    .filter(opt => selected.includes(opt.id))
    .map(opt => opt.name);

  return (
    <div className="multi-select" ref={dropdownRef}>
      <div
        className="multi-select__trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="multi-select__value">
          {selected.length === 0
            ? placeholder
            : selected.length === 1
            ? selectedNames[0]
            : `Đã chọn ${selected.length} ${itemLabel}`}
        </span>
        <span className="multi-select__arrow">{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className="multi-select__dropdown">
          {/* Search */}
          <div className="multi-select__search">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Territory Filter */}
          {enableTerritoryFilter && territories.length > 0 && (
            <div className="multi-select__territory-filter">
              <select
                value={selectedTerritory || ''}
                onChange={(e) => setSelectedTerritory(e.target.value || null)}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">{allTerritoriesLabel}</option>
                {territories.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Select All buttons */}
          {enableSelectAll && options.length > 0 && (
            <div className="multi-select__select-all-group">
              {/* Chọn tất cả (full list) */}
              <label
                className="multi-select__option multi-select__select-all"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                />
                <span>{selectAllLabel}</span>
                <span className="multi-select__select-all-hint">({options.length} cửa hàng)</span>
              </label>

              {/* Chọn tất cả trong filter hiện tại */}
              {enableTerritoryFilter && (
                <label
                  className="multi-select__option multi-select__select-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={filteredAllSelected}
                    onChange={toggleFilteredAll}
                  />
                  <span>{selectAllTerritoriesLabel}</span>
                  {filteredOptions.length > 0 && (
                    <span className="multi-select__select-all-hint">
                      ({filteredOptions.length} cửa hàng)
                    </span>
                  )}
                </label>
              )}
            </div>
          )}

          <div
            className="multi-select__options"
            ref={optionsContainerRef}
            onScroll={handleScroll}
          >
            {filteredOptions.length === 0 ? (
              <div className="multi-select__no-results">Không tìm thấy cửa hàng</div>
            ) : (
              <>
                {/* Territory group headers */}
                {!debouncedSearchTerm.trim() && !selectedTerritory && enableTerritoryFilter ? (
                  // Group by territory
                  Array.from(
                    new Map(
                      filteredOptions
                        .filter(o => o.territoryName)
                        .map(o => [o.territoryName, o.territoryName])
                    ).entries()
                  ).map(([territoryName]) => {
                    const territoryItems = filteredOptions.filter(o => o.territoryName === territoryName);
                    const territoryAllSelected = territoryItems.every(o => selected.includes(o.id));
                    const toggleTerritory = () => {
                      if (territoryAllSelected) {
                        onChange(selected.filter(id => !territoryItems.find(o => o.id === id)));
                      } else {
                        const newIds = [...selected];
                        territoryItems.forEach(o => { if (!newIds.includes(o.id)) newIds.push(o.id); });
                        onChange(newIds);
                      }
                    };
                    return (
                      <div key={territoryName}>
                        <label
                          className="multi-select__territory-header"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={territoryAllSelected && territoryItems.length > 0}
                            onChange={toggleTerritory}
                          />
                          <span className="multi-select__territory-name">{territoryName}</span>
                          <span className="multi-select__select-all-hint">({territoryItems.length})</span>
                        </label>
                        {displayedOptions
                          .filter(o => o.territoryName === territoryName)
                          .map((option) => (
                            <label
                              key={option.id}
                              className="multi-select__option multi-select__option--indented"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={selected.includes(option.id)}
                                onChange={() => toggleOption(option.id)}
                              />
                              <span>{option.name}</span>
                            </label>
                          ))}
                      </div>
                    );
                  })
                ) : (
                  // Flat list (when searching or territory selected)
                  displayedOptions.map((option) => (
                    <label
                      key={option.id}
                      className="multi-select__option"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(option.id)}
                        onChange={() => toggleOption(option.id)}
                      />
                      <span>{option.name}</span>
                      {enableTerritoryFilter && option.territoryName && (
                        <span className="multi-select__store-territory">{option.territoryName}</span>
                      )}
                    </label>
                  ))
                )}

                {!debouncedSearchTerm.trim() && !selectedTerritory && filteredOptions.length > ITEMS_PER_PAGE && displayedItemsCount < filteredOptions.length && (
                  <div className="multi-select__loading-more">
                    Đang tải thêm... ({displayedItemsCount}/{filteredOptions.length})
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
