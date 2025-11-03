import cryptosettings from "/crypto.svg";
import Securitysettings from "/security.svg";
import Faqsettings from "/faqsettings.svg";
import feedbacksettings from "/feedback.svg";
import invitefriendssettings from "/invitefriends.svg";
import dasharrow from "/dasharrow.svg";
import logoutsettings from "/logout.svg";
import { Link } from "react-router-dom";
import { SettingsNavbarInterface } from "../interfaces/SettingsNavbarInterface";

const SettingsNavbar = ({
  handleLogout,
  activeLink,
}: SettingsNavbarInterface) => {
  const SettingsNavData = [
    {
      title: "Crypto",
      icon: cryptosettings,
      link: "/settings/crypto",
    },
    {
      title: "Security",
      icon: Securitysettings,
      link: "/settings/security",
    },
    {
      title: "FAQs",
      icon: Faqsettings,
      link: "/settings/faqs",
    },
    {
      title: "Feedback",
      icon: feedbacksettings,
      link: "/settings/feedback",
    },
    {
      title: "Invite friends",
      icon: invitefriendssettings,
      link: "/settings/invite-friends",
    },
    // {
    //   title: "Logout",
    //   icon: logoutsettings,
    //   link: handleLogout,
    // },
  ];
  return (
    <div className=" w-[80%] md:w-[50%] lg:w-[100%] xl:w-[90%]  grid grid-cols-2 gap-4 xs:gap-10 md:gap-10 lg:gap-6 xl:gap-10">
      {SettingsNavData.map((item, index) => (
        <Link
          key={index}
          role={`${index === 5 && "button"}`}
          to={`${index < 5 ? item.link : "/"}`}
          // to={`${index < 5 && item.link}`}
          className={`${
            activeLink === item.title ? "border-4" : "border"
          } border-[#00808080] p-4 rounded-md flex flex-col justify-center items-center`}
        >
          <div className="w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-bg-color flex justify-center items-center">
            <img
              src={item.icon}
              alt={`${item.title} image`}
              className="w-8 h-8 sm:w-10 sm:h-10 md:w-16 md:h-16"
            />
          </div>
          <div className="flex flex-row justify-center items-center gap-x md:gap-x-3 lg:gap-x-2 mt-2 md:mt-3 lg:mt-4 xl:mt-6">
            <p className="text-xs sm:text-base lg:text-lg text-center">
              {item.title}
            </p>
            <img
              src={dasharrow}
              alt="forward or go-to icon"
              className="w-4 h-4 sm:w-8 sm:h-8"
            />
          </div>
        </Link>
      ))}

      <button
        onClick={handleLogout}
        // to={`${index < 5 && item.link}`}
        className={`${
          activeLink === "LOgout" ? "border-4" : "border"
        } border-[#00808080] p-4 rounded-md flex flex-col justify-center items-center`}
      >
        <div className="w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-bg-color flex justify-center items-center">
          <img
            src={logoutsettings}
            alt={`logout icon`}
            className="w-8 h-8 sm:w-10 sm:h-10 md:w-16 md:h-16"
          />
        </div>
        <div className="flex flex-row justify-center items-center gap-x md:gap-x-3 lg:gap-x-2 mt-2 md:mt-3 lg:mt-4 xl:mt-6">
          <p className="text-xs sm:text-base lg:text-lg text-center">
            {"Logout"}
          </p>
          <img
            src={dasharrow}
            alt="forward or go-to icon"
            className="w-4 h-4 sm:w-8 sm:h-8"
          />
        </div>
      </button>
    </div>
  );
};

export default SettingsNavbar;
