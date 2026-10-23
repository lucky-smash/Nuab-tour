import type { Metadata } from "next";
import { privacy } from "@/data";
import { PageHeader } from "@/components/page/Blocks";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: privacy.metaDescription,
  alternates: { canonical: "/privacy-policy/" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHeader crumbs={[{ label: "Privacy Policy" }]} eyebrow={`Last updated ${privacy.lastModified ?? ""}`} title="Privacy Policy" tone="white" />
      <div className="container-x pb-24">
        <div className="prose-atlas" dangerouslySetInnerHTML={{ __html: privacy.html }} />
      </div>
    </>
  );
}
