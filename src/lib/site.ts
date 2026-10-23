/**
 * Business constants. Every value is taken from the content archive
 * (nuabtourism-site-content.md, §1 Site Overview / §4 Contact Us).
 */
export const SITE = {
  name: "NUAB Tourism",
  legalName: "NUAB Enterprises Pvt. Ltd.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://nuabtourism.in",
  tagline: "Har Safar Mein Aapka Humsafar",
  footerTagline:
    "NUAB Tourism is an experienced tour operator. We work with you to manage all elements of your travel in an efficient, cost effective and ethical manner.",
  founder: "Anil Ahuja",
  accreditation: "IATA registered",
  phones: [
    { display: "+91 93112 29795", tel: "+919311229795" },
    { display: "+91 98211 91795", tel: "+919821191795" },
  ],
  whatsapp: "+919311229795",
  email: "contact.us@nuabtourism.com",
  address: {
    line1: "C-944, Sushant Lok Rd, Block C",
    line2: "Sushant Lok Phase I, Sector 43",
    city: "Gurugram, Haryana 122002",
    full: "C-944, Sushant Lok Rd, Block C, Sushant Lok Phase I, Sector 43, Gurugram, Haryana 122002",
    lat: 28.4595,
    lng: 77.0802,
  },
  mapsUrl: "https://maps.app.goo.gl/SxYTVDJPXF5e1V7j6",
  hours: "Open every day of the year",
  bookingSite: "https://booking.nuabtourism.in",
} as const;

export const whatsappLink = (text: string) => `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`;

export type NavItem = { label: string; href: string; note?: string };
export type NavGroup = { label: string; href?: string; items?: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Day Tours",
    href: "/tours/",
    items: [
      { label: "Agra Same Day Tour by Car", href: "/agra-same-day-tour-by-car/", note: "Taj Mahal · Agra Fort" },
      { label: "Jaipur Same Day Tour by Car", href: "/jaipur-same-day-tour-by-car/", note: "The Pink City" },
      { label: "Mathura Vrindavan Same Day Tour", href: "/mathura-vrindavan-same-day-tour-by-car/", note: "Braj temples" },
      { label: "Delhi Darshan One Day Tour", href: "/delhi-darshan-one-day-tour-by-car/", note: "Capital highlights" },
      { label: "Haridwar & Rishikesh Same Day Tour", href: "/haridwar-and-rishikesh-same-day-tour-by-car/", note: "Ganga Aarti" },
      { label: "Same-day tours by bus", href: "/tours/#bus", note: "Seat-in-coach fares" },
    ],
  },
  {
    label: "Golden Triangle",
    href: "/tours/#multi-day",
    items: [
      { label: "2 Days Mathura Vrindavan", href: "/1-night-2-days-mathura-vrindavan/" },
      { label: "Mathura Vrindavan Agra", href: "/2-night-3-days-agra-mathura/" },
      { label: "Gokul Mathura Vrindavan", href: "/3-days-mathura-vrindavan-tour/" },
      { label: "2 Nights 3 Days Mathura Pilgrimage", href: "/2-night-3-days-mathura-pilgrimage/" },
      { label: "Mathura Govardhan Agra", href: "/3-days-mathura-govardhan-agra/" },
      { label: "Delhi Agra Mathura Vrindavan Haridwar", href: "/6-days-mathura-agra-haridwar-tour/" },
      { label: "Delhi Jaipur Agra Mathura · 6 Days", href: "/6-days-delhi-jaipur-agra-mathura/" },
    ],
  },
  {
    label: "Outstation Cabs",
    items: [
      { label: "Delhi to Himachal Cabs", href: "/delhi-to-himachal-cabs/", note: "Shimla · Manali · Dharamshala" },
      { label: "Delhi to Uttarakhand Cabs", href: "/delhi-to-uttarakhand-cabs/", note: "Dehradun · Nainital · Mussoorie" },
      { label: "Delhi to Vaishno Devi Cabs", href: "/delhi-to-vaishno-devi-cabs/", note: "Jammu · Katra" },
    ],
  },
  {
    label: "International",
    items: [
      { label: "Dubai Packages", href: "/dubai-package/", note: "15 itineraries" },
      { label: "Thailand Packages", href: "/thailand-package/", note: "15 itineraries" },
    ],
  },
  { label: "Destinations", href: "/destinations/" },
  {
    label: "Bike Trips",
    items: [
      { label: "Gallery", href: "/gallery/" },
      { label: "Equipment & Safety Gear", href: "/equipment-safety-gear/" },
      { label: "Road trips from Delhi", href: "/destinations/#road-trips" },
    ],
  },
  { label: "About", href: "/about/" },
];

export const formatINR = (n: number | null | undefined) =>
  n == null ? "" : "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

/** 28.6139 -> 28°37′ N */
export function formatCoord(value: number, axis: "lat" | "lng") {
  const abs = Math.abs(value);
  let deg = Math.floor(abs);
  let min = Math.round((abs - deg) * 60);
  if (min === 60) { deg += 1; min = 0; }
  const hemi = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${deg}°${String(min).padStart(2, "0")}′ ${hemi}`;
}

export const clsx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
