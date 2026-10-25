import Link from "next/link";
import { logOut } from "@/app/(auth)/actions";
import { requireBusiness } from "@/lib/business";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/services", label: "Services" },
  { href: "/staff", label: "Team" },
  { href: "/availability", label: "Availability" },
  { href: "/bookings", label: "Bookings" },
  { href: "/settings", label: "Settings" },
] as const;

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const { business, email } = await requireBusiness();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <Link href="/dashboard" className="font-semibold tracking-tight">
                {business.name}
              </Link>
              <p className="truncate text-xs text-muted">{email}</p>
            </div>
            <form action={logOut}>
              <Button type="submit" variant="secondary">
                Log out
              </Button>
            </form>
          </div>
          <nav className="-mb-px flex gap-1 overflow-x-auto">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:border-border hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
