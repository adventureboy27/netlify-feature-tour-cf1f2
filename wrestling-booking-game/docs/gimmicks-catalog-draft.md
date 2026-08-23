# Gimmick catalogue — content draft

Working material for the booker-decides-the-gimmick module (see chat log for
the design conversation this grew out of — heat scale, signing-time meeting,
forced cold-end check-ins, tag/faction support). Not yet wired into
`src/data/gimmicks.ts` — the live `Gimmick` type has no `blurb`/`promoLines`/
`prop` fields yet. This is the creative draft to pull from once the schema
is settled; existing catalog entries (`Rockstar`, `Biker`, `Backwoods
Brawler`, etc.) are left alone below rather than duplicated.

Every character here is original — built in the spirit of a real era or
archetype, never a real wrestler's name or exact likeness. Alignment is
listed as a *lean*, same as the existing system: many of these can work
either side depending on the wrestler wearing them.

`Prop:` is listed where the character plausibly totes something to the
ring that doubles as a weapon in a hardcore/No-DQ match — hooks straight
into the existing stipulation system.

---

## Law and disorder

- **The Warden** — heel. Runs the ring like his old cell block; "lockdown"
  as a finisher name. *Prop: nightstick.*
  - "Lights out at ten. For you, lights out right now."
  - "I've broken tougher men than you before breakfast count."
- **Con Time** — either. An ex-inmate who did the years and isn't shy about
  it; tattoos as a hit list of old grudges. *Prop: shiv-shaped letter opener,
  played for menace not literal violence.*
  - "Every day inside, I thought about a night like this."
  - "You get one phone call. Use it, because it's the last one you're making."
- **Bail Jumper** — heel/tween. A bounty hunter who decided catching was more
  fun than being caught. *Prop: pair of handcuffs.*
  - "I always get my man. Tonight, that's you."
  - "Skip out on this one and there's nowhere left to run."
- **The Bailiff** — heel. Courtroom order, enforced personally. "All rise"
  as an entrance cue.
  - "Order in this ring, or I hold you in contempt."
  - "The verdict's already in. You're just here for sentencing."
- **Repo Man** — heel. Shows up, takes what's yours, leaves a receipt.
  *Prop: clipboard, used as a slapping weapon.*
  - "Nothing here belongs to you anymore. Not even the win."
  - "I don't take it personal. I just take it."
- **The Sheriff** — face. Small-town law, big-town toughness. Star badge on
  the trunks. *Prop: a length of rope, coiled like a lasso.*
  - "This town's mine to protect, and tonight that means you."
  - "Somebody's gotta clean this place up. Might as well be me."
- **Jury of One** — heel. Self-appointed judge, jury, and executioner of
  the card. *Prop: a gavel.*
  - "I already deliberated. You're guilty."
  - "Court's in session, and there's no appeal."
- **The Escape Artist** — face. Claims he's broken out of three prisons and
  a straightjacket on live TV; sells the mystique hard.
  - "You can lock the door. You can't lock down what I do to you in here."
  - "I've slipped tighter spots than this hold."

## Blue collar

- **Trashman** — heel/tween. Sanitation worker gimmick; wheels an actual
  trash can to the ring. Finisher: "Curbside Pickup." *Prop: trash can lid.*
  - "You're garbage — and pickup's early tonight."
  - "I've hauled off bigger junk than you before my coffee got cold."
- **The Foreman** — face. Hard hat, tool belt, blue-collar authority. Runs
  the card like a job site. *Prop: a wrench.*
  - "This is a union job. You don't get overtime for losing slower."
  - "I built this body with my hands. I'll take yours apart with them too."
- **Live Wire** — heel. An electrician who talks like every match is a
  short circuit waiting to happen.
  - "Touch me and see what happens. I promise it's not pretty."
  - "You're about to get grounded, permanently."
- **The Plumber** — face/tween. Blue overalls, wrench in hand, working-man
  charm played for comedy that turns serious fast. *Prop: pipe wrench.*
  - "I fix what's broken. Tonight, that's your whole game plan."
  - "Every pipe clogs eventually. So does every winning streak."
- **Ironhide** — heel. A steelworker who thinks the ring's just another
  girder forty stories up.
  - "I've stood on beams that would've killed you just looking down."
  - "Steel doesn't bend. Neither do I."
- **The Long Haul** — face. Trucker gimmick, logbook and CB radio flavor,
  "ten-four" catchphrases.
  - "I've driven through worse storms than you."
  - "Get in my way and you're just roadkill on my route."
- **Deep Cut** — heel. A miner who came up from underground mean and stayed
  that way.
  - "I've spent years in the dark. I know exactly where to hit."
  - "You don't want to see what I bring up from down there."
- **The Butcher's Son** — heel. Apron, cleaver prop, unsettlingly calm about
  violence. *Prop: a (blunted, prop) meat cleaver.*
  - "I know exactly where every cut goes."
  - "Prime or scrap — it's all the same to me on the table."
- **Sparkplug** — face. A mechanic gimmick, all grease-stained charisma and
  fix-it-yourself grit. *Prop: a tire iron.*
  - "Every engine's got a weak part. Yours is about to show."
  - "I don't quit on a job halfway. Not tonight either."
- **The Custodian** — heel/tween. A janitor who's swept up after every
  legend in the building and is done being invisible. *Prop: a push broom.*
  - "I've mopped up better men than you off this floor."
  - "You made the mess. I'm just here to finish the job."

## Rural and outlaw

- **Cousin Dell** — face/tween. A genuine hillbilly gimmick, overalls and
  a corncob-pipe prop, dumb-like-a-fox energy that turns on smarter
  opponents.
  - "Y'all think I'm slow. Watch how fast I move when it counts."
  - "Where I'm from, we settle things simpler than this."
- **The Moonshiner** — heel. Runs a still, sells a story about "family
  recipe" toughness. *Prop: a jug, played for comedy and as a light weapon.*
  - "This here's a hundred and fifty proof, and so am I."
  - "You'll wake up wondering what hit you. It was me."
- **Rattler** — heel. A swamp/backwoods gimmick, slow drawl, sudden
  striking speed.
  - "Snakes don't warn you twice."
  - "I've been coiled up waiting for exactly this."
- **The Wrangler** — face. Full cowboy kit, actual rope work in the
  entrance. *Prop: a lasso.*
  - "I've broken wilder animals than you."
  - "Round these parts, we settle up in the ring."
