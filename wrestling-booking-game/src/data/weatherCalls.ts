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
    label: 'Run it',
    gains: 'Whatever crowd braves it still pays, and the town remembers you turned up.',
    costs: 'If it lands, somebody gets hurt getting through it and the gear takes a beating.',
  },
  {
    id: 'callItOff',
    label: 'Call it off',
    gains: 'Nobody travels, nobody gets hurt, and the building is somebody else’s problem.',
    costs: 'The deposit is gone, the house is refunded, and the town remembers you did not show.',
  },
  {
    id: 'moveIt',
    label: 'Move it',
    gains: 'A smaller room out of the weather. The show happens and the television gets made.',
    costs: 'It draws badly, the scramble is billed to you, and half the ticket-holders cannot get there.',
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
    'Every service says the same thing, and none of them say it is turning.',
    'The forecast is as bad as forecasts get. Nobody local thinks this misses.',
    'The county has already told people to stay off the roads tomorrow night.',
  ],
  even: [
    'It could go either way. Half the models turn it north of the building.',
    'There is a real chance this misses entirely, and a real chance it does not.',
    'The man on the radio would not commit to it, which tells you something.',
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
      'They ran it through the blizzard in {town}. Two hundred people made it, the ring crew shovelled the loading bay twice, and everybody who came got shaken by the hand on the way out.',
    ranAndMissed:
      'The blizzard stalled east of {town} and dropped almost nothing. The show went ahead in front of a thin but perfectly happy house.',
    offAndHit:
      '{town} was under two feet by midnight. Calling it off looked like cowardice on the Tuesday and looked like sense by the Friday.',
    offAndMissed:
      'The snow never came. {town} was clear and cold all evening, the building sat dark, and the deposit is not coming back.',
    moved:
      'They pulled the show forty miles south of {town} and out of the snow belt. Small room, small house, and the television got made.',
  },
  tropicalStorm: {
    ranAndHit:
      'The storm came up the coast into {town} exactly as advertised. They ran anyway, to a building that was two thirds tarpaulin and one third crowd.',
    ranAndMissed:
      'The storm tracked out to sea and {town} got nothing but a wet afternoon. The people who chanced it saw a show.',
    offAndHit:
      'The seaboard was told to stay indoors and {town} did. Nobody was going to that building whatever was on the card.',
    offAndMissed:
      'It went out to sea. {town} had a warm still evening, an empty arena, and a promoter with an invoice.',
    moved:
      'They moved inland from {town} at a day’s notice. Everybody who had a ticket for the coast road did not make it.',
  },
  tornadoWarning: {
    ranAndHit:
      'The sirens went over {town} while the second match was going. They put the crowd in the concourse for forty minutes and finished the card at half eleven to the ones who stayed.',
    ranAndMissed:
      'The cell broke up before it reached {town}. The warning was lifted an hour before bell time and the show ran clean.',
    offAndHit:
      'It came down eight miles from the building. Nobody in {town} was thinking about wrestling, and nobody had to be.',
    offAndMissed:
      'The warning expired at four with nothing to show for it. {town} had a beautiful evening and a dark arena.',
    moved:
      'They shifted out of the warning box and ran a hall on the far side of the county. Half of {town} could not get there.',
  },
  powerCut: {
    ranAndHit:
      'The grid went down over {town} and stayed down. They ran the card off the generator, lit like a car park, and the crowd sang through the dark spots.',
    ranAndMissed:
      'The power held in {town} after all. The generator sat outside all night doing nothing and the show ran normally.',
    offAndHit:
      'Half of {town} was dark until the small hours. There was no show to be had and everybody knew it.',
    offAndMissed:
      'The lights never so much as flickered in {town}. The building was ready and the doors stayed shut.',
    moved:
      'They found a hall on the working side of {town}’s grid. It held four hundred and they turned away nobody, because nobody came.',
  },
  floodWarning: {
    ranAndHit:
      'The river came up through {town} the afternoon of the show. They ran to whoever could still get across the bridge, which was not many.',
    ranAndMissed:
      'The river held. {town} stayed dry, the low road stayed open, and a nervous crowd turned into a loud one.',
    offAndHit:
      'The bottom end of {town} went under. Calling it off was the only call there was.',
    offAndMissed:
      'The water stopped a foot short of the road. {town} was passable all night and the show that was not there would have drawn fine.',
    moved:
      'They took it up the valley out of {town} and out of the flood plain. A long drive for everybody and a short night.',
  },
};
