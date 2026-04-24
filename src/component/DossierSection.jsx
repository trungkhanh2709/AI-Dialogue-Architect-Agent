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
        <div style={{ marginTop: 12 }}>
          <ResultBlock
            label="Conversion Architect Dossier"
            content={dossier}
            onOpen={() => {
              setModalQueue([
                {
                  key: "dossier",
                  label: "Conversion Architect Dossier",
                  text: dossier,
                },
              ]);
              setModalIdx(0);
              setModalOpen(true);
            }}
            onRemove={() => {
              setFormData((prev) => ({
                ...prev,
                conversionArchitectDossier: "",
              }));
              setShowDossier(false);
            }}
          />
        </div>
      )}
    </>
  );
}