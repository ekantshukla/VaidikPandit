import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { I18nService } from '../../core/services/i18n.service';
import { SAMAGRI } from '../../core/data/samagri';

/** Puja samagri checklists: tick items off while shopping, share the list on WhatsApp. Ticks stay on this device. */
@Component({
  selector: 'vp-samagri',
  standalone: true,
  template: `
  <div class="wrap page">
    <header class="page-head">
      <h1>{{ i18n.t('samagriTitle') }}</h1>
      <p>{{ i18n.t('samagriIntro') }}</p>
    </header>
    <div class="tabs" role="tablist">
      @for (p of list; track p.id) {
        <button type="button" role="tab" [class.on]="p.id === cur().id" [attr.aria-selected]="p.id === cur().id" (click)="pick(p.id)">{{ hi() ? p.hi : p.en }}</button>
      }
    </div>

    <section class="panel box">
      <header class="bh">
        <div>
          <h2>{{ hi() ? cur().hi : cur().en }}</h2>
          <p class="muted">{{ hi() ? cur().whenHi : cur().when }}</p>
        </div>
        <span class="done num">{{ doneCount() }} / {{ cur().items.length }}</span>
      </header>
      <ul class="items">
        @for (it of cur().items; track it[1]; let i = $index) {
          <li>
            <label [class.ok]="isDone(i)">
              <input type="checkbox" [checked]="isDone(i)" (change)="toggle(i)">
              <span class="t"><b>{{ hi() ? it[0] : it[1] }}</b>@if (it[2]) {<small> · {{ it[2] }}</small>}
                <small class="alt">{{ hi() ? it[1] : it[0] }}</small></span>
            </label>
          </li>
        }
      </ul>
      <div class="acts">
        <a class="btn" [href]="waLink()" target="_blank" rel="noopener">{{ i18n.t('shareWhatsApp') }}</a>
        <button type="button" class="btn ghost" (click)="copy()">{{ copied() ? i18n.t('dakCopied') : i18n.t('copyList') }}</button>
        <button type="button" class="btn quiet" (click)="clear()">{{ i18n.t('clearTicks') }}</button>
      </div>
      <p class="note faint">{{ i18n.t('samagriNote') }}</p>
    </section>
  </div>`,
  styles: [`
    .tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 14px; }
    .tabs button { flex: none; border: 1.5px solid var(--line); background: var(--card); color: var(--ink); border-radius: 999px; padding: 8px 14px; font: inherit; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .tabs button.on { background: var(--ink); border-color: var(--ink); color: #fff; }
    .box { max-width: 760px; }
    .bh { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .bh h2 { margin: 0; }
    .bh p { margin: 2px 0 0; }
    .done { background: var(--tulsi-soft); color: var(--tulsi); font-weight: 700; border-radius: 999px; padding: 4px 12px; flex: none; }
    .items { list-style: none; margin: 14px 0 0; padding: 0; border-top: 1px solid var(--line); }
    .items li { border-bottom: 1px solid var(--line); }
    .items label { display: flex; gap: 12px; align-items: flex-start; padding: 11px 2px; cursor: pointer; }
    .items input { width: 20px; height: 20px; margin-top: 3px; accent-color: var(--tulsi); flex: none; }
    .t { display: flex; flex-direction: column; }
    .t b { font-weight: 600; color: var(--ink); }
    .t small { color: var(--muted); font-weight: 400; }
    .t .alt { color: var(--faint); font-size: .8rem; }
    .ok .t b { text-decoration: line-through; color: var(--faint); }
    .acts { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
    .acts a.btn { text-decoration: none; }
    .note { font-size: .8rem; margin: 12px 0 0; }
  `],
})
export class SamagriComponent {
  readonly i18n = inject(I18nService);
  readonly list = SAMAGRI;
  readonly hi = computed(() => this.i18n.prefersDevanagari());
  private route = inject(ActivatedRoute);
  /** ?p=<id> opens that list directly (linked from Puja Paddhati). */
  readonly curId = signal(SAMAGRI.some(x => x.id === this.route.snapshot.queryParamMap.get('p')) ? this.route.snapshot.queryParamMap.get('p')! : SAMAGRI[0].id);
  readonly cur = computed(() => SAMAGRI.find(p => p.id === this.curId()) ?? SAMAGRI[0]);
  readonly ticks = signal<Record<string, number[]>>(this.load());
  readonly copied = signal(false);
  readonly doneCount = computed(() => (this.ticks()[this.cur().id] ?? []).length);

  private load(): Record<string, number[]> {
    try { return JSON.parse(localStorage.getItem('vp.samagri') || '{}'); } catch { return {}; }
  }
  private save() { try { localStorage.setItem('vp.samagri', JSON.stringify(this.ticks())); } catch { /* ignore */ } }

  pick(id: string) { this.curId.set(id); }
  isDone(i: number) { return (this.ticks()[this.cur().id] ?? []).includes(i); }
  toggle(i: number) {
    const id = this.cur().id, cur = this.ticks()[id] ?? [];
    this.ticks.update(t => ({ ...t, [id]: cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i] }));
    this.save();
  }
  clear() { this.ticks.update(t => ({ ...t, [this.cur().id]: [] })); this.save(); }

  private text() {
    const p = this.cur(), hi = this.hi();
    const lines = p.items.map((it, i) => `${this.isDone(i) ? '✅' : '⬜'} ${hi ? it[0] : it[1]}${it[2] ? ' (' + it[2] + ')' : ''}`);
    return `🪔 ${hi ? p.hi : p.en} — ${hi ? 'पूजा सामग्री' : 'puja samagri'}\n\n${lines.join('\n')}\n\n— Vaidik Pandit`;
  }
  waLink() { return 'https://wa.me/?text=' + encodeURIComponent(this.text()); }
  async copy() {
    try { await navigator.clipboard.writeText(this.text()); this.copied.set(true); setTimeout(() => this.copied.set(false), 1800); } catch { /* ignore */ }
  }
}
