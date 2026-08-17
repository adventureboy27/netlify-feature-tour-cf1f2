// Weather and the things a town does to a show.
//
// The dice this rolls are deliberately lopsided. Most sides are drizzle and
// heat and a bus running late — things that shave a few percent off the house
// and give the week a line of colour. A handful of sides are a storm that
// takes a third of the crowd. One side, buried somewhere down there, is the
// roof coming in and no show happening at all.
//
// That shape is the whole design. If catastrophe were common it would be a
// tax and the player would stop reading it; if it never happened the player
// would stop believing the world could hurt them. It happens about once every
// four or five years and it is remembered.
//
// Two gates keep it regional rather than random: season decides what is
// possible at all (no blizzards in July), and climate decides which towns can
// get it (no hurricanes in the mountains). A promotion that tours learns the
// map has moods.

import type { Climate, Season } from '../engine/types';

export type WeatherSeverity =
  /** No mechanical effect at all. A line in the paper and nothing else. */
  | 'flavour'
  /** A few percent either way. */
  | 'minor'
  /** Enough to notice on the night's takings. */
  | 'notable'
  /** A third of the house or worse. */
  | 'severe'
  /** No show. */
  | 'catastrophe';

export interface WeatherEvent {
  id: string;
  name: string;
  /** Told in the weekly wire. `{town}` is substituted. */
  lines: string[];
  seasons: Season[] | 'any';
  climates: Climate[] | 'any';
  severity: WeatherSeverity;
  /** Multiplier on the house. Above 1 for the rare night the weather helps. */
  draw: number;
  /** Relative likelihood against other events in the same severity tier. */
  weight: number;
  /**
   * How it reads the day *before*, when it is still a forecast and the booker
   * has a call to make. Severe events need this: `lines` are written in the
   * past tense because they report a night that already happened, and showing
   * one as a warning told the player the blizzard had already shut the town
   * down and then asked whether they would like to run the show.
   */
  warnings?: string[];
}

