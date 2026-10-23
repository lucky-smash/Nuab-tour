import { photo, type Tour } from "@/data";

/** Visual identity per tour: engraving + photograph, chosen by the tour's primary city. */
const CITY_VISUALS: { re: RegExp; engraving: string; photo: string; coord: [number, number]; place: string }[] = [
  { re: /^(\d+ (night|days?) )?.*haridwar|rishikesh/i, engraving: "jhula", photo: "rishikesh-laxman-jhula", coord: [29.9457, 78.1642], place: "HARIDWAR · RISHIKESH / UTTARAKHAND" },
  { re: /jaipur/i, engraving: "hawa-mahal", photo: "jaipur-hawa-mahal", coord: [26.9124, 75.7873], place: "JAIPUR / RAJASTHAN" },
  { re: /^agra/i, engraving: "taj-mahal", photo: "agra-taj-mahal", coord: [27.1751, 78.0421], place: "AGRA / UTTAR PRADESH" },
  { re: /delhi darshan/i, engraving: "india-gate", photo: "delhi-india-gate", coord: [28.6139, 77.209], place: "DELHI / INDIA" },
  { re: /mathura|vrindavan|govardhan|pilgrimage/i, engraving: "temple", photo: "vrindavan-prem-mandir", coord: [27.4924, 77.6737], place: "MATHURA · VRINDAVAN / UTTAR PRADESH" },
];

export function tourVisual(t: Tour) {
  const title = t.title;
  // multi-day packages that include Jaipur or Haridwar take that identity first
  const v = CITY_VISUALS.find((c) => c.re.test(title)) ?? CITY_VISUALS[CITY_VISUALS.length - 1];
  return { ...v, photoData: photo(v.photo) };
}
