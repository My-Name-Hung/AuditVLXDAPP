import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import './MultiSelect.css';

interface Option {
  id: number;
  name: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: number[];
  onChange: (selected: number[]) => void;
  placeholder?: string;
  itemLabel?: string; // Label for items (e.g., "nhân viên", "địa bàn")
  searchPlaceholder?: string; // Placeholder for search input
  enableSelectAll?: boolean;
  selectAllLabel?: string;
}

const ITEMS_PER_PAGE = 100; // Limit items rendered at once for performance

export default function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Chọn địa bàn...",
  itemLabel = "địa bàn",
  searchPlaceholder = "Tìm kiếm địa bàn...",
  enableSelectAll = false,
  selectAllLabel = "Chọn tất cả",
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [displayedItemsCount, setDisplayedItemsCount] = useState(ITEMS_PER_PAGE);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsContainerRef = useRef<HTMLDivElement>(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setDisplayedItemsCount(ITEMS_PER_PAGE); // Reset displayed count when search changes
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
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Memoize filtered options for performance
  const filteredOptions = useMemo(() => {
    if (!debouncedSearchTerm.trim()) {
      return options;
    }
    const searchLower = debouncedSearchTerm.toLowerCase();
    return options.filter(option =>
      option.name.toLowerCase().includes(searchLower)
    );
  }, [options, debouncedSearchTerm]);

  // Only render displayed items
  // If searching, show all results (usually small)
  // If not searching, paginate for performance
  const displayedOptions = useMemo(() => {
    const hasSearch = debouncedSearchTerm.trim().length > 0;
    
    // If searching, show all results (search results are usually small)
    if (hasSearch) {
      return filteredOptions;
    }
    
    // If not searching and results exceed limit, paginate
    if (filteredOptions.length <= ITEMS_PER_PAGE) {
      return filteredOptions;
    }
    
    return filteredOptions.slice(0, displayedItemsCount);
  }, [filteredOptions, displayedItemsCount, debouncedSearchTerm]);

  // Load more items when scrolling near bottom (only when not searching)
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const hasSearch = debouncedSearchTerm.trim().length > 0;
    if (hasSearch) return; // Don't paginate when searching
    
    const target = e.currentTarget;
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    
    // Load more when within 100px of bottom
    if (scrollBottom < 100 && displayedItemsCount < filteredOptions.length) {
      setDisplayedItemsCount(prev => Math.min(prev + ITEMS_PER_PAGE, filteredOptions.length));
    }
  }, [displayedItemsCount, filteredOptions.length, debouncedSearchTerm]);

  const toggleOption = (id: number) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const allSelected = options.length > 0 && selected.length === options.length;

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
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            // Reset displayed count when opening
            setDisplayedItemsCount(ITEMS_PER_PAGE);
          }
        }}
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
          <div className="multi-select__search">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {enableSelectAll && options.length > 0 && (
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
            </label>
          )}
          <div 
            className="multi-select__options"
            ref={optionsContainerRef}
            onScroll={handleScroll}
          >
            {filteredOptions.length === 0 ? (
              <div className="multi-select__no-results">Không tìm thấy kết quả</div>
            ) : (
              <>
                {displayedOptions.map((option) => (
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
                  </label>
                ))}
                {!debouncedSearchTerm.trim() && filteredOptions.length > ITEMS_PER_PAGE && displayedItemsCount < filteredOptions.length && (
                  <div className="multi-select__loading-more" style={{ 
                    padding: '0.5rem', 
                    textAlign: 'center', 
                    color: '#666', 
                    fontSize: '0.85rem' 
                  }}>
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

