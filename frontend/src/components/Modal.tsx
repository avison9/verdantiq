import React, { ReactNode, useState } from "react";

interface ModalProps {
  children: ReactNode;
  closeAllModal: () => void;
  closeModal?: boolean;
  showCloseIcon: boolean;
}

const Modal: React.FC<ModalProps> = ({
  children,
  closeAllModal,
  showCloseIcon,
}) => {
  const [showModal, setShowModal] = useState(true);

  const handleCloseModal = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (target.id === "modalWrapper") {
      setShowModal(false);
      closeAllModal();
      window.speechSynthesis.cancel();
    }
  };
  if (!showModal) {
    return null;
  }
  // useEffect(() => {
  //   if (closeModal === false) {
  //     setShowModal(false);
  //   }
  // }, []);
  return (
    <div className="fixed top-0 left-0 bottom-0 right-0 backdrop-blur-sm w-screen h-screen bg-black/30 z-10">
      <div
        id="modalWrapper"
        onClick={(e) => handleCloseModal(e)}
        className=" flex flex-row lg:flex-row items-start justify-center w-full h-full"
      >
        {/* modal dialog */}
        <div className="relative w-[80%] md:w-[65%] lg:w-[45%] max-h-[80%] h-fit flex flex-col justify-center items-center mt-28">
          {children}

          {showCloseIcon && (
            <button
              className="absolute top-0 -right-14 w-8 h-8 lg:w-10 lg:h-10  bg-gray-600 hover:bg-gray-700 rounded-full"
              onClick={() => {
                setShowModal(false);
                closeAllModal();
                window.speechSynthesis.cancel();
              }}
            >
              <p className="text-xl text-white/50 font-medium  ">X</p>
            </button>
          )}
        </div>
        {/* close button */}
      </div>
    </div>
  );
};

export default Modal;
