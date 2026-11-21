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
      'Not one cloud over {town} tonight. Nobody had a single excuse to stay home.',
      'A still, clear evening in {town} — you could hear that ring all the way from the parking lot.',
      'Absolutely nothing happening with the weather in {town} tonight, and the crew took that as a personal favor.',
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
      'The bus out of {town} sat dead in traffic for a full hour, and half the undercard rolled into the building already in their gear.',
      'Two of the boys missed the turn into {town} entirely and did not show up until the second match was already underway.',
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
    lines: ['The air handling in the {town} building packed in flat at six o’clock, and nobody could track down whoever was holding the key.'],
    seasons: ['summer', 'spring'],
    climates: 'any',
    severity: 'flavour',
    draw: 1,
    weight: 10,
  },
  {
    id: 'localPaper',
    name: 'The local paper came',
    lines: ['The {town} paper sent somebody down who spent the entire night asking whether any of it was real.'],
    seasons: 'any',
    climates: 'any',
    severity: 'flavour',
    draw: 1,
    weight: 10,
  },
  {
    id: 'mudLot',
    name: 'The parking lot was a swamp',
    lines: ['It had rained on {town} all week straight, and the overflow parking turned to six full inches of mud. Two cars had to be towed clean out.'],
    seasons: ['spring', 'autumn'],
    climates: 'any',
    severity: 'flavour',
    draw: 1,
    weight: 9,
  },
  {
    id: 'longNight',
    name: 'Light until ten',
    lines: ['Still bright out at ten in {town}. Half this crowd stood around outside afterward rather than head home.'],
    seasons: ['summer'],
    climates: ['northern', 'mountain', 'temperate', 'plains'],
    severity: 'flavour',
    draw: 1,
    weight: 9,
  },
  {
    id: 'darkByFive',
    name: 'Dark by five',
    lines: ['Dark by five in {town} and flat-out freezing by six. Everybody came straight from work and never once took their coats off.'],
    seasons: ['winter'],
    climates: 'any',
    severity: 'flavour',
    draw: 1,
    weight: 11,
  },
  {
    id: 'windyNight',
    name: 'Wind off the flats',
    lines: ['The wind came ripping across {town} hard enough to move the merchandise table clean off its spot, twice.'],
    seasons: ['autumn', 'winter', 'spring'],
    climates: ['plains', 'coastal', 'desert'],
    severity: 'flavour',
    draw: 1,
    weight: 10,
  },
  {
    id: 'coldSnapDesert',
    name: 'Cold once the sun went',
    lines: ['{town} was ninety degrees at four and forty by nine, and nobody who came out in shirtsleeves was ready for that swing.'],
    seasons: ['autumn', 'spring', 'winter'],
    climates: ['desert'],
    severity: 'flavour',
    draw: 1,
    weight: 10,
  },
  {
    id: 'firstFrost',
    name: 'First frost',
    lines: ['First real frost of the year hit {town}. The parking lot turned into a skating rink and every single person came anyway.'],
    seasons: ['autumn', 'winter'],
    climates: ['northern', 'mountain', 'temperate', 'plains'],
    severity: 'flavour',
    draw: 1,
    weight: 12,
  },
  {
    id: 'muggy',
    name: 'Close and muggy',
    lines: ['The air in {town} did not move one bit all night. Everybody in that building was soaked clean through by the third match.'],
    seasons: ['summer'],
    climates: ['coastal', 'temperate', 'plains'],
    severity: 'flavour',
    draw: 1,
    weight: 14,
  },
  {
    id: 'seaFog',
    name: 'Sea fog',
    lines: ['Fog rolled in off the water and sat right on top of {town} all evening. You could not see across the parking lot.'],
    seasons: ['spring', 'autumn', 'winter'],
    climates: ['coastal'],
    severity: 'flavour',
    draw: 1,
    weight: 10,
  },
  {
    id: 'dustDevils',
    name: 'Dust in the air',
    lines: ['Dust blowing straight through {town} all day long. Everything inside that building had a film on it by bell time.'],
    seasons: ['summer', 'spring'],
    climates: ['desert', 'plains'],
    severity: 'flavour',
    draw: 1,
    weight: 10,
  },
  {
    id: 'indianSummer',
    name: 'A late warm spell',
    lines: ['{town} got one more warm week than it had any right to. People walked in wearing shirtsleeves in October.'],
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
    lines: ['It rained on {town} steady from lunchtime onward. A few of the walk-ups thought better of it.'],
    seasons: ['spring', 'autumn', 'winter'],
    climates: 'any',
    severity: 'minor',
    draw: 0.94,
    weight: 26,
  },
  {
    id: 'perfectEvening',
    name: 'A perfect evening',
    lines: ['One of those perfect evenings in {town} where people go out looking for something, anything, to do. The walk-up was an absolute gift.'],
    seasons: ['spring', 'summer', 'autumn'],
    climates: 'any',
    severity: 'minor',
    draw: 1.07,
    weight: 20,
  },
  {
    id: 'coldSnap',
    name: 'Cold snap',
    lines: ['A cold snap hit {town} hard, and the older regulars stayed home by the fire instead.'],
    seasons: ['winter', 'autumn'],
    climates: ['northern', 'mountain', 'plains', 'temperate'],
    severity: 'minor',
    draw: 0.9,
    weight: 18,
  },
  {
    id: 'heatwave',
    name: 'Heatwave',
    lines: ['{town} spent the entire week over a hundred degrees. Nobody wanted to sit in a hall with no air moving through it.'],
    seasons: ['summer'],
    climates: ['desert', 'plains', 'temperate'],
    severity: 'minor',
    draw: 0.9,
    weight: 16,
  },
  {
    id: 'roadworks',
    name: 'The road in was shut',
    lines: ['They closed the main road into {town} for resurfacing and never told a soul about it. Half this crowd showed up late.'],
    seasons: 'any',
    climates: 'any',
    severity: 'minor',
    draw: 0.93,
    weight: 14,
  },
  {
    id: 'localFixture',
    name: 'The local side were at home',
    lines: ['The local side were playing at home in {town} that same night. You cannot compete with that, and you should not even try.'],
    seasons: ['autumn', 'winter', 'spring'],
    climates: 'any',
    severity: 'minor',
    draw: 0.88,
    weight: 14,
  },
  {
    id: 'townFestival',
    name: 'The town was already out',
    lines: ['{town} had a festival going on, and the whole place was already out in the street looking for one more reason to stay out.'],
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
      'Snow came down on {town} straight through the afternoon and never let up. Anyone out of town stayed put and stayed home.',
      '{town} took a full eight inches of snow before the doors had even opened.',
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
    lines: ['Storms rolled right over {town} all evening long. The lights flickered twice, and this crowd cheered both times like it was part of the show.'],
    seasons: ['spring', 'summer'],
    climates: ['plains', 'temperate', 'coastal'],
    severity: 'notable',
    draw: 0.76,
    weight: 22,
  },
  {
    id: 'flooding',
    name: 'Flooded roads',
    lines: ['The low roads into {town} went straight under water. A whole lot of people turned right around and headed home.'],
    seasons: ['spring', 'autumn'],
    climates: ['coastal', 'temperate', 'plains'],
    severity: 'notable',
    draw: 0.68,
    weight: 16,
  },
  {
    id: 'iceStorm',
    name: 'Ice storm',
    lines: ['Freezing rain glazed the whole town of {town} an hour before the doors. The ones who braved it in deserved a whole lot better show than most nights.'],
    seasons: ['winter'],
    climates: ['northern', 'mountain', 'plains'],
    severity: 'notable',
    draw: 0.62,
    weight: 14,
  },
  {
    id: 'wildfireSmoke',
    name: 'Smoke in the air',
    lines: ['Smoke from the fires up the valley sat heavy over {town} all week long. You could taste it right there in the building.'],
    seasons: ['summer', 'autumn'],
    climates: ['desert', 'mountain'],
    severity: 'notable',
    draw: 0.72,
    weight: 12,
  },
  {
    id: 'transitStrike',
    name: 'The buses stopped',
    lines: ['The drivers in {town} walked off the job at six sharp. If you did not have a car, you flat-out did not have a show.'],
    seasons: 'any',
    climates: 'any',
    severity: 'notable',
    draw: 0.74,
    weight: 12,
  },
  {
    id: 'bigWeekend',
    name: 'The town was packed',
    lines: ['{town} was packed wall to wall for the long weekend, and every single one of them was hunting for a ticket to something.'],
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
      'A full-on blizzard shut {town} down cold. Everybody who actually made it could have sat together in the first three rows.',
      'They were still plowing the road to the building in {town} while the ring was going up backstage.',
    ],
    seasons: ['winter'],
    climates: ['northern', 'mountain'],
    severity: 'severe',
    draw: 0.4,
    weight: 22,
    warnings: [
      'The weather service has {town} under a blizzard watch starting at noon. They are talking feet now, not inches.',
      'There is a system barreling down on {town} that has already buried three counties north of it.',
    ],
  },
  {
    id: 'tropicalStorm',
    name: 'Tropical storm',
    lines: ['A tropical storm came barreling up the coast right into {town}, and the whole seaboard was told to stay indoors.'],
    seasons: ['summer', 'autumn'],
    climates: ['coastal'],
    severity: 'severe',
    draw: 0.35,
    weight: 20,
    warnings: [
      'The storm is tracking straight up the coast, and {town} sits right inside the cone.',
      'They have already started boarding up the front on the seaward side of {town}.',
    ],
  },
  {
    id: 'tornadoWarning',
    name: 'Tornado warning',
    lines: [
      'Sirens went off clean across {town} two hours before the doors. That building filled right up with people who were not there for wrestling at all.',
      'A tornado touched down twenty miles from {town}, and nobody in the whole county went anywhere that night.',
    ],
    seasons: ['spring', 'summer'],
    climates: ['plains'],
    severity: 'severe',
    draw: 0.32,
    weight: 20,
    warnings: [
      "The whole of {town}'s county is under a watch box starting at four in the afternoon.",
      'There is a line of cells building west of {town}, and the sky has already gone that color.',
    ],
  },
  {
    id: 'powerCut',
    name: 'The grid went down',
    lines: ['Half of {town} lost power dead at five. That building ran off a generator all night, and it showed.'],
    seasons: 'any',
    climates: 'any',
    severity: 'severe',
    draw: 0.45,
    weight: 14,
    warnings: [
      'The grid over {town} has been browning out all week, and the utility is not promising anybody anything.',
      '{town} is on rolling outages, and nobody is saying which block goes dark next.',
    ],
  },
  {
    id: 'floodWarning',
    name: 'The river came up',
    lines: ['The river came up right through {town} and took the bottom end of town clean with it. Nobody there was thinking about a wrestling show that night.'],
    seasons: ['spring'],
    climates: ['coastal', 'temperate', 'plains'],
    severity: 'severe',
    draw: 0.38,
    weight: 12,
    warnings: [
      'The river through {town} is sitting a foot off the top, and it has been raining upstream for three straight days.',
      'They have sandbags stacked on the low road into {town}, and they sure did not put them there for fun.',
    ],
  },

  // ---- catastrophe: no show ---------------------------------------------
  {
    id: 'roofCollapse',
    name: 'The roof came in',
    lines: [
      'The roof of the building in {town} came down under the weight of the snow the night before the show. Nobody was inside — but this was a very close call, and everybody knows it.',
      'Structural engineers condemned the roof in {town} the very morning of the show and put a fence around the entire block.',
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
    lines: ['{town} was evacuated ahead of the hurricane. The trucks turned right around on the highway and headed home.'],
    seasons: ['autumn'],
    climates: ['coastal'],
    severity: 'catastrophe',
    draw: 0,
    weight: 14,
  },
  {
    id: 'tornadoHit',
    name: 'A tornado went through',
    lines: ['A tornado tore right through {town} in the afternoon. The building is still standing — plenty on either side of it is not.'],
    seasons: ['spring', 'summer'],
    climates: ['plains'],
    severity: 'catastrophe',
    draw: 0,
    weight: 12,
  },
  {
    id: 'buildingFire',
    name: 'Fire in the building',
    lines: ['A fire in the plant room in {town} put the whole building out of use with four hours to go. No show tonight, and that rent is never coming back.'],
    seasons: 'any',
    climates: 'any',
    severity: 'catastrophe',
    draw: 0,
    weight: 10,
  },
  {
    id: 'quarantine',
    name: 'Public gatherings suspended',
    lines: ['The county health board suspended public gatherings in {town} right on Thursday. There was absolutely no arguing with it.'],
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
