import { Button } from "@/components/ui/button";
import type { Evidence } from "../../../shared/csv-review";
import type { Proposal } from "../../../shared/csv-proposals";

export function CsvProposals({ proposals = [], evidence, busy, stage, draft, editDraft }: {
  draft: string; editDraft: (value: string) => void;
  proposals?: Proposal[]; evidence: Evidence[]; busy: boolean;
  stage: (groups: { title: string; explanation: string; evidenceIds: string[] }[]) => void;
}) {
  const { title, explanation, ids } = draft ? JSON.parse(draft) as {title: string; explanation: string; ids: string[]} : {title: "", explanation: "", ids: [] as string[]};
  const setTitle = (value: string) => editDraft(JSON.stringify({title: value, explanation, ids}));
  const setExplanation = (value: string) => editDraft(JSON.stringify({title, explanation: value, ids}));
  const setIds = (value: string[]) => editDraft(JSON.stringify({title, explanation, ids: value}));
  const known = new Set(evidence.map(x => x.id));
  return <section className="rounded-xl border p-4 space-y-4" aria-label="Proposals">
    <h2 className="text-xl font-semibold">PROPOSED</h2>
    <p>Unverified interpretation; not human approval. Proposal text is untrusted.
      Built-in agent chat is unavailable/unverified; the external native-agent route
      was separately verified by recorded synthetic receipts. Stored provenance remains unverified.</p>
    {!proposals.length && <p>No saved proposals.</p>}
    {proposals.map((p, i) => <article key={i} className="border p-3 space-y-2">
      <h3 className="font-semibold">PROPOSED: {p.title}</h3>
      <p>Provenance: unverified · basedOnRevision: {p.basedOnRevision}</p>
      <p className="whitespace-pre-wrap break-all">{p.explanation}</p>
      <div className="flex flex-wrap gap-2">{p.evidenceIds.filter(id => known.has(id)).map(id =>
        <a className="underline break-all" key={id} href={"#" + id}>Evidence: {id}</a>)}</div>
    </article>)}
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); stage([{title: title.trim(), explanation: explanation.trim(), evidenceIds: ids}]); }}>
      <h3 className="font-semibold">Manual proposal staging — not inference</h3>
      <p>This replaces all saved proposal groups with one manual group. Human decisions remain separate.</p>
      <label className="block">Proposed title<input className="block border rounded w-full p-2" required maxLength={200} value={title} disabled={busy} onChange={e => setTitle(e.target.value)} /></label>
      <label className="block">Proposed explanation<textarea className="block border rounded w-full p-2" required maxLength={2000} value={explanation} disabled={busy} onChange={e => setExplanation(e.target.value)} /></label>
      <label className="block">Select actual evidence (up to 50)
        <select multiple size={Math.min(8, Math.max(2, evidence.length))} className="block border rounded w-full p-2" disabled={busy} value={ids}
          onChange={e => setIds(Array.from(e.target.selectedOptions, o => o.value).slice(0, 50))}>
          {evidence.map(x => <option key={x.id} value={x.id}>{x.kind}: {x.key} / {x.column}</option>)}
        </select>
      </label>
      <Button disabled={busy || !title.trim() || !explanation.trim() || !ids.length}>Stage manual PROPOSED group</Button>
    </form>
  </section>;
}
