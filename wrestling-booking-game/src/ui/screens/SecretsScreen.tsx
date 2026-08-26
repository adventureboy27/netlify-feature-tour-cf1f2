// The deals nobody knows about.
//
// Nobody on this screen works for two companies — that is a contract
// violation and it would be over in a week. What is on this screen is timing.
// You find somebody whose deal is nearly up, shake hands on nothing anybody
// could point at, and be the one holding a pen the hour it lapses. Rick Rude
// worked a Sunday for one company on the last day of his contract and was on
// the opposition's show the following night. Nobody had time to catch on.
//
// So the page has two clocks and both are shown plainly. Before his deal runs
// out, the risk is that his own office hears and re-signs him. After it runs
// out he is yours, on your payroll, and the risk is the far worse one: every
// week he sits at home is a week somebody notices he stopped appearing, and
// the moment you were saving bleeds away. Neither clock is advice. The game
// will happily let you sit on a signed contract until it is worth nothing.

import { useState } from 'react';
import { useGameStore } from '../../state/store';
import {
  canSignSecretly,
  canWalkOut,
  exposureChance,
  retentionChance,
  revealImpact,
  secretSigningAppeal,
  secretWeeklyCost,
  stillSecret,
  weeksUntilFree,
} from '../../engine/world/secretSigning';
import { billedAs } from '../../engine/generate/nickname';
import { Panel, SectionHead, promotionTheme } from '../components/chrome';
import { Money } from '../components/display';
import { PaperDoll } from '../paperdoll/PaperDoll';
import type { Wrestler } from '../../engine/types';

/** How likely their own office is to get wind, in words. §0: never a percentage. */
function retentionWord(chance: number): string {
  if (chance >= 0.24) return 'Their office is all over them';
  if (chance >= 0.15) return 'Somebody there will hear about this';
  if (chance >= 0.08) return 'They are not paying attention yet';
  return 'Nobody there suspects a thing';
}

/** How likely the sheets are to place them, in words. */
function exposureWord(chance: number): string {
  if (chance >= 0.5) return 'Somebody is going to print this any day';
  if (chance >= 0.3) return 'People have noticed they stopped appearing';
  if (chance >= 0.15) return 'A couple of people are asking questions';
  return 'Nobody has joined it up yet';
}

function appealWord(appeal: number): string {
  if (appeal >= 0.55) return 'Would shake on it today';
  if (appeal >= 0.38) return 'Would listen';
  if (appeal >= 0.22) return 'Might listen';
  return 'Happy where they are';
}

function weeksWord(weeks: number): string {
  if (weeks <= 0) return 'That deal is up';
  if (weeks === 1) return 'Free next week';
  return `Free in ${weeks} weeks`;
}

