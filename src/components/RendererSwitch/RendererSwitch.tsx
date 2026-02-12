import type { RendererType } from "../../types/renderer.type";

export interface RendererSwitchProps {
  value: RendererType;
  onChange: (renderer: RendererType) => void;
}

const LABELS: Record<RendererType, string> = {
  deckgl: "deck.gl",
  pixijs: "PixiJS",
};

export function RendererSwitch({ value, onChange }: RendererSwitchProps) {
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <span style={{ fontSize: "14px", color: "#94a3b8" }}>Renderer:</span>
      {(Object.keys(LABELS) as RendererType[]).map((renderer) => (
        <button
          key={renderer}
          type="button"
          onClick={() => onChange(renderer)}
          style={{
            padding: "6px 12px",
            fontSize: "13px",
            borderRadius: "6px",
            border: "1px solid #334155",
            background: value === renderer ? "#334155" : "#1e293b",
            color: "white",
            cursor: "pointer",
          }}
        >
          {LABELS[renderer]}
        </button>
      ))}
    </div>
  );
}
