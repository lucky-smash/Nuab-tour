import { notFound } from "next/navigation";
import Preview from "./Preview";

export const metadata = { robots: { index: false } };

// Dev-only route (renders the fallback still via scripts/capture-aircraft.mjs); 404 in production.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Preview />;
}
