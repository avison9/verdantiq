import React, { RefObject, useEffect, useRef, useState } from "react";

interface TextAreaInputFieldProps
  extends React.InputHTMLAttributes<HTMLTextAreaElement> {
  htmlFor: string;
  inputId: string;
  label: string;
  inputValue: string;
  setInputValue: (value: string) => void;
  divRef: RefObject<HTMLDivElement | null>;
}

const TextAreaInputField: React.FC<TextAreaInputFieldProps> = ({
  type,
  htmlFor,
  inputId,
  label,
  inputValue,
  setInputValue,
  divRef,
  ...rest
}) => {
  const [active, setActive] = useState(false);
  //   const [inputValue, setInputValue] = useState("");
  //   const divRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  console.log("inputValue ==> ", inputValue);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (divRef.current && !divRef.current.contains(event.target as Node)) {
      console.log("Clicked outside the div!");

      console.log("inputValue length ==> ", inputValue.length);
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

    // Clean up event listener on component unmount
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [inputValue, active]);
  return (
    <div
      className={`border transition-all duration-1000 mb-6 ${
        active ? "border-primaryColor" : ""
      } rounded-sm flex flex-col items-start w-full h-40 relative `}
      id={inputId}
      ref={divRef}
    >
      <label
        className={`absolute transition-all duration-500  ${
          active
            ? " -translate-y-3 bg-primaryColor text-white px-3 py-[2px] rounded-md text-sm"
            : " translate-y-3"
        } left-4  flex items-center justify-center `}
        htmlFor={htmlFor}
        onClick={handleClickLabel}
      >
        {label}
      </label>
      <textarea
        className={` outline-none h-40 w-full p-4`}
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

export default TextAreaInputField;
