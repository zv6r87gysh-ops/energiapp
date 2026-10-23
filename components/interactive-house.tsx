"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Camera, Car, Flame, Home, Waves } from "lucide-react";
import { readHousePhoto, saveHousePhoto } from "@/lib/house-photo";
import type { HouseholdSimulation } from "@/lib/simulation/engine";
import { money } from "@/lib/energy";
const areas = [
  {
    id: "house",
    name: "Huset",
    href: "/forbrukning",
    icon: Home,
    point: [52, 33],
    shape:
      "247,354 628,199 778,266 827,245 1233,382 1210,465 1070,783 704,867 269,668",
    note: "Husets modellkostnad, exklusive pool och billaddning.",
  },
  {
    id: "floor",
    name: "Golvvärme",
    href: "/golvvarme",
    icon: Flame,
    point: [38, 50],
    shape: "307,567 713,722 862,634 1069,710 704,879 288,714",
    note: "Separat kostnad saknas. Huset totalt visas som referens; det är inte golvvärmens kostnad.",
  },
  {
    id: "pool",
    name: "Pool",
    href: "/pool",
    icon: Waves,
    point: [36, 74],
    shape: "438,856 869,1067 744,1187 305,971",
    note: "Poolens modellerade rörliga kostnad med publicerade elpriser.",
  },
  {
    id: "charging",
    name: "Billaddare",
    href: "/laddning",
    icon: Car,
    point: [43, 12],
    shape: "572,146 663,124 718,163 704,226 641,243 574,208",
    note: "Billaddningens modellkostnad. Laddsymbolens placering är schematisk.",
  },
] as const;
type AreaId = (typeof areas)[number]["id"];
export function InteractiveHouse({
  householdId,
  simulation,
}: {
  householdId: string;
  simulation: HouseholdSimulation | null;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [active, setActive] = useState<AreaId>("house");
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const url = useRef<string | null>(null);
  const generation = useRef({ value: 0 });
  const tooltip = useId();
  const glow = useId().replace(/:/g, "");
  useEffect(() => {
    let mounted = true;
    const counter = generation.current;
    const current = ++counter.value;
    void readHousePhoto(householdId)
      .then((blob) => {
        if (!mounted || generation.current.value !== current || !blob) return;
        const next = URL.createObjectURL(blob);
        url.current = next;
        setPhoto(next);
      })
      .catch(() => {
        if (mounted)
          setError(
            "Bildlagring är inte tillgänglig. Du kan ändå välja ett foto för detta besök.",
          );
      });
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
  return (
    <section
      className="card interactive-house"
      aria-label="Ditt interaktiva hus"
    >
      <div className="house-photo-heading">
        <div>
          <span className="eyebrow">DITT HEM</span>
          <h2>Utforska ditt hus</h2>
        </div>
        <button
          className="button secondary"
          onClick={() => file.current?.click()}
        >
          <Camera size={16} />
          {photo ? "Byt husfoto" : "Välj ditt husfoto"}
        </button>
      </div>
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
        <div className={`house-photo-scene house-active-${active}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Local user-selected Blob URL, no remote image service. */}
          <img
            src={photo}
            alt="Ditt hus med interaktiva markeringar för huset, golvvärmen, poolen och billaddaren"
            width={1596}
            height={1422}
          />
          <svg
            viewBox="0 0 1596 1422"
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
                className={`house-hit house-hit-${a.id} ${active === a.id ? "is-active" : ""}`}
                onMouseEnter={() => setActive(a.id)}
                onFocus={() => setActive(a.id)}
              >
                <polygon
                  points={a.shape}
                  style={{
                    filter: active === a.id ? `url(#${glow})` : undefined,
                  }}
                />
                {a.id === "floor" && (
                  <path
                    className="house-floor-coils"
                    d="M360 627l280 107q35 15 16 32l-275-106q-26-10-20 15l274 106q35 15 8 30L359 702 M767 710l151-56q31-13 41 11l-155 58q-31 12-7 29l154-59"
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
                style={{ left: `${a.point[0]}%`, top: `${a.point[1]}%` }}
                aria-label={`Visa kostnad för ${a.name}`}
                aria-pressed={active === a.id}
                aria-describedby={tooltip}
                onMouseEnter={() => setActive(a.id)}
                onFocus={() => setActive(a.id)}
                onClick={() => setActive(a.id)}
              >
                <Icon size={19} />
                <span>{a.name}</span>
              </button>
            );
          })}
          <div
            className="house-photo-hover-card"
            aria-hidden="true"
            style={{
              left: `clamp(120px, ${area.point[0]}%, calc(100% - 120px))`,
              top: `clamp(8px, calc(${area.point[1]}% + 26px), calc(100% - 125px))`,
            }}
          >
            <strong>{area.name}</strong>
            <span>
              {active === "floor"
                ? "Huset totalt hittills idag"
                : "Kostnad hittills idag"}
            </span>
            <b>{cost == null ? "Underlag saknas" : money(cost)}</b>
            <small>
              {active === "floor"
                ? "Separat golvvärmekostnad saknas"
                : "Modellerad kostnad"}
            </small>
          </div>
        </div>
      ) : (
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
      )}
      <div className="house-category-tabs" aria-label="Välj område på huset">
        {areas.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              aria-pressed={active === a.id}
              onClick={() => setActive(a.id)}
              onMouseEnter={() => setActive(a.id)}
              onFocus={() => setActive(a.id)}
            >
              <Icon size={17} />
              {a.name}
            </button>
          );
        })}
      </div>
      <div
        className="house-cost-tooltip"
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
          <small>{area.note} Modellvärden, inte uppmätt kostnad.</small>
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
