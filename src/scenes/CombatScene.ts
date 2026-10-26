import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { WOLF_FRAME } from '../art/creatures';
import { HERO_NAME } from '../config';
import type { Creature } from '../entities/Creature';
import { Vec2 } from '../iso/IsoMath';
import {
  Battle,
  chooseFoeAction,
  Combatant,
  CombatantDef,
  DEFEND_AC_BONUS,
  DEFEND_STAMINA,
  diceText,
  FOES,
  HEAVY_STAMINA,
  HEAVY_TO_HIT,
  Outcome,
} from '../systems/Combat';
import { Experience } from '../systems/Experience';
import { Inventory, itemDef, ItemId } from '../systems/Inventory';
import { bodyStyle, THEME, titleStyle } from '../ui/Widgets';
import type { GameScene } from './GameScene';

export interface CombatSceneData {
  foes: Creature[];
}

/** How a fight ended, and which beasts are gone for good. */
export interface CombatResult {
  outcome: Outcome;
  slain: string[];
  fled: string[];
}

/** A combatant plus the sprite that stands for it in the world. */
interface Actor {
  c: Combatant;
  sprite: Phaser.GameObjects.Sprite;
  /** Screen-pixel nudge the entity applies to its sprite (for lunges). */
  offset: Vec2;
  pos: () => Vec2;
  /** How far above the feet the head is, in world pixels. */
  height: number;
  creature?: Creature;
}

interface MenuOption {
  id: string;
  label: string;
  hint: string;
  disabled?: boolean;
}

const FONT = 'Georgia, "Times New Roman", serif';
const BTN_H = 46;
const GAP = 8;
const MARGIN = 14;
/** Below this width the actions go in two columns. */
const NARROW = 760;
const CHIP_W = 72;
const CHIP_H = 92;
const LOG_LINES = 3;
const PACK_NAMES = ['Grey Wolf', 'Scarred Wolf', 'Lean Wolf', 'Old Wolf', 'Young Wolf', 'Black Wolf'];

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/**
 * A turn-based fight, played out over the world. Everyone rolls initiative
 * and takes turns in that order (shown along the top). On the hero's turn a
 * menu offers what to do: attack, a heavy blow, defend, use an item, or flee.
 * Each roll of the dice pops up over whoever rolled it, and a log at the
 * bottom spells out the sums. Beasts choose their own moves (see
 * systems/Combat.ts). Emits 'combat-ended' with a CombatResult when it's over.
 */
export class CombatScene extends Phaser.Scene {
  private world!: GameScene;
  private battle!: Battle;
  private hero!: Actor;
  private foes: Actor[] = [];
  private actors: Actor[] = [];

  private orderBar!: Phaser.GameObjects.Container;
  private logBox!: Phaser.GameObjects.Container;
  private logLines: string[] = [];
  private menuBox!: Phaser.GameObjects.Container;
  private hintText!: Phaser.GameObjects.Text;
  private menuTitle!: Phaser.GameObjects.Text;

  private menuOptions: MenuOption[] = [];
  private menuButtons: Array<(selected: boolean) => void> = [];
  private menuResolve?: (id: string) => void;
  private menuOnSelect?: (option: MenuOption) => void;
  private menuHeading = '';
  private selected = 0;

  constructor() {
    super('Combat');
  }

