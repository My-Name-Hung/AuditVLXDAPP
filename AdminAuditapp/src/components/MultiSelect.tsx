import { useState, useRef, useEffect } from 'react';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <div className="multi-select__options">
            {filteredOptions.length === 0 ? (
              <div className="multi-select__no-results">Không tìm thấy kết quả</div>
            ) : (
              filteredOptions.map((option) => (
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
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

