import type { Metadata } from "next";
import { requireBusiness } from "@/lib/business";
import { SettingsForm } from "@/components/dashboard/settings-form";

export const metadata: Metadata = { title: "Settings — BookFlow" };

export default async function SettingsPage() {
  const { business } = await requireBusiness();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-muted">
          Your booking page lives at{" "}
          <span className="font-mono text-brand">/book/{business.slug}</span>.
        </p>
      </div>
      <SettingsForm business={business} />
      <p className="max-w-lg text-sm text-muted">
        Setting a deposit above zero changes how bookings are taken: the
        appointment is held as pending while the customer pays, and only
        becomes confirmed when the payment provider&apos;s webhook arrives. A
        hold that isn&apos;t paid within 15 minutes releases the slot.
      </p>
    </div>
  );
}
