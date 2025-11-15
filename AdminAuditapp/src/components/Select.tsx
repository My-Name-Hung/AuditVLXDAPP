import { useState, useRef, useEffect } from 'react';
import './Select.css';

interface Option {
  id: number | string;
  name: string;
}

interface SelectProps {
  options: Option[];
  value: number | string | null;
  onChange: (value: number | string | null) => void;
  placeholder?: string;
  searchable?: boolean;
}

export default function Select({ 
  options, 
  value, 
  onChange, 
  placeholder = 'Chọn...',
  searchable = false 
}: SelectProps) {
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

  const filteredOptions = searchable
    ? options.filter(option =>
        option.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const selectedOption = options.find(opt => opt.id === value);

  return (
    <div className="select" ref={dropdownRef}>
      <div
        className="select__trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="select__value">
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <span className="select__arrow">{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className="select__dropdown">
          {searchable && (
            <div className="select__search">
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="select__options">
            {filteredOptions.length === 0 ? (
              <div className="select__no-results">Không tìm thấy kết quả</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.id}
                  className={`select__option ${value === option.id ? 'selected' : ''}`}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  {option.name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

