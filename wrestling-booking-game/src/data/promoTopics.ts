// What somebody is out there to say — §9.
//
// Every card carries dedicated promo slots that do not eat match spots, and
// the topic is the decision. A promo is not a filler segment: it is the only
// way to *start* a feud on purpose, and it is where a great talker who cannot
// work becomes worth his contract.
//
// Each topic states its effect honestly and carries a cost or a risk, the same
// rule the creative-event library plays by. "Call out the locker room" is the
// clearest case — it builds heat with several people at once and can turn the
// room against you.

export type PromoTopicId =
  | 'startFeud'
  | 'continueFeud'
  | 'challenge'
  | 'hypeMatch'
  | 'advertise'
  | 'championshipAddress'
  | 'callOutLockerRoom'
  | 'debutOrReturn'
  | 'retirementSpeech'
  | 'invasionPromo';

export interface PromoTopic {
  id: PromoTopicId;
  name: string;
  /** What it does, said plainly. Shown to the player before they pick. */
  effect: string;
  /** What it costs or risks. Every topic has one. */
  cost: string;
  /** Needs somebody to aim it at. */
  needsTarget: boolean;
  /** Only available to somebody carrying a belt. */
  needsChampion?: boolean;
}

export const PROMO_TOPICS: PromoTopic[] = [
  {
    id: 'startFeud',
    name: 'Start something',
    effect: 'Lights a feud between the two of them, from absolutely nothing.',
    cost: 'A feud you light is a feud you have to keep feeding.',
    needsTarget: true,
  },
  {
    id: 'continueFeud',
    name: 'Keep it going',
    effect: 'Pours real gasoline on a feud already burning.',
    cost: 'Nothing new here. This crowd has heard this one before.',
    needsTarget: true,
  },
  {
    id: 'challenge',
    name: 'Challenge them',
    effect: 'Calls somebody out on the microphone and puts real heat on it. This crowd expects the match now.',
    cost: 'They expect the match. Not delivering it costs you.',
    needsTarget: true,
  },
  {
    id: 'hypeMatch',
    name: 'Sell the main event',
    effect: 'Talks up what is coming until this town cannot wait to see it.',
    cost: 'Twenty minutes not spent building anybody new.',
    needsTarget: false,
  },
  {
    id: 'advertise',
    name: 'Sell the promotion',
    effect: 'Wins the whole town over — following climbs wherever you are running.',
    cost: 'Nobody on this roster gets over doing it.',
    needsTarget: false,
  },
  {
    id: 'championshipAddress',
    name: 'Address the division',
    effect: 'The champion grabs the microphone. The belt means even more, and so do they.',
    cost: 'Puts a target squarely on their back, and the room notices exactly who got the microphone.',
    needsTarget: false,
    needsChampion: true,
  },
  {
    id: 'callOutLockerRoom',
    name: 'Call out the locker room',
    effect: 'Puts heat on several people at once, and this crowd absolutely loves it.',
    cost: 'The room turns on them. Morale drops right across the roster.',
    needsTarget: false,
  },
  {
    id: 'debutOrReturn',
    name: 'Introduce them',
    effect: 'Gets a brand-new face over before they have wrestled a single match.',
    cost: 'You have spent the surprise. They had better deliver in that ring.',
    needsTarget: false,
  },
  {
    id: 'retirementSpeech',
    name: 'Say goodbye',
    effect: 'Closes out a career the right way. The whole roster feels this one.',
    cost: 'It is the last thing they will ever do for you.',
    needsTarget: false,
  },
  {
    id: 'invasionPromo',
    name: 'Call out another company',
    effect: 'Takes following right off whoever holds the town you are running in.',
    cost: 'They will hear about it, and they are going to answer.',
    needsTarget: false,
  },
];

export function promoTopicById(id: string): PromoTopic | undefined {
  return PROMO_TOPICS.find((t) => t.id === id);
}

/**
 * How a promo is written up afterwards, by how well it went. Several
 * promos can land in the same band on one card, so each band carries
 * enough lines that a full show rarely has to reach for `writeUp`'s
 * cross-band fallback, let alone repeat one outright.
 */
export const PROMO_LINES: { minQuality: number; lines: string[] }[] = [
  {
    minQuality: 80,
    lines: [
      '{speaker} had this entire building in the palm of one hand and simply would not let go.',
      'Nobody in that arena moved for the whole thing. {speaker} does not miss — not ever.',
      'That, ladies and gentlemen, is the promo they will be playing in the video package for years to come.',
      '{speaker} said it once, said it exactly right, and let it hang there. Chills.',
      'This whole building was leaning in by the end of it. {speaker} knows precisely what they are doing out there.',
      'That was an absolute masterclass. {speaker} could sell a rematch to an empty room and still pack the house.',
    ],
  },
  {
    minQuality: 60,
    lines: [
      '{speaker} said exactly what needed saying and got out clean.',
      'Sharp, mean, and over big time. {speaker} made their point and made it stick.',
      '{speaker} got precisely the reaction they were chasing.',
      'Clean, confident, not one wasted word. {speaker} knows exactly how to close out a segment.',
      'That landed, and it landed hard. {speaker} had this room and used every second of it.',
      '{speaker} did not need long at all. Said it, meant every word, walked off to a pop.',
    ],
  },
  {
    minQuality: 40,
    lines: [
      '{speaker} got through it. This crowd stuck around, for the most part.',
      'Serviceable at best. {speaker} is not going to be remembered for talking, that is for sure.',
      'It did the job and did not do a whole lot more than that.',
      '{speaker} hit the points that mattered and rushed straight through the rest.',
      'Fine, just fine. Nobody is buying a ticket off the back of that one, but fine.',
      '{speaker} was clearly reciting it word for word. Still got the job done, mostly.',
    ],
  },
  {
    minQuality: 0,
    lines: [
      '{speaker} lost this crowd inside a minute flat and never got them back.',
      'Long, loud, and about absolutely nothing. You could hear people heading for the concourse.',
      '{speaker} should not be handed a live microphone again anytime soon.',
      'That went nowhere fast, and somehow still took its sweet time getting there.',
      '{speaker} froze up twice out there and covered neither one of them.',
      'The house lights might as well have come up early. Dead air in a live building — brutal.',
    ],
  },
];
