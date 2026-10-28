/** In-memory, selected-review-only drafts. Never persisted or replayed as writes. */
export class ReviewDrafts {
  reviewId = '';
  values = new Map<string, string>();
  epoch = 0;
  stale = false;
  get dirty() { return this.values.size > 0; }
  select(id: string) {
    if (id !== this.reviewId) { this.values.clear(); this.stale = false; this.reviewId = id; this.epoch++; }
  }
  edit(key: string, value: string) { this.values.set(key, value); this.epoch++; }
  submitted(key: string, value: string) {
    if (this.values.get(key) === value) this.values.delete(key);
  }
  /** Visible recovery and write blocking share one latch, even if readback fails. */
  recover() { this.stale = true; }
  async read<T>(current: () => boolean, load: () => Promise<T>, display: (saved: T) => void) {
    const started = this.epoch;
    try {
      const saved = await load();
      return current() && this.receive(started, () => display(saved));
    } catch (error) {
      if (current()) this.recover();
      throw error;
    }
  }
  receive(started: number, display: () => void) {
    // Home owns request identity through generation/current. A requested id here
    // cannot enforce selection identity because explicit navigation may change it.
    if (this.dirty || started !== this.epoch) {
      this.recover();
      return false;
    }
    // Validation/display failure must never clear recovery.
    this.recover();
    display();
    this.stale = false;
    return true;
  }
  // Discarding text (including Validate sources) does not refresh saved evidence.
  // Only accepted persisted display or leaving this review releases recovery.
  discard() { this.values.clear(); this.epoch++; }
}
