// Signing, releasing, trading, and every other way a contract changes —
// role changes, free agency, renewals, secret signings, answering a rival's
// approach, and the release-request desk.
//
// Split out of store.ts purely for navigability; every action here is
// unchanged from what it always did.

import type { StateCreator } from 'zustand';
import { rng, type GameStore } from '../store';
import { dropFromCard, letThemGo, openBiddingWar, openSigningTalk } from '../storeHelpers';
import { clamp, chance } from '../../engine/rng';
import { clampMorale } from '../../engine/career/morale';
import { wire } from '../../engine/world/wire';
import { Cap, pronounsFor } from '../../engine/career/pronouns';
import { canChangeRole, refereeFromWrestler, managerFromWrestler } from '../../engine/career/transition';
import { evaluateTrade, tradeLine } from '../../engine/world/trades';
import { rivalRosterSize } from '../world';
import { createStandardContract, desiredContractWeeks, renewalRate } from '../../engine/economy/contracts';
import { contractDemand } from '../../engine/career/ego';
import { canSign, currentAskingRate } from '../../engine/world/freeAgents';
import { wontWorkForUs, stillHeldAgainstUs, ourPrice } from '../../engine/career/onOurWatch';
import { exitTerms, guaranteedShareFor, canBeSigned, refusalCost } from '../../engine/economy/termination';
import { releaseStigmaActive, releaseStigmaTerms } from '../../engine/economy/releaseStigma';
import {
  canSignSecretly,
  canWalkOut,
  revealImpact,
  secretSigningAppeal,
  secretWeeklyCost,
  stillSecret,
  weeksUntilFree,
} from '../../engine/world/secretSigning';
import { responseOutcome } from '../../engine/world/poaching';
import { addGrudge, grudgeAgainst } from '../../engine/world/grudges';
import { gimmickById } from '../../data/gimmicks';
import { groupGimmickById } from '../../data/groupGimmicks';
import { canFormGroup, formGroupGimmickStable } from '../../engine/world/tagTeams';
import { newVignette } from '../../engine/career/vignette';

type RosterAndContractsSlice = Pick<
  GameStore,
  | 'changeRole'
  | 'proposeTrade'
  | 'signFreeAgent'
  | 'setAssignment'
  | 'answerRenewal'
  | 'answerRenewalInterest'
  | 'answerRenewalWish'
  | 'chooseSigningGimmick'
  | 'chooseSigningDebut'
  | 'declineSigningPairing'
  | 'formSigningGroup'
  | 'answerColdMeeting'
  | 'chooseColdMeetingGimmick'
  | 'releaseWrestler'
  | 'signSecretly'
  | 'revealSecretSigning'
  | 'tearUpSecretSigning'
  | 'answerApproach'
  | 'answerReleaseRequest'
>;

export const createRosterAndContractsSlice: StateCreator<
  GameStore,
  [['zustand/immer', never]],
  [],
  RosterAndContractsSlice
