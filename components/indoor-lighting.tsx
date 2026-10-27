"use client";
import { useId } from "react";
import { Lightbulb } from "lucide-react";
import type { IndoorGroup } from "@/lib/lighting/contracts";
import { indoorGroups } from "@/lib/lighting/indoor";
export function IndoorLightingOverlay({
  photo,
  viewBox,
  preview,
}: {
  photo: string;
  viewBox: string;
  preview: Partial<Record<IndoorGroup, boolean>>;
}) {
  const id = useId().replace(/:/g, "");
  const [x, y, width, height] = viewBox.split(/\s+/).map(Number);
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="none"
      className="indoor-lighting-overlay"
      data-testid="indoor-lighting-overlay"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor="#ffe5ab" stopOpacity=".8" />
          <stop offset="1" stopColor="#ffd58a" stopOpacity="0" />
        </radialGradient>
        {indoorGroups.map((g) => (
          <clipPath key={g.id} id={`${id}-${g.id}`}>
            <polygon points={g.window} />
          </clipPath>
        ))}
      </defs>
      {indoorGroups.map((g) => (
        <g
          key={g.id}
          data-indoor-group={g.id}
          data-power={preview[g.id] ? "on" : "off"}
          opacity={preview[g.id] ? 1 : 0}
          clipPath={`url(#${id}-${g.id})`}
        >
          <image
            href={photo}
            x={x}
            y={y}
            width={width}
            height={height}
            preserveAspectRatio="none"
          />
          <polygon points={g.window} fill="#ffd385" opacity=".22" />
          {g.spots.map(([sx, sy], i) => (
            <ellipse
              key={i}
              data-indoor-spot={`${g.id}-${i}`}
              cx={sx}
              cy={sy + 38}
              rx="42"
              ry="80"
              fill={`url(#${id}-glow)`}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
export function IndoorLightingControls({
  preview,
  onChange,
}: {
  preview: Partial<Record<IndoorGroup, boolean>>;
  onChange: (preview: Partial<Record<IndoorGroup, boolean>>) => void;
}) {
  return (
    <div className="indoor-lighting-groups">
      {indoorGroups.map((g) => (
        <button
          key={g.id}
          type="button"
          className={`indoor-group-button ${preview[g.id] ? "lighting-is-on" : ""}`}
          aria-pressed={!!preview[g.id]}
          onClick={() => onChange({ ...preview, [g.id]: !preview[g.id] })}
        >
          <Lightbulb size={19} />
          <span>
            {g.name}
            <small>{g.count} spottar</small>
          </span>
          <b>{preview[g.id] ? "Tänd" : "Släckt"}</b>
        </button>
      ))}
    </div>
  );
}
