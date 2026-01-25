import SiteHeader from "../components/SiteHeader";

export default function InstructionsPage() {
  return (
    <div className="sitePage instructionsPage">
      <SiteHeader />

      <main className="instructionsMain">
        <h1>How to Play</h1>
        <p>
          Press Go to move forward one road at a time. Each manhole shows the
          multiplier for that step. Cash out any time to lock in the payout.
        </p>
        <p>
          If you get shot down, the run ends and resets after a short delay.
          Choose difficulty and bet amount before you start.
        </p>
      </main>
    </div>
  );
}
