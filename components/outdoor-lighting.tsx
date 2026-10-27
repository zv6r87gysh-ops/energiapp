"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { Lightbulb, LightbulbOff } from "lucide-react";
import { useHouseAtmosphere } from "./house-atmosphere";
import { lightingPower } from "@/lib/lighting/automation";
import type { SmartControl } from "@/lib/smart-control";
import type { Weather } from "@/lib/weather/contracts";
import type { SceneLocation } from "@/lib/scene/atmosphere";
import { Button } from "./ui/button";
import {
  outdoorLightingSchema,
  type OutdoorLighting,
} from "@/lib/lighting/contracts";
import { poolLamp, outdoorSpots } from "@/lib/lighting/spots";
export function OutdoorLightingControl({
  lighting,
  onChange,
  kind = "outdoor",
  automationLabel,
}: {
  kind?: "outdoor" | "pool";
  automationLabel?: string;
  lighting: OutdoorLighting;
  onChange: (lighting: OutdoorLighting) => void;
}) {
  const on =
    kind === "pool" ? (lighting.poolPreviewOn ?? false) : lighting.previewOn;
  const title = kind === "pool" ? "Poolbelysning" : "Utebelysning";
  return (
    <section className="outdoor-lighting-control" aria-label={title}>
      <div className="outdoor-lighting-icon">
        {on ? <Lightbulb size={22} /> : <LightbulbOff size={22} />}
      </div>
      <div className="outdoor-lighting-copy">
        <strong>
          {title}{" "}
          <small>
            {kind === "pool" ? "Ej ansluten" : "Plejd · Ej ansluten"}
          </small>
        </strong>
        <p>Förhandsvisning på bilden. Inga riktiga lampor styrs ännu.</p>
        {automationLabel && (
          <p>
            {automationLabel} Manuellt val lämnar solstyrning för denna
            ljusgrupp.
          </p>
        )}
        <Link href="/installningar#outdoor-lighting-settings">
          Förbered Plejd-anslutning →
        </Link>
      </div>
      <button
        type="button"
        role="switch"
        aria-label={
          kind === "pool"
            ? "Förhandsvisa poolbelysning"
            : "Förhandsvisa utebelysning"
        }
        aria-checked={on}
        className={`outdoor-lighting-switch ${on ? "is-on" : ""}`}
        onClick={() =>
          onChange({
            ...lighting,
            ...(kind === "pool" ? { poolPreviewOn: !on } : { previewOn: !on }),
          })
        }
      >
        <span className="lighting-switch-track" aria-hidden="true">
          <span />
        </span>
        {on ? "Släck på bilden" : "Tänd på bilden"}
      </button>
    </section>
  );
}
export function OutdoorLightingOverlay({
  on,
  viewBox = "0 0 1596 1422",
  photo,
  brightness = 1,
}: {
  on: boolean;
  viewBox?: string;
  photo: string;
  brightness?: number;
}) {
  const id = useId().replace(/:/g, "");
  const [x, y, width, height] = viewBox.split(/\s+/).map(Number);
  const lift = Math.min(1.16, Math.max(0.6, brightness + 0.18));
  return (
    <svg
      className={`outdoor-lighting-overlay ${on ? "is-on" : ""}`}
      data-testid="outdoor-lighting-overlay"
      data-power={on ? "on" : "off"}
      viewBox={viewBox}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}-soft`}>
          <stop offset="0" stopColor="white" stopOpacity=".96" />
          <stop offset=".35" stopColor="white" stopOpacity=".7" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask
          id={`${id}-areas`}
          maskUnits="userSpaceOnUse"
          x={x}
          y={y}
          width={width}
          height={height}
        >
          <rect x={x} y={y} width={width} height={height} fill="black" />
          {outdoorSpots.map((s) => (
            <g key={s.id} data-spot={s.id}>
              <ellipse
                cx={
                  s.x +
                  (s.kind === "right"
                    ? 20
                    : s.kind === "left"
                      ? -12
                      : s.kind === "garden"
                        ? 10
                        : 0)
                }
                cy={
                  s.y + (s.kind === "wall" ? 60 : s.kind === "garden" ? -20 : 0)
                }
                rx={s.kind === "wall" ? 76 : s.kind === "garden" ? 78 : 65}
                ry={s.kind === "wall" ? 112 : 48}
                fill={`url(#${id}-soft)`}
              />
            </g>
          ))}
        </mask>
        <filter id={`${id}-warm`}>
          <feComponentTransfer>
            <feFuncR type="linear" slope={lift * 1.1} />
            <feFuncG type="linear" slope={lift * 1.02} />
            <feFuncB type="linear" slope={lift * 0.84} />
          </feComponentTransfer>
        </filter>
      </defs>
      <g className="outdoor-light-wash" mask={`url(#${id}-areas)`}>
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
          fill="#ffd98b"
          opacity=".13"
        />
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
  onPoolSelect,
  viewBox = "0 0 1596 1422",
}: {
  onSelect: (point?: readonly number[]) => void;
  active: boolean;
  onPoolSelect: () => void;
  viewBox?: string;
}) {
  return (
    <svg
      viewBox={viewBox}
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
          "M120 993L188 933L260 870L327 809",
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
      <circle
        className="pool-lamp-hit"
        data-light-hit="pool-lamp"
        cx={poolLamp.x}
        cy={poolLamp.y}
        r="28"
        role="button"
        tabIndex={0}
        aria-label="Visa reglage för poolbelysning"
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") onPoolSelect();
        }}
        onFocus={onPoolSelect}
        onClick={onPoolSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPoolSelect();
          }
        }}
      />
    </svg>
  );
}

