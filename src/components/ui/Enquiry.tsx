"use client";

/**
 * "Speak to a Travel Consultant" enquiry dialog.
 *
 * DRAFT (per client decision): this form is a fully designed, interactive *visual* prototype.
 * Submitting validates the fields and shows the confirmation state, but nothing is sent anywhere.
 * Backend hook: replace `fakeSubmit` with a POST to the chosen form service.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Check, Phone, X } from "lucide-react";
import { SITE } from "@/lib/site";
import { CompassMark } from "@/components/layout/Wordmark";

type Ctx = { openEnquiry: (subject?: string) => void };
const EnquiryContext = createContext<Ctx>({ openEnquiry: () => {} });
export const useEnquiry = () => useContext(EnquiryContext);

export function EnquiryProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [subject, setSubject] = useState<string | undefined>();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  const openEnquiry = useCallback((s?: string) => {
    setSubject(s);
    setState("idle");
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onClick = (e: MouseEvent) => { if (e.target === d) d.close(); };
    d.addEventListener("click", onClick);
    return () => d.removeEventListener("click", onClick);
  }, []);

  async function fakeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    setState("sending");
    await new Promise((r) => setTimeout(r, 700));
    setState("sent");
  }

  return (
    <EnquiryContext.Provider value={{ openEnquiry }}>
      {children}
      <dialog
        ref={ref}
        aria-labelledby="enquiry-title"
        className="m-auto w-[min(44rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white p-0 text-ink shadow-[0_40px_80px_-30px_rgb(24_42_59/.5)] backdrop:bg-navy/40 backdrop:backdrop-blur-[2px]"
      >
        <div className="grid md:grid-cols-[1fr_1.35fr]">
          <aside className="relative hidden overflow-hidden bg-mist p-8 md:block">
            <CompassMark className="absolute -right-10 -bottom-10 size-56 text-navy/10" />
            <p className="eyebrow">Speak to a travel consultant</p>
            <p className="mt-4 font-display text-3xl leading-tight text-navy">How can we help you travel?</p>
            <p className="mt-4 text-sm text-muted">Fixed pricing, verified drivers and a phone that gets answered after the booking is done.</p>
            <div className="mt-8 space-y-2 text-sm">
              {SITE.phones.map((p) => (
                <a key={p.tel} href={`tel:${p.tel}`} className="flex items-center gap-2 font-semibold text-navy"><Phone className="size-4" aria-hidden /> {p.display}</a>
              ))}
              <a href={`mailto:${SITE.email}`} className="block break-all text-muted">{SITE.email}</a>
            </div>
          </aside>
          <div className="relative p-6 sm:p-8">
            <button type="button" onClick={() => ref.current?.close()} className="absolute right-3 top-3 inline-flex size-10 items-center justify-center text-muted hover:text-navy" aria-label="Close enquiry form">
              <X className="size-5" />
            </button>
            {state === "sent" ? (
              <div className="flex min-h-[22rem] flex-col items-start justify-center" role="status">
                <span className="inline-flex size-12 items-center justify-center rounded-full border border-navy text-navy"><Check className="size-6" /></span>
                <h2 id="enquiry-title" className="mt-6 text-3xl">Thank you.</h2>
                <p className="mt-3 text-muted">Thank you for your submission! We have received your details and will get back to you shortly.</p>
                <p className="mt-6 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-stone">Preview build · form not yet connected</p>
                <button type="button" className="btn btn-ghost mt-8" onClick={() => ref.current?.close()}>Continue exploring</button>
              </div>
            ) : (
              <form onSubmit={fakeSubmit} noValidate={false} className="space-y-5">
                <div>
                  <p className="eyebrow md:hidden">Speak to a travel consultant</p>
                  <h2 id="enquiry-title" className="mt-1 text-3xl md:mt-0">Plan your journey</h2>
                  {subject && <p className="mt-2 text-sm text-muted">Regarding: <span className="font-semibold text-navy">{subject}</span></p>}
                </div>
                <Field label="Name" name="name" autoComplete="name" required />
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Email" name="email" type="email" autoComplete="email" required />
                  <Field label="Phone number" name="phone" type="tel" autoComplete="tel" required pattern="[0-9+\s\-]{8,}" />
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-[0.8rem] font-semibold text-ink">Message</span>
                  <textarea name="message" rows={4} defaultValue={subject ? `I would like to know more about: ${subject}` : ""} className="w-full resize-y border border-line bg-white px-3 py-2.5 text-[0.95rem] outline-none transition-colors focus:border-navy" />
                </label>
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <button type="submit" className="btn btn-primary" disabled={state === "sending"}>
                    {state === "sending" ? "Sending…" : "Submit enquiry"}
                  </button>
                  <span className="text-xs text-muted">We reply by phone or email, every day of the year.</span>
                </div>
              </form>
            )}
          </div>
        </div>
      </dialog>
    </EnquiryContext.Provider>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.8rem] font-semibold text-ink">
        {label} {props.required && <span className="text-stone" aria-hidden>*</span>}
      </span>
      <input
        {...props}
        className="peer h-11 w-full border border-line bg-white px-3 text-[0.95rem] outline-none transition-colors focus:border-navy user-invalid:border-[#a54b3c]"
      />
      <span className="mt-1 hidden text-xs text-[#a54b3c] peer-user-invalid:block">Please enter a valid {label.toLowerCase()}.</span>
    </label>
  );
}

/** Button that opens the enquiry dialog (usable from server components). */
export function EnquireButton({ subject, className, children }: { subject?: string; className?: string; children?: React.ReactNode }) {
  const { openEnquiry } = useEnquiry();
  return (
    <button type="button" className={className ?? "btn btn-ghost"} onClick={() => openEnquiry(subject)}>
      {children ?? "Enquire now"}
    </button>
  );
}
