import React, { createContext, useContext, useState, ReactNode } from "react";

interface CapturedImage {
  uri: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  timezoneOffset: number;
}

interface SurveyContextType {
  capturedImages: (CapturedImage | undefined)[];
  notes: string;
  setCapturedImages: (images: (CapturedImage | undefined)[]) => void;
  setNotes: (notes: string) => void;
  clearSurveyData: () => void;
}

const SurveyContext = createContext<SurveyContextType | undefined>(undefined);

export function SurveyProvider({ children }: { children: ReactNode }) {
  const [capturedImages, setCapturedImages] = useState<
    (CapturedImage | undefined)[]
  >([undefined, undefined, undefined]);
  const [notes, setNotes] = useState("");

  const clearSurveyData = () => {
    setCapturedImages([undefined, undefined, undefined]);
    setNotes("");
  };

  return (
    <SurveyContext.Provider
      value={{
        capturedImages,
        notes,
        setCapturedImages,
        setNotes,
        clearSurveyData,
      }}
    >
      {children}
    </SurveyContext.Provider>
  );
}

export function useSurvey() {
  const context = useContext(SurveyContext);
  if (context === undefined) {
    throw new Error("useSurvey must be used within a SurveyProvider");
  }
  return context;
}

