import { useEffect, useRef, useState } from "react";
import { COUNTRIES } from "../data/countries";

interface CountrySelectProps {
  value: string;
  onChange: (country: string) => void;
  id?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

const CountrySelect = ({
  value,
  onChange,
  id,
  required,
  placeholder = "Start typing a country…",
  className = "",
}: CountrySelectProps) => {
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Keep input in sync if parent resets the value (e.g. on form reset)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const filtered =
    inputValue.trim() === ""
      ? COUNTRIES
      : COUNTRIES.filter((c) =>
          c.toLowerCase().startsWith(inputValue.trim().toLowerCase())
        ).concat(
          COUNTRIES.filter(
            (c) =>
              !c.toLowerCase().startsWith(inputValue.trim().toLowerCase()) &&
              c.toLowerCase().includes(inputValue.trim().toLowerCase())
          )
        );

  const select = (country: string) => {
    setInputValue(country);
    onChange(country);
    setOpen(false);
    setHighlighted(0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    onChange(e.target.value); // keep parent in sync as user types
    setHighlighted(0);
    setOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlighted]) select(filtered[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const baseInput =
    "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent";

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        required={required}
        value={inputValue}
        placeholder={placeholder}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={`${baseInput} ${className}`}
      />

      {/* Dropdown arrow indicator */}
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
        <svg
          className={`h-4 w-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </span>

      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg text-sm"
        >
          {filtered.map((country, idx) => (
            <li
              key={country}
              role="option"
              aria-selected={idx === highlighted}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur before click registers
                select(country);
              }}
              onMouseEnter={() => setHighlighted(idx)}
              className={`cursor-pointer px-4 py-2 ${
                idx === highlighted
                  ? "bg-emerald-50 text-emerald-700 font-medium"
                  : "text-gray-800 hover:bg-gray-50"
              }`}
            >
              {country}
            </li>
          ))}
        </ul>
      )}

      {open && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-400 shadow-lg">
          No matching country found
        </div>
      )}
    </div>
  );
};

export default CountrySelect;
