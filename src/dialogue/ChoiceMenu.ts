import type { DialogueChoice } from './Dialogue';

/**
 * How a node's replies are laid out, so a long list doesn't climb half way up
 * the screen. Pure, so the rules can be tested without Phaser.
 *
 * A short list is shown as it is. A long one is folded: what's new and matters
 * now (a `key` reply not yet asked) stays up front, and the everyday questions go
 * under one "Ask about…" row that opens them as a second list. If a list is still
 * longer than the room there is, it scrolls; the goodbye stays pinned below it.
 */

/** One row in a list: a reply (by its index in the node's choices), "Ask about…", or "Back". */
export type MenuRow = number | 'more' | 'back';

export interface MenuView {
  /** Rows that scroll when there are more than fit. */
  scroll: MenuRow[];
  /** Rows always shown below them: the goodbye, or "Back". */
  pinned: MenuRow[];
}

export interface ChoiceMenu {
  top: MenuView;
  /** The folded-away questions, when there are some. */
  sub?: MenuView;
}

export interface MenuInput {
  choices: DialogueChoice[];
  /** Whether each reply has been picked before. */
  heard: boolean[];
  /** Whether the last reply leaves the conversation (it's kept at the bottom). */
  lastLeaves: boolean;
  /** How many rows fit. */
  fit: number;
}

/** Whether a reply is new and to do with what's going on: a `key` reply, or one that sets something off. */
export const isKey = (c: DialogueChoice): boolean => !!c.key || !!c.action;

export function arrangeChoices({ choices, heard, lastLeaves, fit }: MenuInput): ChoiceMenu {
  const all = choices.map((_, i) => i);
  const pinned = lastLeaves && choices.length > 1 ? [all.pop()!] : [];
  if (choices.length <= fit) return { top: { scroll: all, pinned } };
  const fresh = all.filter((i) => isKey(choices[i]) && !heard[i]);
  const rest = all.filter((i) => !fresh.includes(i));
  // Folding only helps when it leaves something up front and puts away more than one question.
  if (fresh.length === 0 || rest.length < 2) return { top: { scroll: all, pinned } };
  return {
    top: { scroll: [...fresh, 'more'], pinned },
    sub: { scroll: rest, pinned: ['back'] },
  };
}

/** The first row of a scrolling list to show so `selected` (an index into it) is in view. */
export function scrollToShow(offset: number, selected: number, visible: number, total: number): number {
  if (selected < offset) offset = selected;
  else if (selected >= offset + visible) offset = selected - visible + 1;
  return Math.max(0, Math.min(offset, Math.max(0, total - visible)));
}
