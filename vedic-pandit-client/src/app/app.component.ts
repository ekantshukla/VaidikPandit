import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { I18nService, LANGS } from './core/services/i18n.service';
import { ApiService } from './core/services/api.service';
import { PlacePickerComponent } from './shared/place-picker.component';
import { ChatPanelComponent } from './shared/chat-panel.component';
import { GetAppComponent } from './shared/get-app.component';
import { NativeService } from './core/services/native.service';
import { BotAvatarComponent } from './shared/bot-avatar.component';
import { AccountService } from './core/services/account.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PlacePickerComponent, ChatPanelComponent, GetAppComponent, BotAvatarComponent],
  template: `
  <a class="skip" href="#main">Skip to content</a>
  <header class="top">
    <div class="wrap bar">
      <a routerLink="/" class="brand" aria-label="Vaidik Pandit home">
        <img class="logo" src="logo.svg" alt="" width="56" height="56">
        <span class="names"><span class="mark sa">वैदिक पंडित</span><span class="latin">Vaidik Pandit</span></span>
      </a>
      <nav class="desk" aria-label="Main">
        <a routerLink="/panchang" routerLinkActive="on">{{ i18n.t('nav.panchang') }}</a>
        <a routerLink="/rashifal" routerLinkActive="on">{{ i18n.t('nav.rashifal') }}</a>
        <a routerLink="/muhurat" routerLinkActive="on">{{ i18n.t('nav.muhurat') }}</a>
        <a routerLink="/learn" [class.on]="inMantra()">{{ i18n.t('nav.mantra') }}</a>
        <a routerLink="/granth" routerLinkActive="on">{{ i18n.t('nav.granth') }}</a>
        <a routerLink="/samagri" routerLinkActive="on">{{ i18n.t('nav.samagri') }}</a>
        @if (acc.configured) { <a routerLink="/pandits" [class.on]="inBooking()">{{ i18n.t('nav.book') }}</a> }
      </nav>
      <div class="prefs">
        <label class="sr-only" for="lang">Language</label>
        <select id="lang" class="hdr-select hdr-chip lang" (change)="i18n.set($any($event.target).value)">
          @for (l of langs; track l.code) { <option [value]="l.code" [selected]="l.code === i18n.lang()">{{ l.label }}</option> }
        </select>
        <vp-place-picker />
      </div>
      <div class="acts">
        <a routerLink="/dakshina" routerLinkActive="on" class="dak">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1.6 2.2 2.4 3.9 2.4 5.2A2.4 2.4 0 0 1 12 10.6a2.4 2.4 0 0 1-2.4-2.4C9.6 6.9 10.4 5.2 12 3Z"/><path d="M3 14h18c-.6 3.6-4.2 6-9 6s-8.4-2.4-9-6Z"/><path d="M12 10.6V14"/></svg>
          <span>{{ i18n.t('nav.dakshina') }}</span>
        </a>
        @if (acc.configured) {
          <a routerLink="/account" routerLinkActive="on" class="me" [attr.aria-label]="i18n.t('nav.account')" [title]="i18n.t('nav.account')">
            @if (acc.user()) { <span class="av">{{ initial() }}</span> }
            @else { <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6"/></svg> }
            @if (acc.pending()) { <i class="badge">{{ acc.pending() }}</i> }
          </a>
        }
        @if (!native.isApp) {
          <button type="button" class="get" (click)="getApp.set(true)" [attr.aria-label]="i18n.t('getApp')" [title]="i18n.t('appTitle')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7v7M9 11.5l3 3 3-3M10.5 18.5h3"/></svg>
            <span>{{ i18n.t('getApp') }}</span>
          </button>
        }
      </div>
    </div>
  </header>

  @if (showStrip()) {
    <aside class="strip" aria-label="App">
      <img class="sicon" src="logo.svg" alt="" width="40" height="40">
      <span class="stext"><b>{{ i18n.t('appTitle') }}</b><small>{{ i18n.t('appSub') }}</small></span>
      <button type="button" class="btn sget" (click)="getApp.set(true)">{{ i18n.t('getApp') }}</button>
      <button type="button" class="sx" (click)="dismissStrip()" [attr.aria-label]="i18n.t('closeChat')">✕</button>
    </aside>
  }
  <main id="main"><router-outlet /></main>

  <footer class="foot">
    <div class="wrap">
      <p class="note">{{ i18n.t('disclaimer') }}</p>
      @if (api.online() === false && !api.ai()) { <p class="note faint">{{ i18n.t('offline') }}</p> }
      <nav class="foot-links" aria-label="More">
        <a routerLink="/dakshina">{{ i18n.t('nav.dakshina') }}</a>
        @if (!native.isApp) { <button type="button" (click)="getApp.set(true)">{{ i18n.t('appTitle') }}</button> }
      </nav>
      <div class="sign">
        <p class="copy"><span class="nw">© {{ year }} Vaidik Pandit. All rights reserved.</span>&ngsp;<span class="nw">Sacred texts belong to all.</span></p>
        <p class="credit"><span class="nw">Crafted with devotion by&nbsp;<a href="https://ekantshukla.github.io" target="_blank" rel="noopener" class="sig">Ekant Shukla</a></span>&ngsp;<span class="nw">in Bengaluru, India</span></p>
      </div>
    </div>
  </footer>

  <!-- Mobile: bottom tab bar replaces the top nav and the floating button -->
  <nav class="tabbar" aria-label="Main">
    <a routerLink="/" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>
      <span>{{ i18n.t('today') }}</span>
    </a>
    <a routerLink="/panchang" routerLinkActive="on">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>
      <span>{{ i18n.t('nav.panchang') }}</span>
    </a>
    <a routerLink="/rashifal" routerLinkActive="on">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.6 6.1 6.4.5-4.9 4.2 1.5 6.4L12 16.3l-5.6 3.4 1.5-6.4L3 9.1l6.4-.5z"/></svg>
      <span>{{ i18n.t('nav.rashifal') }}</span>
    </a>
    <a routerLink="/granth" routerLinkActive="on">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>
      <span>{{ i18n.t('nav.granth') }}</span>
    </a>
    <button type="button" class="tab-more" [class.on]="more() || inMore()" (click)="more.set(!more())" [attr.aria-expanded]="more()" aria-controls="moresheet">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
      <span>{{ i18n.t('more') }}</span>
    </button>
  </nav>

  @if (more()) {
    <div class="scrim sheet-scrim" (click)="more.set(false)"></div>
    <nav id="moresheet" class="sheet" [attr.aria-label]="i18n.t('more')" (keydown.escape)="more.set(false)">
      <span class="grip" aria-hidden="true"></span>
      <a routerLink="/ask" class="sheet-ai" (click)="more.set(false)">
        <vp-bot-avatar [size]="40" />
        <span><b>✨ {{ i18n.t('askAiShort') }}</b><small>{{ i18n.t('botHello') }}</small></span>
      </a>
      @if (acc.configured) {
        <a routerLink="/pandits" class="sheet-book" (click)="more.set(false)">
          <span class="bi" aria-hidden="true">🕉️</span>
          <span><b>{{ i18n.t('bookTitle') }}</b><small>{{ i18n.t('bookSub') }}</small></span>
        </a>
      }
      <div class="sheet-grid">
        <a routerLink="/muhurat" routerLinkActive="on" (click)="more.set(false)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg><span>{{ i18n.t('nav.muhurat') }}</span></a>
        <a routerLink="/learn" [class.on]="inMantra()" (click)="more.set(false)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg><span>{{ i18n.t('nav.mantra') }}</span></a>
        <a routerLink="/samagri" routerLinkActive="on" (click)="more.set(false)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11h16l-1.6 8.2A2 2 0 0 1 16.4 21H7.6a2 2 0 0 1-2-1.8z"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span>{{ i18n.t('nav.samagri') }}</span></a>
        <a routerLink="/granth/t/gita" (click)="more.set(false)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M9 8h7M9 11h5"/></svg><span>{{ i18n.t('libGita') }}</span></a>
        <a routerLink="/dakshina" routerLinkActive="on" (click)="more.set(false)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1.6 2.2 2.4 3.9 2.4 5.2A2.4 2.4 0 0 1 12 10.6a2.4 2.4 0 0 1-2.4-2.4C9.6 6.9 10.4 5.2 12 3Z"/><path d="M3 14h18c-.6 3.6-4.2 6-9 6s-8.4-2.4-9-6Z"/></svg><span>{{ i18n.t('nav.dakshina') }}</span></a>
        @if (acc.configured) {
          <a routerLink="/account" routerLinkActive="on" (click)="more.set(false)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6"/></svg><span>{{ i18n.t('nav.account') }}</span></a>
        }
        @if (!native.isApp) {
          <button type="button" (click)="more.set(false); getApp.set(true)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7v7M9 11.5l3 3 3-3"/></svg><span>{{ i18n.t('getApp') }}</span></button>
        }
      </div>
    </nav>
  }

  @if (!onAsk()) {
    @if (!drawer() && !more()) {
      <button type="button" class="bot-fab" (click)="openBot()" [attr.aria-expanded]="drawer()" aria-controls="botwin" [attr.aria-label]="i18n.t('openChat')">
        @if (teaser()) { <span class="teaser" role="status">{{ i18n.t('botHello') }}</span> }
        @else { <span class="fab-label">✨ {{ i18n.t('askAiShort') }}</span> }
        <span class="ring"><vp-bot-avatar [size]="58" [animate]="true" /></span>
        <span class="live" [class.ai]="api.ai()" aria-hidden="true"></span>
      </button>
    }
    @if (drawer()) {
      <div class="scrim" (click)="drawer.set(false)"></div>
      <section id="botwin" class="botwin" role="dialog" aria-modal="true" [attr.aria-label]="i18n.t('panditji')" (keydown.escape)="drawer.set(false)">
        <header class="bw-h">
          <vp-bot-avatar [size]="40" [animate]="true" />
          <div class="bw-t">
            <h2>{{ i18n.t('panditji') }}</h2>
            <span class="bw-s"><i [class.ai]="api.ai()"></i>{{ api.ai() ? i18n.t('botOnline') : i18n.t('botBuiltIn') }}</span>
          </div>
          <a routerLink="/ask" class="bw-b" [attr.aria-label]="i18n.t('fullScreen')" [title]="i18n.t('fullScreen')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
          </a>
          <button type="button" class="bw-b" (click)="drawer.set(false)" [attr.aria-label]="i18n.t('closeChat')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </header>
        <div class="bw-body"><vp-chat-panel /></div>
      </section>
    }
  }
  @if (getApp()) { <vp-get-app (close)="getApp.set(false)" /> }`,
  styles: [`
    .skip { position: absolute; left: -999px; top: 8px; background: var(--haldi); color: var(--ink); padding: 8px 12px; z-index: 100; border-radius: 4px; }
    .skip:focus { left: 8px; }
    .top { background: var(--ink); color: #F6F4FA; position: sticky; top: env(safe-area-inset-top, 0px); z-index: 45; }
    .bar { display: flex; align-items: center; gap: 24px; min-height: 64px; }
    .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; line-height: 1.05; flex: none; }
    .brand .logo { width: 56px; height: 56px; flex: none; }
    .brand .names { display: flex; flex-direction: column; }
    .mark { font-size: 1.75rem; color: #fff; line-height: 1.15; }
    .latin { font-size: .74rem; letter-spacing: .02em; color: rgba(246,244,250,.62); white-space: nowrap; }
    .latin { color: var(--haldi); font-weight: 600; letter-spacing: .06em; font-size: .86rem; }
    .desk { display: flex; gap: 4px; flex: 1; }
    .desk a { color: rgba(246,244,250,.82); text-decoration: none; padding: 8px 12px; border-radius: 999px; font-weight: 500; white-space: nowrap; }
    .desk a:hover { color: #fff; background: rgba(255,255,255,.07); }
    .desk a.on { color: var(--ink); background: var(--haldi); }
    .ask-link { margin-left: auto; }
    .prefs { display: flex; gap: 8px; align-items: center; flex: none; }
    .acts { display: flex; gap: 8px; align-items: center; flex: none; }
    .acts a, .acts button { display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 6px 14px 6px 11px; border-radius: 999px;
      font: inherit; font-weight: 600; font-size: .92rem; text-decoration: none; cursor: pointer; white-space: nowrap; }
    .acts svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex: none; }
    .dak { background: var(--haldi); color: var(--ink); border: 1.5px solid var(--haldi); }
    .dak:hover, .dak.on { background: #F0B53A; }
    .me { position: relative; justify-content: center; padding: 0 !important; width: 40px; background: transparent; color: #fff; border: 1.5px solid rgba(255,255,255,.3); }
    .me:hover, .me.on { border-color: var(--haldi); }
    .me .av { width: 30px; height: 30px; border-radius: 50%; background: var(--haldi); color: var(--ink); display: grid; place-items: center; font-weight: 700; font-size: .9rem; }
    .me .badge { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px; background: var(--sindoor); color: #fff;
      font-style: normal; font-size: .7rem; font-weight: 700; display: grid; place-items: center; border: 2px solid var(--ink); }
    .get { background: transparent; color: #fff; border: 1.5px solid rgba(255,255,255,.3); }
    .get:hover { border-color: rgba(255,255,255,.6); }
    main { min-height: 70vh; }
    .strip { display: none; }
    @media (max-width: 1024px) {
      .strip { display: flex; align-items: center; gap: 10px; background: var(--card); border-bottom: 1px solid var(--line);
        padding: 10px max(16px, env(safe-area-inset-right, 0px)) 10px max(16px, env(safe-area-inset-left, 0px)); }
      .sicon { width: 40px; height: 40px; flex: none; border-radius: 10px; background: var(--ink); padding: 2px; }
      .stext { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
      .stext b { color: var(--ink); font-size: .92rem; }
      .stext small { color: var(--muted); font-size: .78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sget { min-height: 38px; padding: 6px 16px; font-size: .9rem; flex: none; }
      .sx { width: 32px; height: 32px; flex: none; border: 0; background: none; color: var(--faint); cursor: pointer; font-size: .95rem; }
    }
    .foot-links { display: flex; gap: 8px 22px; flex-wrap: wrap; justify-content: center; margin-top: 24px; }
    .foot-links a, .foot-links button { background: none; border: 0; padding: 4px 0; font: inherit; font-size: var(--s0); font-weight: 600; color: var(--sindoor); cursor: pointer;
      text-decoration: underline; text-decoration-color: var(--haldi); text-underline-offset: 4px; }
    .foot { border-top: 1px solid var(--line); padding: 28px 0 40px; font-size: var(--s-1); color: var(--muted); }
    .note { max-width: 72ch; }
    .sign { margin-top: 28px; padding-top: 22px; border-top: 1px solid var(--line); text-align: center; display: grid; gap: 6px; }
    .sign p { margin: 0 auto; max-width: none; }
    .copy { color: var(--faint); }
    .nw { white-space: nowrap; display: inline-block; }
    .credit { color: var(--muted); font-size: var(--s0); }
    .credit .sig { font-family: 'Tiro Devanagari Sanskrit', Georgia, serif; font-style: italic; font-size: 1.12rem; color: var(--ink); text-decoration: none; }
    .credit .sig:hover { color: var(--sindoor); text-decoration: underline; text-decoration-color: var(--haldi); }

    .tabbar { display: none; }
    .sheet, .sheet-scrim { display: none; }
    .fab-label { background: var(--ink); color: #fff; font-weight: 700; font-size: .92rem; padding: 9px 14px; border-radius: 999px;
      box-shadow: 0 8px 22px rgba(29,23,54,.28); white-space: nowrap; border: 2px solid var(--haldi); }
    .bot-fab:hover .fab-label { background: #2A2250; }

    .bot-fab { position: fixed; right: calc(18px + env(safe-area-inset-right, 0px)); bottom: calc(18px + env(safe-area-inset-bottom, 0px)); z-index: 40;
      border: 0; background: none; padding: 0; cursor: pointer; display: flex; align-items: center; gap: 10px; }
    .bot-fab .ring { display: block; border-radius: 50%; padding: 3px; background: linear-gradient(135deg, var(--haldi), var(--sindoor));
      box-shadow: 0 10px 26px rgba(29,23,54,.35); animation: bob 3.2s ease-in-out infinite; }
    .bot-fab:hover .ring { transform: scale(1.05); }
    .bot-fab .live { position: absolute; right: 2px; bottom: 4px; width: 15px; height: 15px; border-radius: 50%; background: var(--haldi); border: 2.5px solid #fff; }
    .bot-fab .live.ai { background: #2FA36B; }
    .teaser { background: var(--card); color: var(--ink); border: 1px solid var(--line); border-radius: 16px 16px 4px 16px; padding: 9px 13px;
      font-weight: 600; font-size: .9rem; box-shadow: 0 8px 22px rgba(29,23,54,.18); white-space: nowrap; animation: pop .3s ease-out; }
    @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
    @keyframes pop { from { transform: translateY(6px) scale(.96); opacity: 0; } to { transform: none; opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .bot-fab .ring { animation: none; } }
    .scrim { position: fixed; inset: 0; background: rgba(29,23,54,.38); z-index: 50; }
    .botwin { position: fixed; right: calc(20px + env(safe-area-inset-right, 0px)); bottom: calc(20px + env(safe-area-inset-bottom, 0px)); z-index: 60;
      width: min(420px, calc(100vw - 40px)); height: min(680px, calc(100vh - 110px)); background: var(--paper); border-radius: 22px; overflow: hidden;
      display: flex; flex-direction: column; box-shadow: 0 24px 60px rgba(29,23,54,.38); animation: rise .22s ease-out; }
    .bw-h { display: flex; align-items: center; gap: 10px; background: var(--ink); color: #fff; padding: 12px 10px 12px 14px; }
    .bw-t { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
    .bw-h h2 { margin: 0; font-size: 1.05rem; color: #fff; font-family: var(--sanskrit); font-weight: 400; }
    .bw-s { font-size: .76rem; color: rgba(246,244,250,.75); display: flex; align-items: center; gap: 6px; }
    .bw-s i { width: 8px; height: 8px; border-radius: 50%; background: var(--haldi); }
    .bw-s i.ai { background: #2FA36B; }
    .bw-b { width: 38px; height: 38px; border-radius: 50%; border: 0; background: rgba(255,255,255,.08); color: #fff; cursor: pointer; display: grid; place-items: center; flex: none; }
    .bw-b:hover { background: rgba(255,255,255,.16); }
    .bw-b svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .bw-body { flex: 1; min-height: 0; padding: 12px 12px calc(12px + env(safe-area-inset-bottom, 0px)); display: flex; }
    .bw-body vp-chat-panel { flex: 1; min-height: 0; }
    @keyframes rise { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }

    @media (max-width: 1280px) { .bar { gap: 12px; } .desk { gap: 0; } .desk a { padding: 8px 8px; } }
    .prefs .lang { max-width: 104px; }
    @media (max-width: 1240px) { .get span { display: none; } .get { padding: 6px 10px; } }

    /* ---------- phones & small tablets ---------- */
    @media (max-width: 1024px) {
      .desk { display: none; }
      .bot-fab { bottom: calc(78px + env(safe-area-inset-bottom, 0px)); right: calc(14px + env(safe-area-inset-right, 0px)); }
      .botwin { left: 0; right: 0; bottom: 0; width: auto; height: 90vh; height: 90dvh; border-radius: 22px 22px 0 0; }
      .fab-label { font-size: .84rem; padding: 7px 12px; }
      .sheet-scrim { display: block; z-index: 41; }
      .sheet { display: block; position: fixed; left: 0; right: 0; bottom: 0; z-index: 42; background: var(--card); border-radius: 22px 22px 0 0;
        padding: 8px max(16px, env(safe-area-inset-right, 0px)) calc(80px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
        box-shadow: 0 -12px 40px rgba(29,23,54,.25); animation: rise .2s ease-out; }
      .grip { display: block; width: 40px; height: 4px; border-radius: 2px; background: var(--line); margin: 4px auto 12px; }
      .sheet-ai { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; text-decoration: none;
        background: var(--ink); color: #fff; margin-bottom: 12px; }
      .sheet-ai b { display: block; font-size: 1.02rem; }
      .sheet-ai small { display: block; color: rgba(246,244,250,.75); font-size: .82rem; }
      .sheet-book { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; text-decoration: none; margin-bottom: 12px;
        background: var(--haldi-soft); border: 1.5px solid var(--haldi); color: var(--ink); }
      .sheet-book .bi { font-size: 1.9rem; width: 40px; text-align: center; }
      .sheet-book b { display: block; font-size: 1.02rem; } .sheet-book small { display: block; color: var(--muted); font-size: .82rem; }
      .sheet-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .sheet-grid a, .sheet-grid button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 80px;
        border: 1px solid var(--line); border-radius: 14px; background: var(--paper); color: var(--ink); text-decoration: none; font: inherit;
        font-size: .86rem; font-weight: 600; cursor: pointer; padding: 8px 4px; text-align: center; }
      .sheet-grid a.on { border-color: var(--sindoor); color: var(--sindoor); }
      .sheet-grid svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
      .bar { flex-wrap: wrap; gap: 8px 12px; padding-block: 10px; min-height: 0; }
      .brand { flex: 1; order: 0; }
      .acts { order: 1; }
      .acts a, .acts button { min-height: 34px; padding: 3px 10px 3px 8px; font-size: .84rem; gap: 5px; }
      .acts svg { width: 17px; height: 17px; }
      .me { width: 34px; height: 34px; }
      .me .av { width: 26px; height: 26px; font-size: .82rem; }
      .dak span { display: inline; }
      .get { padding: 3px 8px; }
      .get span { display: none; }
      .mark { font-size: 1.6rem; }
      .latin { font-size: .8rem; }
      .brand .logo { width: 52px; height: 52px; }
      .prefs { flex: 1 1 100%; order: 2; display: flex; gap: 6px; }
      .prefs > * { min-width: 0; }
      .prefs vp-place-picker { flex: 0 1 auto; min-width: 0; max-width: 46%; }
      .prefs .lang { flex: 0 1 auto; width: auto; max-width: 30%; }
      .foot { padding-bottom: calc(100px + env(safe-area-inset-bottom, 0px)); }

      .tabbar {
        display: grid; grid-template-columns: repeat(5, 1fr);
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
        background: var(--card); border-top: 1px solid var(--line);
        padding: 6px max(4px, env(safe-area-inset-right, 0px)) calc(6px + env(safe-area-inset-bottom, 0px)) max(4px, env(safe-area-inset-left, 0px));
        box-shadow: 0 -6px 20px rgba(29,23,54,.08);
      }
      .tabbar a, .tabbar .tab-more { display: flex; border: 0; background: none; font: inherit; cursor: pointer; flex-direction: column; align-items: center; gap: 2px; padding: 4px 2px; text-decoration: none;
                  color: var(--muted); font-size: .72rem; font-weight: 500; border-radius: 10px; min-height: 52px; justify-content: center; }
      .tabbar a span:last-child { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tabbar svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
      .tabbar a.on, .tabbar .tab-more.on { color: var(--sindoor); }
      .tabbar a.on svg, .tabbar .tab-more.on svg { stroke-width: 2.2; }
      .tabbar .tab-more span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tabbar { max-width: 100%; }
    }
    @media (max-width: 600px) {
      /* phones: the chat opens full screen so the keyboard never hides the input */
      .botwin { top: 0; height: auto; border-radius: 0; padding-top: env(safe-area-inset-top, 0px); }
    }
    @media (max-width: 1024px) and (min-width: 600px) { .tabbar { padding-inline: max(10%, env(safe-area-inset-left, 0px)); } }
    @media (max-width: 380px) {
      .bar { gap: 8px; }
      .mark { font-size: 1.35rem; }
      .latin { font-size: .7rem; }
      .brand .logo { width: 44px; height: 44px; }
      .brand { gap: 8px; }
      .acts { gap: 6px; }
      .acts a, .acts button { min-height: 32px; font-size: .8rem; }
      .dak { padding: 3px 8px 3px 7px; }
      .acts svg { width: 17px; height: 17px; }
    }
  `],
})
export class AppComponent {
  readonly i18n = inject(I18nService);
  readonly api = inject(ApiService);
  readonly langs = LANGS;
  readonly year = new Date().getFullYear();
  readonly drawer = signal(false);
  readonly onAsk = signal(false);
  readonly url = signal('');
  inMantra() { const u = this.url(); return u.startsWith('/learn') || u.startsWith('/mantra'); }
  readonly getApp = signal(false);
  readonly stripClosed = signal(this.readStrip());
  private readStrip(): boolean { try { return localStorage.getItem('vp.appStrip') === 'closed'; } catch { return false; } }
  dismissStrip() { this.stripClosed.set(true); try { localStorage.setItem('vp.appStrip', 'closed'); } catch { /* ignore */ } }
  showStrip() { return !this.native.isApp && (this.native.platform === 'android' || this.native.platform === 'ios') && !this.stripClosed() && !this.onAsk(); }
  readonly native = inject(NativeService);
  readonly teaser = signal(false);

