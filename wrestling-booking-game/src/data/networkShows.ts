// The rest of television.
//
// Wrestling does not exist in a vacuum on a ratings chart — it sits between a
// primetime soap and a police procedural, and where it sits is the clearest
// possible statement of how the business is doing. Landing at number four
// behind two sitcoms means something that "3.4" alone never does.
//
// These are invented 1980s network programmes. They are period-plausible on
// purpose and deliberately not real shows: the design forbids real names or
// likenesses, and a chart full of obvious pastiche would undercut the effect.
// Each carries a base rating and a weekly wobble, so the chart moves on its
// own and a good week for you can still lose to a season finale.

export interface NetworkShow {
  id: string;
  name: string;
  network: string;
  genre: 'drama' | 'sitcom' | 'news' | 'variety' | 'movie' | 'sport';
  /** Typical household rating. */
  baseRating: number;
  /** How much it swings week to week. A finale spikes; the news does not. */
  volatility: number;
}

export const NETWORK_SHOWS: NetworkShow[] = [
  { id: 'ns-oilbarons', name: 'The Oil Barons', network: 'CBN', genre: 'drama', baseRating: 21.4, volatility: 3.2 },
  { id: 'ns-harborlight', name: 'Harborlight', network: 'NBS', genre: 'drama', baseRating: 18.9, volatility: 2.8 },
  { id: 'ns-familyman', name: "Family Man", network: 'ABN', genre: 'sitcom', baseRating: 17.6, volatility: 2.1 },
  { id: 'ns-precinct9', name: 'Precinct Nine', network: 'CBN', genre: 'drama', baseRating: 16.2, volatility: 2.4 },
  { id: 'ns-cheersup', name: 'The Corner Booth', network: 'NBS', genre: 'sitcom', baseRating: 15.8, volatility: 1.9 },
  { id: 'ns-nightdesk', name: 'The Night Desk', network: 'ABN', genre: 'news', baseRating: 14.1, volatility: 0.9 },
  { id: 'ns-goldrush', name: 'Goldrush County', network: 'CBN', genre: 'drama', baseRating: 13.5, volatility: 2.6 },
  { id: 'ns-laughtrack', name: 'Two Doors Down', network: 'NBS', genre: 'sitcom', baseRating: 12.8, volatility: 2.0 },
  { id: 'ns-saturdaymovie', name: 'Saturday Night Movie', network: 'ABN', genre: 'movie', baseRating: 12.2, volatility: 4.5 },
  { id: 'ns-varietyhour', name: 'The Delmore Variety Hour', network: 'CBN', genre: 'variety', baseRating: 11.4, volatility: 2.7 },
  { id: 'ns-mondayball', name: 'Monday Night Football', network: 'ABN', genre: 'sport', baseRating: 16.8, volatility: 3.8 },
  { id: 'ns-hospital', name: 'Mercy General', network: 'NBS', genre: 'drama', baseRating: 10.9, volatility: 2.2 },
  { id: 'ns-detective', name: 'Sunset Detective', network: 'CBN', genre: 'drama', baseRating: 9.7, volatility: 2.3 },
  { id: 'ns-gameshow', name: 'Name Your Price', network: 'NBS', genre: 'variety', baseRating: 8.4, volatility: 1.1 },
  { id: 'ns-sciencefiction', name: 'Starfarer', network: 'ABN', genre: 'drama', baseRating: 7.9, volatility: 2.9 },
  { id: 'ns-latenight', name: 'After Hours with Del Ramsey', network: 'NBS', genre: 'variety', baseRating: 6.2, volatility: 1.3 },
  { id: 'ns-western', name: 'The Long Trail', network: 'CBN', genre: 'drama', baseRating: 5.8, volatility: 1.8 },
  { id: 'ns-sundaysports', name: 'Sunday Sports Roundup', network: 'ABN', genre: 'sport', baseRating: 5.1, volatility: 1.6 },
  { id: 'ns-sitcomrerun', name: 'The Pearsons', network: 'CBN', genre: 'sitcom', baseRating: 4.6, volatility: 1.2 },
  { id: 'ns-publicaffairs', name: 'Nation This Week', network: 'NBS', genre: 'news', baseRating: 3.4, volatility: 0.7 },
];

