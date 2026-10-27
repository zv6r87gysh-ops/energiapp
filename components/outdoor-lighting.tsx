"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { Lightbulb, LightbulbOff } from "lucide-react";
import { Button } from "./ui/button";
import {
  outdoorLightingSchema,
  type OutdoorLighting,
} from "@/lib/lighting/contracts";
import { outdoorSpots } from "@/lib/lighting/spots";
export function OutdoorLightingControl({
  lighting,
  onChange,
}: {
  lighting: OutdoorLighting;
  onChange: (lighting: OutdoorLighting) => void;
}) {
  return (
    <section className="outdoor-lighting-control" aria-label="Utebelysning">
      <div className="outdoor-lighting-icon">
        {lighting.previewOn ? (
          <Lightbulb size={22} />
        ) : (
          <LightbulbOff size={22} />
        )}
      </div>
      <div className="outdoor-lighting-copy">
        <strong>
          Utebelysning <small>Plejd · Ej ansluten</small>
        </strong>
        <p>Förhandsvisning på bilden. Inga riktiga lampor styrs ännu.</p>
        <Link href="/installningar#outdoor-lighting-settings">
          Förbered Plejd-anslutning →
        </Link>
      </div>
      <button
        type="button"
        role="switch"
        aria-label="Förhandsvisa utebelysning"
        aria-checked={lighting.previewOn}
        className={`outdoor-lighting-switch ${lighting.previewOn ? "is-on" : ""}`}
        onClick={() =>
          onChange({ ...lighting, previewOn: !lighting.previewOn })
        }
      >
        <span className="lighting-switch-track" aria-hidden="true">
          <span />
        </span>
        {lighting.previewOn ? "Släck på bilden" : "Tänd på bilden"}
      </button>
    </section>
  );
}
export function OutdoorLightingOverlay({ on }: { on: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className={`outdoor-lighting-overlay ${on ? "is-on" : ""}`}
      data-testid="outdoor-lighting-overlay"
      data-power={on ? "on" : "off"}
      viewBox="0 0 1596 1422"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}-pool`}>
          <stop offset="0" stopColor="#fff5ca" stopOpacity=".95" />
          <stop offset=".4" stopColor="#ffd77b" stopOpacity=".55" />
          <stop offset="1" stopColor="#ffc56a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-beam`} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#fff5cf" stopOpacity=".8" />
          <stop offset=".55" stopColor="#ffde9c" stopOpacity=".35" />
          <stop offset="1" stopColor="#ffd18a" stopOpacity="0" />
        </linearGradient>
        <filter
          id={`${id}-glow`}
          x="-150%"
          y="-150%"
          width="400%"
          height="400%"
        >
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <g className="outdoor-light-wash">
        <rect width="1596" height="1422" fill="#071b24" opacity=".13" />
        {outdoorSpots.map((s) => (
          <g key={s.id} data-spot={s.id}>
            {s.kind === "wall" ? (
              <>
                <path
                  d={`M${s.x - 4} ${s.y} L${s.x - 43} ${s.y + 125} Q${s.x} ${s.y + 157} ${s.x + 43} ${s.y + 125} L${s.x + 4} ${s.y}Z`}
                  fill={`url(#${id}-beam)`}
                />
                <ellipse
                  cx={s.x}
                  cy={s.y + 100}
                  rx="54"
                  ry="67"
                  fill={`url(#${id}-pool)`}
                />
              </>
            ) : (
              <ellipse
                cx={
                  s.x + (s.kind === "right" ? 28 : s.kind === "left" ? -23 : 15)
                }
                cy={s.y + (s.kind === "garden" ? -28 : -6)}
                rx={s.kind === "garden" ? 62 : 42}
                ry={s.kind === "garden" ? 38 : 27}
                transform={`rotate(${s.kind === "right" ? -45 : s.kind === "left" ? -48 : 25} ${s.x} ${s.y})`}
                fill={`url(#${id}-pool)`}
              />
            )}
            <circle
              cx={s.x}
              cy={s.y}
              r="15"
              fill="#ffdf91"
              filter={`url(#${id}-glow)`}
            />
            <circle
              cx={s.x}
              cy={s.y}
              r={s.kind === "wall" ? 4 : 3}
              fill="#fff8dc"
            />
          </g>
        ))}
      </g>
      <g className="outdoor-light-fixtures">
        {outdoorSpots.map((s) => (
          <circle
            key={s.id}
            cx={s.x}
            cy={s.y}
            r={s.kind === "wall" ? 3 : 2}
            fill={on ? "#fff8dc" : "#52605b"}
            stroke={on ? "#ffe9af" : "#a6b1a6"}
            strokeWidth="1"
          />
        ))}
      </g>
    </svg>
  );
}
export function OutdoorLightingSettings({
  lighting,
  onSave,
}: {
  lighting: OutdoorLighting;
  onSave: (lighting: OutdoorLighting) => void;
}) {
  const [bridge, setBridge] = useState(lighting.binding?.bridgeReference ?? "");
  const [group, setGroup] = useState(lighting.binding?.groupReference ?? "");
  const [message, setMessage] = useState("");
  return (
    <section className="card" id="outdoor-lighting-settings">
      <h2>Utebelysning · Plejd</h2>
      <p>
        Plejd är ännu inte anslutet. Belysningen på husbilden är en
        förhandsvisning. När systemet är installerat kopplar vi en kompatibel
        brygga till din ljusgrupp och verifierar att status kan läsas och
        lamporna kan styras.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const result = outdoorLightingSchema.safeParse({
            ...lighting,
            binding:
              bridge.trim() || group.trim()
                ? { bridgeReference: bridge, groupReference: group }
                : undefined,
          });
          if (!result.success) {
            setMessage(
              "Ange både bryggans referens och ljusgruppens referens, eller lämna båda tomma.",
            );
            return;
          }
          onSave(result.data);
          setMessage(
            "Referenser sparade. Ingen anslutning eller verklig styrning har aktiverats.",
          );
        }}
      >
        <div className="form-grid">
          <label>
            Bryggans namn eller referens (valfritt)
            <input
              value={bridge}
              maxLength={100}
              onChange={(e) => setBridge(e.target.value)}
              placeholder="Fyll i när systemet är installerat"
            />
          </label>
          <label>
            Plejd-ljusgruppens referens (valfritt)
            <input
              value={group}
              maxLength={100}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="Exempel: Utebelysning"
            />
          </label>
        </div>
        <p className="muted">
          Inga tekniska uppgifter behövs nu. Här sparas bara icke-hemliga
          referenser, inte lösenord, token eller krypteringsnycklar. Verklig
          anslutning behöver en separat säker inloggning och stöd för den
          installerade bryggan.
        </p>
        <Button type="submit">Spara Plejd-förberedelse</Button>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}

export function OutdoorLightingHitAreas({
  onSelect,
  active,
}: {
  onSelect: (point?: readonly number[]) => void;
  active: boolean;
}) {
  return (
    <svg
      viewBox="0 0 1596 1422"
      preserveAspectRatio="none"
      className={`lighting-hit-overlay ${active ? "is-active" : ""}`}
      aria-label="Belysningsområden på huset"
    >
      <g
        role="button"
        tabIndex={0}
        aria-label="Visa reglage för utebelysning"
        onFocus={() => onSelect()}
        onClick={() => onSelect()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        {outdoorSpots.map((s) => (
          <circle
            key={s.id}
            data-light-hit={s.id}
            cx={s.x}
            cy={s.y}
            r={s.kind === "wall" ? 30 : 26}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse")
                onSelect([s.x / 15.96, s.y / 14.22]);
            }}
          />
        ))}
        {[
          "M291 932L354 866L417 800L480 740",
          "M965 989L1322 613",
          "M62 1227L472 1410",
        ].map((d) => (
          <path
            key={d}
            d={d}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") onSelect();
            }}
          />
        ))}
      </g>
    </svg>
  );
}
