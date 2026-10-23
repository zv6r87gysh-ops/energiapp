"use client";
import { useEffect, useRef, useState } from "react";
import {
  Car,
  Flame,
  Pause,
  Play,
  Settings2,
  ShieldCheck,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  type SmartControl,
  type SmartCategory,
  smartControlSchema,
} from "@/lib/smart-control";
const categories = [
  {
    id: "pool",
    name: "Pool",
    icon: Waves,
    available: true,
    description: "Poolens smartläge och temperaturmål i demonstrationen.",
    status: "Demo tillgänglig",
  },
  {
    id: "charging",
    name: "Billaddare",
    icon: Car,
    available: true,
    description:
      "Laddplanering med vald sluttid, maxpris och manuellt energibehov.",
    status: "Demo tillgänglig",
  },
  {
    id: "heating",
    name: "Golvvärme",
    icon: Flame,
    available: false,
    description:
      "Thermotech EC8 är inte ansluten. Kompatibilitet och säker drift måste verifieras först.",
    status: "Ej tillgänglig",
  },
  {
    id: "other",
    name: "Övriga enheter",
    icon: Zap,
    available: false,
    description:
      "Fler kategorier kan aktiveras när en integration finns och har verifierats.",
    status: "Kommer senare",
  },
] as const;
const names: Record<SmartCategory, string> = {
  pool: "Pool",
  charging: "Billaddare",
};
export function SmartControlPanel({
  control,
  onChange,
  compact = false,
}: {
  compact?: boolean;
  control: SmartControl;
  onChange: (control: SmartControl) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SmartCategory[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function configure() {
    setSelected([...control.categories]);
    setOpen(true);
  }
  function save() {
    const result = smartControlSchema.safeParse({
      mode: "demo",
      enabled: true,
      categories: selected,
      updatedAt: new Date().toISOString(),
    });
    if (!result.success) return;
    onChange(result.data);
    close();
  }
  function disable() {
    onChange({
      mode: "demo",
      enabled: false,
      categories: [],
      updatedAt: new Date().toISOString(),
    });
    close();
  }
  return (
    <>
      <section
        className={`card smart-home ${control.enabled ? "smart-home-active" : ""} ${compact ? "smart-home-compact" : ""}`}
        aria-label="Husets smarta styrning"
      >
        <div className="smart-home-icon">
          <Zap size={23} />
        </div>
        <div className="smart-home-copy">
          <div className="smart-home-title">
            <h2>Smart styrning</h2>
            <span className="badge">
              {control.enabled
                ? "Demo aktiv"
                : control.categories.length
                  ? "Demo pausad"
                  : "Av"}
            </span>
          </div>
          <p>
            {control.enabled
              ? `Valda kategorier: ${control.categories.map((c) => names[c]).join(" och ")}.`
              : control.categories.length
                ? "Dina kategorier är sparade. Återuppta när du vill."
                : "Välj vilka delar av hemmet du vill optimera."}{" "}
            <span>Endast simulering · inga enheter styrs.</span>
          </p>
        </div>
        <div className="smart-home-actions">
          {control.enabled && (
            <Button
              className="secondary"
              onClick={() =>
                onChange({
                  ...control,
                  enabled: false,
                  updatedAt: new Date().toISOString(),
                })
              }
            >
              <Pause size={15} />
              Pausa alla
            </Button>
          )}
          <Button ref={trigger} onClick={configure} aria-haspopup="dialog">
            {control.enabled ? <Settings2 size={16} /> : <Play size={16} />}
            {control.enabled
              ? "Ändra smart styrning"
              : control.categories.length
                ? "Återuppta smart styrning"
                : "Aktivera smart styrning"}
          </Button>
        </div>
      </section>
      <dialog
        ref={dialog}
        className="modal smart-dialog"
        aria-labelledby="smart-control-title"
        aria-describedby="smart-control-description"
        onCancel={close}
        onClose={() => {
          if (open) close();
        }}
        onClick={(e) => {
          if (e.target === dialog.current) {
            const rect = dialog.current.getBoundingClientRect();
            if (
              e.clientX < rect.left ||
              e.clientX > rect.right ||
              e.clientY < rect.top ||
              e.clientY > rect.bottom
            )
              close();
          }
        }}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">ETT SMARTARE HEM · DEMO</span>
            <h2 id="smart-control-title">Vad vill du optimera?</h2>
          </div>
          <button
            type="button"
            aria-label="Stäng smart styrning"
            onClick={close}
          >
            <X size={21} />
          </button>
        </div>
        <p id="smart-control-description" className="muted">
          Välj kategorier för det här hushållet. Du kan ändra eller pausa dem
          när som helst. Valen sparas i den här webbläsaren.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <fieldset className="smart-categories">
            <legend className="sr-only">Kategorier för smart styrning</legend>
            {categories.map((category) => {
              const Icon = category.icon;
              const available = category.available;
              const checked =
                available && selected.includes(category.id as SmartCategory);
              return (
                <label
                  key={category.id}
                  className={`smart-category ${checked ? "checked" : ""} ${!available ? "unavailable" : ""}`}
                >
                  <span className="smart-category-icon">
                    <Icon size={23} />
                  </span>
                  <span className="smart-category-copy">
                    <strong>{category.name}</strong>
                    <small>{category.description}</small>
                    <span className={`badge ${available ? "" : "neutral"}`}>
                      {category.status}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    aria-label={category.name}
                    checked={checked}
                    disabled={!available}
                    onChange={(e) => {
                      if (!available) return;
                      const id = category.id as SmartCategory;
                      setSelected((list) =>
                        e.target.checked
                          ? [...list, id]
                          : list.filter((c) => c !== id),
                      );
                    }}
                  />
                </label>
              );
            })}
          </fieldset>
          <div className="smart-demo-note">
            <ShieldCheck size={19} />
            <p>
              Detta aktiverar bara demonstrationen. Ingen utrustning startas
              eller stoppas, och besparingarna är modellerade.
            </p>
          </div>
          <p className="muted">
            {selected.length
              ? `${selected.length} ${selected.length === 1 ? "kategori vald" : "kategorier valda"}`
              : "Välj minst en tillgänglig kategori för att fortsätta."}
          </p>
          <div className="smart-dialog-actions">
            <Button type="button" className="secondary" onClick={close}>
              Avbryt
            </Button>
            {(control.enabled || control.categories.length > 0) && (
              <Button type="button" className="subtle" onClick={disable}>
                Stäng av och rensa val
              </Button>
            )}
            <Button type="submit" disabled={!selected.length}>
              {control.enabled ? "Spara ändringar" : "Aktivera simulering"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