> = (set, get) => ({
  changeRole: (wrestlerId, role) => {
    let outcome: { ok: boolean; reason: string | null } = { ok: false, reason: 'No game in progress.' };
    set((state) => {
      const world = state.world;
      if (!world) return;
      const person = world.wrestlers[wrestlerId];
      if (!person || person.promotionId !== world.promotion.id) {
        outcome = { ok: false, reason: 'They do not work for you.' };
        return;
      }

      const check = canChangeRole(person, role, world.week, world.settings);
      if (!check.ok) {
        outcome = { ok: false, reason: check.reason };
        return;
      }

      const currentYear = world.settings.startingYear + Math.floor(world.week / 52);

      // Coming out of whatever they were doing. The officiating record is
      // kept rather than deleted — a man who spent two years learning the
      // job does not forget it because he wrestled a season — it just stops
      // being available to book.
      const existingReferee = world.referees.find((r) => r.wrestlerId === wrestlerId);
      if (existingReferee) existingReferee.promotionId = null;
      if (world.defaultRefereeId === existingReferee?.id) world.defaultRefereeId = null;

      person.role = role;
      person.roleSinceWeek = world.week;

      if (role === 'referee') {
        if (existingReferee) {
          existingReferee.promotionId = world.promotion.id;
          existingReferee.name = person.name;
          existingReferee.injury = person.injury;
        } else {
          world.referees.push(refereeFromWrestler(person, currentYear, world.settings));
        }
      }

      if (role === 'manager' && !world.staffManagers.some((m) => m.wrestlerId === wrestlerId)) {
        world.staffManagers.push(managerFromWrestler(person));
      }

      // Whatever they were booked into this week, they are not doing it now.
      for (const segment of [...world.currentCard, ...world.currentPromos]) {
        segment.participants = segment.participants.filter((p) => p.wrestlerId !== wrestlerId);
        if (segment.guestRefereeId === wrestlerId) segment.guestRefereeId = null;
        if (role !== 'manager') {
          segment.managerIds = (segment.managerIds ?? []).filter(
            (m) => m.managerId !== `mgr-of-${wrestlerId}`,
          );
        }
        if (role !== 'referee' && segment.refereeId === existingReferee?.id) segment.refereeId = null;
      }

      outcome = { ok: true, reason: null };
    });
    return outcome;
  },

  proposeTrade: (outgoingId, rivalId, incomingId, cashFromYou) => {
    let verdict = { accepted: false, reason: 'No game in progress.' };
    set((state) => {
      const world = state.world;
      if (!world) return;
      const outgoing = world.wrestlers[outgoingId];
      const rival = world.rivals.find((r) => r.id === rivalId);
      const incoming = incomingId ? world.wrestlers[incomingId] : null;
      if (!outgoing || !rival || outgoing.promotionId !== world.promotion.id) {
        verdict = { accepted: false, reason: 'That deal does not exist.' };
        return;
      }
      if (incoming && incoming.promotionId !== rival.id) {
        verdict = { accepted: false, reason: 'They do not work for them.' };
        return;
      }
      if (cashFromYou > world.promotion.bankBalance) {
        verdict = { accepted: false, reason: 'You do not have that.' };
        return;
      }

      const answer = evaluateTrade({
        offer: { outgoing, incoming: incoming ?? null, cashFromYou },
        them: rival,
        theirRosterSize: rival.rosterIds.length,
        targetRosterSize: rivalRosterSize(rival.rating, world.settings),
        settings: world.settings,
      });

      if (!answer.accepted) {
        // They will not take the call again for a while, so the player
        // cannot simply re-ask every week until the dice land.
        world.tradeRefusals[rivalId] = world.week;
        verdict = { accepted: false, reason: answer.reason };
        return;
      }

      // Done. Both contracts travel with their wrestlers untouched — that
      // is what makes a bad deal a real thing to be rid of.
      world.promotion.rosterIds = world.promotion.rosterIds.filter((id) => id !== outgoingId);
      rival.rosterIds.push(outgoingId);
      outgoing.promotionId = rival.id;
      outgoing.morale = clampMorale(outgoing.morale - world.settings.tradeMoraleCost, world.settings);
      dropFromCard(world, outgoingId);

      if (incoming) {
        rival.rosterIds = rival.rosterIds.filter((id) => id !== incoming.id);
        world.promotion.rosterIds.push(incoming.id);
        incoming.promotionId = world.promotion.id;
        incoming.morale = clampMorale(incoming.morale - world.settings.tradeMoraleCost, world.settings);
      }

      world.promotion.bankBalance -= cashFromYou;
      rival.bankBalance += cashFromYou;

      world.weeklyNews.push(
        wire(
          'signing',
          tradeLine(outgoing.name, incoming?.name ?? null, world.promotion.name, rival.name, cashFromYou),
          world.week,
        ),
      );
      verdict = { accepted: true, reason: answer.reason };
    });
    return verdict;
  },

  signFreeAgent: (wrestlerId) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const wrestler = world.wrestlers[wrestlerId];
      const agent = world.freeAgents.find((a) => a.wrestlerId === wrestlerId);
      if (!wrestler || !agent) return;
      if (!canSign(wrestler, world.promotion.bankBalance, world.settings)) return;
      // Ninety days means ninety days, including for the company he just
      // left. This is the thing the player traded a payout for.
      if (!canBeSigned(wrestler)) return;

      // And what this company did. A man who looks after himself does not
      // sign here while it is fresh, and the ones who will want paying for
      // it. Enforced in the store as well as greyed out on the page, so the
      // rule is the rule. See career/onOurWatch.ts.
      const held = stillHeldAgainstUs(world.promotion.deathsOnOurWatch ?? [], world.week, world.settings);
      if (wontWorkForUs(wrestler, held, world.settings)) return;

      const weeklyRate = ourPrice(
        currentAskingRate(agent, wrestler, world.economicClimate, world.settings, world.week),
        held,
        world.settings,
      );
      // Not what a person still holds against us (onOurWatch.ts, above) —
      // what the market thinks of this promotion's own recent behaviour.
      // See economy/releaseStigma.ts.
      const stigma = releaseStigmaTerms(
        wrestler,
        weeklyRate,
        releaseStigmaActive(world.solventWeeksSinceLastRelease, world.settings),
        world.settings,
      );

      wrestler.promotionId = world.promotion.id;
      wrestler.contract = {
        // The term he advertised in the pool, so the length a booker read on
        // Tuesday is the length he signs on Thursday.
        ...createStandardContract(wrestler, world.settings, world.settings.startingYear, agent.wantsWeeks),
        weeklyRate,
        // Somebody with a big opinion of themselves demands guarantees to
        // sign, not only to re-sign — folded together with any release
        // stigma premium, never stacked on top of it separately.
        guaranteedPct: stigma.guaranteedPct,
      };
      world.promotion.bankBalance -= stigma.signingBonus;
      world.promotion.rosterIds.push(wrestlerId);
      world.freeAgents = world.freeAgents.filter((a) => a.wrestlerId !== wrestlerId);
      openSigningTalk(world, wrestlerId);
    });
  },

  setAssignment: (wrestlerId, choice) => {
    set((state) => {
      const person = state.world?.wrestlers[wrestlerId];
      if (!person) return;
      person.assignment = choice;
    });
  },

  answerRenewal: (wrestlerId, accept) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const index = world.pendingRenewals.findIndex((r) => r.wrestlerId === wrestlerId);
      const offer = world.pendingRenewals[index];
      const member = world.wrestlers[wrestlerId];
      if (index < 0 || !offer || !member) return;

      world.pendingRenewals.splice(index, 1);

      if (accept) {
        // You paid what they asked, clauses and all. The clauses are the
        // part that will hurt later.
        member.contract = {
          ...createStandardContract(member, world.settings, world.settings.startingYear),
          weeklyRate: offer.demand.weeklyRate,
          clauses: [...offer.demand.clauses],
          // Guaranteed money is what the top of the card asks for and
          // nobody else gets. It is also what makes re-signing a star a
          // commitment rather than a line item — from here, cutting him
          // costs the rest of the paper.
          guaranteedPct: guaranteedShareFor(member.ego, world.settings),
        };
        member.morale = clampMorale(member.morale + 10, world.settings);
        return;
      }

      // Refused. They might take a plain deal anyway, or they might go.
      member.morale = clampMorale(member.morale - 15, world.settings);
      if (chance(rng, offer.demand.walkRisk)) {
        world.promotion.rosterIds = world.promotion.rosterIds.filter((id) => id !== wrestlerId);
        member.promotionId = null;
        member.contract = null;
        world.freeAgents.push({
          wrestlerId,
          reason: 'contractExpired',
          askingRate: offer.demand.weeklyRate,
          wantsWeeks: desiredContractWeeks(member, world.settings),
          weeksUnsigned: 0,
        });
      } else {
        member.contract = createStandardContract(member, world.settings, world.settings.startingYear);
      }
    });
  },

  // ---------------------------------------------------------------------
  // The renewal window — a real, booker-initiated conversation opened by
  // resolveWeek at renewalWindowWeeks, not an automatic demand at expiry.
  // Two steps, one conversation: answerRenewalInterest is the booker's own
  // "do we want them back," answerRenewalWish is what happens once the
  // answer was yes. See state/world.ts's RenewalTalk.

  answerRenewalInterest: (wrestlerId, interested) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const talk = world.renewalTalks.find((t) => t.wrestlerId === wrestlerId && t.stage === 'askInterest');
      if (!talk) return;

      if (!interested) {
        // The booker does not want them back. Nothing else to ask — the
        // deal plays out to a plain, quiet expiry when it runs down.
        world.renewalTalks = world.renewalTalks.filter((t) => t !== talk);
        return;
      }
      talk.stage = 'askWrestler';
    });
  },

  answerRenewalWish: (wrestlerId, choice) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const index = world.renewalTalks.findIndex((t) => t.wrestlerId === wrestlerId && t.stage === 'askWrestler');
      const talk = world.renewalTalks[index];
      const member = world.wrestlers[wrestlerId];
      if (index < 0 || !talk || !member || !member.contract) return;
      world.renewalTalks.splice(index, 1);

      // Warm exit — same plain expiry as the booker saying no above.
      if (choice === 'leave') return;

      if (choice === 'explore') {
        // Player-triggered, one-off — the shared stream, not an isolated
        // seed. See the RNG note in root CLAUDE.md: that trap is about
        // resolveWeek's own automatic rolls, not a click the booker made.
        openBiddingWar(world, rng, member, 'renewalAuction');
        return;
      }

      // 'stay' — the same negotiation the game has always run at expiry,
      // just reached a little earlier than the buzzer. answerRenewal
      // (above) handles whatever the booker decides from here, unchanged.
      const heldAtTheTable = stillHeldAgainstUs(world.promotion.deathsOnOurWatch ?? [], world.week, world.settings);
      const demand = contractDemand(member, renewalRate(member, world.settings), member.careerStatus, world.settings);
      world.pendingRenewals.push({
        wrestlerId,
        demand: { ...demand, weeklyRate: ourPrice(demand.weeklyRate, heldAtTheTable, world.settings) },
        openedWeek: world.week,
      });
    });
  },

  // ---------------------------------------------------------------------
  // The signing meeting — a real, booker-initiated "meet the booker"
  // conversation opened right after somebody lands on the roster (see
  // openSigningTalk in storeHelpers.ts). Two steps, same in-place-stage
  // pattern as the renewal window above: chooseSigningGimmick is the
  // booker deciding the character, formSigningGroup/declineSigningPairing
  // is whatever happens next. See state/world.ts's SigningTalk.

  chooseSigningGimmick: (wrestlerId, gimmickId) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const talk = world.signingTalks.find((t) => t.wrestlerId === wrestlerId && t.stage === 'pickGimmick');
      const wrestler = world.wrestlers[wrestlerId];
      const gimmick = gimmickById(gimmickId);
      if (!talk || !wrestler || !gimmick) return;

      // Every generated wrestler already has *a* gimmick — only actually
      // restyle them if the booker picked something different, same as
      // the gimmickRequest event's own gimmickChange handler.
      if (gimmick.id !== wrestler.gimmick.id) {
        wrestler.gimmick = gimmick;
        if (gimmick.masked === 'required') wrestler.masked = true;
        else if (gimmick.masked === 'forbidden') wrestler.masked = false;
        wrestler.gimmickFreshness = 100;
      }
      // The character is locked in; how the crowd actually meets it is a
      // second, real decision — see chooseSigningDebut.
      talk.stage = 'chooseDebut';
    });
  },

  chooseSigningDebut: (wrestlerId, choice) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const talk = world.signingTalks.find((t) => t.wrestlerId === wrestlerId && t.stage === 'chooseDebut');
      const wrestler = world.wrestlers[wrestlerId];
      if (!talk || !wrestler) return;

      if (choice === 'vignette') {
        // Can't afford it — nothing happens, same as any other unaffordable
        // booker decision in this game. The talk stays open for a real choice.
        if (world.promotion.bankBalance < world.settings.vignetteCost) return;
        world.promotion.bankBalance -= world.settings.vignetteCost;
        wrestler.vignette = newVignette(world.settings, world.week);
        // No debut wire yet — the whole point is nobody outside the office
        // knows this name exists. See engine/career/vignette.ts's payoff,
        // which fires the real "debuts tonight" news once it resolves.
        world.weeklyNews.push(
          wire(
            'debut',
            `${world.promotion.name} starts running mystery vignettes tonight — no name, no face, just a promise that somebody new is coming.`,
            world.week,
            'minor',
          ),
        );
      } else {
        // A plain free-agent signing has never carried its own wire line —
        // this is the moment the character actually locks in, so it is the
        // first real news anybody gets about the new arrival.
        world.weeklyNews.push(
          wire('debut', `${wrestler.name} debuts tonight as ${wrestler.gimmick.name} — a brand-new name for this crowd to learn.`, world.week, 'minor'),
        );
        world.pendingGimmickReactions.push({ kind: 'debut', name: wrestler.name, gimmickName: wrestler.gimmick.name });
      }

      talk.stage = 'offerPairing';
    });
  },

  declineSigningPairing: (wrestlerId) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      world.signingTalks = world.signingTalks.filter(
        (t) => !(t.wrestlerId === wrestlerId && t.stage === 'offerPairing'),
      );
    });
  },

  formSigningGroup: (wrestlerId, groupGimmickId, partnerIds) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const talkIndex = world.signingTalks.findIndex(
        (t) => t.wrestlerId === wrestlerId && t.stage === 'offerPairing',
      );
      const wrestler = world.wrestlers[wrestlerId];
      const group = groupGimmickById(groupGimmickId);
      if (talkIndex < 0 || !wrestler || !group) return;

      const partners = partnerIds.map((id) => world.wrestlers[id]);
      if (partners.some((p) => !p)) return;
      const members = [wrestler, ...partners.filter((p): p is NonNullable<typeof p> => Boolean(p))];

      const wantedSize = group.kind === 'tagTeam' ? 2 : 3;
      if (members.length < wantedSize || (group.kind === 'tagTeam' && members.length !== 2)) return;

      const rosterIds = new Set(world.promotion.rosterIds);
      const check = canFormGroup(members, world.stables, rosterIds, group.name);
      if (!check.ok) return;

      world.stables.push(formGroupGimmickStable(members, group, world.week, `stable-${world.nextId++}`));
      world.signingTalks.splice(talkIndex, 1);
      world.pendingGimmickReactions.push({ kind: 'pairing', name: group.name, gimmickName: group.name });
      world.weeklyNews.push(
        wire('team', `${group.name} debuts tonight, and this crowd better be paying attention — ${members.map((m) => m.name).join(', ')}.`, world.week, 'normal'),
      );
    });
  },

  // ---------------------------------------------------------------------
  // The forced cold-meeting — an act has sat ice cold too long
  // (World.coldMeetings, opened by resolveWeek's weeksIceCold clock). The
  // booker has exactly two ways out: relaunch the character, or cut them
  // loose. See CLAUDE.md's gimmick module design.

  answerColdMeeting: (wrestlerId, choice) => {
    if (choice === 'release') {
      set((state) => {
        const world = state.world;
        if (!world) return;
        world.coldMeetings = world.coldMeetings.filter((m) => m.wrestlerId !== wrestlerId);
      });
      // Same release everybody else gets — this is not a special, cheaper
      // exit, just the same door opened from the other side of the desk.
      get().releaseWrestler(wrestlerId);
      return;
    }
    set((state) => {
      const world = state.world;
      if (!world) return;
      const meeting = world.coldMeetings.find((m) => m.wrestlerId === wrestlerId && m.stage === 'decide');
      if (!meeting) return;
      meeting.stage = 'pickGimmick';
    });
  },

  chooseColdMeetingGimmick: (wrestlerId, gimmickId) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const index = world.coldMeetings.findIndex((m) => m.wrestlerId === wrestlerId && m.stage === 'pickGimmick');
      const wrestler = world.wrestlers[wrestlerId];
      const gimmick = gimmickById(gimmickId);
      if (index < 0 || !wrestler || !gimmick) return;

      // A relaunch, whether or not the character itself actually changed —
      // same "clean slate" the repackage event has always granted. Picking
      // the identical gimmick again is a real choice ("this can still work,
      // give it a real push") and earns the same reset, not a smaller one.
      if (gimmick.id !== wrestler.gimmick.id) {
        wrestler.gimmick = gimmick;
        if (gimmick.masked === 'required') wrestler.masked = true;
        else if (gimmick.masked === 'forbidden') wrestler.masked = false;
      }
      wrestler.gimmickFreshness = 100;
      wrestler.weeksIceCold = 0;
      world.coldMeetings.splice(index, 1);
      world.pendingGimmickReactions.push({ kind: 'relaunch', name: wrestler.name, gimmickName: gimmick.name });
      world.weeklyNews.push(
        wire(
          'debut',
          `${wrestler.name} relaunches tonight as ${gimmick.name} — the old character had gone stone cold, and the office finally pulled the trigger on something new.`,
          world.week,
          'normal',
        ),
      );
    });
  },

  releaseWrestler: (wrestlerId) => {
    let outcome = { ok: false, reason: 'No game in progress.' as string | null, cost: 0 };
    set((state) => {
      const world = state.world;
      if (!world) return;
      const wrestler = world.wrestlers[wrestlerId];
      if (!wrestler) return;

      const terms = exitTerms(wrestler, 'fired', world.settings, world.promotion.name);
      // You cannot cut somebody you cannot afford to pay off. This is the
      // whole weight of guaranteed money: a deal you regret is a deal you
      // are stuck inside until you can fund the way out.
      if (terms.severance > world.promotion.bankBalance) {
        outcome = {
          ok: false,
          reason: 'You cannot cover what is guaranteed on that deal.',
          cost: terms.severance,
        };
        return;
      }

      world.promotion.bankBalance -= terms.severance;
      letThemGo(world, wrestler, terms);
      outcome = { ok: true, reason: null, cost: terms.severance };
    });
    return outcome;
  },

  signSecretly: (wrestlerId) => {
    let outcome: { ok: boolean; reason: string | null } = { ok: false, reason: 'No world.' };
    set((state) => {
      const world = state.world;
      const person = world?.wrestlers[wrestlerId];
      if (!world || !person) return;

      if (!canSignSecretly(person, world.promotion.id, world.settings)) {
        outcome = {
          ok: false,
          reason: 'There is nothing to talk about. That deal is not up any time soon.',
        };
        return;
      }
      if (world.secretSignings.some((s2) => s2.wrestlerId === wrestlerId)) {
        outcome = { ok: false, reason: 'You already have an understanding there.' };
        return;
      }
      const cost = secretWeeklyCost(person, world.settings);
      // Nothing is paid today — nothing is signed today. But you do not
      // shake on a number you cannot cover when it comes due.
      if (world.promotion.bankBalance < cost * world.settings.secretSigningProofWeeks) {
        outcome = { ok: false, reason: 'You cannot cover what you would be promising.' };
        return;
      }
      // Whether they go for it at all. A happy man in a good spot mostly
      // does not, which is why the list of who *would* is the interesting
      // half of the screen.
      if (!chance(rng, secretSigningAppeal(person, world.settings))) {
        outcome = { ok: false, reason: `${person.name} turned it down, and now knows you asked.` };
        // They know. That is a real cost of trying.
        person.morale = clampMorale(person.morale - world.settings.secretSigningRefusalMorale, world.settings);
        return;
      }

      const rival = world.rivals.find((r) => r.id === person.promotionId);
      world.secretSignings.push({
        wrestlerId,
        wrestlerName: person.name,
        fromPromotionId: person.promotionId!,
        fromPromotionName: rival?.name ?? 'somewhere else',
        agreedWeek: world.week,
        // What was shaken on: the week his deal runs out. He works every
        // date they have booked him for between now and then.
        freeWeek: world.week + weeksUntilFree(person),
        weeklyRate: cost,
        signedWeek: null,
        blownWeek: null,
      });
      outcome = { ok: true, reason: null };
      // Deliberately no wire item. Nothing has happened yet — that is the
      // entire point.
    });
    return outcome;
  },

  revealSecretSigning: (wrestlerId) => {
    set((state) => {
      const world = state.world;
      const index = world?.secretSignings.findIndex((s2) => s2.wrestlerId === wrestlerId) ?? -1;
      if (!world || index < 0) return;
      const signing = world.secretSignings[index]!;
      const person = world.wrestlers[wrestlerId];
      if (!person) return;
      // He cannot walk out on your show while he is still working theirs.
      // The whole thing rests on this: no man is under two contracts.
      if (!canWalkOut(signing)) return;

      const impact = revealImpact(signing, person, world.week, world.settings);
      const wasSecret = stillSecret(signing);

      // He has been yours since his old deal lapsed. This is the moment the
      // rest of the world finds out — which is also the moment he becomes
      // somebody you can book.
      for (const rival of world.rivals) {
        rival.rosterIds = rival.rosterIds.filter((id) => id !== wrestlerId);
      }
      person.promotionId = world.promotion.id;
      if (!world.promotion.rosterIds.includes(wrestlerId)) world.promotion.rosterIds.push(wrestlerId);
      world.secretSignings.splice(index, 1);

      // The pop. A reveal nobody saw coming is worth several times a
      // signing announcement; one the sheets already printed is worth a
      // fraction of it.
      person.momentum = clamp(person.momentum + impact * world.settings.revealMomentumPerImpact, 0, 100);
      person.popularity = clamp(person.popularity + impact * world.settings.revealPopularityPerImpact, 0, 100);
      world.promotion.rating = clamp(
        world.promotion.rating + impact * world.settings.revealCompanyRatingPerImpact,
        0,
        100,
      );
      const victim = world.rivals.find((r) => r.id === signing.fromPromotionId);
      if (victim) {
        victim.rating = clamp(victim.rating - impact * world.settings.revealRivalRatingPerImpact, 0, 100);

        // They remember this the same way they remember a burial on a joint
        // show — see engine/world/grudges.ts. It is the reason a rival who
        // has had somebody stolen out from under them is exactly the kind of
        // company that later sends somebody through the curtain of their
        // own accord (data/incidents.ts's rivalInvasion).
        const remembered = addGrudge(
          grudgeAgainst(world.grudges, victim.id),
          victim.id,
          impact * world.settings.grudgeSecretSigningPerImpact,
          `You took ${person.name} right out from under them.`,
          world.week,
        );
        world.grudges = world.grudges.filter((g) => g.promotionId !== victim.id);
        if (remembered) world.grudges.push(remembered);
      }

      const sinceFree = Math.max(0, world.week - signing.freeWeek);
      world.weeklyNews.push(
        wire(
          'signing',
          !wasSecret
            ? `${person.name} finally turned up for ${world.promotion.name} tonight. The sheets had already called it, though, which took most of the surprise right out of it.`
            : sinceFree <= 1
              ? `${person.name} walked right out on ${world.promotion.name}'s show tonight, and this one nobody saw coming. ${Cap(pronounsFor(person).they)} worked ${pronounsFor(person).their} last date for ${signing.fromPromotionName} on the very last day of that contract and had already signed here before the week was even out.`
              : `${person.name} walked right out on ${world.promotion.name}'s show tonight. Every soul in that building still had ${pronounsFor(person).them} penciled in at ${signing.fromPromotionName}. That deal quietly expired ${sinceFree} weeks ago, and ${pronounsFor(person).they} has been signed here the entire time.`,
          world.week,
          'lead',
        ),
      );
    });
  },

  tearUpSecretSigning: (wrestlerId) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const signing = world.secretSignings.find((s2) => s2.wrestlerId === wrestlerId);
      const person = world.wrestlers[wrestlerId];
      // Walking away from a handshake costs nothing, because a handshake is
      // nothing. Walking away from a signed contract nobody has seen means
      // releasing a man the world thinks still works somewhere else — so he
      // becomes exactly what he is: a free agent nobody has announced.
      if (signing?.signedWeek !== null && signing !== undefined && person) {
        person.promotionId = null;
        person.contract = null;
        world.promotion.rosterIds = world.promotion.rosterIds.filter((id) => id !== wrestlerId);
      }
      world.secretSignings = world.secretSignings.filter((s2) => s2.wrestlerId !== wrestlerId);
    });
  },

  answerApproach: (offerId, response) => {
    let outcome: { ok: boolean; reason: string | null } = { ok: false, reason: 'No world.' };
    set((state) => {
      const world = state.world;
      if (!world) return;
      const offer = world.approachOffers.find((o) => o.id === offerId && o.status === 'open');
      const target = offer ? world.wrestlers[offer.wrestlerId] : undefined;
      if (!offer || !target) {
        outcome = { ok: false, reason: 'That approach is closed.' };
        return;
      }

      const effect = responseOutcome(response, world.settings);
      offer.temptation = clamp(offer.temptation + effect.temptationDelta, 0, 100);
      if (target.contract && effect.rateMultiplier !== 1) {
        target.contract.weeklyRate = Math.round(target.contract.weeklyRate * effect.rateMultiplier);
      }
      target.morale = clampMorale(target.morale + effect.moraleDelta, world.settings);
      target.momentum = clamp(target.momentum + effect.momentumDelta, 0, 100);
      world.promotion.reputation = clamp(
        world.promotion.reputation + effect.reputationDelta,
        0,
        100,
      );
      // The rest of the room hears what he got. That is the cost of paying
      // one man to stay — see economy/perks.ts for the same idea.
      for (const id of world.promotion.rosterIds) {
        const member = world.wrestlers[id];
        if (!member || member.id === target.id || member.deceased) continue;
        member.morale = clampMorale(member.morale + effect.rosterMoraleDelta, world.settings);
      }
      // Answered, so it does not resolve itself on its date. Whether he
      // stays is still settled then, at the temptation you have left him on.
      offer.resolvesWeek = Math.max(offer.resolvesWeek, world.week + 1);
      world.weeklyNews.push(
        wire('signing', `${target.name}: ${effect.description}`, world.week),
      );
      outcome = { ok: true, reason: effect.description };
    });
    return outcome;
  },

  answerReleaseRequest: (wrestlerId, grant) => {
    set((state) => {
      const world = state.world;
      if (!world) return;
      const index = world.releaseRequests.findIndex((r) => r.wrestlerId === wrestlerId);
      const wrestler = world.wrestlers[wrestlerId];
      if (index < 0 || !wrestler) return;
      world.releaseRequests.splice(index, 1);

      if (!grant) {
        // He stays, and he is not happy about it. Saying no is often right
        // — he is still your wrestler and he still has to work.
        wrestler.morale = clampMorale(wrestler.morale - refusalCost(world.settings) * 2, world.settings);
        // And he remembers. Morale comes back; this does not. The next time
        // he is a free man and this company is in the room, they are not in
        // it — see economy/bidding.ts stanceToward.
        if (!wrestler.grudges) wrestler.grudges = [];
        if (!wrestler.grudges.includes(world.promotion.id)) wrestler.grudges.push(world.promotion.id);
        world.weeklyNews.push(
          wire(
            'departure',
            `${wrestler.name} asked for a release, straight up. ${Cap(pronounsFor(wrestler).they)} was told no in no uncertain terms, and stays right on this roster.`,
            world.week,
          ),
        );
        return;
      }

      const terms = exitTerms(wrestler, 'negotiatedRelease', world.settings, world.promotion.name);
      letThemGo(world, wrestler, terms);
    });
  },
});
