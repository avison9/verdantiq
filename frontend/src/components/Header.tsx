import { Link, NavLink } from "react-router-dom";
import HamburgerMenuIcon from "../icons/MenuIcon";
import { useEffect, useState } from "react";
// import logo from "/logo.jpeg";

const Header = () => {
  const [activeLink, setActiveLink] = useState("");
  const [toggleMenu, setToggleMenu] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const homeCheck = activeLink === "home";
  const servicesCheck = activeLink === "services";
  const aboutUsCheck = activeLink === "aboutUs";

  const navHeight = window.innerHeight - 80;

  const handleLink = (linkId: string) => {
    setToggleMenu(false);
    setActiveLink(linkId);
    document.getElementById(linkId)?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      console.log("windowWidth ==> ", window.innerWidth);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (windowWidth >= 1024) {
      console.log("windowWidth is >= 1024px: ", windowWidth);
      setToggleMenu(false);
    }
  }, [windowWidth]);

  return (
    <header className="fixed w-full  top-0 h-20 bg-[#F2F2F2] z-50">
      <div className="container w-[80%] md:w-full mx-auto h-full flex flex-row items-center justify-between ">
        <div className="">
          {/* logo */}
          <Link to={"/"}>
            <div className="">
              {/* logo */}
              {/* <img
                src={logo}
                alt="Grace Destiny Moulding Int'l (Psychology Consultants) logo"
                className="w-16 h-16"
              /> */}
              <p>VerdantIq</p>
            </div>
          </Link>
        </div>

        <div className="flex flex-row items-center">
          {/* menu items */}
          <nav
            className={`text-sm md:text-xl lg:text-2xl fixed z-20 lg:relative lg:h-fit lg:flex lg:flex-row lg:items-center  
            ${
              toggleMenu
                ? ` top-20 w-full flex flex-col items-center justify-center left-0 bg-[#F2F2F2] transition ease-in-out duration-[700ms]`
                : "-left-full lg:left-5 "
            }
            `}
            style={{ height: toggleMenu ? navHeight : "" }}
          >
            <Link
              to="/"
              onClick={() => handleLink("heroSection")}
              className={`${
                toggleMenu ? "translate-x-4 ease-linear duration-[700ms]" : ""
              }`}
              style={{
                borderBottomColor: "#021343",
                borderBottomWidth: 4,
                borderBottom: homeCheck ? "solid" : "",
                color: homeCheck ? "#021343" : "#000",
                marginRight: 20,
                marginBottom: toggleMenu ? 40 : "",
              }}
            >
              Home
            </Link>
            <Link
              to="#aboutUs"
              onClick={() => handleLink("aboutUs")}
              className={`${
                toggleMenu ? "translate-x-4 ease-linear duration-[700ms]" : ""
              }`}
              style={{
                borderBottomColor: "#021343",
                borderBottomWidth: 4,
                borderBottom: aboutUsCheck ? "solid" : "",
                color: aboutUsCheck ? "#021343" : "#000",
                marginRight: 20,
                marginBottom: toggleMenu ? 40 : "",
              }}
            >
              About
            </Link>
            <NavLink
              to="#services"
              onClick={() => handleLink("services")}
              className={`${
                toggleMenu ? "translate-x-4 ease-linear duration-[700ms]" : ""
              }`}
              style={{
                borderBottomColor: "#021343",
                borderBottomWidth: 4,
                borderBottom: servicesCheck ? "solid" : "",
                color: servicesCheck ? "#021343" : "#000",
                marginRight: 20,
                marginBottom: toggleMenu ? 40 : "",
              }}
            >
              Services
            </NavLink>
          </nav>

          {/* menu icon */}
          <button
            className="lg:hidden"
            onClick={() => setToggleMenu(!toggleMenu)}
          >
            <HamburgerMenuIcon />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