- **Dust Bowl** — heel/tween. A dirt-poor farmer's-son gimmick, chip on the
  shoulder about every promotion that overlooked him.
  - "I've clawed everything I have out of dirt. You're next."
  - "Nobody handed me a thing. I'm not handing you one either."
- **The Poacher** — heel. Hunts for a living, treats opponents like game.
  *Prop: a coiled net.*
  - "I already know where you're weak. I've been tracking you all week."
  - "Some things are in season. Tonight, you are."
- **Old Ridge** — either. A grizzled mountain-man gimmick, decades of
  isolation played as quiet menace.
  - "I've gone years without seeing another soul. I don't need company now."
  - "The mountain doesn't care if you're ready. Neither do I."
- **The Gatorman** — heel. Bayou wrestler gimmick, alligator-hide-print
  gear, bites-back mean streak.
  - "Down in the swamp, you learn: the thing that looks slow is the one
    that gets you."
  - "I don't let go once I've got a hold. Ask the last thing I caught."

## Military and paramilitary

- **The Drill** — heel. A washed-out drill sergeant who never left the
  parade ground mentality behind. *Prop: a swagger stick.*
  - "Drop and give me twenty. Then I'll finish you off."
  - "I've broken tougher recruits than you before sunrise."
- **Shell Shock** — either. A combat-vet gimmick, thousand-yard stare,
  unpredictable violence.
  - "You don't want to see what's behind my eyes right now."
  - "I've survived worse than this ring. Have you?"
- **The Deserter** — heel. Walked out on his unit, no regrets, points that
  same discipline at the crowd now.
  - "I didn't run from the fight. I ran from the wrong side of it."
  - "Nobody tells me where to stand anymore."
- **Point Man** — face. Squared-away, leads-from-the-front military
  gimmick, genuinely earnest patriotism played straight.
  - "I go first so nobody else has to."
  - "This is nothing compared to what I signed up for."
- **The Warlord** — heel. Mercenary-adjacent but louder, painted face,
  conquest talk. *Prop: a length of chain worn as a bandolier.*
  - "Every territory I've touched, I've taken."
  - "This ring's just the next thing I own."
- **Field Medic** — face/tween. Was there to patch soldiers up, got tired
  of watching, decided to hit back instead.
  - "I've stitched up worse wounds than the one I'm about to give you."
  - "Some things you can't patch. This is one of them."

## Showbiz and entertainment

- **Rock Star** — either. *(near-existing catalog concept — see Rockstar;
  this variant leans harder theatrical, less musician, more arena-persona.)*
  Guitar prop smashed at ringside for real theater. *Prop: a (breakaway)
  guitar.*
  - "This is my encore. You don't get one."
  - "Every legend needs a finale. You're mine tonight."
- **The Understudy** — heel/tween. Spent years as somebody's opening act,
  finally got billed and won't share the spotlight again.
  - "I waited in the wings long enough. Now you wait."
  - "I know every trick because I watched the best steal them first."
- **Ringmaster** — heel. Circus-master theatrics, treats the whole card
  like his three-ring show. *Prop: a riding crop.*
  - "Ladies and gentlemen — the main event is a formality."
  - "Step right up and watch how fast this ends."
- **The Contortionist** — either. Circus-trained flexibility gimmick, an
  in-ring style built around bending out of holds nobody escapes.
  - "You can't trap what doesn't hold still."
  - "I've folded myself into smaller spaces than this problem."
- **Stuntdouble** — face. Ex-Hollywood stunt performer, no-sell reputation,
  "I've taken worse falls for less money" attitude.
  - "I've been set on fire for a paycheck. This is nothing."
  - "I do my own stunts. Do you?"
- **The Headliner** — heel. Insists his name should be on top of every
  poster, furious it isn't yet.
  - "This card is upside down. I fix that tonight."
  - "You're the undercard to my whole career."
- **DJ Bodyslam** — face/tween. Turntables at ringside, hypes his own
  entrance, crowd-work heavy.
  - "I've got the only beat that matters in this building."
  - "Drop the bass. Drop the opponent. Same set."
- **The Ventriloquist** — heel. Creepy theater-kid energy, talks about
  "making you dance" like a puppet. Unsettling more than funny.
  - "I already know exactly how this ends. I wrote the script."
  - "Strings or no strings, you move how I want you to."
- **Marquee** — either. Old-school showman, insists every match is "the
  show," treats losing as bad reviews.
  - "The lights are on. Give the people something worth the ticket."
  - "I don't do flops. Tonight's no exception."

## Sports crossovers

- **The Combine** — face. Failed-athlete-adjacent but leans into raw
  measurables — fastest forty, biggest vertical — chip on his shoulder
  about never getting drafted.
  - "They clocked every number on me except heart. Watch this one."
  - "Cut from every roster but this one. I made sure of it."
- **Sideline** — heel. A benched star who thinks the real sport was always
  wrestling and everyone else wasted his time.
  - "I warmed a bench for a game that didn't deserve me."
  - "This is the only field that ever actually tested me."
- **The Boarder** — face/tween. Skateboard culture gimmick, rides the
  board to ringside, trick-based entrance. *Prop: a skateboard.*
  - "I've eaten pavement harder than anything you can dish out."
  - "Landed worse falls than this and kept rolling."
- **Big Wave** — face. Surfer gimmick, laid-back on the mic, vicious the
  second the bell rings.
  - "You don't fight the wave. You just get pulled under."
  - "I've survived bigger wipeouts than you."
- **The Cutman** — heel. A boxing corner-man gimmick, talks in fight-camp
  jargon, treats every match like he's the one throwing in the towel — for
  the other guy.
  - "I've stopped fights for less blood than this."
  - "Somebody's towel's going in tonight. Not mine."
- **Iron Medal** — either. An Olympic-reject gimmick, silver medalist with
  a grudge about the gold.
  - "Second place taught me exactly what losing costs."
  - "I've trained four years for smaller stages than this."
- **The Powerlifter** — heel. Raw strength-sport gimmick, chalk bag,
  numbers-obsessed trash talk.
  - "I've put up more weight than you'll ever be worth."
  - "This is just another rep to me."
- **Blacktop** — face/tween. Streetball gimmick, playground trash talk,
  flashy and loud.
  - "Ain't no refs out here where I learned to play."
  - "Run it back? Nah — game's already over."

