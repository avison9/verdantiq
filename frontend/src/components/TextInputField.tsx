import React, { RefObject, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

interface TextInputFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  type:
    | "text"
    | "password"
    | "email"
    | "number"
    | "date"
    | "checkbox"
    | "radio"; // add other types if needed
  htmlFor: string;
  inputId: string;
  label: string;
  inputValue: string;
  setInputValue: (value: string) => void;
  divRef: RefObject<HTMLDivElement | null>;
}

const TextInputField: React.FC<TextInputFieldProps> = ({
  type,
  htmlFor,
  inputId,
  label,
  inputValue,
  setInputValue,
  divRef,
  ...rest
}) => {
  const location = useLocation();
  const [active, setActive] = useState(false);
  //   const [inputValue, setInputValue] = useState("");
  //   const divRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (divRef.current && !divRef.current.contains(event.target as Node)) {
      if (inputValue.length === 0 && active) {
        setActive(false);
      }
    }
  };

  const handleClickLabel = () => {
    if (inputValue.length === 0) {
      setActive(true);
      // const inputElement = document.getElementById(inputId);

      if (inputRef.current) {
        inputRef.current?.setSelectionRange(15, 15);
        inputRef.current?.focus();
      }

      // inputElement?.setSelectionRange(5:Number, 5:Number);
      // inputElement?.focus();
    }
  };

  useEffect(() => {
    // Add event listener to capture clicks
    document.addEventListener("mousedown", handleClickOutside);

    // Check for initial input value
    if (inputValue.length > 0) {
      setActive(true);
    }

    // Clean up event listener on component unmount
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [inputValue, active, location.pathname]);
  return (
    <div
      className={`border transition-all duration-1000 mb-6 ${
        active ? "border-[primaryColor]" : ""
      } rounded-sm flex flex-col items-start w-full h-14 relative `}
      id={inputId}
      ref={divRef}
    >
      <label
        className={`absolute transition-all duration-500  ${
          active
            ? " -translate-y-3 bg-[primaryColor] text-white px-3 py-[2px] rounded-md text-sm"
            : " translate-y-3"
        } left-4  flex items-center justify-center `}
        htmlFor={htmlFor}
        onClick={handleClickLabel}
      >
        {label}
      </label>
      <input
        className={` outline-none h-14 w-full p-4`}
        type={type}
        id={inputId}
        ref={inputRef}
        {...rest}
        onFocus={() => {
          if (inputValue.length === 0) {
            setActive(true);
          }
        }}
        onChange={handleChange}
      />
    </div>
  );
};

export default TextInputField;
