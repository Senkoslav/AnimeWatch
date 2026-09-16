import Link from "next/link";

// Пункты навигации появляются вместе со страницами: typedRoutes не даст сослаться на несуществующую.
export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
        <Link
          href="/"
          className="-mx-2 inline-flex min-h-11 items-center rounded-sm px-2 font-display text-lg font-bold"
        >
          BebraDub
        </Link>
      </div>
    </header>
  );
}
