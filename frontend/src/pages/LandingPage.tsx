import usePageTitle from "../hooks/usePageTitle";

const LandingPage = () => {
  usePageTitle("Precision Agriculture Platform");
  return (
    <div>
      <p className="font-bold">VerdantIQ</p>
      <p>Coming soon...</p>
    </div>
  );
};

export default LandingPage;