## Intellectual and eccentric

- **The Professor** — heel. Lectures the crowd mid-match, condescending,
  genuinely smart scouting reports on opponents.
  - "Class is in session. Take notes — this is the only lesson you get."
  - "I've studied you longer than you've studied yourself."
- **Free Verse** — face/tween. A poet gimmick, spits actual rhyming promos,
  soft-spoken until the bell rings.
  - "Every line I write ends the same way you're about to."
  - "I don't need to shout. The words do the damage."
- **The Chess Piece** — either. Slow, methodical, talks in strategy
  metaphors, plays a long, patient in-ring game.
  - "You're playing checkers. I'm four moves ahead."
  - "Every piece has its purpose. Yours was the sacrifice."
- **Mad Science** — heel. Wild-eyed inventor gimmick, "experiments" language
  around moves, unpredictable energy.
  - "Every great discovery needs a test subject."
  - "This is going to hurt. For science."
- **The Philosopher** — either. Calm, detached, talks about violence like
  an abstract concept, deeply unsettling.
  - "Pain is just a perspective. Yours is about to change."
  - "I've made peace with things you haven't even considered yet."
- **Riddle** — heel/tween. Speaks almost entirely in riddles and half-truths,
  keeps opponents guessing at his real plan.
  - "Ask me the right question and I might tell you how this ends."
  - "The answer was always violence. It usually is."
- **The Hypnotist** — heel. Claims to get inside opponents' heads before
  the bell even rings. *Prop: a pocket watch on a chain.*
  - "By the time you hear the bell, you've already lost."
  - "Watch closely. You won't remember losing this."

## Mystical and supernatural

- **The Undertaker's Boy** *(working title, would be renamed to avoid the
  obvious real-world overlap)* — **cut**, see note below.
- **Hex** — heel. Voodoo-adjacent mystic gimmick, talks curses and bad luck
  onto opponents, dolls as a visual prop. *Prop: pins, played for menace,
  never literal.*
  - "I already put a pin where it'll hurt most."
  - "You crossed the wrong door tonight."
- **The Reverend** — heel/tween. Fire-and-brimstone preacher energy
  (distinct from the existing catalog's straight Preacher entry — this one
  leans corrupt televangelist rather than earnest). *Prop: a bible, used to
  smack rather than read.*
  - "The collection plate's full and so is my patience."
  - "Confess now. Confession's cheaper than what's coming."
- **Old Bones** — either. A fortune-teller gimmick, claims to already know
  how every match ends.
  - "I saw this coming a week ago. So did you, if you're honest."
  - "The cards never lie. Neither do I, when it's this obvious."
- **Static** — heel. A medium/psychic gimmick, talks to "the other side"
  mid-promo, eerie stillness broken by sudden violence.
  - "Somebody's already told me how tonight ends for you."
  - "The dead don't lie. Ask them yourself in a minute."
- **The Shaman** — face/tween. Ritual-and-ceremony entrance, treats every
  match like a rite of passage.
  - "This is a ceremony. You're the sacrifice."
  - "I carry more than muscle into this ring."
- **Blackout** — heel. An eclipse/omen-themed gimmick, "bad things happen
  when I show up" mystique.
  - "Every time I'm booked, something goes dark. Tonight it's you."
  - "You don't want to be here when the lights go."

*(Note: an "Undertaker's Boy" entry was drafted and then cut — too close to
an existing, very famous real gimmick to be safely original. Flagging the
near-miss here rather than silently omitting it, since it's a reminder to
run every mystical/death-themed entry through that same check before this
gets wired into the game for real.)*

## Corporate, political, and media

