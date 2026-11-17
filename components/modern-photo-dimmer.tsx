import {
  modernIndoorGroups,
  modernSpots,
  modernLayout,
  modernPoolLamp,
} from "@/lib/modern-house";
import type { OutdoorLighting } from "@/lib/lighting/contracts";
import { useId } from "react";
// The illustration contains warm light. Dim its lit regions before adding live preview glows.
export function ModernPhotoDimmer({
  lighting,
  outdoorOn,
  poolOn,
}: {
  lighting: OutdoorLighting;
  outdoorOn: boolean;
  poolOn: boolean;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox={modernLayout.viewBox}
      preserveAspectRatio="xMidYMid slice"
      className="modern-photo-dimmer"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}-dim`}>
          <stop offset="0" stopColor="#091912" stopOpacity=".9" />
          <stop offset=".45" stopColor="#091912" stopOpacity=".65" />
          <stop offset="1" stopColor="#091912" stopOpacity="0" />
        </radialGradient>
      </defs>
      {modernIndoorGroups.map((g) => (
        <polygon
          key={g.id}
          points={g.window}
          fill="#091912"
          opacity={
            0.65 *
            (1 -
              (lighting.indoorPreview?.[g.id]
                ? (lighting.indoorBrightness?.[g.id] ?? 100) / 100
                : 0))
          }
        />
      ))}
      {!outdoorOn &&
        modernSpots.map((s) => (
          <ellipse
            key={s.id}
            cx={s.x}
            cy={s.y + 25}
            rx={s.kind === "wall" ? 52 : 86}
            ry={s.kind === "wall" ? 73 : 55}
            fill={`url(#${id}-dim)`}
          />
        ))}
      {!poolOn && (
        <ellipse
          cx={modernPoolLamp.x}
          cy={modernPoolLamp.y}
          rx="80"
          ry="30"
          fill={`url(#${id}-dim)`}
        />
      )}
    </svg>
  );
}
