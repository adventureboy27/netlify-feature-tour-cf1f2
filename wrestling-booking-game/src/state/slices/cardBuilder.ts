// Building the card — who is in which segment, and filling it in when the
// player does not want to do it by hand.
//
// Split out of store.ts purely for navigability; every action here is
// unchanged from what it always did.

import type { StateCreator } from 'zustand';
import { rng, type GameStore } from '../store';
import { canWork, bookRivalCard } from '../../engine/world/rivalBooking';
import { recallBookings } from '../../engine/sim/freshness';
import { refusesToWorkWith, findRelationship } from '../../engine/career/relationships';
import { promoIsValid } from '../../engine/sim/promo';
import type { PromoTopicId } from '../../data/promoTopics';
import { shunned } from '../../engine/career/onOurWatch';
import { signedReferees, isAvailable as refereeIsAvailable } from '../../engine/sim/referees';
import { stipulationById } from '../../data/stipulations';
import { familyById } from '../../data/matchProps';
import { usableUnitsForFamily } from '../../engine/economy/matchProps';
import type { Id, Wrestler } from '../../engine/types';

type CardBuilderSlice = Pick<
  GameStore,
  | 'setSegmentParticipant'
  | 'removeSegmentParticipant'
  | 'setDarkMatchParticipant'
  | 'removeDarkMatchParticipant'
  | 'setSegmentRules'
  | 'setSegmentStipulation'
  | 'setSegmentGearUnits'
  | 'autoFillCard'
  | 'toggleSegmentTitle'
>;

