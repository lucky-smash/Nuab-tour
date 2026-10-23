import { notFound } from "next/navigation";
import Sheet from "./Sheet";

export const metadata = { robots: { index: false } };

// Dev-only route: renders the 3D atlas ground texture for review; 404 in production.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Sheet />;
}