- **The Shareholder** — heel. Suit-and-tie corporate-raider gimmick, treats
  wrestlers like assets to be acquired or liquidated. *(Distinct from the
  existing Corporate Stooge/Rich Snob/Owner's Favorite — this one is the
  boardroom itself, not somebody's lackey.)*
  - "I don't lose. I divest."
  - "Your contract's about to get a lot shorter."
- **The Senator** — heel. Career-politician gimmick, empty promises, always
  campaigning even mid-match.
  - "Vote for me and this all goes a lot easier."
  - "I've broken bigger promises than the one I'm about to make you."
- **Tabloid** — heel/tween. A gossip-columnist gimmick, "exposes" opponents'
  secrets in promos, plays dirty with information instead of just fists.
  - "I already know what you don't want printed."
  - "Front page tomorrow: you, losing."
- **The Union Boss** — face/tween. Working-class solidarity gimmick, speaks
  for "the boys in the back," genuinely popular with the roster in-fiction.
  - "Everybody in that locker room's got my back. Who's got yours?"
  - "I don't negotiate. I organize."
- **Prime Time** — heel. A talk-show-host gimmick, treats every segment
  like his own program, interrupts other promos.
  - "This is my show now. You're just a guest."
  - "Great television needs a loser. Type-cast, tonight."
- **The Litigator** — heel. Lawyer gimmick, threatens lawsuits, twists
  rules technicalities, weaselly but genuinely dangerous.
  - "I'll see you in court. Or the hospital. Your choice."
  - "I've won cases with less evidence than I have on you."

## Historical and mythic

- **The Gladiator** — face. Colosseum theming, actual arena entrance,
  earnest old-world honor code. *Prop: a (blunted, prop) short sword and
  shield.*
  - "Ave — those about to lose, I salute you."
  - "I've survived worse arenas than this one."
- **Northland** — heel. Viking-raider theming, horned helmet, conquest
  talk. *Prop: a (prop) battle axe.*
  - "I didn't sail this far to leave empty-handed."
  - "Your village should've hidden better."
- **The Ronin** — either. Masterless-samurai theming, honor-bound but
  wandering, quiet until provoked. *Prop: a (blunted, prop) katana, carried
  sheathed.*
  - "A blade doesn't need to be drawn to already know the outcome."
  - "I serve no one. That makes me dangerous to everyone."
- **Iron Age** — heel. Blacksmith/forge theming, "I forge champions and
  break the rest" talk.
  - "Everything strong gets hammered first. You're about to find out why."
  - "I don't break. I get tempered."
- **The Pharaoh** — heel. Ancient-Egyptian royalty theming, god-king
  arrogance.
  - "Kneel. It's traditional, and it's about to be mandatory."
  - "Dynasties outlast wrestlers like you by centuries."
- **Highland** — face/tween. Scottish-clan theming, caber-toss strongman
  energy, actual claymore-style prop. *Prop: a (blunted, prop) claymore.*
  - "Where I'm from, this is a warm-up."
  - "My clan's been settling things this way for a thousand years."
- **The Corsair** — heel/tween. Pirate theming, treasure-hunter greed,
  actual cutlass prop. *Prop: a (blunted, prop) cutlass.*
  - "Everything you've got is about to be mine."
  - "Dead men don't need championships."

## Animal and nature acts

- **Shark Attack** — heel. Predator-themed, cold, circling energy before
  striking.
  - "I smell blood in the water already."
  - "Sharks don't warn you. Neither do I."
- **The Wolf** — either. Pack-leader theming, howls to the crowd, hunts in
  patterns.
  - "I don't hunt alone by accident. I hunt alone because nobody keeps up."
  - "You're not prey. You're just slow prey."
- **Grizzly** — heel. Bear-themed powerhouse, hibernation-and-rage
  mythology, unpredictable temper.
  - "Wake a bear up wrong and this is what happens."
  - "I've been patient all week. That's over now."
- **The Snake Charmer** — heel/tween. Carries a (prop, clearly fake) snake
  to the ring, hypnotic, slow-building menace. *Prop: a coiled rope styled
  as a snake.*
  - "Everybody freezes the first time they see one up close."
  - "I don't need to strike first. You'll flinch. That's enough."
- **Falconer** — face. Trains birds of prey in-fiction, sharp-eyed,
  patient-hunter gimmick.
  - "I've trained things faster and meaner than you to obey me."
  - "One strike. That's all a good hunter needs."
- **The Bull** — heel. Raw-charge powerhouse, red-cape entrance theatrics.
  - "You're waving a cape at exactly the wrong animal."
  - "I only know how to go forward. Through you works fine."
- **Houndmaster** — heel/tween. Brings an actual (real, handled by staff,
  or implied) guard dog to ringside for entrance theater; genuinely
  unsettling presence.
  - "He only bites on command. I haven't given it yet."
  - "Good dog. Bad night for you."

## Food and hospitality

- **The Chef** — either. Kitchen-brigade discipline, "I don't serve
  seconds" talk. *Prop: a (blunted, prop) cleaver, same family as Butcher's
  Son but a distinct, less menacing, more showman flavor — keep only one of
  the two in an actual roster to avoid overlap.*
  - "Everything on my menu ends the same way — done."
  - "I've plated better men than you and sent them out cold."
- **Last Call** — heel/tween. Bartender gimmick, world-weary, "seen every
  kind of drunk fight there is" attitude.
  - "I've thrown out bigger messes than you before closing."
  - "Last call was an hour ago. You're still here anyway."
- **The Delivery Guy** — face/tween. Pizza-delivery everyman gimmick,
  scrappy, always "on the clock," genuinely likable underdog energy.
  *Prop: a pizza peel/paddle.*
  - "Thirty minutes or it's free. You've got about that long."
  - "I deliver. Every single time."

## Medical

- **The Surgeon** — heel. Cold, clinical, talks about opponents like
  operations. Unsettlingly calm.
  - "I already know exactly where to cut."
  - "This won't take long. It never does."
- **Night Shift** — face/tween. Overworked ER-nurse gimmick, exhausted but
  tougher for it, "I've seen worse than this on a Friday" attitude.
  - "You think this is bad? Come see my normal Tuesday."
  - "I've patched up worse and sent them home. You're not getting that
    treatment."
- **The Dentist** — heel. Unsettling, methodical, "open wide" catchphrase
  played for genuine menace rather than comedy.
  - "This is going to hurt. It's supposed to."
  - "Nobody ever likes what I find when I look closer."

## School and education

- **Coach** — face/tween. Old-school gym-teacher energy, whistle prop,
  drill-sergeant-but-friendlier.
  - "Give me twenty. Then give me the match."
  - "I've benched better players than you for less."
- **The Principal** — heel. Detention-and-discipline theming, treats the
  ring like his office.
  - "You're in my building now. My rules."
  - "This is a permanent record kind of night."
- **Valedictorian** — heel/tween. Straight-A overachiever gimmick, insists
  he's "smarter than the whole card," condescending brilliance.
  - "I graduated top of every class I've ever entered. This is no
    different."
  - "You're the extra credit I didn't need to bother with."
- **The Substitute** — face/tween. Journeyman "always the backup, never
  the star" gimmick with a chip on his shoulder about finally getting a
  real shot.
  - "Nobody remembers the substitute. They will after tonight."
  - "I've been ready for this class period for years."

## Tech and modern

- **The Firewall** — heel. Hacker-adjacent gimmick, "already got inside
  your head before the match started" mystique.
  - "I've been in your systems since Tuesday."
  - "Everything you've got, I've already seen."
- **Respawn** — face/tween. Gamer-culture gimmick, treats losses as just
  another round, genuinely upbeat resilience.
  - "Died plenty of times before. Always came back stronger."
  - "This is just round one to me."
- **The Algorithm** — heel. Cold, data-driven, talks about opponents in
  win-probability terms.
  - "I've already calculated the outcome. You're just here to confirm it."
  - "The numbers never lie. Neither do I, when they're this one-sided."
- **Buffering** — heel/tween. An influencer gimmick, obsessed with going
  viral, phone-out-for-a-selfie mid-entrance theatrics.
  - "This is content either way. Better for me if you lose."
  - "You're about to blow up my numbers. Thanks in advance."

## Everyman-with-an-edge

- **The Substitute Teacher of Pain** *(cut — too close to Substitute above,
  listing the miss deliberately rather than quietly dropping it)*.
- **Nine-to-Five** — face. Ordinary-office-worker gimmick who turned out to
  have real fight in him; earnest, relatable underdog.
  - "I've survived worse Mondays than this."
  - "Turns out I had more in the tank than a desk job ever needed."
- **The Landlord** — heel. Petty, greedy, treats the ring like territory
  he's owed rent on.
  - "This ring's mine. You're behind on payment."
  - "Eviction notice — effective immediately."
- **Overtime** — face/tween. Never-say-die gimmick built entirely around
  refusing to lose in regulation.
  - "I don't do easy wins for anybody. Including you."
  - "This one's going the distance. It always does with me."
- **The Neighbor** — heel/tween. Suburban-grudge gimmick, petty
  fence-line-dispute energy scaled up to real violence, played partly for
  dark comedy.
  - "You let your dog on my lawn one too many times."
  - "This has been a long time coming, and the whole street knows it."

---

## Tag team gimmicks

Each entry is a **shared concept two wrestlers step into together**, not
two solo gimmicks glued side by side — the point is a unit identity.

- **The Wrecking Crew** — heel. Demolition/construction duo, matching hard
  hats, "condemned" as a shared finisher name. *Prop: a sledgehammer,
  carried by one partner.*
  - "This whole building's coming down tonight."
- **Cell Block** — heel. Two former inmates, shared "did time together"
  backstory, genuine loyalty played as menace.
  - "We already survived worse than each other. What do you think you
    survive?"
- **Double or Nothing** — heel/tween. A gambler duo, cards-and-dice
  theming, "the house always wins" as a shared catchphrase. *Prop: a deck
  of oversized cards, tossed at ringside as showmanship.*
  - "You bet on the wrong table."
- **The Line Crew** — face. Utility-worker duo, "we fix what's broken"
  blue-collar teamwork gimmick.
  - "Every outage gets restored eventually. You're the outage."
- **Closing Time** — heel/tween. Two bouncers-turned-wrestlers, "we're the
  ones who throw you out" energy. Distinct from the solo bartender Last
  Call above — pick one or the other for an actual roster, not both.
  - "We've cleared out worse crowds than this one."
- **The Boy Scouts** — face/tween. Earnest, merit-badge theatrics played
  half for comedy, genuinely dangerous once it turns.
  - "We came prepared. Did you?"
- **Sudden Death** — heel. Overtime-obsessed duo, insist every match should
  end in chaos, thrive in no-countout stipulations.
  - "Regulation's for cowards. We only do sudden death."
- **The Vacancy** — heel/tween. Motel-owner duo, "checked you in, we're
  checking you out" theming.
  - "Checkout was an hour ago. You're still here."
- **Fresh Ink** — face/tween. Tattoo-parlor duo, matching new-ink
  entrances, loud and proud showmen.
  - "Every piece tells a story. Yours ends tonight."
- **The Foreclosure** — heel. Bank-repo duo, corporate menace, "we own
  everything eventually" theming.
  - "We already own the deed on this match."
- **Overtime Parking** — face/tween. Meter-maid/valet duo played for comedy
  that turns genuinely tough.
  - "You're way past your time limit."
- **The Understudies** — heel/tween. A theater-duo mirror of the solo
  Understudy above, sharing the same "finally got billed" grudge as a pair.
  - "Two understudies is still a headline act. Watch."
- **Salt and Vinegar** — face/tween. A loud, bickering duo whose in-fighting
  somehow makes them more dangerous, not less.
  - "We fight each other worse than we're about to fight you."
- **The Deep Freeze** — heel. Cold, silent, methodical duo — zero
  showmanship, maximum menace, built for a slow, suffocating match style.
  - (Rarely speaks. When they do:) "This ends quietly."
- **Roughhouse** — face. Bar-brawl-style duo, genuinely enjoy the fight
  more than the win.
  - "We didn't come here for a wrestling match. We came for a bar fight."
- **The Overdraft** — heel/tween. Debt-collector duo, "you owe us" theming
  applied to the whole card.
  - "Everybody in this building owes somebody. Tonight, you pay us."
- **High Beams** — face. A trucker/road duo built around the Long Haul's
  world, "we've logged more miles than this whole card combined" swagger.
  - "We've driven through worse weather than you."
- **The Overtime Rule** — heel/tween. A sports-crossover duo, obsessed with
  making every match go the distance on their terms.
  - "Regulation doesn't apply to us. Never has."
- **Static Cling** — heel. A tech/media duo built around the Algorithm and
  Buffering's world, "we already control what you see" theming.
  - "We wrote the story before you walked out here."
- **Barrel Roll** — face/tween. A rodeo-and-derby duo, chaotic showmanship,
  genuinely reckless in-ring style.
  - "We don't slow down for anybody. Never have."
- **The Second Opinion** — heel. A medical-themed duo, unsettling
  clinical calm, finish opponents off with the same cold precision.
  - "We already agree on the diagnosis."

## Faction and stable gimmicks

Three or more members under one banner. Each entry describes the shared
philosophy a group of wrestlers steps into, not any one member's persona —
individual members can (and should) keep their own solo gimmick underneath
if they have one, the way a real stable works.

- **The Union** — face-leaning. Blue-collar solidarity faction; every member
  reads as a different trade (the Foreman, Sparkplug, the Custodian, etc.
  could all plausibly belong). Shared cause: "the locker room takes care of
  its own."
- **The Boardroom** — heel. Corporate-raider faction; the Shareholder as a
  natural centerpiece, backed by lawyer/media-type members (the Litigator,
  Tabloid). Shared cause: buying up the roster's contracts and loyalty.
- **Cell Block Nine** — heel. A prison-yard faction built around Con Time
  and the Warden as natural anchors, recruiting anyone with a
  "did-time" backstory.
  - Shared line, chanted together: "We already own this yard."
- **The Congregation** — heel-leaning, genuinely creepy. Built around the
  Reverend and Hex; cult-adjacent without literally being the existing
  catalog's Cult Leader — a group faith rather than one leader's
  personality.
- **The Reserves** — face. A misfit faction of never-quite-made-it
  gimmicks — the Substitute, Nine-to-Five, the Combine — banding together
  specifically because none of them got picked first.
  - Shared line: "Nobody wanted us alone. Try all of us."
- **The Motor Pool** — either, usually heel. A biker-and-trucker faction
  (natural home for the existing Biker entry, plus the Long Haul), road
  gang energy, genuine menace in numbers.
- **The Dojo** — face-leaning. A martial-discipline faction, built around
  the Ronin and any masked/luchador-style members, "honor before
  everything" shared code — the one faction that actually polices its own
  members' conduct in-fiction.
- **The Wasteyard** — heel. A scrap-and-salvage faction built around
  Trashman and Repo Man; "we take what's thrown away and make it dangerous"
  as the shared hook.
- **Prime Time Players** *(working title — would need a rename pass, reads
  close to real-world branding conventions)* — **cut**, flagged rather than
  silently dropped, same reasoning as the Undertaker's Boy note above.
- **The Frequency** — heel/tween. A media-and-tech faction built around
  Buffering and the Algorithm, "we control the narrative" as the shared
  hook — genuinely useful in-fiction for a promotion that wants a faction
  who can plausibly manipulate the newsfeed/TV-ratings systems already in
  the game.
- **Last Rites** — heel, genuinely dark tone. A mystical faction built
  around Hex, Static, and Blackout — shared "bad things happen around us"
  mythology, most dangerous stable in terms of tone, needs careful pacing
  so it doesn't read as cheap shock value.
- **The Bracket** — face-leaning. A sports-crossover faction — Iron Medal,
  the Powerlifter, Blacktop — competitive-athlete camaraderie, "we respect
  the game even when we're breaking your face" ethos.
- **The Understudy Company** — heel-leaning. The full-troupe version of the
  tag-team Understudies above — three or more showbiz-adjacent members
  (Understudy, Marquee, DJ Bodyslam, the Contortionist) who all spent years
  as somebody's opening act and are done being one.
  - Shared line: "We were always the show. Nobody just noticed yet."
- **Open Road** — face-leaning. A trucker/biker/travel faction — the Long
  Haul, Border Crossing, High Beams — built around the idea that none of
  them belong to any one territory, and that's the point.
- **The Colony** — heel, careful tonal pacing. A hive-minded faction built
  around Chrome, the Algorithm, and Sector Seven — genuinely eerie, "we do
  not act alone, we act as one" collective-menace framing rather than any
  single leader's personality.
- **Last Call Local 12** — face-leaning. A service-industry faction —
  Last Call, the Delivery Guy, Curb Service — genuine working-friends
  camaraderie, closest thing to a comic-relief faction that still wins
  clean.

---

## Minor tweaks — regular names, no full theatrical gimmick

Per the brief: not everyone needs a costume-and-catchphrase character.
These are light-touch persona hooks a wrestler can "catch on" with while
keeping their real name and a mostly ordinary look — a nickname earned
in-fiction, a single visual tell, a reputation rather than a script.

- **"Iron Grip"** — earned nickname for a submission specialist; no gimmick,
  just a moniker that sticks after enough matches end the same way.
- **"The Bell-to-Bell Man"** — reputation nickname for someone who's simply
  never once quit early; zero costume, all in-ring credibility.
- **A single visual tell** — one piece of gear that reads as "theirs":
  a specific taped wrist, a particular boot color, one tattoo the camera
  keeps finding. No name change, no promo shift.
- **"Old Reliable"** — a veteran nickname earned through consistency, not
  performance — the crowd trusts them precisely because nothing ever
  changes.
- **A hometown tag** — "The Pride of [Territory]" styled purely off where
  they're from, no character behind it beyond genuine local support.
- **"Second Gear"** — nickname for a wrestler known for slow starts and hot
  finishes; describes a real in-ring pattern rather than inventing a
  persona.
- **A shared look, no shared name** — two or three wrestlers who simply
  dress in coordinating colors without forming an official stable; reads
  as "these guys are friends" without any of the mechanical faction
  overhead.
- **"The Quiet Type"** — an anti-gimmick: deliberately no promos, no
  catchphrases, lets the matches do 100% of the talking. Its own kind of
  character precisely by refusing one.

## Travel and exploration

- **The Cartographer** — either. Claims to have "mapped every weakness"
  before the bell rings.
  - "I already know every route through your defense."
  - "You're standing on territory I charted years ago."
- **The Stowaway** — heel/tween. Snuck into the business with no
  credentials and no permission, resents everyone who came up the "proper"
  way.
  - "Nobody let me in. I let myself in."
  - "You paid dues. I skipped the line. We're even now."
- **Diplomatic Immunity** — heel. Acts like the rules simply don't apply to
  him, backed by an "embassy" of legal-sounding nonsense.
  - "You can file a complaint. It won't matter."
  - "I answer to nobody in this building."
- **The Expedition** — face. Explorer-adventurer gimmick, treats every
  match like uncharted territory to conquer.
  - "I've survived places that would kill you just visiting."
  - "Every summit gets climbed eventually. This one's no different."
- **Border Crossing** — either. A drifter gimmick, never stays in one
  territory long, "passing through" energy that unsettles hometown crowds.
  - "I'm not from here. I won't be here long either. But tonight's mine."
  - "Every town looks the same after you win in enough of them."
- **The Import** — heel/tween. Plays up being "brought in special," acts
  like the local scene is beneath him.
  - "They flew me in because nobody here could get it done."
  - "You're the local flavor. I'm the main course."
- **Jet Lag** — face/tween. Constantly "just landed," exhausted-but-tough
  gimmick, wins anyway despite claiming to barely be conscious.
  - "I haven't slept in two days. Doesn't matter."
  - "You get me tired. You still don't get me beat."
- **The Passport** — either. Collects "stamps" from every territory he's
  wrestled in, treats his record like a travel log.
  - "Another stamp. Another win."
  - "I've done this in six territories. Doing it here changes nothing."

## Weather and disaster

- **Wildfire** — heel. Spreads-fast, burns-everything energy, "you can't
  contain me" as the hook.
  - "You can't put this out. Nobody's managed it yet."
  - "By the time you notice, it's already spread past you."
- **Avalanche** — heel. Slow build, sudden overwhelming force, "the warning
  comes too late" mystique.
  - "It starts quiet. It always starts quiet."
  - "There's no outrunning this once it's moving."
- **The Forecast** — heel/tween. Claims to predict exactly how every match
  goes, meteorologist theatrics.
  - "Ninety percent chance of a beating tonight."
  - "I called this a week ago. I'm rarely wrong."
- **Storm Chaser** — face. Genuinely drawn to danger, thrill-seeker energy,
  runs toward the fight instead of away from it.
  - "I drive into the storm. Everybody else drives away."
  - "This is the safest I've felt all week."
- **Category Five** — heel. Raw destructive-force powerhouse gimmick,
  named-storm entrance theatrics.
  - "They only name the ones that do real damage."
  - "I'm not a warning. I'm already here."
- **Whiteout** — either. Cold, disorienting, "you won't see it coming"
  menace.
  - "Visibility's zero. That's exactly how I like it."
  - "You won't see the last one coming either."
- **Aftershock** — heel/tween. Insists the "first hit" is never the real
  damage, built around a delayed, secondary offense.
  - "Everybody braces for the first one. Nobody braces for me."
  - "The real damage always comes after."

## Music, beyond the one rock-star slot

- **The Conductor** — either. Orchestral, precise, treats the match like a
  composition he's directing note by note. *Prop: a baton.*
  - "Every great piece needs a finale. I write those."
  - "You're off-tempo. I'll fix that."
- **Feedback** — heel. Punk-scene gimmick, loud, chaotic, genuinely
  unpredictable pacing in-ring.
  - "This isn't supposed to sound clean. Neither is tonight."
  - "Three chords and the truth. The truth is you're losing."
- **The Aria** — either. Opera-trained showman, treats every entrance like
  a curtain-raiser, dramatic to the point of parody that turns real.
  - "Every opera needs a tragedy. Yours starts now."
  - "Save your applause. I haven't even started."
- **Honky Tonk Heartbreak** — face/tween. Country-bar gimmick, heartbroken
  ballads played for crowd sympathy that curdles into real anger.
  - "I've been left before. I don't get left twice."
  - "This one's for every bar that ever threw me out."
- **Mic Drop** — face/tween. Rapper gimmick, freestyles actual promo lines,
  crowd-interactive energy.
  - "I don't need sixteen bars. I need about sixteen seconds."
  - "Come up with something better before I'm already done."
- **The B-Side** — heel/tween. A one-hit-wonder gimmick, bitter about being
  remembered for one thing, desperate to prove there's more.
  - "Everybody remembers the hit. Nobody remembers what came after. I'm
    about to fix that."
  - "I've got more than one song in me. Tonight's the proof."

## More everyday jobs

- **The Mailman** — face. Rain-or-shine reliability gimmick, "always
  delivers" as the hook.
  - "I've never missed a route. Not starting tonight."
  - "Something's coming for you. I'm just the delivery."
- **Flight Risk** — heel/tween. Flight-attendant gimmick, calm safety-briefing
  delivery over genuinely threatening promises.
  - "Please remain seated. This is about to get turbulent."
  - "In the event of an emergency, I am the emergency."
- **Night Watch** — face. Security-guard gimmick, quiet, watchful,
  genuinely protective of the locker room in-fiction.
  - "I've been watching this whole card. I don't like what I see from you."
  - "Nothing happens on my watch that I don't allow."
- **The Barber** — heel/tween. Old-school barbershop theming, "close shave"
  as a finisher name, straight-razor mystique (never a literal blade).
  - "Sit still. This won't take long."
  - "Everybody leaves my chair looking different. You will too."
- **Curb Service** — face/tween. Valet gimmick, fast, cocky, "I'll have you
  out of here in under a minute" energy.
  - "I already brought the car around. You're leaving early."
  - "Tip's optional. The beating isn't."
- **Second Shift** — face. Overnight-worker gimmick, "nobody sees how hard
  I work because nobody's watching at 3 a.m." underdog energy.
  - "I've been grinding while you were asleep."
  - "This is just another shift to me."
- **The Auditor** — heel. Meticulous, finds every flaw, treats opponents
  like a failed inspection.
  - "I found every weakness. It's a long list."
  - "This doesn't pass. Nothing about your night does."
- **Whistle Blower** — heel/tween. An ex-official gimmick, insists he
  finally gets to make the calls instead of just enforcing them.
  - "I've watched better men than you get counted out. Now I get to do the
    counting on my terms."
  - "No more three-count. I finish things myself now."

## Sci-fi and speculative

- **Liftoff** — face. Astronaut theming, "nothing rattles someone who's
  left the atmosphere" calm-under-pressure gimmick.
  - "I've been higher up than this ring will ever get you."
  - "Zero gravity doesn't scare me. You definitely don't."
- **The Anomaly** — either. Time-displaced theming, cryptic about "where"
  or "when" he's actually from, disorienting promo style.
  - "I've already seen how this goes. Several times."
  - "You haven't happened yet, as far as I'm concerned."
- **Abduction** — heel/tween. Conspiracy-adjacent, claims something
  "up there" is watching, distinct enough from the existing Conspiracy
  Theorist to avoid overlap — this one leans genuinely eerie, not comedic.
  - "They took three hours out of my life once. I got something back for
    it."
  - "You wouldn't believe what I've seen. You're about to feel it."
- **Chrome** — heel. Cyborg/augmented theming, cold, mechanical delivery,
  "upgraded past pain" mystique.
  - "Pain is a signal. Mine's been rerouted."
  - "You're fighting the old model. I'm not that anymore."
- **The Simulation** — heel/tween. Insists nothing that happens "really
  matters," detached nihilist energy played for both comedy and real
  menace.
  - "None of this is real. That should worry you more, not less."
  - "If nothing matters, there's nothing stopping me."
- **Deep Space** — either. Isolation-themed, long-silence-then-violence
  pacing, minimal promo work.
  - (Rarely speaks. When he does:) "It's quiet out there. I like it quiet."
- **Sector Seven** — heel. Shadowy-agency theming, refuses to explain who
  he "really" works for, paranoia-inducing mystique.
  - "You don't need clearance to know this is happening."
  - "I'm not here officially. That should worry you more."

## More combat sports

- **Dohyo** — either. Sumo-adjacent power gimmick, ritual entrance,
  immovable-object in-ring style.
  - "You can't push what won't move."
  - "The bigger they come to try me, the harder they land."
- **Low Kick** — heel/tween. Kickboxing gimmick, leg-attack specialist,
  clinical about breaking opponents down piece by piece.
  - "I don't need one big shot. I need forty small ones."
  - "By round three you won't be standing on your own legs."
- **The Armbar** — either. Pure-grappler gimmick, no strikes, all
  submission, quietly terrifying to opponents who know the style.
  - "I don't need to hit you. I just need one arm."
  - "Tap early. It only gets worse."
- **The Atlas Stone** — heel. Strongman-competition gimmick, raw lifting
  power, treats opponents like the next event in a competition.
  - "I've hoisted heavier things than you for fun."
  - "This is just the log-press portion of my night."
- **Table Stakes** — face/tween. Arm-wrestling-hustler gimmick, bar-bet
  energy, "I'll wrestle you for it" swagger.
  - "Everything's a bet with me. Tonight you're the stakes."
  - "I've never once lost at this. Don't start believing you're the
    exception."
- **The Cage** — heel. MMA-crossover gimmick, disdainful of "worked"
  wrestling, insists on "real" fighting, genuine tension with the roster
  in-fiction.
  - "This isn't a real fight. Let me show you what one looks like."
  - "No ropes to hide behind where I come from."

## More rural and agricultural

- **The Beekeeper** — face/tween. Calm-until-provoked gimmick, "you don't
  want to see the whole hive angry" mystique.
  - "One sting doesn't seem like much. Wait for all of them."
  - "I keep my temper. Until I don't."
- **The Barrelman** — face. Rodeo-clown-turned-wrestler gimmick, comedic
  showman who's secretly the toughest guy on the card — the actual job is
  stepping in front of something dangerous on purpose.
  - "My whole job used to be getting hit so somebody else didn't have to.
    Tonight I'm doing it for me."
  - "Laugh all you want. I've taken worse than this for free."
- **Derby Night** — heel. Demolition-derby gimmick, "last car running"
  attitude, embraces chaos and collateral damage.
  - "I don't drive around the wreck. I drive through it."
  - "Last one moving wins. Simple as that."
- **The Trapper** — heel. Patient, methodical, "the trap's already set
  before you know it" mystique.
  - "You walked right into this. You just don't know it yet."
  - "I don't chase. I wait."
- **Sodbuster** — face. A farmer's-son gimmick distinct from Dust Bowl
  above — leans earnest and hopeful rather than bitter, "built this from
  nothing, proud of it" energy.
  - "Everything I have, I grew myself."
  - "You don't scare a man who's already survived a bad harvest."
- **The Auctioneer** — heel/tween. Fast-talking livestock-auction gimmick,
  rapid-fire promo delivery, "going once, going twice" as a finish
  callout.
  - "Going once — going twice — gone."
  - "Everything's for sale tonight, including your winning streak."

## More corporate and pop culture

- **The Founder** — heel. Startup-CEO gimmick, buzzword-heavy promos,
  genuinely delusional confidence.
  - "I disrupted three industries before breakfast. You're next."
  - "This isn't a match. It's a pivot."
- **The Wheel** — heel/tween. Game-show-host gimmick, treats every match
  like a segment, oddly cheerful menace.
  - "Let's see what's behind door number two — oh, it's a beating."
  - "Big money, big prizes, bigger beating tonight."
- **Center Stage** — heel. Pageant-circuit gimmick, obsessed with
  presentation and optics, genuinely rattled by anything that messes up
  his look.
  - "I didn't come this far to get this hair messed up. Try me anyway."
  - "Presentation matters. Yours is about to get much worse."
- **The Franchise** — heel/tween. Insists he's bigger than any single
  promotion, "I could be wrestling anywhere" arrogance.
  - "This company's lucky to have me. Try not to waste it."
  - "I'm a brand. You're a house show."
- **Prime Rate** — heel. Banker gimmick, treats every match like a loan
  coming due with interest.
  - "Everything gets collected eventually, with interest."
  - "You're overdrawn. Tonight's the correction."
- **The Broker** — either. Deal-making gimmick, always negotiating even
  mid-match, unsettling calm about violence as "just business."
  - "Everything's negotiable. Except tonight's outcome."
  - "I don't take this personally. It's just the deal."

## A few more, filling out the thinner categories above

- **The Line Cook** — face/tween. (Food and hospitality.) Fast, blue-collar
  kitchen energy distinct from the Chef's showman angle — this one's about
  grinding through a packed rush, not performing.
  - "I've survived a dinner rush worse than this."
- **Happy Hour** — heel/tween. (Food and hospitality.) A regular-turned-wrestler
  gimmick, over-familiar, wears out his welcome on purpose.
  - "One more round. On the house — my house."
- **The Anesthesiologist** — heel. (Medical.) Unsettlingly calm, "you won't
  feel a thing" energy that's clearly a lie.
  - "Count backward from ten. You won't make it to five."
- **Bedside Manner** — face. (Medical.) Genuinely warm, reassuring gimmick
  that turns out to be a legitimately dangerous in-ring worker.
  - "I'll take good care of you. Right up until I don't have to."
- **The Hall Monitor** — heel/tween. (School.) Petty-authority gimmick,
  writes up opponents for imaginary violations.
  - "That's a write-up. Several, actually."
- **Detention** — heel. (School.) A kept-back-a-grade gimmick, older and
  meaner than everyone in his "class," genuine chip on his shoulder.
  - "I've been held back so many times I might as well own the building."
- **The Beta Test** — heel/tween. (Tech.) Insists opponents are just an
  early, broken version of what's coming — condescending tech-bro energy.
  - "You're the version before the good one. That's still me."
- **Patch Notes** — face/tween. (Tech.) A gamer gimmick distinct from
  Respawn above — obsessed with "fixing bugs," treats losses as issues to
  patch out permanently.
  - "Every weakness gets patched eventually. Watch me fix mine live."

---

## Notes for whoever wires this in later

- **Tally:** 209 named entries above, 3 explicitly cut for IP-proximity
  reasons (flagged inline, not silently dropped) — 206 usable. Roughly 165
  solo gimmicks across 24 categories, 22 tag-team concepts, 15
  faction/stable concepts, 8 "no full gimmick needed" minor-tweak options.
- Three entries above were drafted and then explicitly **cut** rather than
  quietly dropped, each flagged inline where it happened — all three read
  too close to real, famous wrestling IP to be safely original. Worth
  scanning the final list once more before anything ships, since a few
  more may be borderline (the Ringmaster, the Undertaker-adjacent
  mystical-death cluster generally) even where they weren't flagged here.
- Overlap warnings were left inline in a couple of spots (Chef vs. Butcher's
  Son, the two "Closing Time"/bartender concepts, Rock Star vs. the
  existing catalog's Rockstar) — pick one from each pair for an actual
  roster rather than running both.
- Nothing here is mechanically wired yet — no `popularityCeiling`,
  `growthRateMultiplier`, `merchMultiplier`, or `look` values assigned,
  since those depend on decisions we haven't locked (how heat/freshness
  will actually work once it's reaction-driven, whether tag/faction
  gimmicks need their own type shape distinct from solo `Gimmick`). This
  is characteristics and promo lines only, as asked.
