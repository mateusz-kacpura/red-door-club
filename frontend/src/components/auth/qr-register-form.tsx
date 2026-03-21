"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { ApiError } from "@/lib/api-client";

const STEPS = ["Identity", "Business", "Interests", "Preferences", "Consent"];

const INDUSTRIES = [
  "Finance", "Technology", "Real Estate", "Legal", "Consulting",
  "Healthcare", "Manufacturing", "Import/Export",
];
const REVENUE_RANGES = [
  "< ฿10M", "฿10M – ฿50M", "฿50M – ฿200M", "> ฿200M",
];
const INTEREST_OPTIONS = [
  "Real Estate", "Finance", "Tech", "Networking", "Lifestyle", "Events", "Partnerships",
];
const EVENT_FORMATS = ["Dinner", "Mixer", "Workshop", "Private Party"];
const LANGUAGES = ["English", "Thai", "Both"];

export function QRRegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const passId = searchParams.get("pass") ?? "";
  const promoId = searchParams.get("promo") ?? "";
  const tier = searchParams.get("tier") ?? "silver";

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "RedDoor2026!",
    phone: "",
    nationality: "",
    company_name: "",
    job_title: "",
    industry: "",
    revenue_range: "",
    company_size: "",
    interests: [] as string[],
    event_format: "",
    preferred_days: [] as string[],
    language_preference: "English",
    pdpa_consent: false,
    marketing_opt_in: false,
    tos_accepted: false,
  });

  const update = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleInterest = (val: string) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(val)
        ? prev.interests.filter((i) => i !== val)
        : [...prev.interests, val],
    }));
  };

  const canProceed = () => {
    if (step === 1) return form.full_name && form.email;
    if (step === 2) return form.company_name && form.industry;
    if (step === 3) return form.interests.length > 0;
    if (step === 4) return true;
    if (step === 5) return form.pdpa_consent && form.tos_accepted;
    return true;
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError("");
    try {
      await apiClient.post("/auth/register", {
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone,
        company_name: form.company_name,
        industry: form.industry,
        revenue_range: form.revenue_range,
        interests: form.interests,
        pdpa_consent: form.pdpa_consent,
        user_type: "prospect",
        tier: tier || null,
        promo_code: promoId || null,
        tier_grant: tier || null,
      });
      router.push(`/login?registered=true&pass=${passId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Registration failed. Please try again.");
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto px-4">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors
                  ${i + 1 < step ? "bg-primary border-primary text-primary-foreground" : ""}
                  ${i + 1 === step ? "border-primary text-primary" : ""}
                  ${i + 1 > step ? "border-muted text-muted-foreground" : ""}
                `}
              >
                {i + 1 < step ? "✓" : i + 1}
              </div>
              <span className="text-xs mt-1 text-muted-foreground hidden sm:block">{label}</span>
            </div>
          ))}
        </div>
        <div className="w-full bg-muted rounded-full h-1">
          <div
            className="bg-primary h-1 rounded-full transition-all"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-xl">
            Step {step} — {STEPS[step - 1]}
          </CardTitle>
          <CardDescription>
            {step === 1 && "Tell us who you are."}
            {step === 2 && "Tell us about your business."}
            {step === 3 && "What are you interested in?"}
            {step === 4 && "Set your event preferences."}
            {step === 5 && "Almost there — review and consent."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Step 1 — Identity */}
          {step === 1 && (
            <>
              <div className="space-y-1">
                <Label>Full Name *</Label>
                <Input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} placeholder="Your full name" />
              </div>
              <div className="space-y-1">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="email@example.com" />
              </div>
              <div className="space-y-1">
                <Label>Phone (LINE / WhatsApp)</Label>
                <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+66 8x xxx xxxx" />
              </div>
              <div className="space-y-1">
                <Label>Nationality</Label>
                <Input value={form.nationality} onChange={(e) => update("nationality", e.target.value)} placeholder="Thai / British / etc." />
              </div>
            </>
          )}

          {/* Step 2 — Business */}
          {step === 2 && (
            <>
              <div className="space-y-1">
                <Label>Company Name *</Label>
                <Input value={form.company_name} onChange={(e) => update("company_name", e.target.value)} placeholder="Your company" />
              </div>
              <div className="space-y-1">
                <Label>Job Title</Label>
                <Input value={form.job_title} onChange={(e) => update("job_title", e.target.value)} placeholder="CEO / Director / Founder" />
              </div>
              <div className="space-y-1">
                <Label>Industry *</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.industry}
                  onChange={(e) => update("industry", e.target.value)}
                >
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Annual Revenue Range</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.revenue_range}
                  onChange={(e) => update("revenue_range", e.target.value)}
                >
                  <option value="">Select range...</option>
                  {REVENUE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Step 3 — Interests */}
          {step === 3 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Select all that apply *</p>
              <div className="grid grid-cols-2 gap-2">
                {INTEREST_OPTIONS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left
                      ${form.interests.includes(interest)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"}`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4 — Preferences */}
          {step === 4 && (
            <>
              <div className="space-y-2">
                <Label>Preferred Event Format</Label>
                <div className="grid grid-cols-2 gap-2">
                  {EVENT_FORMATS.map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => update("event_format", format)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                        ${form.event_format === format
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"}`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Language Preference</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.language_preference}
                  onChange={(e) => update("language_preference", e.target.value)}
                >
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Step 5 — Consent */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4 bg-muted/30">
                <p className="text-sm font-medium mb-1">Summary</p>
                <p className="text-sm text-muted-foreground">{form.full_name} · {form.email}</p>
                <p className="text-sm text-muted-foreground">{form.company_name} · {form.industry}</p>
                <p className="text-sm text-muted-foreground">Interests: {form.interests.join(", ")}</p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.pdpa_consent}
                  onChange={(e) => update("pdpa_consent", e.target.checked)}
                />
                <span className="text-sm">
                  I consent to the collection and processing of my personal data under Thailand&apos;s PDPA (B.E. 2562). *
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.tos_accepted}
                  onChange={(e) => update("tos_accepted", e.target.checked)}
                />
                <span className="text-sm">I agree to the Terms of Service and Club Rules. *</span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.marketing_opt_in}
                  onChange={(e) => update("marketing_opt_in", e.target.checked)}
                />
                <span className="text-sm text-muted-foreground">
                  I&apos;d like to receive event updates and club news via email / LINE.
                </span>
              </label>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-between pt-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <div className="ml-auto">
              {step < 5 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={!canProceed() || isLoading}>
                  {isLoading ? "Submitting..." : "Complete Registration"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground mt-4">
        S8LLS Private Business Club — Bangkok
      </p>
    </div>
  );
}
