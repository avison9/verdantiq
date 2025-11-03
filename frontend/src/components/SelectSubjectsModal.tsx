import { useState } from "react";
import CheckMark from "../icons/CheckMark";
import { SUBJECTS } from "../localData/Subjects";
import {
  SelectDropDownInterface,
  TitleAndValuePair,
} from "../interfaces/SelectDropdownInterface";
import ArrowUpIcon from "../icons/ArrowUpIcon";
import ArrowDownIcon from "../icons/ArrowDownIcon";

export type selectSubjectsProps = {
  title: string | number;
  value: string | number;
  year: string | number;
  noOfquestions: string | number;
};

const SelectSubjectsModal = ({
  mode,
  label,
  title,

  selectedValues,

  toggle,
  handleToggle,
  handleSelectValue,
}: SelectDropDownInterface) => {
  const [data, _] = useState<TitleAndValuePair[]>(SUBJECTS);

  const handleSelectSubjects = (e: selectSubjectsProps) => {
    handleSelectValue(e);
  };

  return (
    <div className="mt-4 w-full">
      <p role="label" className="text-base md:text-lg lg:text-2xl mb-2">
        {label}
      </p>
      <button
        onClick={handleToggle}
        className=" w-full bg-bg-color rounded-md p-4  flex flex-row justify-between items-center"
      >
        <p className="text-[#595959] text-xs md:text-sm lg:text-base">
          {title}
        </p>
        <div>
          {toggle ? (
            <ArrowUpIcon color="#008080" width="25" height="25" />
          ) : (
            <ArrowDownIcon color="#008080" width="25" height="25" />
          )}
        </div>
      </button>
      <p className="italic text-xs md:text-sm lg:text-base font-semibold my-2">
        {mode === "cbt"
          ? "Select English  language and three more subjects"
          : mode === "learn"
          ? "Select at least one subject and no more than four subjects"
          : mode === "quiz"
          ? "Select only a subject"
          : mode === "profile"
          ? "Select only four subjects"
          : ""}
      </p>
      <div className="w-full">
        {toggle &&
          data.map((item, index) => (
            <div key={index} className="bg-bg-color">
              <button
                onClick={() =>
                  handleSelectSubjects({ ...item, noOfquestions: 0, year: "" })
                }
                className="relative  w-full py-2 px-4 flex flex-row items-center justify-between border-b border-b-[#dedcdc]"
              >
                <p className="text-xs md:text-sm lg:text-base">{item.title}</p>
                {selectedValues?.some((item2) =>
                  item2.title.toString().includes(item.title.toString())
                ) && (
                  <div className=" h-5 w-5 md:w-5 md:h-5 rounded-full bg-primaryColor">
                    <CheckMark width="20" height="20" color="#fff" />
                  </div>
                )}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
};

export default SelectSubjectsModal;
