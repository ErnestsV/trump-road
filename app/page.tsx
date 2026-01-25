import Image from "next/image";
import Link from "next/link";
import SiteHeader from "./components/SiteHeader";

export default function Home() {
  return (
    <div className="sitePage homePage">
      <SiteHeader />

      <main className="homeMain">
        <Link className="homeHeroLink" href="/game">
          <Image
            className="homeHeroImage"
            src="/hp_logo.png"
            alt="Trump Road"
            width={640}
            height={640}
            priority
          />
        </Link>
      </main>
    </div>
  );
}