export const WEATHER_EVENTS: WeatherEvent[] = [
  // ---- flavour: no effect, all texture --------------------------------
  {
    id: 'clearNight',
    name: 'A clear night',
    lines: [
      'Not a cloud over {town}. Nobody had an excuse to stay home.',
      'A still, clear evening in {town}. You could hear the ring from the car park.',
      'Nothing at all happening with the weather in {town}, which the crew took as a personal favour.',
    ],
    seasons: 'any',
    climates: 'any',
    severity: 'flavour',
    draw: 1,
    weight: 12,
  },
  {
    id: 'lateBus',
    name: 'The bus was late',
    lines: [
      'The bus out of {town} sat in traffic for an hour and half the undercard got to the building in their gear.',
      'Two of the boys missed the turn into {town} entirely and arrived during the second match.',
    ],
    seasons: 'any',
    climates: 'any',
    severity: 'flavour',
    draw: 1,
    weight: 11,
  },
  {
    id: 'brokenAir',
    name: 'The air conditioning gave up',
    lines: ['The air handling in the {town} building packed in at six and nobody could find whoever had the key.'],
    seasons: ['summer', 'spring'],
    climates: 'any',
    severity: 'flavour',
    draw: 1,
    weight: 10,
  },
  {
    id: 'localPaper',
    name: 'The local paper came',
    lines: ['The {town} paper sent somebody who spent the whole night asking whether it was real.'],
    seasons: 'any',
    climates: 'any',
    severity: 'flavour',
    draw: 1,
    weight: 10,
  },
  {
    id: 'mudLot',
    name: 'The car park was a swamp',
    lines: ['It had rained on {town} all week and the overflow parking was six inches of mud. Two cars had to be towed out.'],
    seasons: ['spring', 'autumn'],
    climates: 'any',
    severity: 'flavour',
    draw: 1,
    weight: 9,
  },
  {
    id: 'longNight',
    name: 'Light until ten',
    lines: ['Still light at ten in {town}. Half the crowd stood outside afterwards rather than go home.'],
    seasons: ['summer'],
    climates: ['northern', 'mountain', 'temperate', 'plains'],
    severity: 'flavour',
    draw: 1,
    weight: 9,
  },
  {
    id: 'darkByFive',
    name: 'Dark by five',
    lines: ['Dark by five in {town} and freezing by six. Everybody came straight from work and kept their coats on.'],
    seasons: ['winter'],
    climates: 'any',
    severity: 'flavour',
    draw: 1,
    weight: 11,
  },
  {
    id: 'windyNight',
    name: 'Wind off the flats',
    lines: ['The wind came across {town} hard enough to move the merchandise table twice.'],
    seasons: ['autumn', 'winter', 'spring'],
    climates: ['plains', 'coastal', 'desert'],
    severity: 'flavour',
    draw: 1,
    weight: 10,
  },
  {
    id: 'coldSnapDesert',
    name: 'Cold once the sun went',
    lines: ['{town} was ninety at four and forty at nine, and nobody who came out in shirtsleeves was ready for it.'],
    seasons: ['autumn', 'spring', 'winter'],
    climates: ['desert'],
    severity: 'flavour',
    draw: 1,
    weight: 10,
  },
  {
    id: 'firstFrost',
    name: 'First frost',
    lines: ['First real frost of the year in {town}. The car park was a skating rink and everybody came anyway.'],
    seasons: ['autumn', 'winter'],
    climates: ['northern', 'mountain', 'temperate', 'plains'],
    severity: 'flavour',
    draw: 1,
    weight: 12,
  },
  {
    id: 'muggy',
    name: 'Close and muggy',
    lines: ['The air in {town} did not move all night. Everyone in the building was soaked by the third match.'],
    seasons: ['summer'],
    climates: ['coastal', 'temperate', 'plains'],
    severity: 'flavour',
    draw: 1,
    weight: 14,
  },
  {
    id: 'seaFog',
    name: 'Sea fog',
    lines: ['Fog came in off the water and sat on {town} all evening. You could not see the far side of the car park.'],
    seasons: ['spring', 'autumn', 'winter'],
    climates: ['coastal'],
    severity: 'flavour',
    draw: 1,
    weight: 10,
  },
  {
    id: 'dustDevils',
    name: 'Dust in the air',
    lines: ['Dust blowing through {town} all day. Everything in the building had a film on it by bell time.'],
    seasons: ['summer', 'spring'],
    climates: ['desert', 'plains'],
    severity: 'flavour',
    draw: 1,
    weight: 10,
  },
  {
    id: 'indianSummer',
    name: 'A late warm spell',
    lines: ['{town} got one more warm week than it had any right to. People came in shirtsleeves in October.'],
    seasons: ['autumn'],
    climates: 'any',
    severity: 'flavour',
    draw: 1,
    weight: 9,
  },

  // ---- minor: a few percent -------------------------------------------
  {
    id: 'steadyRain',
    name: 'Steady rain',
    lines: ['It rained on {town} from lunchtime onward. A few of the walk-ups decided against it.'],
    seasons: ['spring', 'autumn', 'winter'],
    climates: 'any',
    severity: 'minor',
    draw: 0.94,
    weight: 26,
  },
  {
    id: 'perfectEvening',
    name: 'A perfect evening',
    lines: ['One of those evenings in {town} where people go looking for something to do. The walk-up was a gift.'],
    seasons: ['spring', 'summer', 'autumn'],
    climates: 'any',
    severity: 'minor',
    draw: 1.07,
    weight: 20,
  },
  {
    id: 'coldSnap',
    name: 'Cold snap',
    lines: ['A cold snap hit {town} and the older regulars stayed by the fire.'],
    seasons: ['winter', 'autumn'],
    climates: ['northern', 'mountain', 'plains', 'temperate'],
    severity: 'minor',
    draw: 0.9,
    weight: 18,
  },
  {
    id: 'heatwave',
    name: 'Heatwave',
    lines: ['{town} spent the week over a hundred. Nobody wanted to sit in a hall with no air moving.'],
    seasons: ['summer'],
    climates: ['desert', 'plains', 'temperate'],
    severity: 'minor',
    draw: 0.9,
    weight: 16,
  },
  {
    id: 'roadworks',
    name: 'The road in was shut',
    lines: ['They closed the main road into {town} for resurfacing and never told anybody. Half the crowd was late.'],
    seasons: 'any',
    climates: 'any',
    severity: 'minor',
    draw: 0.93,
    weight: 14,
  },
  {
    id: 'localFixture',
    name: 'The local side were at home',
    lines: ['The local side were at home in {town} the same night. You cannot compete with that and should not try.'],
    seasons: ['autumn', 'winter', 'spring'],
    climates: 'any',
    severity: 'minor',
    draw: 0.88,
    weight: 14,
  },
  {
    id: 'townFestival',
    name: 'The town was already out',
    lines: ['{town} had a festival on and the whole place was already in the street looking for a reason to stay out.'],
    seasons: ['summer', 'autumn'],
    climates: 'any',
    severity: 'minor',
    draw: 1.09,
    weight: 12,
  },

  // ---- notable: you feel it in the takings ------------------------------
  {
    id: 'heavySnow',
    name: 'Heavy snow',
    lines: [
      'Snow came down on {town} through the afternoon and did not stop. Anyone out of town stayed out of town.',
      '{town} took eight inches of snow before the doors even opened.',
    ],
    seasons: ['winter'],
    climates: ['northern', 'mountain'],
    severity: 'notable',
    draw: 0.7,
    weight: 24,
  },
  {
    id: 'thunderstorm',
    name: 'Thunderstorms',
    lines: ['Storms rolled over {town} all evening. The lights flickered twice and the crowd cheered both times.'],
    seasons: ['spring', 'summer'],
    climates: ['plains', 'temperate', 'coastal'],
    severity: 'notable',
    draw: 0.76,
    weight: 22,
  },
  {
    id: 'flooding',
    name: 'Flooded roads',
    lines: ['The low roads into {town} were under water. A lot of people turned round and went home.'],
    seasons: ['spring', 'autumn'],
    climates: ['coastal', 'temperate', 'plains'],
    severity: 'notable',
    draw: 0.68,
    weight: 16,
  },
  {
    id: 'iceStorm',
    name: 'Ice storm',
    lines: ['Freezing rain glazed {town} an hour before the doors. The ones who made it deserved a better show.'],
    seasons: ['winter'],
    climates: ['northern', 'mountain', 'plains'],
    severity: 'notable',
    draw: 0.62,
    weight: 14,
  },
  {
    id: 'wildfireSmoke',
    name: 'Smoke in the air',
    lines: ['Smoke from the fires up the valley sat over {town} all week. You could taste it in the building.'],
    seasons: ['summer', 'autumn'],
    climates: ['desert', 'mountain'],
    severity: 'notable',
    draw: 0.72,
    weight: 12,
  },
  {
    id: 'transitStrike',
    name: 'The buses stopped',
    lines: ['The drivers in {town} walked out at six. If you did not have a car you did not have a show.'],
    seasons: 'any',
    climates: 'any',
    severity: 'notable',
    draw: 0.74,
    weight: 12,
  },
  {
    id: 'bigWeekend',
    name: 'The town was packed',
    lines: ['{town} was full for the long weekend and every one of them was looking for a ticket to something.'],
    seasons: ['summer'],
    climates: 'any',
    severity: 'notable',
    draw: 1.18,
    weight: 10,
  },

  // ---- severe: a third of the house, or worse ---------------------------
  {
    id: 'blizzard',
    name: 'Blizzard',
    lines: [
      'A blizzard shut {town} down. The people who got there could have all sat in the first three rows.',
      'They were plowing the road to the building in {town} while the ring was going up.',
    ],
    seasons: ['winter'],
    climates: ['northern', 'mountain'],
    severity: 'severe',
    draw: 0.4,
    weight: 22,
    warnings: [
      'The service has {town} under a blizzard watch from noon. They are talking about feet, not inches.',
      'There is a system coming down on {town} that has already buried three counties north of it.',
    ],
  },
  {
    id: 'tropicalStorm',
    name: 'Tropical storm',
    lines: ['A storm came up the coast into {town} and the whole seaboard was told to stay indoors.'],
    seasons: ['summer', 'autumn'],
    climates: ['coastal'],
    severity: 'severe',
    draw: 0.35,
    weight: 20,
    warnings: [
      'The storm is tracking up the coast and {town} is inside the cone.',
      'They have started boarding up the front on the seaward side of {town}.',
    ],
  },
  {
    id: 'tornadoWarning',
    name: 'Tornado warning',
    lines: [
      'Sirens went off across {town} two hours before the doors. The building filled up with people who were not there for wrestling.',
      'A tornado touched down twenty miles from {town} and nobody in the county went anywhere that night.',
    ],
    seasons: ['spring', 'summer'],
    climates: ['plains'],
    severity: 'severe',
    draw: 0.32,
    weight: 20,
    warnings: [
      "The whole of {town}'s county is under a watch box from four in the afternoon.",
      'There is a line of cells building west of {town} and the air has gone that colour.',
    ],
  },
  {
    id: 'powerCut',
    name: 'The grid went down',
    lines: ['Half of {town} lost power at five. The building ran off a generator and looked it.'],
    seasons: 'any',
    climates: 'any',
    severity: 'severe',
    draw: 0.45,
    weight: 14,
    warnings: [
      'The grid over {town} has been browning out all week and the utility is not promising anything.',
      '{town} is on rolling outages and nobody will say which block goes dark when.',
    ],
  },
  {
    id: 'floodWarning',
    name: 'The river came up',
    lines: ['The river came up through {town} and took the bottom end of the town with it. Nobody was thinking about a wrestling show.'],
    seasons: ['spring'],
    climates: ['coastal', 'temperate', 'plains'],
    severity: 'severe',
    draw: 0.38,
    weight: 12,
    warnings: [
      'The river through {town} is a foot off the top and it has been raining upstream for three days.',
      'They have sandbags on the low road into {town} and they did not put them there for fun.',
    ],
  },

  // ---- catastrophe: no show ---------------------------------------------
  {
    id: 'roofCollapse',
    name: 'The roof came in',
    lines: [
      'The roof of the building in {town} came down under the weight of the snow the night before the show. Nobody was inside. It was very close to being the other thing.',
      'Structural engineers condemned the roof in {town} the morning of the show and put a fence round the whole block.',
    ],
    seasons: ['winter'],
    climates: ['northern', 'mountain'],
    severity: 'catastrophe',
    draw: 0,
    weight: 12,
  },
  {
    id: 'hurricane',
    name: 'Hurricane',
    lines: ['{town} was evacuated ahead of the storm. The trucks turned round on the highway and went home.'],
    seasons: ['autumn'],
    climates: ['coastal'],
    severity: 'catastrophe',
    draw: 0,
    weight: 14,
  },
  {
    id: 'tornadoHit',
    name: 'A tornado went through',
    lines: ['A tornado went through {town} in the afternoon. The building is still standing. Plenty either side of it is not.'],
    seasons: ['spring', 'summer'],
    climates: ['plains'],
    severity: 'catastrophe',
    draw: 0,
    weight: 12,
  },
  {
    id: 'buildingFire',
    name: 'Fire in the building',
    lines: ['A fire in the plant room in {town} put the building out of use with four hours to go. No show, and the rent is not coming back.'],
    seasons: 'any',
    climates: 'any',
    severity: 'catastrophe',
    draw: 0,
    weight: 10,
  },
  {
    id: 'quarantine',
    name: 'Public gatherings suspended',
    lines: ['The county health board suspended public gatherings in {town} on the Thursday. There was no arguing with it.'],
    seasons: 'any',
    climates: 'any',
    severity: 'catastrophe',
    draw: 0,
    weight: 6,
  },
];

/** Every event that could happen in this town, this time of year. */
export function eligibleWeather(season: Season, climate: Climate, severity: WeatherSeverity): WeatherEvent[] {
  return WEATHER_EVENTS.filter(
    (e) =>
      e.severity === severity &&
      (e.seasons === 'any' || e.seasons.includes(season)) &&
      (e.climates === 'any' || e.climates.includes(climate)),
  );
}
