import { describe, expect, it } from 'vitest';
import { arrangeChoices, scrollToShow } from '../../src/dialogue/ChoiceMenu';
import type { DialogueChoice } from '../../src/dialogue/Dialogue';

const ask = (text: string, key = false): DialogueChoice => ({ text, next: text, ...(key ? { key } : {}) });
const bye: DialogueChoice = { text: 'Carry on.' };

/** The militiaman after the raid: five everyday questions, three about the goblins, and the goodbye. */
const MILITIA = [
  ask('What are you guarding against?'), ask('Is the road safe?'), ask('When is the market open?'),
  ask('Who are the soldiers at the north gate?'), ask("What's the notice board for?"),
  ask('They took my mother.', true), ask('What is the militia doing?', true), ask('They will come here next.', true),
  bye,
];
const none = (n: number) => new Array<boolean>(n).fill(false);

describe('laying out replies', () => {
  it('leaves a short list as it is, with the goodbye kept at the bottom', () => {
    const choices = MILITIA.slice(0, 4).concat(bye);
    expect(arrangeChoices({ choices, heard: none(5), lastLeaves: true, fit: 6 })).toEqual({
      top: { scroll: [0, 1, 2, 3], pinned: [4] },
    });
  });

  it('folds the everyday questions of a long list under "Ask about…", keeping the new ones up front', () => {
    const menu = arrangeChoices({ choices: MILITIA, heard: none(9), lastLeaves: true, fit: 6 });
    expect(menu.top).toEqual({ scroll: [5, 6, 7, 'more'], pinned: [8] });
    expect(menu.sub).toEqual({ scroll: [0, 1, 2, 3, 4], pinned: ['back'] });
  });

  it('puts a new reply away with the rest once it has been asked', () => {
    const heard = none(9);
    heard[5] = true;
    const menu = arrangeChoices({ choices: MILITIA, heard, lastLeaves: true, fit: 6 });
    expect(menu.top.scroll).toEqual([6, 7, 'more']);
    expect(menu.sub?.scroll).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('counts a reply that sets something off as new', () => {
    const choices = [...MILITIA.slice(0, 5), { text: 'Come with me.', next: 'join', action: 'companion:hire:wat' }, ...MILITIA.slice(0, 2), bye];
    expect(arrangeChoices({ choices, heard: none(9), lastLeaves: true, fit: 6 }).top.scroll).toEqual([5, 'more']);
  });

  it("doesn't fold a long list with nothing new in it: it scrolls instead", () => {
    const choices = [...MILITIA.slice(0, 5), ask('A'), ask('B'), bye];
    expect(arrangeChoices({ choices, heard: none(8), lastLeaves: true, fit: 6 })).toEqual({
      top: { scroll: [0, 1, 2, 3, 4, 5, 6], pinned: [7] },
    });
  });

  it("doesn't pin a last reply that carries on talking", () => {
    const choices = MILITIA.slice(0, 3);
    expect(arrangeChoices({ choices, heard: none(3), lastLeaves: false, fit: 6 }).top).toEqual({ scroll: [0, 1, 2], pinned: [] });
  });
});

describe('scrolling a list', () => {
  it('moves only as far as it must to keep the selected row in view', () => {
    expect(scrollToShow(0, 2, 4, 7)).toBe(0);
    expect(scrollToShow(0, 5, 4, 7)).toBe(2);
    expect(scrollToShow(3, 1, 4, 7)).toBe(1);
    expect(scrollToShow(0, 6, 4, 7)).toBe(3);
  });
});
