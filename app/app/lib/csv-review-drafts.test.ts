import { describe, it, expect } from 'vitest';
import { ReviewDrafts } from './csv-review-drafts';
describe('selected review draft event sequences', () => {
  it.each(['note:e1', 'manual'])('preserves dirty %s across external revision', key => {
    const d = new ReviewDrafts(); d.select('a'); d.edit(key, 'human draft');
    expect(d.receive(d.epoch, () => {})).toBe(false);
    expect(d.values.get(key)).toBe('human draft'); expect(d.stale).toBe(true);
  });
  it('saving one of two dirty cards clears only exact submitted text', () => {
    const d = new ReviewDrafts(); d.select('a'); d.edit('note:1','one'); d.edit('note:2','two');
    d.edit('manual','proposal'); d.submitted('note:1','one');
    expect([...d.values]).toEqual([['note:2','two'],['manual','proposal']]);
    expect(d.receive(d.epoch, () => {})).toBe(false);
    d.edit('note:2','edited during save'); d.submitted('note:2','two');
    expect(d.values.get('note:2')).toBe('edited during save');
  });
  it('conflict fresh read preserves draft until explicit discard', () => {
    const d = new ReviewDrafts(); d.select('a'); d.edit('note:1','correction');
    expect(d.receive(d.epoch, () => {})).toBe(false); expect(d.stale).toBe(true);
    d.discard(); expect(d.receive(d.epoch, () => {})).toBe(true); expect(d.dirty).toBe(false);
  });
  it('late reopen after editing cannot replace selected state', () => {
    const d = new ReviewDrafts(); d.select('a'); const started = d.epoch;
    d.edit('manual','late edit'); expect(d.receive(started, () => {})).toBe(false);
  });
  it('switch review never leaks drafts', () => {
    const d = new ReviewDrafts(); d.select('a'); d.edit('note:1','a only');
    d.select('b'); expect(d.values.size).toBe(0); expect(d.reviewId).toBe('b');
  });
});


describe('fresh persisted display recovery transition used by Home', () => {
  it.each([false, true])('discarding text cannot release recovery before a persisted read (dirty=%s)', async dirty => {
    const d = new ReviewDrafts(); d.select('a');
    if (dirty) d.edit('note:1', 'discard explicitly');
    d.recover();
    // Validate sources calls this same method, then inspects CSV headers only.
    d.discard();
    expect(d.dirty).toBe(false);
    expect(d.reviewId).toBe('a');
    expect(d.stale).toBe(true);
    await expect(d.read(() => true, async () => { throw Error('read unavailable'); },
      () => {})).rejects.toThrow('read unavailable');
    expect(d.stale).toBe(true);
    expect(await d.read(() => true, async () => ({ id: 'a', revision: 2 }),
      saved => d.select(saved.id))).toBe(true);
    expect(d.stale).toBe(false);
  });
  it.each([1, 2])('no-dirty failed save then fresh same-review revision %s clears stale and enables writes', async revision => {
    const d = new ReviewDrafts(); d.select('a');
    let displayed = { id: 'a', revision: 1 };
    d.recover(); // Both human and proposal mutation catches use this before readback.
    expect(d.dirty).toBe(false); expect(d.stale).toBe(true);
    const saved = { id: 'a', revision };
    expect(await d.read(() => true, async () => saved, fresh => { d.select(fresh.id); displayed = fresh; })).toBe(true);
    expect(displayed).toEqual(saved); expect(d.stale).toBe(false);
    expect(d.dirty).toBe(false); // Home uses stale for both write disabling and banner.
  });
  it('failed fresh read retains visible recovery without displaying or replaying', async () => {
    const d = new ReviewDrafts(); d.select('a');
    let displays = 0, loads = 0;
    d.recover();
    await expect(d.read(() => true, async () => { loads++; throw Error('read failed'); },
      () => { displays++; })).rejects.toThrow('read failed');
    expect(loads).toBe(1); expect(displays).toBe(0);
    expect(d.stale).toBe(true); expect(d.dirty).toBe(false);
    await expect(d.read(() => true, async () => ({}),
      () => { throw Error('Saved source provenance unavailable'); }))
      .rejects.toThrow('Saved source provenance unavailable');
    expect(d.stale).toBe(true);
  });
  it('obsolete read cannot display or affect another selected review', async () => {
    const d = new ReviewDrafts(); d.select('a');
    let displayed = false;
    await d.read(() => false, async () => { d.select('b'); return {}; },
      () => { displayed = true; });
    expect(displayed).toBe(false); expect(d.reviewId).toBe('b'); expect(d.stale).toBe(false);
  });
  it.each(['note:e1', 'manual'])('dirty fresh read blocks display and retains %s plus recovery', async key => {
    const d = new ReviewDrafts(); d.select('a'); d.edit(key, 'keep me'); d.recover();
    let displays = 0;
    expect(await d.read(() => true, async () => ({ id: 'b' }), saved => { displays++; d.select(saved.id); })).toBe(false);
    expect(displays).toBe(0); expect(d.reviewId).toBe('a');
    expect(d.values.get(key)).toBe('keep me'); expect(d.stale).toBe(true);
    d.discard();
    expect(await d.read(() => true, async () => ({ id: 'b' }), saved => { displays++; d.select(saved.id); })).toBe(true);
    expect(displays).toBe(1); expect(d.reviewId).toBe('b');
    expect(d.values.size).toBe(0); expect(d.stale).toBe(false);
  });
  it('late edit then submit clearing cannot bypass the epoch guard', () => {
    const d = new ReviewDrafts(); d.select('a'); const started = d.epoch;
    d.edit('note:1', 'late'); d.submitted('note:1', 'late');
    expect(d.dirty).toBe(false);
    let displayed = false;
    expect(d.receive(started, () => { displayed = true; })).toBe(false);
    expect(displayed).toBe(false); expect(d.stale).toBe(true);
  });
});
