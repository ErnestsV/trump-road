import Image from "next/image";
import Link from "next/link";

type GameHeaderProps = {
  balanceLabel: string;
};

export default function GameHeader({ balanceLabel }: GameHeaderProps) {
  return (
    <header className="gameHeader">
       <Link className="logoLink" href="/">
        <Image src="/logo.png" alt="Trump Road logo" width={100} height={100} />
      </Link>
      <div className="balanceTotal">
        <span>Total balance</span>
        <strong>{balanceLabel}</strong>
      </div>
    </header>
  );
}
