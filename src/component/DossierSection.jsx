import React from "react";
import ResultBlock from "./ResultBlock";

export default function DossierSection({
  toolHistoryOptions,
  selectedToolHistory,
  setSelectedToolHistory,
  onGenerate,
  isLoading,
  dossier,
  showDossier,
  setShowDossier,
  setFormData,
  setModalQueue,
  setModalIdx,
  setModalOpen,
}) {
  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <div className="text_label">Tool History</div>

        <select
          value={selectedToolHistory}
          onChange={(e) => setSelectedToolHistory(e.target.value)}
        >
          <option value="">Select...</option>

          {toolHistoryOptions
            .filter((item) => item.toolName === "Conversion Architect")
            .map((item) => (
              <option key={item._id} value={item._id}>
                {item.title}
              </option>
            ))}
        </select>
      </div>

      <button
        type="button"
        className={`bm-btn bm-btn--primary ${isLoading ? "loading" : ""}`}
        onClick={onGenerate}
        disabled={isLoading}
        style={{ marginTop: 8 }}
      >
        {isLoading ? "Generating..." : "Generate Dossier"}
      </button>

    {dossier && showDossier && (
  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
    
    {dossier.psych && (
      <ResultBlock
        label="Dossier – Psych"
        content={dossier.psych}
        onOpen={() => {
          setModalQueue([
            {
              key: "dossier_psych",
              label: "Dossier – Psych",
              text: dossier.psych,
            },
          ]);
          setModalIdx(0);
          setModalOpen(true);
        }}
        onRemove={() => {
          setFormData((prev) => ({
            ...prev,
            conversionArchitectDossier: {
              ...prev.conversionArchitectDossier,
              psych: "",
            },
          }));
        }}
      />
    )}

    {dossier.business && (
      <ResultBlock
        label="Dossier – Business"
        content={dossier.business}
        onOpen={() => {
          setModalQueue([
            {
              key: "dossier_business",
              label: "Dossier – Business",
              text: dossier.business,
            },
          ]);
          setModalIdx(0);
          setModalOpen(true);
        }}
        onRemove={() => {
          setFormData((prev) => ({
            ...prev,
            conversionArchitectDossier: {
              ...prev.conversionArchitectDossier,
              business: "",
            },
          }));
        }}
      />
    )}

  </div>
)}
    </>
  );
}