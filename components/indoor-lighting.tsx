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
          <stop offset="0" stopColor="white" stopOpacity=".85" />
          <stop offset=".35" stopColor="white" stopOpacity=".42" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor="#fff3ce" stopOpacity=".95" />
          <stop offset=".3" stopColor="#ffe3a0" stopOpacity=".55" />
          <stop offset="1" stopColor="#ffd58a" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-warm`}>
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 .06  0 .9 0 0 .03  0 0 .65 0 0  0 0 0 1 0"
          />
        </filter>
        {indoorGroups.map((g) => (
          <clipPath key={g.id} id={`${id}-${g.id}`}>
            <polygon points={g.window} />
          </clipPath>
        ))}
        {indoorGroups.map((g) => (
          <mask
            key={g.id}
            id={`${id}-${g.id}-wash`}
            maskUnits="userSpaceOnUse"
            x={x}
            y={y}
            width={width}
            height={height}
          >
            {g.spots.map(([sx, sy], i) => (
              <ellipse
                key={i}
                cx={sx}
                cy={sy + 30}
                rx={g.count === 3 ? 27 : 30}
                ry="62"
                fill={`url(#${id}-glow)`}
              />
            ))}
          </mask>
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
          <g mask={`url(#${id}-${g.id}-wash)`}>
            <image
              href={photo}
              x={x}
              y={y}
              width={width}
              height={height}
              preserveAspectRatio="none"
              filter={`url(#${id}-warm)`}
            />
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              fill="#ffcf7b"
              opacity=".15"
            />
          </g>
          {g.spots.map(([sx, sy], i) => (
            <g key={i} data-indoor-spot={`${g.id}-${i}`}>
              <ellipse
                cx={sx}
                cy={sy}
                rx="12"
                ry="8"
                fill={`url(#${id}-halo)`}
              />
              <ellipse cx={sx} cy={sy} rx="3.4" ry="2" fill="#fff6da" />
            </g>
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