export function SecretsScreen() {
  const world = useGameStore((s) => s.world);
  const signSecretly = useGameStore((s) => s.signSecretly);
  const reveal = useGameStore((s) => s.revealSecretSigning);
  const tearUp = useGameStore((s) => s.tearUpSecretSigning);
  const [note, setNote] = useState<string | null>(null);
  const [showTargets, setShowTargets] = useState(false);
  if (!world) return null;

  const theme = promotionTheme(world.promotion.identity);
  const held = world.secretSignings;
  const heldIds = new Set(held.map((s) => s.wrestlerId));

  const targets = Object.values(world.wrestlers)
    .filter(
      (w): w is Wrestler =>
        Boolean(w) && canSignSecretly(w, world.promotion.id, world.settings) && !heldIds.has(w.id),
    )
    .sort((a, b) => weeksUntilFree(a) - weeksUntilFree(b))
    .slice(0, 24);

  // Only the ones whose deal has actually started are costing anything. A
  // handshake is free, because a handshake is nothing.
  const weekly = held
    .filter((s) => s.signedWeek !== null)
    .reduce((sum, s) => sum + s.weeklyRate, 0);

  return (
    <div className="p-3 pb-6 text-neutral-100">
      <h1 className="text-lg font-bold">The quiet business</h1>
      <p className="mb-3 text-[11px] leading-snug text-neutral-500">
        Nobody works for two companies at once, not really. What you can do is find somebody whose deal is nearly
        up, agree to something neither of you ever writes down, and have them signed the very hour it lapses —
        then walk them right out the door before anybody even figures out where they went.
      </p>

      {note && <p className="mb-3 rounded-lg border border-amber-900 bg-amber-950/30 p-2 text-xs text-amber-200">{note}</p>}

      {held.length > 0 && (
        <section>
          <SectionHead hint={weekly > 0 ? <Money amount={-weekly} /> : <span>nothing owed yet</span>}>
            The ones nobody knows about
          </SectionHead>
          <div className="flex flex-col gap-2">
            {held.map((signing) => {
              const person = world.wrestlers[signing.wrestlerId];
              if (!person) return null;
              const secret = stillSecret(signing);
              const walkable = canWalkOut(signing);
              const untilFree = Math.max(0, signing.freeWeek - world.week);
              const sinceFree = Math.max(0, world.week - signing.freeWeek);
              const impact = revealImpact(signing, person, world.week, world.settings);
              const holder = world.rivals.find((r) => r.id === signing.fromPromotionId);
              const risk = walkable
                ? exposureWord(exposureChance(signing, world.week, world.settings))
                : retentionWord(retentionChance(person, holder?.rating ?? 0, world.settings));

              return (
                <Panel
                  key={signing.wrestlerId}
                  data-testid={`secret-${signing.wrestlerId}`}
                  className={`p-2.5 ${secret ? (walkable ? 'border-emerald-900' : '') : 'border-rose-900'}`}
                >
                  <div className="flex items-start gap-2">
                    <PaperDoll photoDataUrl={person.photoDataUrl} name={person.name} size="thumb" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{billedAs(person)}</div>
                      <div className="text-[11px] text-neutral-500">
                        {walkable
                          ? `Signed here. The world still has them down at ${signing.fromPromotionName}.`
                          : `Still working ${signing.fromPromotionName} dates. Nothing is signed.`}
                      </div>
                      <div className="mt-0.5 text-[11px] text-neutral-400">
                        {walkable ? (
                          <>
                            {sinceFree === 0
                              ? 'Free this week'
                              : `Free ${sinceFree} ${sinceFree === 1 ? 'week' : 'weeks'} ago`}
                            <span className="mx-1 text-neutral-700">·</span>
                            <Money amount={-signing.weeklyRate} /> a week
                          </>
                        ) : (
                          <>
                            {untilFree === 1 ? 'Free next week' : `Free in ${untilFree} weeks`}
                            <span className="mx-1 text-neutral-700">·</span>
                            <Money amount={-signing.weeklyRate} /> a week when it starts
                          </>
                        )}
                      </div>
                      <div className={`text-[11px] ${secret ? 'text-neutral-500' : 'text-rose-400'}`}>
                        {secret ? risk : 'The sheets have placed them. Whatever this was, it is not a surprise.'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex gap-2">
                    {walkable ? (
                      <button
                        type="button"
                        data-testid={`reveal-${signing.wrestlerId}`}
                        onClick={() => {
                          reveal(signing.wrestlerId);
                          setNote(`${person.name} walked out on your show.`);
                        }}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-white ${theme.action}`}
                      >
                        Walk them out {impact >= 2.5 ? 'tonight' : 'anyway'}
                      </button>
                    ) : (
                      <span className="flex-1 rounded-lg border border-neutral-800 px-3 py-2 text-center text-xs text-neutral-500">
                        Still under contract to them
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        tearUp(signing.wrestlerId);
                        setNote(
                          walkable
                            ? `${person.name} released, clean and simple. A free agent now, and nobody out there is ever the wiser.`
                            : `Whatever you had agreed with ${person.name} is completely off the table.`,
                        );
                      }}
                      className="rounded-lg border border-neutral-800 px-3 py-2 text-xs text-neutral-400 hover:border-rose-800 hover:text-rose-400"
                    >
                      Tear it up
                    </button>
                  </div>
                </Panel>
              );
            })}
          </div>
        </section>
      )}

      <SectionHead
        hint={
          <button type="button" onClick={() => setShowTargets((v) => !v)} className="underline">
            {showTargets ? 'hide' : 'show'}
          </button>
        }
      >
        Whose deal is running out
      </SectionHead>

      {showTargets ? (
        <div className="flex flex-col gap-1.5">
          {targets.map((person) => {
            const cost = secretWeeklyCost(person, world.settings);
            const company =
              world.rivals.find((r) => r.id === person.promotionId)?.name ?? 'another company';
            return (
              <Panel key={person.id} className="flex items-center gap-2 p-2">
                <PaperDoll photoDataUrl={person.photoDataUrl} name={person.name} size="thumb" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">{billedAs(person)}</div>
                  <div className="truncate text-[11px] text-neutral-500">{company}</div>
                  {/* The clock goes on its own line and is never truncated —
                      it is the whole decision. */}
                  <div className="text-[11px] text-neutral-300">
                    {weeksWord(weeksUntilFree(person))}
                    <span className="mx-1 text-neutral-700">·</span>
                    <Money amount={-cost} /> a week
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {appealWord(secretSigningAppeal(person, world.settings))}
                  </div>
                </div>
                <button
                  type="button"
                  data-testid={`approach-${person.id}`}
                  onClick={() => {
                    const result = signSecretly(person.id);
                    setNote(
                      result.ok
                        ? `${person.name} shook on it, right there. Not one word gets written down and not one dollar is owed until that deal finally runs out.`
                        : result.reason,
                    );
                  }}
                  className="shrink-0 rounded-lg border border-neutral-700 px-2.5 py-2 text-[11px] text-neutral-200 hover:border-emerald-700"
                >
                  Approach
                </button>
              </Panel>
            );
          })}
          {targets.length === 0 && (
            <p className="text-xs text-neutral-500">
              Not one person in this business is close enough to the end of a deal to talk to right now. Come back
              in a few weeks.
            </p>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-neutral-600">
          Somebody with a full year left to run has nothing to discuss. Approach one who does and get turned down,
          and they absolutely know you asked — and eventually, so does their entire office.
        </p>
      )}
    </div>
  );
}
