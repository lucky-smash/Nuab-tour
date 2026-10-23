import type { Metadata } from "next";
import { equipment } from "@/data";
import { PageHeader, Section } from "@/components/page/Blocks";

export const metadata: Metadata = {
  title: "Equipment & Safety Gear — Bike Trips",
  description: "Motorcycles and riding safety gear available on NUAB Tourism bike trips.",
  alternates: { canonical: "/equipment-safety-gear/" },
};

export default function EquipmentPage() {
  return (
    <>
      <PageHeader crumbs={[{ label: "Bike trips" }, { label: "Equipment & Safety Gear" }]} eyebrow="Bike trips" title="Equipment & safety gear." lede="The motorcycles and riding gear listed for NUAB bike trips." engraving="himalaya" />
      {equipment.groups.map((g, gi) => (
        <Section key={g.title} tone={gi % 2 ? "mist" : "white"} eyebrow={`${g.items.length} items`} title={g.title}>
          <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-4">
            {g.items.map((it) => (
              <li key={it.image} className="bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.image} alt={it.caption} loading="lazy" className="aspect-square w-full object-contain" />
                <p className="mt-3 text-[0.85rem] font-semibold text-navy">{it.caption}</p>
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </>
  );
}
