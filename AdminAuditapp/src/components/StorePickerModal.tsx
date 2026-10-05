import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import './StorePickerModal.css';

interface Option {
  id: number;
  name: string;
  territoryName?: string | null;
}

interface StorePickerModalProps {
  options: Option[];
  selected: number[];
  onChange: (selected: number[]) => void;
  title?: string;
  itemLabel?: string;
}

export default function StorePickerModal({
  options,
  selected,
  onChange,
  title = "Chọn cửa hàng",
  itemLabel = "cửa hàng",
}: StorePickerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);
  const firstRenderRef = useRef(true);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Skip re-computation on first render (don't reset when modal stays open)
  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setSelectedTerritory(null);
  }, []);

  // Build selected SET for O(1) lookups
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Build unique territories list
  const territories = useMemo(() => {
    const map = new Map<string, string>();
    options.forEach(opt => {
      if (opt.territoryName) map.set(opt.territoryName, opt.territoryName);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [options]);

  // Build groups — pre-computed once, not inside .map()
  const groups = useMemo(() => {
    return territories.map(territoryName => {
      const items = options.filter(o => o.territoryName === territoryName);
      const selectedCount = items.filter(o => selectedSet.has(o.id)).length;
      return { territoryName, items, selectedCount };
    });
  }, [territories, options, selectedSet]);

  // Flat filtered options (used when searching or territory selected)
  const flatFiltered = useMemo(() => {
    let result = options;
    if (selectedTerritory) {
      result = result.filter(o => o.territoryName === selectedTerritory);
    }
    if (debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      result = result.filter(o =>
        o.name.toLowerCase().includes(searchLower) ||
        (o.territoryName && o.territoryName.toLowerCase().includes(searchLower))
      );
    }
    return result;
  }, [options, selectedTerritory, debouncedSearchTerm]);

  // Group filtered (when no search + no territory filter)
  const groupFiltered = useMemo(() => {
    if (debouncedSearchTerm.trim() || selectedTerritory) return null;
    return groups;
  }, [groups, debouncedSearchTerm, selectedTerritory]);

  // Stats
  const allSelected = options.length > 0 && selected.length === options.length;
  const filteredAllSelected = flatFiltered.length > 0 && flatFiltered.every(o => selectedSet.has(o.id));

  // Handlers (stable, defined once)
  const toggleOption = useCallback((id: number) => {
    if (selectedSet.has(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }, [selected, selectedSet, onChange]);

  const toggleAll = useCallback(() => {
    onChange(allSelected ? [] : options.map(o => o.id));
  }, [allSelected, options, onChange]);

  const toggleFilteredAll = useCallback(() => {
    if (filteredAllSelected) {
      onChange(selected.filter(id => !flatFiltered.find(o => o.id === id)));
    } else {
      const newIds = [...selected];
      flatFiltered.forEach(o => { if (!newIds.includes(o.id)) newIds.push(o.id); });
      onChange(newIds);
    }
  }, [filteredAllSelected, selected, flatFiltered, onChange]);

  const toggleGroup = useCallback((territoryName: string, groupItems: Option[]) => {
    const groupIds = new Set(groupItems.map(o => o.id));
    const allSelected = groupItems.every(o => selectedSet.has(o.id));
    if (allSelected) {
      onChange(selected.filter(id => !groupIds.has(id)));
    } else {
      const newIds = [...selected];
      groupItems.forEach(o => { if (!newIds.includes(o.id)) newIds.push(o.id); });
      onChange(newIds);
    }
  }, [selected, selectedSet, onChange]);

  const clearAll = useCallback(() => onChange([]), [onChange]);

  const selectedNames = useMemo(() =>
    options.filter(opt => selectedSet.has(opt.id)).map(opt => opt.name),
    [options, selectedSet]
  );

  // Show summary chips (max 6)
  const displayChips = selected.slice(0, 6);
  const overflowCount = selected.length - 6;

  return (
    <>
      {/* Trigger Button */}
      <button type="button" className="store-picker-trigger" onClick={openModal}>
        <span className="store-picker-trigger__text">
          {selected.length === 0
            ? `Chọn cửa hàng`
            : `Đã chọn ${selected.length} ${itemLabel}`}
        </span>
        <span className="store-picker-trigger__icon">▼</span>
      </button>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="store-picker-selected-chips">
          {displayChips.map(id => {
            const opt = options.find(o => o.id === id);
            return (
              <span key={id} className="store-picker-chip">
                <span className="store-picker-chip__text">{opt?.name || `#${id}`}</span>
                <button
                  type="button"
                  className="store-picker-chip__remove"
                  onClick={e => { e.stopPropagation(); toggleOption(id); }}
                >×</button>
              </span>
            );
          })}
          {overflowCount > 0 && (
            <span className="store-picker-chip store-picker-chip--more">
              +{overflowCount}
            </span>
          )}
          <button type="button" className="store-picker-clear-btn" onClick={clearAll}>
            Xóa tất cả
          </button>
        </div>
      )}

      {/* Modal */}
      {isOpen && (
        <div className="store-picker-modal-overlay" onClick={closeModal}>
          <div className="store-picker-modal" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="store-picker-modal__header">
              <h2 className="store-picker-modal__title">{title}</h2>
              <button type="button" className="store-picker-modal__close" onClick={closeModal}>×</button>
            </div>

            {/* Toolbar */}
            <div className="store-picker-modal__toolbar">
              <div className="store-picker-modal__search-wrap">
                <input
                  type="text"
                  className="store-picker-modal__search"
                  placeholder="Tìm cửa hàng theo tên, mã hoặc địa bàn..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  autoFocus
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="store-picker-modal__search-clear"
                    onClick={() => setSearchTerm('')}
                  >×</button>
                )}
              </div>

              <select
                className="store-picker-modal__territory-select"
                value={selectedTerritory || ''}
                onChange={e => setSelectedTerritory(e.target.value || null)}
              >
                <option value="">🌐 Tất cả địa bàn</option>
                {territories.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Select all row */}
            <div className="store-picker-modal__select-all-row">
              <label className="store-picker-modal__checkbox-row">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                <span>Chọn tất cả <strong>({options.length})</strong></span>
              </label>
              <label className="store-picker-modal__checkbox-row">
                <input type="checkbox" checked={filteredAllSelected} onChange={toggleFilteredAll} />
                <span>Trong trang hiện tại <strong>({flatFiltered.length})</strong></span>
              </label>
              <div className="store-picker-modal__selection-count">
                <span className="store-picker-modal__count-badge">
                  {selected.length} / {options.length}
                </span>
              </div>
            </div>

            {/* Scrollable list */}
            <div className="store-picker-modal__list">
              {flatFiltered.length === 0 ? (
                <div className="store-picker-modal__empty">
                  Không tìm thấy cửa hàng nào
                </div>
              ) : groupFiltered ? (
                // Grouped by territory (no search + no territory filter)
                groups.filter(g => g.items.length > 0).map(group => (
                  <div key={group.territoryName} className="store-picker-modal__group">
                    <div
                      className="store-picker-modal__group-header"
                      onClick={() => toggleGroup(group.territoryName, group.items)}
                    >
                      <input
                        type="checkbox"
                        checked={group.selectedCount > 0 && group.selectedCount === group.items.length}
                        onChange={() => toggleGroup(group.territoryName, group.items)}
                        onClick={e => e.stopPropagation()}
                      />
                      <span className="store-picker-modal__group-name">{group.territoryName}</span>
                      <span className="store-picker-modal__group-meta">
                        {group.selectedCount}/{group.items.length}
                      </span>
                    </div>
                    <div className="store-picker-modal__group-items">
                      {group.items.map(option => (
                        <label key={option.id} className="store-picker-modal__item">
                          <input
                            type="checkbox"
                            checked={selectedSet.has(option.id)}
                            onChange={() => toggleOption(option.id)}
                          />
                          <span className="store-picker-modal__item-name">{option.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                // Flat list (searching or territory selected)
                <div className="store-picker-modal__flat-list">
                  {flatFiltered.map(option => (
                    <label key={option.id} className="store-picker-modal__item">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(option.id)}
                        onChange={() => toggleOption(option.id)}
                      />
                      <span className="store-picker-modal__item-name">{option.name}</span>
                      {option.territoryName && (
                        <span className="store-picker-modal__item-territory">{option.territoryName}</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="store-picker-modal__footer">
              <span className="store-picker-modal__footer-info">
                Đã chọn: <strong>{selected.length}</strong> / {options.length} cửa hàng
              </span>
              <div className="store-picker-modal__footer-actions">
                <button type="button" className="store-picker-modal__btn store-picker-modal__btn--cancel" onClick={closeModal}>
                  Đóng
                </button>
                <button type="button" className="store-picker-modal__btn store-picker-modal__btn--confirm" onClick={closeModal}>
                  Xác nhận
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
