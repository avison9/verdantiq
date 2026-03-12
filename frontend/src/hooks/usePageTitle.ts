import { useEffect } from "react";

const usePageTitle = (page: string) => {
  useEffect(() => {
    document.title = `VerdantIQ | ${page}`;
    return () => {
      document.title = "VerdantIQ";
    };
  }, [page]);
};

export default usePageTitle;
