import Phaser from 'phaser';
import { ITEMS } from '../systems/Inventory';
import { RAID_SWITCHES, readSwitches, SwitchKey, SWITCHES, withSwitches } from '../systems/DebugSwitches';
import { WEATHER_KINDS } from '../systems/Weather';
import { AreaId } from '../world/MapData';
import { KINDS as ROAD_EVENTS } from '../world/PlainsEvents';
import { AREAS, isTestArea } from './game/areas';
import * as Debug from './game/debug';

/** Remembered between visits (in this browser only): whether the panel was folded away. */
const FOLDED_KEY = 'eldermoor.debug.folded';

const CSS = `
#eldermoor-debug { position: fixed; left: 8px; bottom: 8px; z-index: 50; width: 300px; max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px); overflow: auto; box-sizing: border-box; background: rgba(14, 12, 18, 0.92);
  color: #e8dfca; border: 1px solid #6b5a3a; border-radius: 6px; font: 12px/1.35 system-ui, sans-serif;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5); }
#eldermoor-debug.folded { width: auto; }
#eldermoor-debug.folded .body { display: none; }
#eldermoor-debug .head { display: flex; gap: 8px; align-items: center; padding: 6px 8px; cursor: pointer; user-select: none;
  background: rgba(107, 90, 58, 0.35); }
#eldermoor-debug .head b { color: #f0c987; letter-spacing: 0.04em; }
#eldermoor-debug .body { padding: 6px 8px 8px; }
#eldermoor-debug .status { color: #b8ad95; margin-bottom: 6px; font-variant-numeric: tabular-nums; }
#eldermoor-debug h4 { margin: 8px 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #c9a86a; }
#eldermoor-debug .row { display: flex; gap: 4px; align-items: center; margin: 3px 0; }
#eldermoor-debug label { flex: 0 0 72px; color: #cfc4ab; }
#eldermoor-debug input, #eldermoor-debug select { flex: 1 1 auto; min-width: 0; background: #241f2a; color: #f2ead8;
  border: 1px solid #54483a; border-radius: 3px; padding: 2px 4px; font: inherit; }
#eldermoor-debug button { background: #4a3c27; color: #f6ecd2; border: 1px solid #8a7146; border-radius: 3px;
  padding: 2px 7px; font: inherit; cursor: pointer; white-space: nowrap; }
#eldermoor-debug button:hover { background: #5d4b30; }
#eldermoor-debug button.wide { width: 100%; margin-top: 4px; }
#eldermoor-debug .hint { color: #8f8673; font-size: 11px; margin: -1px 0 3px 76px; }
#eldermoor-debug .flags { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px; }
#eldermoor-debug .flags span { background: #2d2634; border: 1px solid #54483a; border-radius: 9px; padding: 0 6px;
  cursor: pointer; font-size: 11px; }
#eldermoor-debug .flags span:hover { text-decoration: line-through; }
#eldermoor-debug .said { color: #9cd49c; min-height: 1.3em; margin-top: 6px; }
`;

/**
 * The testing panel, opened by adding ?debug to the page address. It gathers
 * every URL switch (area, hour, raid, event, give, wolves, weather) to start a
 * new game with, and has buttons for the things testers keep wanting: jump to
 * an area, set the hour or the weather, set or clear a story flag, coins and
 * experience, full health, and kill everything in a fight.
 *
 * It's a plain HTML panel over the canvas (so its text boxes are real ones),
 * kept by this scene, which runs alongside the game from boot. ` (backquote)
 * folds it away and back. Keys typed in it don't reach the game.
 */
export class DebugScene extends Phaser.Scene {
  private panel?: HTMLDivElement;
  private statusLine?: HTMLDivElement;
  private flagsBox?: HTMLDivElement;
  private said?: HTMLDivElement;
  private refresh = 0;
  private shownFlags = '';

  constructor() {
    super('Debug');
  }

