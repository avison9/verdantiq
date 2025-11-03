const LoadingSpinner = ({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) => {
  console.log(width, height, color);

  return (
    <div className="flex items-center justify-center w-12 h-12 mx-auto">
      <div
        className={` border-4 border-t-4 border-t-[${color}] border-gray-200 rounded-full animate-spin`}
        style={{
          width: width,
          height: height,
          // borderTopColor: "#fff",

          // borderColor: color,
          // borderWidth: 4,
          // borderTopWidth: 4,
        }}
      ></div>
      {/* <div
        className="w-6 h-6 border-4 border-t-4 border-t-green-500 border-gray-200 rounded-full animate-spin"
        // style={{ borderTopColor: "#DCEEEC" }}
      ></div> */}
    </div>
  );
};

export default LoadingSpinner;