  openBot() { this.teaser.set(false); this.more.set(false); this.drawer.set(true); }
  readonly more = signal(false);
  /** The current page lives in the More sheet (the tab bar shows only Today, Panchang, Rashifal, Granth). */
  inMore() { const u = this.url(); return ['/muhurat', '/learn', '/mantra', '/samagri', '/dakshina', '/pandit', '/booking', '/account', '/admin'].some(p => u.startsWith(p)); }
  inBooking() { const u = this.url(); return ['/pandit', '/booking'].some(p => u.startsWith(p)); }
  readonly acc = inject(AccountService);
  initial() { const n = this.acc.profile()?.name || this.acc.user()?.email || '?'; return n.trim()[0]?.toUpperCase() ?? '?'; }

  constructor() {
    const router = inject(Router);
    // Android back button: close what's open, else go back a page, else minimise the app
    this.native.onBack(() => {
      if (this.getApp()) { this.getApp.set(false); return true; }
      if (this.more()) { this.more.set(false); return true; }
      if (this.drawer()) { this.drawer.set(false); return true; }
      if (router.url !== '/' && router.url !== '') { history.back(); return true; }
      return false;
    });
    router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(e => {
      this.onAsk.set((e as NavigationEnd).urlAfterRedirects.startsWith('/ask'));
      this.url.set((e as NavigationEnd).urlAfterRedirects);
      this.drawer.set(false);
      this.more.set(false);
      window.scrollTo({ top: 0 });
    });
    this.api.isOnline();
    // A one-time "Namaste" bubble next to the floating PanditJi so people know he is a chatbot
    try {
      if (!localStorage.getItem('vp.botHello')) {
        setTimeout(() => this.teaser.set(true), 1500);
        setTimeout(() => this.teaser.set(false), 9000);
        localStorage.setItem('vp.botHello', '1');
      }
    } catch { /* ignore */ }
    document.documentElement.lang = this.i18n.lang();
  }
}
