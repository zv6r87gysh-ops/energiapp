"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Car,
  Check,
  ChevronRight,
  Link2,
  Plus,
  Radio,
  Settings2,
  ShieldCheck,
  Trash2,
  Waves,
  X,
} from "lucide-react";
import { ZodError } from "zod";
import { Button } from "./ui/button";
import type { Device } from "@/lib/models";
import {
  deviceKinds,
  deviceDetailsSchema,
  registerDevice,
  pendingDeviceStatus,
  type DeviceKind,
  type DeviceDetails,
} from "@/lib/devices";
const icons = {
  "pool-wifi": Waves,
  "energy-meter": Activity,
  charger: Car,
  other: Radio,
};
const blank = (kind: DeviceKind): DeviceDetails => ({
  kind,
  name: "",
  manufacturer: "",
  model: "",
  identifier: "",
});
export function DeviceManager({
  householdId,
  devices,
  onChange,
  showList = false,
  showConnect = true,
  defaultKind = "energy-meter",
}: {
  householdId: string;
  devices: Device[];
  onChange: (devices: Device[]) => void;
  showList?: boolean;
  showConnect?: boolean;
  defaultKind?: DeviceKind;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<DeviceDetails>(blank(defaultKind));
  const [editingId, setEditingId] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const own = devices.filter((d) => d.householdId === householdId);
  const prepared = own.filter((d) => d.source === "registered");
  const kind = deviceKinds.find((k) => k.id === draft.kind)!;
  useEffect(() => {
    if (step > 0 && !dialog.current?.open) dialog.current?.showModal();
    else if (step === 0 && dialog.current?.open) dialog.current.close();
  }, [step]);
  function close() {
    setStep(0);
    setError("");
    trigger.current?.focus();
  }
  function open() {
    setDraft(blank(defaultKind));
    setEditingId(undefined);
    setError("");
    setSuccess("");
    setStep(1);
  }
  function details() {
    const parsed = deviceDetailsSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setDraft(parsed.data);
    setError("");
    setStep(3);
  }
  function save() {
    try {
      const device = registerDevice(draft, householdId, own, editingId);
      onChange(
        editingId
          ? devices.map((d) => (d.id === editingId ? device : d))
          : [...devices, device],
      );
      setSuccess(
        `${device.name} har sparats. Status: ${pendingDeviceStatus}. Ingen anslutning eller styrning har aktiverats.`,
      );
      close();
    } catch (e) {
      setError(
        e instanceof ZodError
          ? e.issues[0].message
          : e instanceof Error
            ? e.message
            : "Enheten kunde inte sparas.",
      );
    }
  }
  function edit(device: Device) {
    if (!device.kind || !device.identifier) return;
    setDraft({
      kind: device.kind,
      name: device.name,
      manufacturer: device.manufacturer,
      model: device.model,
      identifier: device.identifier,
    });
    setEditingId(device.id);
    setError("");
    setSuccess("");
    setStep(2);
  }
  return (
    <>
      <section className="card device-hub" aria-label="Egna enheter">
        {showConnect ? (
          <div className="device-hub-heading">
            <div className="device-hub-icon">
              <Link2 size={23} />
            </div>
            <div>
              <h2>Koppla in dina egna enheter</h2>
              <p>
                Poolens WiFi-box, elmätare eller billaddare. Börja med modell
                och enhetsnummer.
              </p>
              <span className="muted">
                {prepared.length
                  ? `${prepared.length} ${prepared.length === 1 ? "enhet förberedd" : "enheter förberedda"} · ingen verifierad anslutning ännu`
                  : "Inga egna enheter är anslutna ännu."}
              </span>
            </div>
            <Button ref={trigger} onClick={open}>
              <Plus size={17} />
              Lägg till egen enhet
            </Button>
          </div>
        ) : (
          <h2>Dina registrerade enheter</h2>
        )}
        {!showList && prepared.length > 0 && (
          <Link className="text-link" href="/installningar">
            Hantera dina enheter <ChevronRight size={15} />
          </Link>
        )}
        {success && (
          <p role="status" className="device-success">
            <Check size={17} />
            {success}
          </p>
        )}
        {showList && (
          <div className="owned-devices">
            {own.length === 0 ? (
              <p className="muted device-empty">
                Lägg till en enhet under Pool, Golvvärme eller Elbilsladdning.
                Den sparas för ditt valda hushåll och visas här med tydlig
                anslutningsstatus.
              </p>
            ) : (
              own.map((device) => {
                const Icon = icons[device.kind ?? "other"];
                const registered = device.source === "registered";
                return (
                  <article
                    className="owned-device"
                    key={device.id}
                    aria-label={`Enhet: ${device.name}`}
                  >
                    <div className="owned-device-top">
                      <span className="device-icon">
                        <Icon size={20} />
                      </span>
                      <div>
                        <h3>{device.name}</h3>
                        <p>
                          {device.manufacturer} · {device.model}
                        </p>
                      </div>
                      <span className="badge neutral">
                        {registered
                          ? pendingDeviceStatus
                          : "Demo · simulerad enhet"}
                      </span>
                    </div>
                    {registered && (
                      <dl className="device-facts">
                        <div>
                          <dt>Serienummer / Enhets-ID</dt>
                          <dd>{device.identifier}</dd>
                        </div>
                        <div>
                          <dt>Senaste avläsning</dt>
                          <dd>Ingen avläsning</dd>
                        </div>
                      </dl>
                    )}
                    <p className="muted">
                      {registered
                        ? "Uppgifterna är sparade lokalt. En verifierad integration behövs innan mätvärden kan hämtas."
                        : "Äldre demoenhet. Ingen fysisk utrustning är ansluten."}
                    </p>
                    <div className="toolbar">
                      {registered && (
                        <Button
                          className="secondary"
                          onClick={() => edit(device)}
                        >
                          <Settings2 size={14} />
                          Redigera uppgifter
                        </Button>
                      )}
                      {removeId === device.id ? (
                        <>
                          <span className="muted">Ta bort registreringen?</span>
                          <Button
                            className="secondary"
                            onClick={() => {
                              onChange(
                                devices.filter((d) => d.id !== device.id),
                              );
                              setRemoveId(null);
                            }}
                          >
                            Bekräfta borttagning
                          </Button>
                          <Button
                            className="subtle"
                            onClick={() => setRemoveId(null)}
                          >
                            Avbryt
                          </Button>
                        </>
                      ) : (
                        <Button
                          className="subtle"
                          onClick={() => setRemoveId(device.id)}
                        >
                          <Trash2 size={14} />
                          Ta bort
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </section>
      <dialog
        ref={dialog}
        className="modal device-dialog"
        aria-labelledby="device-dialog-title"
        aria-describedby="device-dialog-description"
        onCancel={close}
        onClose={() => {
          if (step > 0) close();
        }}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              {editingId ? "REDIGERA ENHET" : `STEG ${step} AV 3`}
            </span>
            <h2 id="device-dialog-title">
              {step === 1
                ? "Vad vill du koppla in?"
                : step === 2
                  ? "Enhetens uppgifter"
                  : "Kontrollera och spara"}
            </h2>
          </div>
          <button type="button" aria-label="Stäng enhetsguide" onClick={close}>
            <X size={21} />
          </button>
        </div>
        <p id="device-dialog-description" className="muted">
          {step === 1
            ? "Välj typ av enhet. Du behöver tillverkare, exakt modell och ett serienummer eller enhets-ID."
            : "Registrera din enhet för det valda hushållet. Den är inte ansluten till Energihem ännu."}
        </p>
        {error && (
          <p role="alert" className="device-error">
            {error}
          </p>
        )}
        {step === 1 && (
          <div className="device-kind-grid">
            {deviceKinds.map((k) => {
              const Icon = icons[k.id];
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    setDraft(blank(k.id));
                    setStep(2);
                  }}
                >
                  <Icon size={26} />
                  <span>
                    <strong>{k.name}</strong>
                    <small>{k.description}</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              );
            })}
          </div>
        )}
        {step === 2 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              details();
            }}
            noValidate
          >
            <span className="badge neutral">{kind.shortName}</span>
            <div className="form-grid device-details">
              {(
                [
                  ["name", "Enhetens namn", "Exempel: Poolen hemma"],
                  ["manufacturer", "Tillverkare", "Tillverkaren på etiketten"],
                  ["model", "Exakt modell", "Modell på enheten eller i appen"],
                ] as const
              ).map(([key, label, placeholder]) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <input
                    value={draft[key]}
                    autoComplete="off"
                    maxLength={key === "model" ? 100 : 80}
                    placeholder={placeholder}
                    required
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label className="field">
                <span>Serienummer / Enhets-ID</span>
                <input
                  value={draft.identifier}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={80}
                  placeholder="Numret från etiketten eller appen"
                  aria-describedby="device-id-help"
                  required
                  onChange={(e) =>
                    setDraft({ ...draft, identifier: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="device-id-help" id="device-id-help">
              <Radio size={18} />
              <p>
                <strong>Var hittar jag numret?</strong>
                {kind.help}
              </p>
            </div>
            <p className="muted">
              Ange aldrig WiFi-lösenord, lösenord till tillverkarkonton,
              parkopplingshemligheter eller API-nycklar här.
            </p>
            <div className="device-dialog-actions">
              <Button
                type="button"
                className="secondary"
                onClick={() => {
                  setError("");
                  setStep(1);
                }}
              >
                Byt enhetstyp
              </Button>
              <Button type="submit">Kontrollera uppgifter</Button>
            </div>
          </form>
        )}
        {step === 3 && (
          <>
            <div className="device-review">
              <h3>{draft.name}</h3>
              <dl className="device-facts">
                <div>
                  <dt>Typ</dt>
                  <dd>{kind.shortName}</dd>
                </div>
                <div>
                  <dt>Tillverkare och modell</dt>
                  <dd>
                    {draft.manufacturer} · {draft.model}
                  </dd>
                </div>
                <div>
                  <dt>Serienummer / Enhets-ID</dt>
                  <dd>{draft.identifier}</dd>
                </div>
                <div>
                  <dt>Status efter sparning</dt>
                  <dd>{pendingDeviceStatus}</dd>
                </div>
              </dl>
            </div>
            <div className="device-next-step">
              <ShieldCheck size={20} />
              <div>
                <strong>Nästa steg för anslutning</strong>
                <p>{kind.next}</p>
              </div>
            </div>
            <p className="muted">
              Detta kontrollerar att formuläret är komplett. Numret verifieras
              inte mot tillverkaren. Uppgifterna lagras i den här webbläsaren
              och ingen smart styrning aktiveras.
            </p>
            <div className="device-dialog-actions">
              <Button
                type="button"
                className="secondary"
                onClick={() => {
                  setError("");
                  setStep(2);
                }}
              >
                Ändra uppgifter
              </Button>
              <Button type="button" onClick={save}>
                {editingId ? "Spara ändringar" : "Spara enhet"}
              </Button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
