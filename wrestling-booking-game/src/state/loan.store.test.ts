// The bank calling, and what happens once the booker answers.

import { describe, expect, it, beforeEach } from 'vitest';
import { useGameStore } from './store';
import { defaultWorldSettings } from '../engine/world/settings';
import { maybeOfferLoan, tickLoan, expireStaleLoanOffer, answerLoanOffer } from './storeHelpers';
import { loanTermsFor } from '../engine/economy/loan';

function newGame() {
  useGameStore.getState().newGame({
    ...defaultWorldSettings(),
    seed: 'loan-1',
    startingRosterSize: 14,
    ownerMandatesEnabled: true,
  });
}

beforeEach(newGame);

describe('the bank calling', () => {
  it('makes no offer while the promotion is solvent', () => {
    useGameStore.setState((s) => {
      s.world!.weeksInTheRed = 0;
      maybeOfferLoan(s.world!);
    });
    expect(useGameStore.getState().world!.pendingLoanOffer).toBeNull();
  });

  it('offers a loan once weeksInTheRed reaches the trigger, sized against payroll', () => {
    useGameStore.setState((s) => {
      s.world!.weeksInTheRed = s.world!.settings.loanTriggerWeeksInTheRed;
      maybeOfferLoan(s.world!);
    });
    const world = useGameStore.getState().world!;
    expect(world.pendingLoanOffer).not.toBeNull();
    expect(world.pendingLoanOffer!.attemptNumber).toBe(1);
  });

  it('never offers a second loan while one is already active', () => {
    useGameStore.setState((s) => {
      const world = s.world!;
      world.weeksInTheRed = world.settings.loanTriggerWeeksInTheRed;
      world.activeLoan = { attemptNumber: 1, tier: 'small', borrowed: 1000, totalOwed: 1300, weeklyPayment: 50, weeksRemaining: 10, startedWeek: 1 };
      maybeOfferLoan(world);
    });
    expect(useGameStore.getState().world!.pendingLoanOffer).toBeNull();
  });

  it('will not offer a second one until the cooldown has actually run', () => {
    useGameStore.setState((s) => {
      const world = s.world!;
      world.loansTaken = 1;
      world.solventWeeksSinceLastLoan = world.settings.loanCooldownWeeks1st - 1;
      world.weeksInTheRed = world.settings.loanTriggerWeeksInTheRed;
      maybeOfferLoan(world);
    });
    expect(useGameStore.getState().world!.pendingLoanOffer).toBeNull();

    useGameStore.setState((s) => {
      const world = s.world!;
      world.solventWeeksSinceLastLoan = world.settings.loanCooldownWeeks1st;
      maybeOfferLoan(world);
    });
    const offer = useGameStore.getState().world!.pendingLoanOffer;
    expect(offer).not.toBeNull();
    expect(offer!.attemptNumber).toBe(2);
  });
});

describe('a stale offer', () => {
  it('lapses after sitting unanswered for a week', () => {
    useGameStore.setState((s) => {
      s.world!.pendingLoanOffer = { attemptNumber: 1, openedWeek: s.world!.week, payrollAtOffer: 5000 };
    });
    // Same week: not stale yet.
    useGameStore.setState((s) => expireStaleLoanOffer(s.world!));
    expect(useGameStore.getState().world!.pendingLoanOffer).not.toBeNull();

    useGameStore.setState((s) => {
      s.world!.week += 1;
      expireStaleLoanOffer(s.world!);
    });
    expect(useGameStore.getState().world!.pendingLoanOffer).toBeNull();
  });
});

