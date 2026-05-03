export class Scorer {
  constructor() {
    this.reset();
  }

  reset() {
    this.decisions = 0;
    this.correct = 0;
    this.streak = 0;
    this.bestStreak = 0;
  }

  get wrong() { return this.decisions - this.correct; }

  get accuracy() {
    return this.decisions === 0 ? null : Math.round((this.correct / this.decisions) * 100);
  }

  record(isCorrect) {
    this.decisions++;
    if (isCorrect) {
      this.correct++;
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    } else {
      this.streak = 0;
    }
    return isCorrect;
  }
}
