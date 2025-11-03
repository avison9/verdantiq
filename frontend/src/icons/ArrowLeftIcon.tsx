import { ColorProp } from "../interfaces/interfaces";

const ArrowLeftIcon = ({ color }: ColorProp) => {
  return (
    <svg
      className=""
      width="11"
      height="15"
      viewBox="0 0 11 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.5 1L1.5 7.5L9.5 14"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default ArrowLeftIcon;