export function PoolLightingOverlay({
  on,
  photo,
  viewBox,
  brightness,
}: {
  on: boolean;
  photo: string;
  viewBox: string;
  brightness: number;
}) {
  const id = useId().replace(/:/g, "");
  const [x, y, w, h] = viewBox.split(/\s+/).map(Number);
  return (
    <svg
      className={`outdoor-lighting-overlay pool-lighting-overlay ${on ? "is-on" : ""}`}
      data-testid="pool-lighting-overlay"
      data-power={on ? "on" : "off"}
      viewBox={viewBox}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}-water`}>
          <stop stopColor="white" stopOpacity=".95" />
          <stop offset=".5" stopColor="white" stopOpacity=".6" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-pool`}>
          <polygon points="438,856 869,1067 744,1187 305,971" />
        </clipPath>
        <mask
          id={`${id}-glow`}
          maskUnits="userSpaceOnUse"
          x={x}
          y={y}
          width={w}
          height={h}
        >
          <rect x={x} y={y} width={w} height={h} fill="black" />
          <ellipse
            cx={poolLamp.x}
            cy={poolLamp.y + 35}
            rx="220"
            ry="145"
            fill={`url(#${id}-water)`}
          />
        </mask>
        <filter id={`${id}-bright`}>
          <feComponentTransfer>
            <feFuncR
              type="linear"
              slope={Math.max(0.5, brightness + 0.1) * 0.8}
            />
            <feFuncG
              type="linear"
              slope={Math.max(0.65, brightness + 0.15) * 1.05}
            />
            <feFuncB
              type="linear"
              slope={Math.max(0.8, brightness + 0.2) * 1.2}
            />
          </feComponentTransfer>
        </filter>
      </defs>
      <g
        className="outdoor-light-wash"
        clipPath={`url(#${id}-pool)`}
        mask={`url(#${id}-glow)`}
      >
        <image
          href={photo}
          x={x}
          y={y}
          width={w}
          height={h}
          preserveAspectRatio="none"
          filter={`url(#${id}-bright)`}
        />
        <rect x={x} y={y} width={w} height={h} fill="#81ebff" opacity=".25" />
      </g>
    </svg>
  );
}
export function PoolLightingPanel({
  lighting,
  control,
  weather,
  location,
  onManual,
}: {
  lighting: OutdoorLighting;
  control: SmartControl;
  weather: Weather | null;
  location: SceneLocation | null;
  onManual: (on: boolean) => void;
}) {
  const scene = useHouseAtmosphere(weather, location);
  const state = lightingPower(
    lighting,
    control,
    "pool",
    scene?.altitude ?? null,
  );
  return (
    <OutdoorLightingControl
      kind="pool"
      lighting={{ ...lighting, poolPreviewOn: state.on }}
      automationLabel={state.label}
      onChange={(next) => onManual(next.poolPreviewOn ?? false)}
    />
  );
}
