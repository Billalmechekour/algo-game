import React, { createContext, useState } from "react";

export const UIContext = createContext();

export function UIContextProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState(null);

  return (
    <UIContext.Provider
      value={{
        loading,
        setLoading,
        error,
        setError,
        success,
        setSuccess,
        showModal,
        setShowModal,
        modalContent,
        setModalContent,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}
