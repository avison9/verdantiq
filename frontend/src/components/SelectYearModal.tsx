import { SelectDropDownInterface } from "../interfaces/SelectDropdownInterface";
import ArrowUpIcon from "../icons/ArrowUpIcon";
import ArrowDownIcon from "../icons/ArrowDownIcon";
import CheckMark from "../icons/CheckMark";
import { yearData } from "../localData/localData";

const SelectYearModal = ({
  label,
  title,
  providedData,
  toggle,
  handleToggle,
  handleSelectValue,
}: SelectDropDownInterface) => {
  // const [searchTerm, setSearchTerm] = useState("");
  // const [data, setData] = useState<TitleAndValuePair[]>([]);

  // const handleFilter = (e: string) => {
  //   setSearchTerm(e);
  // };

  // const handleCancelSearch = () => {
  //   setSearchTerm("");
  //   setData(providedData);
  // };

  // useEffect(() => {
  //   const filteredResult = providedData.filter((item) =>
  //     item.title.toString().includes(searchTerm)
  //   );
  //   setData(filteredResult);
  // }, [searchTerm]);

  return (
    <div className="mt-4 w-full ">
      <p role="label" className="text-base md:text-lg lg:text-2xl mb-2">
        {label}
      </p>
      <button
        onClick={handleToggle}
        className=" w-full  bg-bg-color rounded-md p-4  flex flex-row justify-between items-center"
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
      <div className="w-full ">
        {toggle &&
          providedData.map((item: any, index: number) => (
            <div key={index} className="bg-bg-color p-3">
              <p className="text-xs md:text-sm lg:text-base">
                {item.title} {item.value} {item.year}
              </p>
              <div className="flex flex-row items-center overflow-x-scroll py-4 ">
                {yearData.map((item2, index2) => (
                  <button
                    key={index2}
                    onClick={() => handleSelectValue(item2.value, index)}
                    className="relative w-full py-2 px-4 flex flex-row items-center justify-between border border-primaryColor rounded-md mr-2"
                  >
                    <p className="text-xs md:text-sm lg:text-base">
                      {item2.title}
                    </p>
                    {item.year === item2.value && (
                      <div className="absolute md:-top-[6px] md:-right-[6px] -top-2 -right-2 h-5 w-5 md:w-5 md:h-5 rounded-full bg-primaryColor">
                        <CheckMark width="20" height="20" color="#fff" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default SelectYearModal;
