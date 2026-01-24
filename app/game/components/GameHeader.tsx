type GameHeaderProps = {
  title: string;
  balanceLabel: string;
};

export default function GameHeader({ title, balanceLabel }: GameHeaderProps) {
  return (
    <header className="gameHeader">
      <div>
        <h1>{title}</h1>
      </div>
      <div className="balanceTotal">
        <span>Total balance</span>
        <strong>{balanceLabel}</strong>
      </div>
    </header>
  );
}
