// The call you make when the forecast is bad.
//
// Only the severe tier asks. A roof coming in the morning of the show is not
// a decision, it is a fact, so catastrophes still just happen; and the mild
// tiers are not worth stopping the week for. Severe weather lands about every
// eighteen months, which is often enough to be a system the player learns and
// rare enough that it never becomes a chore.
//
// The three options are deliberately different in shape rather than in size:
//
//   run it      a gamble — cheap if the storm turns, expensive if it does not
//   call it off certain, safe, and costs you money and the town's goodwill
//   move it     a hedge — the show happens, badly, and the scramble is billed
//
// The trap this design is avoiding: if calling it off simply avoided the
// costs, it would be strictly correct every time the forecast was bad and
// there would be no decision at all. So calling it off has to hurt, and the
// storm has to be able to miss. Both options must be capable of being wrong.

import type { Id } from '../engine/types';

export type WeatherCallOptionId = 'runIt' | 'callItOff' | 'moveIt';

export interface WeatherCallOption {
  id: WeatherCallOptionId;
  label: string;
  /** What you are hoping for. */
  gains: string;
  /** What it costs. Required — an option with no cost is not a decision. */
  costs: string;
}

export const WEATHER_CALL_OPTIONS: WeatherCallOption[] = [
  {
    id: 'runIt',
    label: 'Open the doors anyway',
    gains:
      'Everybody who fights their way through it pays to get in, and this town never forgets the promotion that showed up when it said it would.',
    costs:
      'If it lands, you are working a half-empty building with the boys driving home straight through the worst of it afterward, and somebody is going to get hurt doing it.',
  },
  {
    id: 'callItOff',
    label: 'Pull the plug',
    gains:
      'Nobody drives through it, nobody climbs a ladder in a gale, and whatever happens to that building tonight happens without your name anywhere near it.',
    costs:
      'The deposit is gone no matter what the sky does, every single ticket goes back, and the regulars find out real fast you were the promotion that canceled on them.',
  },
  {
    id: 'moveIt',
    label: 'Find another building',
    gains:
      'A smaller hall out from under it entirely, booked overnight. The card gets worked, the television gets made, and the week is not a total write-off.',
    costs:
      'You are paying double to run somewhere nobody has heard of, in front of whoever could stomach the drive, and that room is going to look thin on camera.',
  },
];

/**
 * How sure the forecast is.
 *
 * Two strengths rather than one, because a decision where the answer is
 * always the same is not a decision. An `even` forecast is usually worth
 * running; a `likely` one usually is not. Learning to tell them apart is the
 * skill the system is asking for.
 */
export type ForecastStrength = 'likely' | 'even';

/**
 * Said in words, never a number — the odds rule applies to the sky as much as
 * to a match. Several phrasings per strength so the same forecast does not
 * read identically every time it comes round.
 */
export const FORECAST_LINES: Record<ForecastStrength, string[]> = {
  likely: [
    'Every single service is saying the exact same thing, and not one of them has it turning.',
    'Nobody local thinks this misses. The men loading the truck are already talking about it like it has happened.',
    'The county has told everybody to stay off the roads tomorrow night, and the county does not say that lightly.',
    'The building manager actually called you. That never happens.',
  ],
  even: [
    'This one could genuinely go either way. Half the forecasts turn it north of the building, and half of them flat-out do not.',
    'There is a real chance this misses altogether, and a real chance you are about to be the fool who bet on that.',
    'The man on the radio would not commit to a thing, which tells you about as much as you already knew this morning.',
    'Ask two different people in {town} and you get two completely different answers, and both of them sound absolutely certain.',
  ],
};

/** What actually happened, per event, once the call was made. */
export interface WeatherCallOutcomeLines {
  /** Ran it, and the weather arrived. */
  ranAndHit: string;
  /** Ran it, and the weather turned. */
  ranAndMissed: string;
  /** Called it off, and the weather arrived — the right call. */
  offAndHit: string;
  /** Called it off, and the weather turned — the wrong one. */
  offAndMissed: string;
  /** Moved it. */
  moved: string;
}

