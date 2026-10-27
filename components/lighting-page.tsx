"use client";
import { useEffect, useState } from "react";
import type { OutdoorLighting } from "@/lib/lighting/contracts";
import { outdoorLightingSchema } from "@/lib/lighting/contracts";
import { indoorGroups } from "@/lib/lighting/indoor";
import type { SmartControl } from "@/lib/smart-control";
import type { Weather } from "@/lib/weather/contracts";
import type { SceneLocation } from "@/lib/scene/atmosphere";
import { useHouseAtmosphere } from "./house-atmosphere";
import { lightingPower } from "@/lib/lighting/automation";
import { IndoorLightingControls } from "./indoor-lighting";

export function LightingPage({
  lighting,
  control,
  weather,
  location,
  onSave,
  onManual,
}: {
  lighting: OutdoorLighting;
  control: SmartControl;
  weather: Weather | null;
  location: SceneLocation | null;
  onSave: (lighting: OutdoorLighting) => void;
  onManual: (group: "outdoor" | "pool", on: boolean) => void;
}) {
  const scene = useHouseAtmosphere(weather, location);
  const exterior = lightingPower(
    lighting,
    control,
    "outdoor",
    scene?.altitude ?? null,
  );
  const pool = lightingPower(
    lighting,
    control,
    "pool",
    scene?.altitude ?? null,
  );
  const [bridgeType, setBridgeType] = useState(
    lighting.indoorBinding?.bridgeType ?? "bluetooth",
  );
  const [references, setReferences] = useState(
    lighting.indoorBinding?.groups ?? {},
  );
  const [message, setMessage] = useState("");
  const savedBinding = JSON.stringify(
    lighting.indoorBinding ?? { bridgeType: "bluetooth", groups: {} },
  );
  useEffect(() => {
    const binding: NonNullable<OutdoorLighting["indoorBinding"]> =
      JSON.parse(savedBinding);
    queueMicrotask(() => {
      setBridgeType(binding.bridgeType);
      setReferences(binding.groups);
    });
  }, [savedBinding]);

  const allOn = indoorGroups.every((g) => lighting.indoorPreview?.[g.id]);
  return (
    <div className="lighting-page">
      <nav className="lighting-subnav" aria-label="Belysningskategorier">
        <a href="#inomhus">Inomhus · 12 spottar</a>
        <a href="#utomhus">Utomhus · inklusive poolbelysning</a>
      </nav>
      <p className="muted">
        Din befintliga Plejd-installation är ännu inte ansluten till Energihem.
        Knapparna ändrar förhandsvisningen; de skickar inga kommandon till
        lamporna.
      </p>
      <section className="card" id="inomhus">
        <div className="lighting-section-heading">
          <h2>Inomhus</h2>
          <button
            className="button secondary"
            onClick={() =>
              onSave({
                ...lighting,
                indoorPreview: Object.fromEntries(
                  indoorGroups.map((g) => [g.id, !allOn]),
                ),
              })
            }
          >
            {allOn ? "Släck allt inomhus" : "Tänd allt inomhus"}
          </button>
        </div>
        <p>
          Två stora fönster med tre spottar vardera, två i fönstret ovanför
          bordet, två bakom bordet och två vid matplatsen under pergolan.
        </p>
        <IndoorLightingControls
          preview={lighting.indoorPreview ?? {}}
          onChange={(indoorPreview) => onSave({ ...lighting, indoorPreview })}
        />
        <details className="lighting-connection">
          <summary>Koppla din befintliga Plejd-installation</summary>
          <p>
            Plejd kommunicerar lokalt via Bluetooth. Webbappen behöver en
            kompatibel brygga hemma. Välj anslutningen när du vet vilken brygga
            du har. Referenserna nedan sparas lokalt; en verifierad brygga och
            säker serveranslutning behövs innan riktiga lampor kan styras. Skriv
            inte lösenord eller tokens här.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const result = outdoorLightingSchema.safeParse({
                ...lighting,
                indoorBinding: {
                  bridgeType,
                  groups: Object.fromEntries(
                    Object.entries(references).filter(([, v]) => v?.trim()),
                  ),
                },
              });
              if (!result.success) {
                setMessage(
                  "Kontrollera ljusgruppernas referenser. Använd endast namn eller enhets-ID.",
                );
                return;
              }
              onSave(result.data);
              setMessage(
                "Plejd-uppgifterna har sparats. Ingen fysisk anslutning har aktiverats.",
              );
            }}
          >
            <label>
              Anslutning till Plejd
              <select
                value={bridgeType}
                onChange={(e) =>
                  setBridgeType(e.target.value as typeof bridgeType)
                }
              >
                <option value="unknown">Vet inte ännu</option>
                <option value="bluetooth">Bluetooth · brygga ej vald</option>
                <option value="home-assistant">Home Assistant</option>
                <option value="plejd-gateway">Plejd Gateway</option>
                <option value="other">Annan brygga</option>
              </select>
            </label>
            <div className="form-grid">
              {indoorGroups.map((g) => (
                <label key={g.id}>
                  {g.name} · ljusgruppens referens
                  <input
                    maxLength={100}
                    value={references[g.id] ?? ""}
                    onChange={(e) =>
                      setReferences({ ...references, [g.id]: e.target.value })
                    }
                    placeholder="Namn eller enhets-ID (valfritt)"
                  />
                </label>
              ))}
            </div>
            <button className="button secondary" type="submit">
              Spara inomhusbelysningens Plejd-uppgifter
            </button>
            {message && <p role="status">{message}</p>}
          </form>
        </details>
      </section>
      <section className="card" id="utomhus">
        <h2>Utomhus</h2>
        <div className="indoor-lighting-groups">
          <button
            className={`indoor-group-button ${exterior.on ? "lighting-is-on" : ""}`}
            aria-pressed={exterior.on}
            onClick={() => onManual("outdoor", !exterior.on)}
          >
            <span>
              Utebelysning<small>{exterior.label}</small>
            </span>
            <b>{exterior.on ? "Tänd" : "Släckt"}</b>
          </button>
          <div className="pool-lighting-subcategory" id="poolbelysning">
            <h3>Poolbelysning</h3>
            <button
              className={`indoor-group-button ${pool.on ? "lighting-is-on" : ""}`}
              aria-label="Poolbelysning"
              aria-pressed={pool.on}
              onClick={() => onManual("pool", !pool.on)}
            >
              <span>
                Poollampa<small>{pool.label}</small>
              </span>
              <b>{pool.on ? "Tänd" : "Släckt"}</b>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
