import Link from "next/link";
import { setStaffActive } from "@/app/(dashboard)/staff/actions";
import { StaffForm } from "./staff-form";
import { SubmitButton } from "@/components/ui/button";
import type { Staff } from "@/lib/types";

export function StaffRow({ member, editing }: { member: Staff; editing: boolean }) {
  if (editing) {
    return (
      <li className="rounded-xl border border-brand p-5">
        <StaffForm member={member} />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{member.name}</h3>
          {!member.active && (
            <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
              Inactive
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-muted">{member.email ?? "No email"}</p>
      </div>
      <div className="flex gap-2">
        <Link
          href={`/staff?edit=${member.id}`}
          className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface"
        >
          Edit
        </Link>
        <form action={setStaffActive}>
          <input type="hidden" name="id" value={member.id} />
          <input type="hidden" name="active" value={String(!member.active)} />
          <SubmitButton variant={member.active ? "danger" : "secondary"}>
            {member.active ? "Deactivate" : "Reactivate"}
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