export const createCardBuilderSlice: StateCreator<GameStore, [['zustand/immer', never]], [], CardBuilderSlice> = (
  set,
) => ({
  setSegmentParticipant: (slot, wrestlerId, side) => {
    set((state) => {
      const segment = state.world?.currentCard[slot];
      if (!segment) return;
      // A wrestler occupies exactly one slot in a segment at a time.
      segment.participants = segment.participants.filter((p) => p.wrestlerId !== wrestlerId);
      segment.participants.push({ wrestlerId, side, role: 'competitor' });
    });
  },

  removeSegmentParticipant: (slot, wrestlerId) => {
    set((state) => {
      const segment = state.world?.currentCard[slot];
      if (!segment) return;
      segment.participants = segment.participants.filter((p) => p.wrestlerId !== wrestlerId);
    });
  },

  setDarkMatchParticipant: (slot, wrestlerId, side) => {
    set((state) => {
      const segment = state.world?.currentDarkMatches[slot];
      if (!segment) return;
      segment.participants = segment.participants.filter((p) => p.wrestlerId !== wrestlerId);
      segment.participants.push({ wrestlerId, side, role: 'competitor' });
    });
  },

  removeDarkMatchParticipant: (slot, wrestlerId) => {
    set((state) => {
      const segment = state.world?.currentDarkMatches[slot];
      if (!segment) return;
      segment.participants = segment.participants.filter((p) => p.wrestlerId !== wrestlerId);
    });
  },

  setSegmentRules: (slot, rules) => {
    set((state) => {
      const segment = state.world?.currentCard[slot];
      if (!segment) return;
      Object.assign(segment.rules, rules);
    });
  },

  setSegmentStipulation: (slot, stipulationId) => {
    set((state) => {
      const segment = state.world?.currentCard[slot];
      if (!segment) return;
      segment.stipulation = stipulationId;
      // A gear assignment only makes sense for the stipulation it was picked
      // for — ladders left over from a Ladder Match mean nothing once the
      // slot becomes a Steel Cage. See data/matchProps.ts.
      segment.gearUnitIds = undefined;
    });
  },

  setSegmentGearUnits: (slot, unitIds) => {
    set((state) => {
      const world = state.world;
      const segment = world?.currentCard[slot];
      if (!world || !segment) return;
      const stipulation = segment.stipulation ? stipulationById(segment.stipulation) : null;
      const family = stipulation?.gearFamilyId ? familyById(stipulation.gearFamilyId) : null;
      // Nothing to assign gear to if the booked stipulation doesn't need any.
      if (!family) return;
      const usable = new Set(
        usableUnitsForFamily(world.ownedPropUnits, family.id, world.settings).map((u) => u.id),
      );
      segment.gearUnitIds = unitIds.filter((id) => usable.has(id)).slice(0, family.maxUnitsInMatch);
    });
  },

  autoFillCard: () => {
    set((state) => {
      const world = state.world;
      // Two ways a save ends: the bank, and the owner.
      if (!world || world.folded || world.fired) return;

      const alreadyBooked = new Set(world.currentCard.flatMap((s) => s.participants.map((p) => p.wrestlerId)));
      const available = world.promotion.rosterIds
        .map((id) => world.wrestlers[id])
        .filter(
          (w): w is Wrestler =>
            Boolean(w) &&
            !alreadyBooked.has(w!.id) &&
            canWork(w!, world.settings, world.week) &&
            // Nobody will get in the ring with the man the room blames for
            // a death, so the office does not offer him a match. Filtered
            // here rather than in `canWork` for two reasons: he is
            // physically able to work, and a company that releases him
            // should not find him unbookable everywhere in the world —
            // this is *this* locker room refusing, not a status on the man.
            //
            // And it stops the office, not the player. Booking him anyway
            // is still one tap away, with no warning and no block (§0).
            !shunned(w!.blamedFor, world.week, world.settings),
        );

      // The microphone, first.
      //
      // Fill the card only ever filled *matches*, so an auto-played save
      // never cut a promo — which meant a whole system with a UI, a topic
      // list and a show-rating contribution ran zero times unless the player
      // built every card by hand. It also meant no manager was ever booked
      // as a mouthpiece, so the one thing a manager is best at never
      // happened either.
      //
      // The office books the obvious thing: the best talker on the roster,
      // aimed at somebody they already have a feud with when there is one.
      const talkers = [...available].sort((a, b) => b.charisma - a.charisma);
      const speaking = new Set<Id>();
      for (const slot of world.currentPromos) {
        if (slot.kind === 'confrontation' || slot.promoSpeakerId) continue;
        const speaker = talkers.find((w) => !speaking.has(w.id));
        if (!speaker) break;

        // Somebody they are already in with, if anybody. A promo aimed at a
        // live feud is worth more than one aimed at nobody — see promo.ts.
        const feud = world.rivalries.find(
          (r) => r.resolvedWeek === null && r.participantIds.includes(speaker.id),
        );
        const targetId = feud?.participantIds.find((id) => id !== speaker.id) ?? null;
        const target = targetId ? world.wrestlers[targetId] : undefined;
        const holdsTitle = world.titles.some(
          (t) => t.promotionId === world.promotion.id && t.currentHolderIds.includes(speaker.id),
        );

        // What the office books when it is choosing for itself. Selling
        // the main event is the safe, obvious thing a real office does with
        // twenty minutes and a good talker.
        //
        // This used to fall back to calling out the locker room, which is
        // the single most damaging thing anybody can say into a microphone
        // — it takes morale off *every wrestler on the roster*. The office
        // booked it every week the best talker had no feud and no belt,
        // which was most weeks, and it was the largest force in the morale
        // system by a distance: measured at 691 points off a twelve-man
        // locker room over fourteen weeks, against 285 of everything the
        // weekly morale pass put back. It is a fine thing for a booker to
        // choose. It is not a default.
        const topicId: PromoTopicId = target
          ? 'continueFeud'
          : holdsTitle
            ? 'championshipAddress'
            : 'hypeMatch';
        if (!promoIsValid(topicId, speaker, target ?? null, holdsTitle)) continue;

        slot.promoSpeakerId = speaker.id;
        slot.promoTopicId = topicId;
        slot.promoTargetId = target?.id ?? null;
        // And a mouthpiece for somebody who cannot talk, which is the whole
        // reason to carry one — see sim/ringside.ts.
        // Off the roster rather than off `staffManagers`, which only fills
        // when somebody *changes role* — a manager signed as a manager was
        // never in it, so the lookup found nobody however many you had.
        const ownMouth = speaker.charisma;
        const mouthpiece = world.promotion.rosterIds
          .map((id) => world.wrestlers[id])
          .find(
            (m): m is Wrestler =>
              Boolean(m) &&
              m!.role === 'manager' &&
              !m!.deceased &&
              m!.charisma > ownMouth + world.settings.autoFillMouthpieceGap,
          );
        slot.promoMouthpieceId = mouthpiece?.id ?? null;
        speaking.add(speaker.id);
      }

      const emptySlots = world.currentCard
        .map((segment, index) => ({ segment, index }))
        .filter(({ segment }) => new Set(segment.participants.map((p) => p.side)).size < 2);
      if (emptySlots.length === 0 || available.length < 2) return;

      // Same AI that books the rival cards, pointed at your roster — so the
      // office's idea of a card is exactly as good as the competition's.
      const card = bookRivalCard(rng, {
        promotion: world.promotion,
        available,
        titles: world.titles,
        stables: world.stables,
        week: world.week,
        settings: { ...world.settings, segmentsPerTV: emptySlots.length },
        // Without this the office books the same six matches every week and
        // walks the company into the ground on repetition alone.
        memory: recallBookings(world.showHistory, world.week, world.settings),
        refuses: (aId, bId) =>
          refusesToWorkWith(findRelationship(world.relationships, aId, bId), world.settings),
      });

      card.matches.forEach((match, i) => {
        const target = emptySlots[i];
        if (!target) return;
        const segment = world.currentCard[target.index]!;
        segment.participants = match.sides.flatMap((members, side) =>
          members.map((w) => ({ wrestlerId: w.id, side, role: 'competitor' as const })),
        );
        segment.titleIds = match.titleIds ?? [];
      });

      // The office names an official for the card if the player has not.
      // Per-match assignments are left alone — deciding which referee gets
      // the main event is the interesting half of the job and Fill the card
      // should not do it for you.
      const availableOfficials = signedReferees(world.referees, world.promotion.id).filter(refereeIsAvailable);
      if (!world.defaultRefereeId || !availableOfficials.some((r) => r.id === world.defaultRefereeId)) {
        world.defaultRefereeId = availableOfficials[0]?.id ?? null;
      }
    });
  },

  toggleSegmentTitle: (slot, titleId) => {
    set((state) => {
      const segment = state.world?.currentCard[slot];
      if (!segment) return;
      const index = segment.titleIds.indexOf(titleId);
      if (index >= 0) segment.titleIds.splice(index, 1);
      else segment.titleIds.push(titleId);
    });
  },
});