/**
 * Keyed by the weather event id. Every severe event needs a set, which
 * weatherCalls.test.ts enforces — a severe event with no prose is a decision
 * the player makes and never hears the result of.
 */
export const WEATHER_CALL_LINES: Record<Id, WeatherCallOutcomeLines> = {
  blizzard: {
    ranAndHit:
      'They ran it straight through the blizzard in {town}, and it was unbelievable. Two hundred people fought their way in, the ring crew shoveled that loading bay twice, and every single one who came got a handshake on the way out.',
    ranAndMissed:
      'The blizzard stalled out east of {town} and dropped almost nothing in the end. The show went off in front of a thin but genuinely happy house.',
    offAndHit:
      '{town} was buried under two feet by midnight. Calling it off looked like cowardice on Tuesday and looked like pure genius by Friday.',
    offAndMissed:
      'The snow never showed up at all. {town} sat clear and cold all evening, the building went dark, and that deposit is never coming back.',
    moved:
      'They pulled the show forty miles south of {town} and clean out of the snow belt. Small room, small house, but the television got made.',
  },
  tropicalStorm: {
    ranAndHit:
      'The storm came roaring up the coast into {town} exactly as advertised, right on schedule. They ran it anyway, to a building that was two-thirds tarpaulin and one-third crowd.',
    ranAndMissed:
      'The storm tracked out to sea and {town} got nothing worse than a wet afternoon. The people who chanced it got themselves a real show.',
    offAndHit:
      'The whole seaboard was told to stay indoors, and {town} listened. Nobody was going anywhere near that building whatever was on the card.',
    offAndMissed:
      'It tracked out to sea in the end. {town} had a warm, still evening, an empty arena, and a promoter staring at an invoice.',
    moved:
      'They moved inland out of {town} on a day’s notice. Everybody holding a ticket for the coast road never made it in.',
  },
  tornadoWarning: {
    ranAndHit:
      'The sirens went off right over {town} while the second match was still going. They put the crowd in the concourse for forty long minutes and finished the card late for the ones who stuck it out.',
    ranAndMissed:
      'The cell broke apart before it ever reached {town}. The warning lifted well before bell time and the show ran clean, no issue at all.',
    offAndHit:
      'It touched down just miles from the building. Nobody in {town} was thinking about wrestling that night, and nobody had to be.',
    offAndMissed:
      'The warning expired with nothing at all to show for it. {town} had a beautiful evening outside and a dark, empty arena.',
    moved:
      'They shifted clean out of the warning box and ran a hall on the far side of the county. Half of {town} never made it there.',
  },
  powerCut: {
    ranAndHit:
      'The grid went down over {town} and stayed down all night. They ran the card off the generator, lit up like a parking lot, and this crowd sang straight through every dark spot.',
    ranAndMissed:
      'The power held in {town} after all. That generator sat outside all night doing nothing at all, and the show ran completely normally.',
    offAndHit:
      'Half of {town} sat dark clean into the small hours. There was no show to be had, and everybody in that town already knew it.',
    offAndMissed:
      'The lights never so much as flickered in {town}. The building was ready to go and the doors stayed shut anyway.',
    moved:
      'They found a hall on the working side of {town}’s grid. It filled up fast and they turned away nobody, because nobody was coming anyway.',
  },
  floodWarning: {
    ranAndHit:
      'The river came up right through {town} the very afternoon of the show. They ran it anyway, to whoever could still fight their way across the bridge, and that was not many.',
    ranAndMissed:
      'The river held after all. {town} stayed dry, the low road stayed open, and a nervous crowd turned into a genuinely loud one.',
    offAndHit:
      'The bottom end of {town} went clean under. Calling it off was the only call there ever was.',
    offAndMissed:
      'The water stopped just short of the road. {town} was passable all night, and the show that never happened would have drawn just fine.',
    moved:
      'They took it up the valley, clean out of {town} and out of the flood plain entirely. A long drive for everybody and a short night for the show.',
  },
};
