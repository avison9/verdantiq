import { SelectDropDownInterface } from "../interfaces/SelectDropdownInterface";
import ArrowUpIcon from "../icons/ArrowUpIcon";
import ArrowDownIcon from "../icons/ArrowDownIcon";
import CheckMark from "../icons/CheckMark";

export type durationProps = {
  title: string;
  value: number;
};
// type SelectDurationModalprops = {
//   mode: string;
//   openModal: boolean;
//   closeModal: () => void;
//   durationData: durationProps[];
//   selectDuration: (e: number) => void;
// };

const SelectDurationModal = ({
  mode,
  label,
  title,
  providedData,
  selectedValue,
  // questionIndex,
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
  //   const filteredResult = providedData.filter(
  //     (item) =>
  //       typeof item.title === "string" &&
  //       item.title.toLowerCase().includes(searchTerm.toLowerCase())
  //   );
  //   setData(filteredResult);
  // }, [searchTerm]);

  return (
    // {data.map((item, index) => (
    //   <TouchableOpacity
    //     style={styles.buttonStyle}
    //     key={index}
    //     onPress={() => selectDuration(item.value)}
    //   >
    //     <Text>{item.title} </Text>
    //   </TouchableOpacity>
    // ))}

    <div
      className={`${
        mode === "quiz" || mode === "cbt" ? "hidden" : "block"
      } mt-4 w-full`}
    >
      <p role="label" className="text-base md:text-lg lg:text-2xl mb-2">
        {label}
      </p>
      <button
        onClick={handleToggle}
        className=" w-full bg-bg-color rounded-md p-4  flex flex-row justify-between items-center"
      >
        <p className="text-[#595959] text-xs md:text-sm lg:text-base">
          {title} {selectedValue}
        </p>
        <div>
          {toggle ? (
            <ArrowUpIcon color="#008080" width="25" height="25" />
          ) : (
            <ArrowDownIcon color="#008080" width="25" height="25" />
          )}
        </div>
      </button>
      {/* <p className="italic text-xs md:text-sm lg:text-base font-semibold my-2">

      </p> */}
      <div className="w-full mt-4">
        {toggle &&
          providedData.map((item, index) => (
            <div key={index} className="bg-bg-color">
              <button
                onClick={() => handleSelectValue(item?.value)}
                className="relative w-full py-2 px-4 flex flex-row items-center justify-between border-b border-b-[#dedcdc]"
              >
                <p className="text-xs md:text-sm lg:text-base">{item.title}</p>
                {selectedValue?.toString() === item.value.toString() && (
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

export default SelectDurationModal;
