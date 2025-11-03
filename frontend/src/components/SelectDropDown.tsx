import ArrowDownIcon from "../icons/ArrowDownIcon";
import ArrowUpIcon from "../icons/ArrowUpIcon";

import { SelectDropDownInterface } from "../interfaces/SelectDropdownInterface";

const SelectDropDown = ({
  // mode,
  label,
  title,
  providedData,
  // selectedValue,
  // questionIndex,
  toggle,
  handleToggle,
}: // handleSelectValue,
SelectDropDownInterface) => {
  return (
    <div className="mt-4 w-full md:w-[80%]">
      <p role="label" className="text-base md:text-lg lg:text-2xl mb-2">
        {label}
      </p>
      <button
        onClick={handleToggle}
        className=" w-full md:w-[80%] bg-bg-color rounded-md p-4  flex flex-row justify-between items-center"
      >
        <p className="text-[#595959] text-xs md:text-sm lg:text-lg">{title}</p>
        <div>
          {toggle ? (
            <ArrowUpIcon color="#008080" width="20" height="20" />
          ) : (
            <ArrowDownIcon color="#008080" width="20" height="20" />
          )}
        </div>
      </button>
      <div className="w-full md:w-[80%]">
        {toggle &&
          providedData.map((_, index) => (
            <div key={index} className="bg-bg-color p-3">
              {/* <button
                onClick={() =>
                  key === "subject"
                    ? handleSelectValue({ ...item, noOfquestions: 0, year: "" })
                    : key === "year"
                    ? handleSelectValue(item, questionIndex)
                    : handleSelectValue(item?.value)
                }
                className="relative w-full py-2 flex flex-row items-center justify-between border-b border-b-[#dedcdc]"
              >
                <p>{item.title}</p>
                {selectedValue === item.value && (
                  <div className="absolute md:-top-[6px] md:-right-[6px] -top-2 -right-2 h-5 w-5 md:w-5 md:h-5 rounded-full bg-primaryColor">
                    <CheckMark width="20" height="20" color="#fff" />
                  </div>
                )}
              </button> */}
            </div>
          ))}
      </div>
    </div>
  );
};

export default SelectDropDown;
