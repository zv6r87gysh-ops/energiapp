"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Camera, Car, Flame, Home, Lightbulb, Waves } from "lucide-react";
import {
  readHousePhoto,
  saveHousePhoto,
  readBundledHousePhoto,
} from "@/lib/house-photo";
import type { HouseholdSimulation } from "@/lib/simulation/engine";
import {
  OutdoorLightingControl,
  OutdoorLightingOverlay,
  PoolLightingOverlay,
} from "./outdoor-lighting";
import { lightingPower } from "@/lib/lighting/automation";
import type { SmartControl } from "@/lib/smart-control";
import type { OutdoorLighting } from "@/lib/lighting/contracts";
import { housePhotoLayout, photoPoint } from "@/lib/house-photo-layout";
import {
  HouseClock,
  HouseWeatherEffects,
  useHouseAtmosphere,
} from "./house-atmosphere";
import type { Weather } from "@/lib/weather/contracts";
import type { SceneLocation } from "@/lib/scene/atmosphere";
import { money } from "@/lib/energy";
const areas = [
  {
    id: "house",
    name: "Huset",
    href: "/forbrukning",
    icon: Home,
    point: [49.5, 28.5],
    shape:
      "247,354 628,199 778,266 827,245 1233,382 1233,403 1207,419 1193,607 1046,825 858,912 704,855 405,752 270,696 262,380",
    note: "Husets modellkostnad, exklusive pool och billaddning.",
  },
  {
    id: "floor",
    name: "Golvvärme",
    href: "/golvvarme",
    icon: Flame,
    point: [37.5, 49.5],
    shape: "405,647 704,758 857,671 1045,740 858,831 704,855 405,744",
    note: "Separat kostnad saknas. Huset totalt visas som referens; det är inte golvvärmens kostnad.",
  },
  {
    id: "pool",
    name: "Pool",
    href: "/pool",
    icon: Waves,
    point: [36.8, 72],
    shape: "427,831 901,1060 748,1220 247,979",
    note: "Poolens modellerade rörliga kostnad med publicerade elpriser.",
  },
  {
    id: "charging",
    name: "Billaddare",
    href: "/laddning",
    icon: Car,
    point: [39.8, 12.5],
    shape: "574,180 611,149 658,143 695,159 700,185 678,211 636,223 583,207",
    note: "Billaddningens modellkostnad. Laddsymbolens placering är schematisk.",
  },
] as const;
type AreaId = (typeof areas)[number]["id"];
export function InteractiveHouse({
  householdId,
  householdSelector,
  simulation,
  controls,
  lighting,
  onLightingManual,
  smartControl,
  weather,
  location,
  weatherMessage,
  postcode,
  onPostcode,
}: {
  weatherMessage: string;
  postcode: string;
  onPostcode: (postcode: string) => void;
  controls?: React.ReactNode;
  householdSelector?: React.ReactNode;
  weather: Weather | null;
  location: SceneLocation | null;
  lighting: OutdoorLighting;
  onLightingManual: (group: "outdoor" | "pool", on: boolean) => void;
  smartControl: SmartControl;
  householdId: string;
  simulation: HouseholdSimulation | null;
}) {
  const atmosphere = useHouseAtmosphere(weather, location);
  const [photo, setPhoto] = useState<string | null>(null);
  const [layout, setLayout] = useState(() => housePhotoLayout(1596, 1422));
  const [active, setActive] = useState<AreaId>("house");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function cancelHide() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }
  function clearPreview() {
    cancelHide();
    setPreview(false);
  }
  function scheduleHide() {
    cancelHide();
    hoverTimer.current = setTimeout(() => {
      if (
        document.activeElement?.matches(
          ".house-hit:focus-visible,.house-photo-pin:focus-visible,.house-category-tabs button:focus-visible",
        )
      )
        return;
      clearPreview();
    }, 180);
  }
  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    [],
  );
  function selectArea(id: AreaId) {
    cancelHide();
    setActive(id);
    setPreview(true);
  }
  const file = useRef<HTMLInputElement>(null);
  const url = useRef<string | null>(null);
  const generation = useRef({ value: 0 });
  const tooltip = useId();
  const glow = useId().replace(/:/g, "");
  useEffect(() => {
    let mounted = true;
    const counter = generation.current;
    const current = ++counter.value;
    void (async () => {
      let blob: Blob | null = null;
      let storageFailed = false;
      try {
        blob = await readHousePhoto(householdId);
      } catch {
        storageFailed = true;
      }
      const bundled = blob ? null : await readBundledHousePhoto(householdId);
      if (!mounted || generation.current.value !== current) return;
      if (blob) {
        const next = URL.createObjectURL(blob);
        url.current = next;
        setPhoto(next);
      } else if (bundled) setPhoto(bundled);
      else if (storageFailed)
        setError(
          "Bildlagring är inte tillgänglig. Du kan ändå välja ett foto för detta besök.",
        );
    })();
    return () => {
      mounted = false;
      counter.value++;
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = null;
    };
  }, [householdId]);
  async function choosePhoto(selected?: File) {
    if (!selected) return;
    const current = ++generation.current.value;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setError("Välj en JPG-, PNG- eller WebP-bild.");
      return;
    }
    if (selected.size > 15 * 1024 * 1024) {
      setError("Välj en bild som är mindre än 15 MB.");
      return;
    }
    let next: string | null = null;
    try {
      next = URL.createObjectURL(selected);
      const image = new Image();
      image.src = next;
      await image.decode();
      if (generation.current.value !== current) {
        URL.revokeObjectURL(next);
        return;
      }
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = next;
      setLayout(housePhotoLayout(image.naturalWidth, image.naturalHeight));
      setPhoto(next);
      setError("");
      try {
        await saveHousePhoto(householdId, selected);
      } catch {
        if (generation.current.value === current)
          setError(
            "Fotot visas men kunde inte sparas. Välj det igen nästa gång du öppnar appen.",
          );
      }
    } catch {
      if (next) URL.revokeObjectURL(next);
      if (generation.current.value === current)
        setError("Bilden kunde inte läsas. Prova att spara den som JPG.");
    }
  }
  const houseCost =
    simulation?.cost == null ||
    simulation.devices.pool.cost == null ||
    simulation.devices.charging.cost == null
      ? null
      : simulation.cost -
        simulation.devices.pool.cost -
        simulation.devices.charging.cost;
  const cost =
    active === "pool"
      ? simulation?.devices.pool.cost
      : active === "charging"
        ? simulation?.devices.charging.cost
        : houseCost;
  const area = areas.find((a) => a.id === active)!;
  const savings = simulation?.continuousComparison[active] ?? null;
  const exteriorState = lightingPower(
    lighting,
    smartControl,
    "outdoor",
    atmosphere?.altitude ?? null,
  );
  const poolState = lightingPower(
    lighting,
    smartControl,
    "pool",
    atmosphere?.altitude ?? null,
  );
  const shownLighting = {
    ...lighting,
    previewOn: exteriorState.on,
    poolPreviewOn: poolState.on,
  };
  const areaPoint = photoPoint(area.point, layout);
  return (
    <section
      className="card interactive-house"
      aria-label="Ditt interaktiva hus"
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") scheduleHide();
      }}
    >
      <div className="house-photo-heading">
        <div>
          <span className="eyebrow">DITT HEM</span>
          <h1>Utforska ditt hus</h1>
        </div>
        <div className="house-photo-actions">
          {householdSelector}
          <button
            className="button secondary"
            onClick={() => file.current?.click()}
          >
            <Camera size={16} />
            {photo ? "Byt husfoto" : "Välj ditt husfoto"}
          </button>
        </div>
      </div>
      <HouseClock
        key={postcode}
        scene={atmosphere}
        location={location}
        weather={weather}
        message={weatherMessage}
        postcode={postcode}
        onPostcode={onPostcode}
      />
      {!photo && (
        <OutdoorLightingControl
          lighting={shownLighting}
          automationLabel={exteriorState.label}
          onChange={(next) => onLightingManual("outdoor", next.previewOn)}
        />
      )}
      <input
        ref={file}
        className="house-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Välj husfoto"
        onChange={(e) => {
          void choosePhoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && <p role="status">{error}</p>}
      {photo ? (
        <div
          className={`house-photo-scene house-active-${preview ? active : "none"}`}
          onPointerMove={(e) => {
            if (e.pointerType !== "mouse") return;
            const target = e.target as Element;
            if (
              target.closest(
                ".house-hit,.house-photo-pin,.house-photo-hover-card,.house-category-tabs",
              )
            )
              cancelHide();
            else scheduleHide();
          }}
        >
          <div className="house-photo-visual">
            {/* eslint-disable-next-line @next/next/no-img-element -- Local user-selected Blob URL, no remote image service. */}
            <img
              src={photo}
              alt="Ditt hus med interaktiva markeringar för huset, golvvärmen, poolen och billaddaren"
              width={1596}
              height={1422}
              data-season={atmosphere?.season}
              style={{
                filter: atmosphere
                  ? `brightness(${atmosphere.brightness}) saturate(${atmosphere.season === "winter" ? 0.72 : atmosphere.season === "summer" ? 1.08 : 0.94}) sepia(${atmosphere.season === "autumn" ? 0.12 : 0.02})`
                  : undefined,
              }}
              onLoad={(event) =>
                setLayout(
                  housePhotoLayout(
                    event.currentTarget.naturalWidth,
                    event.currentTarget.naturalHeight,
                  ),
                )
              }
            />
            <HouseWeatherEffects scene={atmosphere} />
            <OutdoorLightingOverlay
              on={exteriorState.on}
              viewBox={layout.viewBox}
              photo={photo}
              brightness={atmosphere?.brightness ?? 1}
            />
            <PoolLightingOverlay
              on={poolState.on}
              photo={photo}
              viewBox={layout.viewBox}
              brightness={atmosphere?.brightness ?? 1}
            />
            <svg
              viewBox={layout.viewBox}
              preserveAspectRatio="none"
              className="house-photo-overlay"
              aria-label="Kategorier på husfotot"
            >
              <defs>
                <filter id={glow} x="-25%" y="-25%" width="150%" height="150%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {areas.map((a) => (
                <a
                  key={a.id}
                  href={a.href}
                  aria-label={`Öppna ${a.name}`}
                  aria-describedby={tooltip}
                  className={`house-hit house-hit-${a.id} ${preview && active === a.id ? "is-active" : ""}`}
                  onMouseEnter={() => selectArea(a.id)}
                  onFocus={() => selectArea(a.id)}
                >
                  <polygon
                    points={a.shape}
                    style={{
                      filter:
                        preview && active === a.id
                          ? `url(#${glow})`
                          : undefined,
                    }}
                  />
                  {a.id === "floor" && (
                    <path
                      className="house-floor-coils"
                      d="M430 677l242 91q20 8 8 19l-245-92q-19-7-14 9l250 94q21 8 8 19l-244-92 M745 770l112-64 133 48q18 7 4 16l-123-44-109 62q-16 10 0 17l111-62 107 40"
                    />
                  )}
                </a>
              ))}
            </svg>
            {areas.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.id}
                  className={`house-photo-pin house-pin-${a.id}`}
                  style={{
                    left: `${photoPoint(a.point, layout)[0]}%`,
                    top: `${photoPoint(a.point, layout)[1]}%`,
                  }}
                  aria-label={`Visa kostnad för ${a.name}`}
                  aria-pressed={preview && active === a.id}
                  aria-describedby={tooltip}
                  onMouseEnter={() => selectArea(a.id)}
                  onFocus={() => selectArea(a.id)}
                  onClick={() => selectArea(a.id)}
                >
                  <Icon size={19} />
                  <span>{a.name}</span>
                </button>
              );
            })}
            <div
              className={`house-photo-hover-card ${preview ? "is-visible" : ""}`}
              aria-hidden="true"
              style={{
                left: `clamp(118px, ${areaPoint[0]}%, calc(100% - 118px))`,
                top: `clamp(8px, calc(${areaPoint[1]}% ${active === "pool" || active === "floor" ? "- 176px" : "+ 28px"}), calc(100% - 170px))`,
              }}
            >
              <strong>{area.name}</strong>
              <span>
                {active === "floor"
                  ? "Huset totalt hittills idag"
                  : "Kostnad hittills idag"}
              </span>
              <b>{cost == null ? "Underlag saknas" : money(cost)}</b>
              <span className="house-savings">
                Besparing mot ständig drift{" "}
                <strong>{savings === null ? "—" : money(savings)}</strong>
              </span>
              <small>
                {active === "floor"
                  ? "Separat golvvärmekostnad saknas"
                  : "Modellerad kostnad"}
              </small>
            </div>
          </div>
          <div
            className="house-category-tabs"
            aria-label="Välj område på huset"
          >
            <button
              type="button"
              aria-label="Utebelysning"
              className={exteriorState.on ? "lighting-is-on" : ""}
              data-power={exteriorState.on ? "on" : "off"}
              aria-pressed={exteriorState.on}
              title={
                exteriorState.on
                  ? "Släck utebelysningen på bilden"
                  : "Tänd utebelysningen på bilden"
              }
              onClick={() => {
                clearPreview();
                onLightingManual("outdoor", !exteriorState.on);
              }}
            >
              <Lightbulb size={17} />
              Utebelysning <small>{exteriorState.on ? "Tänd" : "Släckt"}</small>
            </button>
            <button
              type="button"
              aria-label="Poolbelysning"
              className={poolState.on ? "lighting-is-on" : ""}
              data-power={poolState.on ? "on" : "off"}
              aria-pressed={poolState.on}
              title={
                poolState.on
                  ? "Släck poolbelysningen på bilden"
                  : "Tänd poolbelysningen på bilden"
              }
              onClick={() => {
                clearPreview();
                onLightingManual("pool", !poolState.on);
              }}
            >
              <Lightbulb size={17} />
              Poolbelysning <small>{poolState.on ? "Tänd" : "Släckt"}</small>
            </button>
            {areas.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.id}
                  aria-pressed={preview && active === a.id}
                  onClick={() => selectArea(a.id)}
                  onMouseEnter={() => selectArea(a.id)}
                  onFocus={() => selectArea(a.id)}
                >
                  <Icon size={17} />
                  {a.name}
                </button>
              );
            })}
          </div>
          {controls && <div className="house-smart-controls">{controls}</div>}
        </div>
      ) : (
        <div className="house-photo-placeholder">
          <button
            className="house-photo-empty"
            onClick={() => file.current?.click()}
          >
            <Camera size={38} />
            <strong>Lägg till fotot på ditt hus</strong>
            <span>
              Välj samma foto som i chatten. Pool, hus, golvslingor och laddare
              får interaktiva markeringar.
            </span>
          </button>
          {controls && <div className="house-smart-fallback">{controls}</div>}
        </div>
      )}
      <div
        className="house-cost-tooltip"
        hidden={!preview}
        id={tooltip}
        role="status"
        aria-live="polite"
      >
        <div>
          <strong>{area.name}</strong>
          <span>
            {active === "floor"
              ? "Huset totalt hittills idag"
              : "Kostnad hittills idag"}
          </span>
          <b>{cost == null ? "Kostnadsunderlag saknas" : money(cost)}</b>
          <div className="house-savings">
            Besparing mot ständig drift:{" "}
            <strong>{savings === null ? "—" : money(savings)}</strong>
          </div>
          <small>
            {area.note} Modellvärden, inte uppmätt kostnad. Hypotetisk
            jämförelse från midnatt till nu: pool{" "}
            {simulation?.continuousComparison.poolPower ?? 2} kW, laddare{" "}
            {simulation?.continuousComparison.chargingPower ?? 6} kW utan
            avbrott. Olika levererad energi; skillnaden är inte enbart effekten
            av smart styrning. Husets baslast styrs inte och golvvärme saknar
            separat jämförelse.
          </small>
        </div>
        <Link className="button" href={area.href}>
          Öppna {area.name} →
        </Link>
      </div>
      <p className="muted house-photo-help">
        Hovra eller välj en markering för kostnad. Klicka på det lysande området
        eller Öppna för att gå till vyn. På mobilen: tryck på en markering och
        sedan Öppna. Golvslingor och laddsymbol är schematiska. Fotot sparas
        endast i denna webbläsare för valt hushåll.
      </p>
    </section>
  );
}