describe('answering the offer', () => {
  function offered() {
    useGameStore.setState((s) => {
      s.world!.pendingLoanOffer = { attemptNumber: 1, openedWeek: s.world!.week, payrollAtOffer: 20_000 };
    });
    return useGameStore.getState().world!.pendingLoanOffer!;
  }

  it('turning it down leaves no loan and no obligation', () => {
    offered();
    const before = useGameStore.getState().world!.promotion.bankBalance;
    useGameStore.setState((s) => answerLoanOffer(s.world!, null));

    const world = useGameStore.getState().world!;
    expect(world.pendingLoanOffer).toBeNull();
    expect(world.activeLoan).toBeNull();
    expect(world.promotion.bankBalance).toBe(before);
    expect(world.mandateStrikes).toBe(0);
  });

  it('taking a tier credits the bank, opens a real loan, and costs the owner strikes', () => {
    const offer = offered();
    const before = useGameStore.getState().world!.promotion.bankBalance;
    const terms = loanTermsFor(offer.attemptNumber, offer.payrollAtOffer, useGameStore.getState().world!.settings);

    useGameStore.setState((s) => answerLoanOffer(s.world!, 'medium'));

    const world = useGameStore.getState().world!;
    expect(world.pendingLoanOffer).toBeNull();
    expect(world.activeLoan).not.toBeNull();
    expect(world.activeLoan!.borrowed).toBe(terms.tiers.medium);
    expect(world.promotion.bankBalance).toBe(before + terms.tiers.medium);
    expect(world.loansTaken).toBe(1);
    expect(world.solventWeeksSinceLastLoan).toBe(0);
    expect(world.mandateStrikes).toBe(terms.mandateStrikes);
  });

  it('can be the strike that gets the booker fired', () => {
    offered();
    useGameStore.setState((s) => {
      s.world!.mandateStrikes = s.world!.settings.mandateStrikesBeforeFiring - 1;
      answerLoanOffer(s.world!, 'large');
    });
    expect(useGameStore.getState().world!.fired).not.toBeNull();
  });

  it('does nothing when there is no pending offer to answer', () => {
    const before = useGameStore.getState().world!.promotion.bankBalance;
    useGameStore.setState((s) => answerLoanOffer(s.world!, 'large'));
    const world = useGameStore.getState().world!;
    expect(world.activeLoan).toBeNull();
    expect(world.promotion.bankBalance).toBe(before);
  });
});

describe('the weekly tick', () => {
  it('deducts the payment automatically, unconditionally, every week', () => {
    useGameStore.setState((s) => {
      s.world!.activeLoan = {
        attemptNumber: 1,
        tier: 'small',
        borrowed: 5000,
        totalOwed: 6500,
        weeklyPayment: 250,
        weeksRemaining: 3,
        startedWeek: s.world!.week,
      };
    });
    const before = useGameStore.getState().world!.promotion.bankBalance;
    useGameStore.setState((s) => tickLoan(s.world!));

    const world = useGameStore.getState().world!;
    expect(world.promotion.bankBalance).toBe(before - 250);
    expect(world.activeLoan!.weeksRemaining).toBe(2);
  });

  it('deducts it even when it drives the bank balance further negative', () => {
    useGameStore.setState((s) => {
      s.world!.promotion.bankBalance = -100;
      s.world!.activeLoan = {
        attemptNumber: 1,
        tier: 'small',
        borrowed: 5000,
        totalOwed: 6500,
        weeklyPayment: 250,
        weeksRemaining: 5,
        startedWeek: s.world!.week,
      };
    });
    useGameStore.setState((s) => tickLoan(s.world!));
    expect(useGameStore.getState().world!.promotion.bankBalance).toBe(-350);
  });

  it('clears itself the week the balance hits zero', () => {
    useGameStore.setState((s) => {
      s.world!.activeLoan = {
        attemptNumber: 1,
        tier: 'small',
        borrowed: 5000,
        totalOwed: 6500,
        weeklyPayment: 250,
        weeksRemaining: 1,
        startedWeek: s.world!.week,
      };
    });
    useGameStore.setState((s) => tickLoan(s.world!));
    expect(useGameStore.getState().world!.activeLoan).toBeNull();
  });

  it('only counts a clean, loan-free week toward the cooldown', () => {
    useGameStore.setState((s) => {
      s.world!.promotion.bankBalance = 1000;
      s.world!.solventWeeksSinceLastLoan = 4;
      tickLoan(s.world!);
    });
    expect(useGameStore.getState().world!.solventWeeksSinceLastLoan).toBe(5);

    useGameStore.setState((s) => {
      s.world!.promotion.bankBalance = -1;
      s.world!.solventWeeksSinceLastLoan = 5;
      tickLoan(s.world!);
    });
    expect(useGameStore.getState().world!.solventWeeksSinceLastLoan).toBe(0);
  });

  it('does not let a week still repaying count toward the next cooldown', () => {
    useGameStore.setState((s) => {
      s.world!.promotion.bankBalance = 1000;
      s.world!.solventWeeksSinceLastLoan = 3;
      s.world!.activeLoan = {
        attemptNumber: 1,
        tier: 'small',
        borrowed: 5000,
        totalOwed: 6500,
        weeklyPayment: 250,
        weeksRemaining: 4,
        startedWeek: s.world!.week,
      };
      tickLoan(s.world!);
    });
    expect(useGameStore.getState().world!.solventWeeksSinceLastLoan).toBe(0);
  });
});
