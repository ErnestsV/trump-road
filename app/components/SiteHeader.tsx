import Image from "next/image";
import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="siteHeader">
      <Link className="logoLink" href="/">
        <Image src="/logo.png" alt="Trump Road logo" width={100} height={100} />
      </Link>
      <nav className="siteNav" aria-label="Primary">
        <Link href="/game">Game</Link>
        <Link href="/instructions">Instructions</Link>
      </nav>
    </header>
  );
}
