import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            BookFlow
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-20">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
