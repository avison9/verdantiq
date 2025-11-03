import { ColorProp } from "../interfaces/interfaces";

const DemoQuestionIcon = ({ color }: ColorProp) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 19C8.13 19 5 15.87 5 12C5 8.13 8.13 5 12 5C15.87 5 19 8.13 19 12C19 15.87 15.87 19 12 19ZM12 7C11.45 7 11 7.45 11 8V12C11 12.55 11.45 13 12 13C12.55 13 13 12.55 13 12V8C13 7.45 12.55 7 12 7ZM12 14.5C11.17 14.5 10.5 15.17 10.5 16C10.5 16.83 11.17 17.5 12 17.5C12.83 17.5 13.5 16.83 13.5 16C13.5 15.17 12.83 14.5 12 14.5Z"
        fill={color}
      />
    </svg>
  );
};

export default DemoQuestionIcon;