  create(): void {
    this.build();
    const toggle = (e: KeyboardEvent) => {
      if (e.key === '`' && !(e.target instanceof HTMLInputElement)) this.fold();
    };
    window.addEventListener('keydown', toggle);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', toggle);
      this.panel?.remove();
      document.getElementById('eldermoor-debug-css')?.remove();
      this.panel = undefined;
    });
  }

  update(_t: number, dt: number): void {
    this.refresh -= dt;
    if (this.refresh > 0 || !this.panel) return;
    this.refresh = 250;
    this.statusLine!.textContent = Debug.status(this.game);
    this.showFlags();
  }

  private build(): void {
    const style = document.createElement('style');
    style.id = 'eldermoor-debug-css';
    style.textContent = CSS;
    document.head.appendChild(style);

    const panel = (this.panel = document.createElement('div'));
    panel.id = 'eldermoor-debug';
    // Keys and clicks in the panel stay in the panel (Phaser listens on the window for both).
    for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'wheel']) {
      panel.addEventListener(type, (e) => {
        if (type !== 'keydown' || (e as KeyboardEvent).key !== '`' || e.target instanceof HTMLInputElement) e.stopPropagation();
      });
    }
    let folded = false;
    try {
      folded = localStorage.getItem(FOLDED_KEY) === '1';
    } catch {
      // No storage: start open.
    }
    panel.classList.toggle('folded', folded);

    const head = el('div', 'head');
    head.append(el('b', '', 'DEBUG'), el('span', '', '` to fold'));
    head.addEventListener('click', () => this.fold());
    const body = el('div', 'body');
    panel.append(head, body);

    this.statusLine = el('div', 'status');
    body.append(this.statusLine);

    // The URL switches: written into the address, then a new game started with them.
    body.append(el('h4', '', 'New game with switches'));
    const now = readSwitches(window.location.search);
    const inputs = new Map<SwitchKey, HTMLInputElement | HTMLSelectElement>();
    for (const s of SWITCHES) {
      const row = el('div', 'row');
      const id = `dbg-${s.key}`;
      const label = el('label', '', s.label);
      label.htmlFor = id;
      let input: HTMLInputElement | HTMLSelectElement;
      if (s.kind === 'choice') {
        input = select(['', ...this.choices(s.key)]);
      } else {
        input = document.createElement('input');
        input.type = s.kind === 'number' ? 'number' : 'text';
        if (s.min !== undefined) input.min = String(s.min);
        if (s.max !== undefined) input.max = String(s.max);
        if (s.step !== undefined) input.step = String(s.step);
        if (s.key === 'give') input.setAttribute('list', 'dbg-items');
      }
      input.id = id;
      input.value = now[s.key] ?? '';
      inputs.set(s.key, input);
      row.append(label, input);
      body.append(row, el('div', 'hint', s.hint));
    }
    const items = document.createElement('datalist');
    items.id = 'dbg-items';
    for (const id of Object.keys(ITEMS).sort()) items.append(new Option(id));
    body.append(items);
    body.append(
      button('Start a new game with these', () => {
        const values: Partial<Record<SwitchKey, string>> = {};
        for (const [k, input] of inputs) values[k] = input.value;
        const search = withSwitches(window.location.search, values);
        window.history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`);
        this.say(Debug.restartNewGame(this.game));
      }, 'wide'),
    );

    // Things to do to the game going on.
    body.append(el('h4', '', 'Now'));
    const areaPick = select(Object.keys(AREAS));
    body.append(row('Teleport', areaPick, button('Go', () => this.say(Debug.teleport(this.game, areaPick.value as AreaId)))));
    const hour = document.createElement('input');
    hour.type = 'number';
    hour.min = '0';
    hour.max = '23.99';
    hour.step = '0.5';
    hour.placeholder = '0-24';
    body.append(row('Hour', hour, button('Set', () => this.say(Debug.setHour(this.game, Number(hour.value))))));
    const weather = select(['', ...WEATHER_KINDS]);
    body.append(row('Weather', weather, button('Hold', () => this.say(Debug.setWeather(weather.value)))));
    const flag = document.createElement('input');
    flag.type = 'text';
    flag.placeholder = 'raid-over, paid-toll...';
    body.append(
      row(
        'Flag',
        flag,
        button('Set', () => this.say(Debug.setFlag(flag.value, true))),
        button('Clear', () => this.say(Debug.setFlag(flag.value, false))),
      ),
    );
    this.flagsBox = el('div', 'flags');
    body.append(this.flagsBox);
    body.append(
      row('Coins', button('+10', () => this.say(Debug.giveCoins(10))), button('+100', () => this.say(Debug.giveCoins(100))), button('+1000', () => this.say(Debug.giveCoins(1000)))),
      row('XP', button('+50', () => this.say(Debug.giveXp(50))), button('+250', () => this.say(Debug.giveXp(250))), button('+1000', () => this.say(Debug.giveXp(1000)))),
      row('Hero', button('Heal', () => this.say(Debug.heal(this.game))), button('Kill all in fight', () => this.say(Debug.killAll(this.game)))),
      row('Companion', button('Sigrun', () => this.say(Debug.toggleCompanion(this.game, 'sigrun'))), button('Wat', () => this.say(Debug.toggleCompanion(this.game, 'wat')))),
    );
    this.said = el('div', 'said');
    body.append(this.said);

    (document.getElementById('game') ?? document.body).append(panel);
  }

  /** What a switch that takes a choice can be set to. */
  private choices(key: SwitchKey): readonly string[] {
    switch (key) {
      case 'area':
        return Object.keys(AREAS).filter(isTestArea);
      case 'raid':
        return RAID_SWITCHES;
      case 'event':
        return ROAD_EVENTS;
      case 'weather':
        return WEATHER_KINDS;
      default:
        return [];
    }
  }

  /** The story's flags as chips; clicking one clears it. */
  private showFlags(): void {
    const list = Debug.liveGame(this.game) ? Debug.flags() : [];
    const key = list.join();
    if (key === this.shownFlags || !this.flagsBox) return;
    this.shownFlags = key;
    this.flagsBox.replaceChildren(
      ...list.map((f) => {
        const chip = el('span', '', f);
        chip.title = 'Click to clear';
        chip.addEventListener('click', () => this.say(Debug.setFlag(f, false)));
        return chip;
      }),
    );
  }

  private fold(): void {
    if (!this.panel) return;
    const folded = this.panel.classList.toggle('folded');
    try {
      localStorage.setItem(FOLDED_KEY, folded ? '1' : '0');
    } catch {
      // Not kept: fine.
    }
  }

  private say(text: string): void {
    if (this.said) this.said.textContent = text;
    this.refresh = 0;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function select(options: readonly string[]): HTMLSelectElement {
  const s = document.createElement('select');
  for (const o of options) s.append(new Option(o || '(none)', o));
  s.addEventListener('change', () => s.blur());
  return s;
}

function button(text: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', () => {
    // Hand the keyboard straight back to the game (keys pressed in the panel don't reach it).
    b.blur();
    onClick();
  });
  return b;
}

function row(label: string, ...parts: HTMLElement[]): HTMLDivElement {
  const r = el('div', 'row');
  r.append(el('label', '', label), ...parts);
  return r;
}
