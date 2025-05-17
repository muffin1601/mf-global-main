import React, { useState, useRef, useEffect } from 'react';
import './styles/ChipSelect.css';

const ChipSelect = ({ label, name, options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef();

  const toggleOption = (option) => {
    if (selected.includes(option)) {
      onChange(name, selected.filter((item) => item !== option));
    } else {
      onChange(name, [...selected, option]);
    }
  };

  const removeChip = (option) => {
    onChange(name, selected.filter((item) => item !== option));
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="chip-select" ref={dropdownRef}>
      <label>{label}</label>
      <div className="chip-container" onClick={() => setIsOpen(!isOpen)}>
        {selected.length === 0 ? (
          <span className="chip-placeholder">Select {label}</span>
        ) : (
          selected.map((val) => (
            <div className="chip" key={val}>
              {val}
              <span className="chip-remove" onClick={(e) => {
                e.stopPropagation();
                removeChip(val);
              }}>×</span>
            </div>
          ))
        )}
      </div>

      {isOpen && (
        <div className="chip-dropdown">
          {options.map((option) => (
            <div
              key={option}
              className={`chip-option ${selected.includes(option) ? 'selected' : ''}`}
              onClick={() => toggleOption(option)}
            >
              {option}
              {selected.includes(option) && <span className="checkmark">✔</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChipSelect;
