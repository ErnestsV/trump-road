import Image from "next/image";

type DifficultyKey = "easy" | "medium" | "hard" | "hardcore";

type BottomPanelProps = {
  betInput: string;
  betOptions: number[];
  cashoutDisabled: boolean;
  cashoutLabel: string;
  difficulty: DifficultyKey;
  difficultyOpen: boolean;
  maxBet: number;
  minBet: number;
  playLabel: string;
  roundActive: boolean;
  selectedBet: number;
  onBetChipClick: (bet: number) => void;
  onBetInputBlur: () => void;
  onBetInputChange: (value: string) => void;
  onCashOut: () => void;
  onDifficultyChange: (level: DifficultyKey) => void;
  onMaxClick: () => void;
  onMinClick: () => void;
  onPlay: () => void;
  onToggleDifficulty: () => void;
};

export default function BottomPanel({
  betInput,
  betOptions,
  cashoutDisabled,
  cashoutLabel,
  difficulty,
  difficultyOpen,
  maxBet,
  minBet,
  playLabel,
  roundActive,
  selectedBet,
  onBetChipClick,
  onBetInputBlur,
  onBetInputChange,
  onCashOut,
  onDifficultyChange,
  onMaxClick,
  onMinClick,
  onPlay,
  onToggleDifficulty,
}: BottomPanelProps) {
  // Bet controls: min/max shortcuts, editable input, and preset chips.
  const renderBetSection = () => (
    <div className="panelBlock">
      <div className="minMaxCard">
        <button
          className="minMaxButton"
          type="button"
          onClick={onMinClick}
          disabled={roundActive}
        >
          MIN
        </button>
        <input
          className="minMaxInput"
          type="number"
          min={minBet}
          max={maxBet}
          step="0.01"
          value={betInput}
          onChange={(event) => onBetInputChange(event.target.value)}
          onBlur={onBetInputBlur}
          disabled={roundActive}
        />
        <button
          className="minMaxButton"
          type="button"
          onClick={onMaxClick}
          disabled={roundActive}
        >
          MAX
        </button>
      </div>
      <div className="betRow">
        {betOptions.map((bet) => (
          <button
            key={bet}
            className={`chipButton ${selectedBet === bet ? "active" : ""}`}
            onClick={() => onBetChipClick(bet)}
            disabled={roundActive}
          >
            {bet} $
          </button>
        ))}
      </div>
    </div>
  );

  // Difficulty chooser with optional collapse (mobile) to save space.
  const renderDifficultySection = () => (
    <div className="panelBlock">
      <div className="panelHeader">
        <button
          type="button"
          className="difficultyToggle"
          onClick={onToggleDifficulty}
          aria-expanded={difficultyOpen}
        >
          <h2>Difficulty</h2>
          <Image
            className="chevron"
            src="/chevron.png"
            alt=""
            width={20}
            height={12}
            aria-hidden="true"
          />
        </button>
      </div>
      <div className={`difficultyContent ${difficultyOpen ? "open" : "closed"}`}>
        <div className="difficultyRow">
          {(["easy", "medium", "hard", "hardcore"] as DifficultyKey[]).map(
            (level) => (
              <button
                key={level}
                className={`difficultyButton ${
                  difficulty === level ? "active" : ""
                }`}
                onClick={() => onDifficultyChange(level)}
                disabled={roundActive}
              >
                {level}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );

  // Primary actions: advance the run or cash out.
  const renderActionsSection = () => (
    <div className="panelBlock actions">
      <button className="playButton" onClick={onPlay}>
        {playLabel}
      </button>
      <button
        className="cashoutButton"
        onClick={onCashOut}
        disabled={cashoutDisabled}
      >
        {cashoutLabel}
      </button>
    </div>
  );

  return (
    <section className="bottomPanel">
      {renderBetSection()}
      {renderDifficultySection()}
      {renderActionsSection()}
    </section>
  );
}
