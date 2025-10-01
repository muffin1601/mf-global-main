import React, { useState, useRef, useEffect } from "react";

const ChipSelect = ({ label, name, options = [], selected = [], onChange }) => {
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

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
              <span
                className="chip-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeChip(val);
                }}
              >
                ×
              </span>
            </div>
          ))
        )}
      </div>

      {isOpen && (
        <div className="chip-dropdown">
          {options.length > 0 ? (
            options.map((option) => (
              <div
                key={option}
                className={`chip-option ${
                  selected.includes(option) ? "selected" : ""
                }`}
                onClick={() => toggleOption(option)}
              >
                {option}
                {selected.includes(option) && (
                  <span className="checkmark">✔</span>
                )}
              </div>
            ))
          ) : (
            <div className="chip-option disabled">No options</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChipSelect;


const css = `

.chip-select {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: 'Outfit', sans-serif;
  width: 100%;
  box-sizing: border-box;
}

.chip-select label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}


.chip-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 44px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid #e3e6ea;
  border-radius: 10px;
  cursor: pointer;
  background: #fff;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.12s ease;
}

.chip-container:hover {
  border-color: #cfcfcf;
  box-shadow: 0 4px 14px rgba(0,0,0,0.06);
}


.chip-placeholder {
  color: #9aa0a6;
  font-size: 14px;
}


.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 20px;
  background: #f4f6fb;
  color: #1f2937;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  user-select: none;
}

.chip:hover {
  background: #e9edf8;
}


.chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  color: #6b7280;
  padding: 0 0 2px 0;
  transition: color 0.12s ease;
  line-height: 1;
}

.chip-remove:hover {
  color: #d03c3c;
}


.chip-dropdown {
  position: absolute;
  top: calc(100% + 0px);
  left: 0;
  width: 100%;
  max-width: 100%;
  background: #fff;
  border: 1px solid #e6e9ee;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(6, 12, 24, 0.08);
  max-height: 260px;
  overflow-y: auto;
  z-index: 2200;
  padding: 6px 0;
  animation: chipDropdownFade 0.15s ease;
}

/* animation */
@keyframes chipDropdownFade {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}


.chip-option {
  padding: 10px 14px;
  font-size: 14px;
  color: #263238;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.12s ease, color 0.12s ease;
}

.chip-option:hover {
  background: #f7f9fc;
}

.chip-option.selected {
  background: rgba(250,89,14,0.06); /* subtle orange highlight */
  color: #fa590e; /* accent color */
  font-weight: 700;
}

/* checkmark on selected item */
.checkmark {
  margin-left: 8px;
  font-size: 13px;
  color: #fa590e;
  font-weight: 700;
}

/* scrollbar tweaks */
.chip-dropdown::-webkit-scrollbar {
  width: 8px;
}
.chip-dropdown::-webkit-scrollbar-track {
  background: rgba(200,200,200,0.12);
  border-radius: 10px;
}
.chip-dropdown::-webkit-scrollbar-thumb {
  background-color: rgba(130,130,130,0.36);
  border-radius: 10px;
}
.chip-dropdown::-webkit-scrollbar-thumb:hover {
  background-color: rgba(110,110,110,0.48);
}

/* small responsive tweaks */
@media (max-width: 520px) {
  .chip-container { padding: 8px; min-height: 40px; }
  .chip { padding: 6px 8px; font-size: 13px; }
  .chip-option { padding: 10px 12px; font-size: 13px; }
}

`;

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);