  create(data: CombatSceneData): void {
    this.world = this.scene.get('Game') as GameScene;
    this.menuOptions = [];
    this.menuResolve = undefined;
    this.menuOnSelect = undefined;
    this.logLines = [];

    const stats = this.world.stats;
    stats.health = Math.max(1, Math.round(stats.health));
    const player = this.world.player;
    this.hero = {
      c: { ...this.heroStats(), initiative: 0, defending: false, fled: false },
      sprite: player.sprite,
      offset: player.offset,
      pos: () => ({ x: player.gx, y: player.gy }),
      height: 44,
    };
    const defs: CombatantDef[] = [this.hero.c];
    data.foes.forEach((creature, i) => {
      const foe = FOES[creature.kind];
      const name = data.foes.length === 1 ? foe.name : PACK_NAMES[i % PACK_NAMES.length];
      defs.push({ ...foe, id: creature.id, name, side: 'foes', hp: foe.maxHp });
    });
    this.battle = new Battle(defs);
    const byId = new Map(this.battle.combatants.map((c) => [c.id, c]));
    this.hero.c = byId.get('hero')!;
    this.foes = data.foes.map((creature) => ({
      c: byId.get(creature.id)!,
      sprite: creature.sprite,
      offset: creature.offset,
      pos: () => ({ x: creature.gx, y: creature.gy }),
      height: 26,
      creature,
    }));
    this.actors = [this.hero, ...this.foes];

    this.orderBar = this.add.container(0, 0);
    this.logBox = this.add.container(0, 0);
    this.menuBox = this.add.container(0, 0);
    this.menuTitle = this.add.text(0, 0, '', { ...bodyStyle(17, THEME.goldText), fontFamily: FONT }).setOrigin(0.5, 1);
    this.hintText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '14px', color: THEME.text, stroke: '#000000', strokeThickness: 3, align: 'center' })
      .setOrigin(0.5, 1);

    const kb = this.input.keyboard!;
    const digits = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    digits.forEach((key, i) => kb.on(`keydown-${key}`, () => this.pick(i)));
    for (const key of ['LEFT', 'UP', 'A', 'W']) kb.on(`keydown-${key}`, () => this.moveSelection(-1));
    for (const key of ['RIGHT', 'DOWN', 'D', 'S']) kb.on(`keydown-${key}`, () => this.moveSelection(1));
    for (const key of ['ENTER', 'SPACE', 'E']) kb.on(`keydown-${key}`, () => this.pick(this.selected));
    for (const key of ['ESC', 'BACKSPACE']) {
      kb.on(`keydown-${key}`, () => {
        const back = this.menuOptions.findIndex((o) => o.id === 'back');
        if (back >= 0) this.pick(back);
      });
    }

    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.layout, this));
    this.layout();
    void this.run();
  }

  // ------------------------------------------------------------ the fight

  private async run(): Promise<void> {
    const first = this.foes[0];
    this.world.player.faceTowards(first.pos().x, first.pos().y);
    this.log(
      this.foes.length > 1
        ? this.world.map.data.underground
          ? 'Eyes shine in the lantern light. Wolves pad out of the dark, hackles raised. You are surrounded!'
          : 'Wolves slink out of the grass, hackles raised. You are surrounded!'
        : 'The wolf lowers its head and snarls, circling you. It means to fight!',
    );
    // The beasts close in, and the camera settles on the fight.
    const spots: Vec2[] = [];
    for (const f of this.foes) spots.push(this.closeInSpot(f, spots));
    await Promise.all(this.foes.map((f, i) => f.creature!.moveTo(spots[i].x, spots[i].y, 650)));
    this.world.player.faceTowards(first.pos().x, first.pos().y);
    this.world.frameFight(this.actors.map((a) => a.pos()));
    this.banner(this.foes.length > 1 ? 'Wolves attack!' : 'A wolf attacks!');
    await this.wait(900);

    if (!Inventory.equipped.mainHand) {
      this.log('You have nothing in your hands. Your walking staff would help: look under Use item.');
    }
    this.log('Roll for initiative!');
    const rolls = this.battle.rollInitiative();
    await Promise.all(rolls.map((r) => this.rollDie(this.actorOf(r.who), r.roll, signed(r.who.quickness))));
    this.log(`Turn order: ${this.battle.order.map((c) => `${c.name} ${c.initiative}`).join(', ')}.`);
    this.drawOrder();
    await this.wait(500);

    while (this.battle.outcome() === 'ongoing') {
      const c = this.battle.current;
      this.drawOrder();
      this.banner(c.side === 'party' ? 'Your turn' : `${c.name}'s turn`, c.side === 'party');
      await this.wait(c.side === 'party' ? 350 : 650);
      if (c === this.hero.c) await this.heroTurn();
      else await this.foeTurn(this.actorOf(c));
      this.drawOrder();
      await this.wait(400);
      this.battle.endTurn();
    }
    await this.finish(this.battle.outcome());
  }

  private async heroTurn(): Promise<void> {
    const hero = this.hero.c;
    const stats = this.world.stats;
    for (;;) {
      const foes = this.battle.standing('foes');
      const items = this.itemOptions();
      const choice = await this.showMenu('Your move', [
        {
          id: 'attack',
          label: 'Attack',
          hint: `Strike a foe: d20 ${signed(hero.toHit)} to hit, ${diceText(hero.damage)} damage.`,
        },
        {
          id: 'heavy',
          label: 'Heavy blow',
          hint: `Put everything into it: ${HEAVY_TO_HIT} to hit, but double damage dice. Costs ${HEAVY_STAMINA} stamina` +
            (stats.stamina < HEAVY_STAMINA ? ' (not enough!).' : '.'),
          disabled: stats.stamina < HEAVY_STAMINA,
        },
        {
          id: 'defend',
          label: 'Defend',
          hint: `Raise your guard: +${DEFEND_AC_BONUS} armour until your next turn, and catch your breath (+${DEFEND_STAMINA} stamina).`,
        },
        {
          id: 'item',
          label: 'Use item',
          hint: items.length > 0 ? 'Eat something from your satchel, or take up a weapon.' : 'Nothing in your satchel will help.',
          disabled: items.length === 0,
        },
        {
          id: 'flee',
          label: 'Flee',
          hint: `Run for it: d20 ${signed(hero.quickness)} against ${this.battle.fleeDc(hero)}. If it fails, you lose your turn.`,
        },
      ]);

      if (choice === 'attack' || choice === 'heavy') {
        const target = foes.length === 1 ? foes[0] : await this.chooseTarget(foes);
        if (!target) continue;
        // Spending stamina is a negative restore.
        if (choice === 'heavy') stats.restoreStamina(-HEAVY_STAMINA);
        await this.attack(this.hero, this.actorOf(target), choice === 'heavy');
        return;
      }
      if (choice === 'defend') {
        this.battle.defend(hero);
        stats.restoreStamina(DEFEND_STAMINA);
        GameAudio.click();
        this.float(this.hero, 'On guard', '#9cd3ff');
        await this.hop(this.hero.offset, 0, -4);
        this.log(`You raise your guard (armour ${this.battle.armourOf(hero)}) and steady your breathing.`);
        return;
      }
      if (choice === 'item') {
        const use = await this.showMenu('Use which item?', [...items, { id: 'back', label: 'Back', hint: 'Choose something else.' }]);
        if (use === 'back') continue;
        await this.useItem(use);
        return;
      }
      if (choice === 'flee') {
        const r = this.battle.tryFlee(hero);
        await this.rollDie(this.hero, r.roll, signed(hero.quickness));
        if (r.success) {
          this.log(`You run for it: ${r.roll} ${signed(hero.quickness)} = ${r.total} against ${r.dc}. You get away!`);
          await this.hop(this.hero.offset, 0, -6);
        } else {
          this.log(`You try to run: ${r.roll} ${signed(hero.quickness)} = ${r.total} against ${r.dc}. You're cut off!`);
          this.float(this.hero, 'Cut off!', '#d8c8a4');
        }
        return;
      }
    }
  }

  private async foeTurn(foe: Actor): Promise<void> {
    const action = chooseFoeAction(this.battle, foe.c);
    if (action.type === 'attack') {
      await this.attack(foe, this.actorOf(action.target), false);
    } else if (action.type === 'flee') {
      foe.c.fled = true;
      GameAudio.yelp();
      this.log(`The ${foe.c.name} yelps, tucks its tail and bolts for the trees!`);
      const from = this.hero.pos();
      await foe.creature!.flee(from.x, from.y);
    }
  }

  private async chooseTarget(foes: Combatant[]): Promise<Combatant | undefined> {
    const options: MenuOption[] = foes.map((f) => ({
      id: f.id,
      label: `${f.name}  ${f.hp}/${f.maxHp}`,
      hint: `Armour ${this.battle.armourOf(f)}. You need to roll ${Math.max(2, this.battle.armourOf(f) - this.hero.c.toHit)} or more.`,
    }));
    options.push({ id: 'back', label: 'Back', hint: 'Choose something else.' });
    // A gold arrow bobs over whichever one is picked.
    const arrow = this.add.graphics().setVisible(false);
    arrow.fillStyle(THEME.gold, 1).lineStyle(2, 0x2a1a08, 1);
    arrow.fillTriangle(-12, -16, 12, -16, 0, 0).strokeTriangle(-12, -16, 12, -16, 0, 0);
    const bob = this.tweens.add({ targets: arrow, scale: { from: 1, to: 0.8 }, duration: 300, yoyo: true, repeat: -1 });
    this.menuOnSelect = (o) => {
      const foe = this.foes.find((f) => f.c.id === o.id);
      arrow.setVisible(!!foe);
      if (foe) arrow.setPosition(this.headOf(foe).x, this.headOf(foe).y + 4);
    };
    const id = await this.showMenu('Attack which?', options);
    bob.stop();
    arrow.destroy();
    return foes.find((f) => f.id === id);
  }

  /** Food to eat, and weapons that could be taken up, from the satchel. */
  private itemOptions(): MenuOption[] {
    const options: MenuOption[] = [];
    const seen = new Set<ItemId>();
    Inventory.bag.forEach((stack, index) => {
      if (!stack || seen.has(stack.id)) return;
      const def = itemDef(stack.id);
      if (def.eat) {
        seen.add(stack.id);
        const gains = [def.eat.health && `${def.eat.health} health`, def.eat.stamina && `${def.eat.stamina} stamina`].filter(Boolean);
        options.push({ id: `eat:${index}`, label: `${def.name} x${Inventory.count(stack.id)}`, hint: `Eat it: restores ${gains.join(' and ')}.` });
      } else if (def.slot === 'mainHand') {
        seen.add(stack.id);
        options.push({
          id: `equip:${index}`,
          label: `Take ${def.name}`,
          hint: `Take it up as your weapon: ${signed(def.attack ?? 0)} attack, and d6 damage instead of fists.`,
        });
      }
    });
    return options;
  }

  private async useItem(id: string): Promise<void> {
    const [kind, slot] = id.split(':');
    const index = Number(slot);
    const stack = Inventory.bag[index];
    if (!stack) return;
    const def = itemDef(stack.id);
    if (kind === 'eat') {
      const before = this.world.stats.health;
      this.world.eat(index);
      this.hero.c.hp = Math.round(this.world.stats.health);
      const healed = Math.round(this.world.stats.health - before);
      this.float(this.hero, healed > 0 ? `+${healed}` : 'Refreshed', '#8fe08a');
      this.log(`You wolf down the ${def.name.toLowerCase()}${healed > 0 ? ` and recover ${healed} health` : ''}.`);
      await this.wait(500);
    } else {
      Inventory.equip(index);
      Object.assign(this.hero.c, this.heroStats());
      GameAudio.pickup();
      this.float(this.hero, def.name, THEME.goldText);
      this.log(`You take up the ${def.name.toLowerCase()}. Attacks now roll d20 ${signed(this.hero.c.toHit)}, ${diceText(this.hero.c.damage)} damage.`);
      await this.wait(500);
    }
  }

  /** Roll to hit, lunge, and show what happened. */
  private async attack(attacker: Actor, target: Actor, heavy: boolean): Promise<void> {
    const r = this.battle.attack(attacker.c, target.c, heavy);
    const at = target.pos();
    if (attacker.creature) attacker.creature.faceTowards(at.x, at.y);
    else this.world.player.faceTowards(at.x, at.y);

    await this.rollDie(attacker, r.roll, signed(r.total - r.roll));
    if (attacker.creature) {
      attacker.creature.setFrame(WOLF_FRAME.bite);
      GameAudio.bite();
    } else {
      GameAudio.swing(heavy);
    }
    await this.lunge(attacker, target, heavy);
    if (attacker.creature && attacker.c.hp > 0) attacker.creature.setFrame(WOLF_FRAME.snarl);

    const who = attacker === this.hero ? 'You' : `The ${attacker.c.name}`;
    const whom = target === this.hero ? 'you' : `the ${target.c.name}`;
    const verb = heavy ? 'put all your strength into a blow at' : attacker.c.verb;
    const sum = `${r.roll} ${signed(r.total - r.roll)} = ${r.total} against armour ${r.ac}`;
    if (r.hit) {
      GameAudio.hit(r.crit);
      if (target === this.hero) {
        this.world.stats.damage(r.damage);
        this.world.cameras.main.shake(160, r.crit ? 0.012 : 0.006);
      }
      this.flash(target);
      this.float(target, r.crit ? `Critical! -${r.damage}` : `-${r.damage}`, r.crit ? '#ffd76a' : '#ff6b5a', r.crit);
      if (target.creature && !r.killed) {
        GameAudio.yelp();
        target.creature.setFrame(WOLF_FRAME.hurt);
        this.time.delayedCall(350, () => {
          if (target.c.hp > 0 && !target.c.fled) target.creature!.setFrame(WOLF_FRAME.snarl);
        });
      }
      const how = r.crit ? 'A natural 20, a critical hit!' : 'Hit!';
      this.log(`${who} ${verb} ${whom}: ${sum}. ${how} ${r.damage} damage.`);
    } else {
      this.float(target, 'Miss', '#d8c8a4');
      void this.hop(target.offset, target === this.hero ? -6 : 6, 0);
      const how = r.roll === 1 ? 'A 1: a clumsy miss.' : 'Miss.';
      this.log(`${who} ${verb} ${whom}: ${sum}. ${how}`);
    }
    this.drawOrder();

    if (r.killed) {
      await this.wait(350);
      if (target.creature) {
        GameAudio.yelp();
        target.creature.die();
        const xp = FOES[target.creature.kind].xp;
        this.log(`The ${target.c.name} crumples to the ground and lies still. You earn ${xp} experience.`);
        this.float(target, `+${xp} XP`, THEME.goldText);
        this.gainXp(xp, target.c.name);
      } else {
        this.log('Your legs give way and the world goes dark...');
      }
    }
    await this.wait(250);
  }

  private async finish(outcome: Outcome): Promise<void> {
    this.clearMenu();
    this.hintText.setText('');
    const slain = this.foes.filter((f) => f.c.hp <= 0).map((f) => f.c.id);
    const fled = this.foes.filter((f) => f.c.fled).map((f) => f.c.id);
    if (outcome === 'victory') {
      GameAudio.victory();
      this.banner('Victory!', true);
    } else if (outcome === 'defeat') {
      GameAudio.defeat();
      this.hero.sprite.setTint(0x777777);
      this.banner('You have fallen...');
    } else {
      this.banner('You got away!', true);
    }
    await this.wait(1700);
    this.hero.sprite.clearTint();
    this.hero.offset.x = this.hero.offset.y = 0;
    for (const f of this.foes) f.offset.x = f.offset.y = 0;
    this.tweens.add({
      targets: [this.orderBar, this.logBox, this.menuBox, this.hintText, this.menuTitle],
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.events.emit('combat-ended', { outcome, slain, fled } satisfies CombatResult);
        this.scene.stop();
      },
    });
  }

  /** Experience for a kill. A level gained mid-fight counts at once: the new health is there to use. */
  private gainXp(xp: number, reason: string): void {
    Experience.gain(xp, reason);
    const stats = this.world.stats;
    if (stats.maxHealth !== this.hero.c.maxHp) {
      Object.assign(this.hero.c, this.heroStats());
      this.drawOrder();
    }
  }

  /** The hero's numbers, from their level and what they're wearing and wielding. */
  private heroStats(): CombatantDef {
    const gear = Inventory.totals;
    const weapon = Inventory.equipped.mainHand;
    const stats = this.world.stats;
    return {
      id: 'hero',
      name: HERO_NAME,
      side: 'party',
      hp: Math.round(stats.health),
      maxHp: stats.maxHealth,
      ac: 10 + gear.defence,
      toHit: 3 + gear.attack + Experience.toHitBonus,
      damage: { count: 1, sides: weapon ? 6 : 4, bonus: gear.attack + Experience.damageBonus },
      quickness: 2,
      verb: weapon ? `swing your ${itemDef(weapon).name.toLowerCase()} at` : 'throw a punch at',
    };
  }

  private actorOf(c: Combatant): Actor {
    return this.actors.find((a) => a.c === c)!;
  }

  /** Where a beast stands to fight: beside the hero on its own side, clear of the spots others took. */
  private closeInSpot(foe: Actor, taken: Vec2[]): Vec2 {
    const h = this.hero.pos();
    const p = foe.pos();
    const base = Math.atan2(p.y - h.y, p.x - h.x);
    const map = this.world.map;
    for (const turn of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
      const x = h.x + Math.cos(base + turn) * 1.7;
      const y = h.y + Math.sin(base + turn) * 1.7;
      const free = taken.every((t) => Math.hypot(t.x - x, t.y - y) > 1.1);
      if (free && map.isWalkable(Math.floor(x), Math.floor(y))) return { x, y };
    }
    return p;
  }

  // ------------------------------------------------------------ menu

  private showMenu(heading: string, options: MenuOption[]): Promise<string> {
    return new Promise((resolve) => {
      this.menuHeading = heading;
      this.menuOptions = options;
      this.menuResolve = resolve;
      this.selected = Math.max(0, options.findIndex((o) => !o.disabled));
      this.buildMenu();
      this.select(this.selected);
    });
  }

  private pick(i: number): void {
    const option = this.menuOptions[i];
    const resolve = this.menuResolve;
    if (!option || !resolve) return;
    if (option.disabled) {
      GameAudio.hover();
      return;
    }
    GameAudio.click();
    this.clearMenu();
    resolve(option.id);
  }

  private clearMenu(): void {
    this.menuResolve = undefined;
    this.menuOnSelect = undefined;
    this.menuOptions = [];
    this.menuButtons = [];
    this.menuBox.removeAll(true);
    this.menuTitle.setText('');
    this.hintText.setText('');
  }

  private moveSelection(step: number): void {
    const n = this.menuOptions.length;
    if (n === 0) return;
    let i = this.selected;
    for (let k = 0; k < n; k++) {
      i = (i + step + n) % n;
      if (!this.menuOptions[i].disabled) break;
    }
    if (i !== this.selected) GameAudio.hover();
    this.select(i);
  }

  private select(i: number): void {
    this.selected = i;
    this.menuButtons.forEach((draw, k) => draw(k === i));
    const option = this.menuOptions[i];
    if (!option) return;
    this.hintText.setText(option.hint);
    this.menuOnSelect?.(option);
  }

  /** Lays the current options out as a row of buttons (two columns on narrow screens). */
  private buildMenu(): void {
    this.menuBox.removeAll(true);
    this.menuButtons = [];
    const options = this.menuOptions;
    if (options.length === 0) return;
    const { width, height } = this.scale;
    const narrow = width < NARROW;
    const cols = narrow ? 2 : Math.min(options.length, 5);
    const rows = Math.ceil(options.length / cols);
    const totalW = Math.min(narrow ? width - MARGIN * 2 : 820, width - MARGIN * 2);
    const bw = (totalW - GAP * (cols - 1)) / cols;
    const top = height - MARGIN - rows * BTN_H - (rows - 1) * GAP;

    options.forEach((option, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      // Centre a short last row.
      const inRow = row === rows - 1 ? options.length - row * cols : cols;
      const rowW = inRow * bw + (inRow - 1) * GAP;
      const x = width / 2 - rowW / 2 + col * (bw + GAP) + bw / 2;
      const y = top + row * (BTN_H + GAP) + BTN_H / 2;
      const bg = this.add.graphics();
      const key = this.add.text(-bw / 2 + 12, 0, `${i + 1}`, { fontFamily: FONT, fontSize: '13px', color: THEME.dimText }).setOrigin(0, 0.5);
      const label = this.add
        .text(6, 0, option.label, { fontFamily: FONT, fontSize: narrow ? '16px' : '17px', color: THEME.text })
        .setOrigin(0.5);
      if (label.width > bw - 34) label.setScale((bw - 34) / label.width);
      const button = this.add.container(x, y, [bg, key, label]);
      const draw = (on: boolean) => {
        bg.clear();
        bg.fillStyle(on ? THEME.panelLight : THEME.panel, 0.94);
        bg.fillRoundedRect(-bw / 2, -BTN_H / 2, bw, BTN_H, 9);
        bg.lineStyle(on ? 2.5 : 1.5, THEME.gold, on ? 1 : 0.55);
        bg.strokeRoundedRect(-bw / 2, -BTN_H / 2, bw, BTN_H, 9);
        label.setColor(option.disabled ? THEME.dimText : on ? THEME.goldText : THEME.text);
        button.setAlpha(option.disabled ? 0.55 : 1);
      };
      button.setSize(bw, BTN_H).setInteractive({ useHandCursor: !option.disabled });
      button.on('pointerover', () => this.select(i));
      button.on('pointerup', () => this.pick(i));
      this.menuBox.add(button);
      this.menuButtons.push(draw);
    });

    this.menuTitle.setText(this.menuHeading).setPosition(width / 2, top - 30);
    this.hintText.setPosition(width / 2, top - 8).setWordWrapWidth(Math.min(width - MARGIN * 2, 720));
    this.layoutLog();
  }

  // ------------------------------------------------------------ order bar and log

  /** The turn order along the top: a card for each fighter, the one acting raised and lit. */
  private drawOrder(): void {
    this.orderBar.removeAll(true);
    const order = this.battle.order.length > 0 ? this.battle.order : this.battle.combatants;
    const current = this.battle.order.length > 0 ? this.battle.current : undefined;
    const totalW = order.length * CHIP_W + (order.length - 1) * 6;
    const round = this.add
      .text(0, 0, this.battle.order.length > 0 ? `Round ${this.battle.round}` : 'Initiative', {
        fontFamily: FONT, fontSize: '14px', color: THEME.goldText, stroke: '#000000', strokeThickness: 3,
      })
      .setOrigin(0.5, 0);
    this.orderBar.add(round);
    order.forEach((c, i) => {
      const x = -totalW / 2 + i * (CHIP_W + 6);
      const active = c === current;
      const out = c.hp <= 0 || c.fled;
      const chip = this.add.container(x, active ? 22 : 26);
      const bg = this.add.graphics();
      bg.fillStyle(THEME.panel, 0.92);
      bg.fillRoundedRect(0, 0, CHIP_W, CHIP_H, 8);
      bg.lineStyle(active ? 3 : 1.5, c.side === 'party' ? 0x8fbf6a : THEME.gold, active ? 1 : 0.5);
      bg.strokeRoundedRect(0, 0, CHIP_W, CHIP_H, 8);
      const portrait = c.side === 'party' ? this.add.image(CHIP_W / 2, 54, 'player', 0) : this.add.image(CHIP_W / 2, 50, 'creature-wolf', 0);
      portrait.setOrigin(0.5, 1);
      if (c.side === 'party') portrait.setCrop(0, 4, 32, 40);
      const name = this.add
        .text(CHIP_W / 2, 56, c.name, { fontFamily: FONT, fontSize: '11px', color: active ? THEME.goldText : THEME.text })
        .setOrigin(0.5, 0);
      if (name.width > CHIP_W - 6) name.setScale((CHIP_W - 6) / name.width);
      const bar = this.add.graphics();
      const t = Phaser.Math.Clamp(c.hp / c.maxHp, 0, 1);
      bar.fillStyle(0x3a0e0b, 1);
      bar.fillRect(8, 73, CHIP_W - 16, 5);
      bar.fillStyle(t > 0.5 ? 0x5fae3c : t > 0.25 ? 0xd9a22a : 0xc8352a, 1);
      bar.fillRect(8, 73, (CHIP_W - 16) * t, 5);
      const hp = this.add
        .text(CHIP_W / 2, 79, out ? (c.fled ? 'fled' : 'down') : `${c.hp}/${c.maxHp}`, { fontFamily: FONT, fontSize: '10px', color: THEME.dimText })
        .setOrigin(0.5, 0);
      chip.add([bg, portrait, name, bar, hp]);
      if (c.defending && !out) {
        const shield = this.add.text(CHIP_W - 6, 4, '+4', { fontFamily: FONT, fontSize: '10px', color: '#9cd3ff' }).setOrigin(1, 0);
        chip.add(shield);
      }
      if (out) {
        chip.setAlpha(0.45);
        portrait.setTint(0x888888);
      }
      if (active) {
        const arrow = this.add.graphics();
        arrow.fillStyle(THEME.gold, 1);
        arrow.fillTriangle(CHIP_W / 2 - 6, CHIP_H + 4, CHIP_W / 2 + 6, CHIP_H + 4, CHIP_W / 2, CHIP_H + 10);
        chip.add(arrow);
      }
      this.orderBar.add(chip);
    });
  }

  private log(line: string): void {
    this.logLines.push(line);
    if (this.logLines.length > LOG_LINES) this.logLines.shift();
    this.layoutLog();
  }

  /** The last few lines of what happened, just above the menu (or at the bottom when there's no menu). */
  private layoutLog(): void {
    this.logBox.removeAll(true);
    if (this.logLines.length === 0) return;
    const { width, height } = this.scale;
    const w = Math.min(width - MARGIN * 2, 720);
    const texts = this.logLines.map((line, i) =>
      this.add.text(0, 0, line, {
        fontFamily: FONT,
        fontSize: width < NARROW ? '13px' : '14px',
        color: i === this.logLines.length - 1 ? THEME.text : THEME.dimText,
        wordWrap: { width: w - 24 },
      }),
    );
    const h = texts.reduce((n, t) => n + t.height + 3, 0) + 14;
    const menuTop = this.menuOptions.length > 0 ? this.menuTitle.y - 22 : height - MARGIN;
    const top = menuTop - h - 6;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.55);
    bg.fillRoundedRect(width / 2 - w / 2, top, w, h, 8);
    this.logBox.add(bg);
    let y = top + 7;
    for (const t of texts) {
      t.setPosition(width / 2 - w / 2 + 12, y);
      y += t.height + 3;
      this.logBox.add(t);
    }
  }

  private layout(): void {
    const { width } = this.scale;
    const chipsW = this.battle.combatants.length * (CHIP_W + 6);
    // Beside the health bars when there's room, otherwise just below them.
    const y = width >= chipsW + 2 * 210 ? MARGIN - 6 : 68;
    this.orderBar.setPosition(Math.round(width / 2), y);
    this.drawOrder();
    if (this.menuOptions.length > 0) {
      this.buildMenu();
      this.select(this.selected);
    } else {
      this.layoutLog();
    }
  }

  // ------------------------------------------------------------ effects

  /** Screen position just above an actor's head. */
  private headOf(actor: Actor): Vec2 {
    const cam = this.world.cameras.main;
    return {
      x: (actor.sprite.x - cam.worldView.x) * cam.zoom,
      y: (actor.sprite.y - actor.height - cam.worldView.y) * cam.zoom - 10,
    };
  }

  /** A d20 tumbles over the actor's head and lands on `value`. */
  private rollDie(actor: Actor, value: number, bonus: string): Promise<void> {
    GameAudio.dice();
    const p = this.headOf(actor);
    const die = this.add.graphics();
    const r = 18;
    const corners = Array.from({ length: 6 }, (_, k) => {
      const a = Math.PI / 6 + (k * Math.PI) / 3;
      return new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r);
    });
    die.fillStyle(0xf3e2b3, 1);
    die.fillPoints(corners, true);
    die.lineStyle(2, 0x2a1a08, 1);
    die.strokePoints(corners, true, true);
    // The facets of the near face.
    die.lineStyle(1, 0x8a6a3a, 0.8);
    die.strokeTriangle(0, -r * 0.62, r * 0.6, r * 0.38, -r * 0.6, r * 0.38);
    const text = this.add.text(0, 2, '?', { fontFamily: FONT, fontSize: '17px', color: '#2a1a08', fontStyle: 'bold' }).setOrigin(0.5);
    const extra = this.add
      .text(r + 4, 2, '', { fontFamily: FONT, fontSize: '15px', color: THEME.goldText, stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0, 0.5);
    const box = this.add.container(p.x, p.y, [die, text, extra]).setScale(0.4);
    this.tweens.add({ targets: box, scale: 1, angle: { from: -200, to: 0 }, duration: 460, ease: 'Back.easeOut' });
    const spin = this.time.addEvent({ delay: 55, repeat: 7, callback: () => text.setText(`${1 + Math.floor(Math.random() * 20)}`) });
    return new Promise((resolve) => {
      this.time.delayedCall(520, () => {
        spin.remove();
        text.setText(`${value}`).setColor(value === 20 ? '#a86e00' : value === 1 ? '#a8201a' : '#2a1a08');
        extra.setText(bonus);
        this.tweens.add({ targets: box, scale: 1.2, duration: 90, yoyo: true });
        this.tweens.add({ targets: box, alpha: 0, y: p.y - 14, delay: 900, duration: 300, onComplete: () => box.destroy() });
        this.time.delayedCall(260, () => resolve());
      });
    });
  }

  /** Floating words or numbers rising from an actor. */
  private float(actor: Actor, text: string, color: string, big = false): void {
    const p = this.headOf(actor);
    const t = this.add
      .text(p.x, p.y - 4, text, {
        fontFamily: FONT, fontSize: big ? '24px' : '19px', color, stroke: '#000000', strokeThickness: 4, fontStyle: 'bold',
      })
      .setOrigin(0.5, 1);
    this.tweens.add({ targets: t, y: p.y - 40, duration: 1100, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 750, duration: 400, onComplete: () => t.destroy() });
  }

  /** Big words across the middle of the screen. */
  private banner(text: string, friendly = false): void {
    const { width, height } = this.scale;
    const t = this.add
      .text(width / 2, height * 0.36, text, titleStyle(width < NARROW ? 26 : 34))
      .setOrigin(0.5)
      .setAlpha(0);
    if (!friendly) t.setColor('#e8a07a');
    this.tweens.add({ targets: t, alpha: 1, scale: { from: 0.85, to: 1 }, duration: 180, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 800, duration: 300, onComplete: () => t.destroy() });
  }

  /** Lunge towards the target and back (a heavy blow winds up first). */
  private async lunge(attacker: Actor, target: Actor, heavy: boolean): Promise<void> {
    const dx = target.sprite.x - attacker.sprite.x;
    const dy = target.sprite.y - attacker.sprite.y;
    const len = Math.hypot(dx, dy) || 1;
    const reach = attacker.creature ? 16 : heavy ? 14 : 10;
    if (heavy) await this.nudge(attacker.offset, (-dx / len) * 5, (-dy / len) * 5, 160);
    await this.nudge(attacker.offset, (dx / len) * reach, (dy / len) * reach, 110);
    void this.nudge(attacker.offset, 0, 0, 180);
  }

  /** A quick hop or sidestep, returning to where it was. */
  private async hop(offset: Vec2, x: number, y: number): Promise<void> {
    await this.nudge(offset, x, y, 100);
    await this.nudge(offset, 0, 0, 140);
  }

  private nudge(offset: Vec2, x: number, y: number, ms: number): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ targets: offset, x, y, duration: ms, ease: 'Sine.easeOut', onComplete: () => resolve() }));
  }

  /** Flash red when struck. */
  private flash(actor: Actor): void {
    actor.sprite.setTintFill(0xff5040);
    this.time.delayedCall(90, () => actor.sprite.clearTint());
    this.time.delayedCall(170, () => actor.sprite.setTintFill(0xff5040));
    this.time.delayedCall(250, () => actor.sprite.clearTint());
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }
}
