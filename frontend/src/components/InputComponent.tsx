import { InputInterface } from "../interfaces/InputInterface";

const InputComponent = ({
  label,
  placeholder,
  onChangeText,
}: InputInterface) => {
  return (
    <div className="mt-4 w-full md:w-[80%]">
      <label htmlFor="">{label}</label>
      <label
        role="label"
        className="text-base md:text-lg lg:text-2xl mb-2"
      ></label>
      <input
        id=""
        placeholder={placeholder}
        className=" w-full md:w-[80%] bg-bg-color rounded-md p-4  flex flex-row justify-between items-center"
        onChange={onChangeText}
      />
    </div>
  );
};

export default InputComponent;
