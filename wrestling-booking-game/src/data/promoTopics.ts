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
    effect: 'Puts a feud on the board between the two of them, from nothing.',
    cost: 'A feud you started is a feud you have to book.',
    needsTarget: true,
  },
  {
    id: 'continueFeud',
    name: 'Keep it going',
    effect: 'Adds real heat to a feud already running.',
    cost: 'Nothing new happens. The crowd has heard this before.',
    needsTarget: true,
  },
  {
    id: 'challenge',
    name: 'Challenge them',
    effect: 'Calls somebody out and puts heat on it. The crowd expects the match.',
    cost: 'They expect the match. Not booking it costs you.',
    needsTarget: true,
  },
  {
    id: 'hypeMatch',
    name: 'Sell the main event',
    effect: 'Talks up what is coming. More people turn out for it.',
    cost: 'Twenty minutes not spent on anybody new.',
    needsTarget: false,
  },
  {
    id: 'advertise',
    name: 'Sell the promotion',
    effect: 'Wins the town over. Following goes up where you are running.',
    cost: 'Nobody on the roster gets over doing it.',
    needsTarget: false,
  },
  {
    id: 'championshipAddress',
    name: 'Address the division',
    effect: 'The champion speaks. The belt means more and so do they.',
    cost: 'Puts a target on them, and the room notices who got the microphone.',
    needsTarget: false,
    needsChampion: true,
  },
  {
    id: 'callOutLockerRoom',
    name: 'Call out the locker room',
    effect: 'Heat with several people at once, and the crowd loves it.',
    cost: 'The room turns. Morale drops across the roster.',
    needsTarget: false,
  },
  {
    id: 'debutOrReturn',
    name: 'Introduce them',
    effect: 'Gets a new face over before they have wrestled a match.',
    cost: 'You have spent the surprise. They had better deliver.',
    needsTarget: false,
  },
  {
    id: 'retirementSpeech',
    name: 'Say goodbye',
    effect: 'Closes a career properly. The whole roster feels it.',
    cost: 'It is the last thing they will ever do for you.',
    needsTarget: false,
  },
  {
    id: 'invasionPromo',
    name: 'Call out another company',
    effect: 'Takes following off whoever holds the town you are running.',
    cost: 'They will hear about it, and they will answer.',
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
      '{speaker} had the building in the palm of their hand and would not let go.',
      'Nobody moved for the whole thing. {speaker} does not miss.',
      'That is the promo they will play in the video package for years.',
      '{speaker} said it once, said it right, and let it sit there.',
      'The whole building was leaning in by the end of it. {speaker} knows exactly what they are doing.',
      'That is a masterclass. {speaker} could sell a rematch to an empty room.',
    ],
  },
  {
    minQuality: 60,
    lines: [
      '{speaker} said exactly what they needed to and got out.',
      'Sharp, mean, and over. {speaker} made their point.',
      '{speaker} got the reaction they were after.',
      'Clean, confident, no wasted words. {speaker} knows how to close a segment.',
      'That landed. {speaker} had the room and used it well.',
      '{speaker} did not need long. Said it, meant it, walked off.',
    ],
  },
  {
    minQuality: 40,
    lines: [
      '{speaker} got through it. The crowd stayed with them, mostly.',
      'Serviceable. {speaker} is not going to be remembered for talking.',
      'It did the job and it did not do much more.',
      '{speaker} hit the points that mattered and rushed the rest.',
      'Fine. Nobody is buying a ticket off the back of that, but fine.',
      '{speaker} was clearly reciting it. It still worked, mostly.',
    ],
  },
  {
    minQuality: 0,
    lines: [
      '{speaker} lost the crowd inside a minute and never got them back.',
      'Long, loud, and about nothing. You could hear people leaving for the concourse.',
      '{speaker} should not be handed a microphone again in a hurry.',
      'That went nowhere and took its time getting there.',
      '{speaker} froze twice and covered neither of them.',
      'The house lights might as well have come up. Dead air in a live building.',
    ],
  },
];
