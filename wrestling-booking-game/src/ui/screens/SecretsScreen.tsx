// The contracts nobody knows about.
//
// Everybody on this screen is still on somebody else's roster, still working
// somebody else's shows, and still listed there by every sheet in the
// business. The only person who knows otherwise is the booker looking at this
// page — which is the entire reason it is a separate screen and not a row on
// the roster.
//
// Two numbers matter and both are shown plainly: what it costs a week to keep
// somebody who is working for a competitor, and how long you have been
// sitting on it. Neither is advice. The game will happily let you hold a
// secret for two years until it is worth nothing and you have paid a fortune
// for the privilege.

import { useState } from 'react';
import { useGameStore } from '../../state/store';
import {
  canSignSecretly,
  leakChance,
  revealImpact,
  secretSigningAppeal,
  secretWeeklyCost,
  stillSecret,
} from '../../engine/world/secretSigning';
import { billedAs } from '../../engine/generate/nickname';
import { Panel, SectionHead, promotionTheme } from '../components/chrome';
import { Money } from '../components/display';
import { PaperDoll } from '../paperdoll/PaperDoll';
import type { Wrestler } from '../../engine/types';

/** How likely something is, in words. §0: never a percentage. */
function oddsWord(chance: number): string {
  if (chance >= 0.3) return 'It is going to get out';
  if (chance >= 0.18) return 'This is leaking soon';
  if (chance >= 0.09) return 'People are starting to talk';
  return 'Nobody knows';
}

function appealWord(appeal: number): string {
  if (appeal >= 0.55) return 'Would jump at it';
  if (appeal >= 0.38) return 'Would listen';
  if (appeal >= 0.22) return 'Might listen';
  return 'Happy where they are';
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
    .filter((w): w is Wrestler => Boolean(w) && canSignSecretly(w, world.promotion.id) && !heldIds.has(w.id))
    .sort((a, b) => secretSigningAppeal(b, world.settings) - secretSigningAppeal(a, world.settings))
    .slice(0, 24);

  const weekly = held.reduce((sum, s) => sum + s.weeklyRate, 0);

  return (
    <div className="p-3 pb-24 text-neutral-100">
      <h1 className="text-lg font-bold">The quiet business</h1>
      <p className="mb-3 text-[11px] leading-snug text-neutral-500">
        Sign somebody who works for a competitor. They stay on their roster, keep working their shows, and
        every sheet in the business still has them listed there — until the week you walk them out.
      </p>

      {note && <p className="mb-3 rounded-lg border border-amber-900 bg-amber-950/30 p-2 text-xs text-amber-200">{note}</p>}

      {held.length > 0 && (
        <section>
          <SectionHead hint={<Money amount={-weekly} />}>Under contract, quietly</SectionHead>
          <div className="flex flex-col gap-2">
            {held.map((signing) => {
              const person = world.wrestlers[signing.wrestlerId];
              if (!person) return null;
              const weeks = Math.max(0, world.week - signing.signedWeek);
              const risk = leakChance(signing, person, world.week, world.settings);
              const impact = revealImpact(signing, person, world.week, world.settings);
              const secret = stillSecret(signing);

              return (
                <Panel
                  key={signing.wrestlerId}
                  data-testid={`secret-${signing.wrestlerId}`}
                  className={`p-2.5 ${secret ? '' : 'border-rose-900'}`}
                >
                  <div className="flex items-start gap-2">
                    <PaperDoll
                      appearance={person.appearance}
                      gender={person.gender}
                      alignment={person.alignment}
                      size="thumb"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{billedAs(person)}</div>
                      <div className="text-[11px] text-neutral-500">
                        The world thinks he works for {signing.fromPromotionName}
                      </div>
                      <div className="mt-0.5 text-[11px] text-neutral-400">
                        {weeks === 0 ? 'Signed this week' : `Held ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`}
                        <span className="mx-1 text-neutral-700">·</span>
                        <Money amount={-signing.weeklyRate} /> a week
                      </div>
                      <div className={`text-[11px] ${secret ? 'text-neutral-500' : 'text-rose-400'}`}>
                        {secret ? oddsWord(risk) : 'The sheets have it. Whatever this was, it is not a surprise.'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      data-testid={`reveal-${signing.wrestlerId}`}
                      onClick={() => {
                        reveal(signing.wrestlerId);
                        setNote(`${person.name} walked out on your show.`);
                      }}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-white ${theme.action}`}
                    >
                      Walk him out {impact >= 2.5 ? 'tonight' : 'anyway'}
                    </button>
                    <button
                      type="button"
                      onClick={() => tearUp(signing.wrestlerId)}
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
        Who you could approach
      </SectionHead>

      {showTargets ? (
        <div className="flex flex-col gap-1.5">
          {targets.map((person) => {
            const cost = secretWeeklyCost(person, world.settings);
            const company =
              world.rivals.find((r) => r.id === person.promotionId)?.name ?? 'another company';
            return (
              <Panel key={person.id} className="flex items-center gap-2 p-2">
                <PaperDoll
                  appearance={person.appearance}
                  gender={person.gender}
                  alignment={person.alignment}
                  size="thumb"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">{billedAs(person)}</div>
                  <div className="truncate text-[11px] text-neutral-500">{company}</div>
                  <div className="text-[11px] text-neutral-400">
                    {appealWord(secretSigningAppeal(person, world.settings))}
                    <span className="mx-1 text-neutral-700">·</span>
                    <Money amount={-cost} /> a week
                  </div>
                </div>
                <button
                  type="button"
                  data-testid={`approach-${person.id}`}
                  onClick={() => {
                    const result = signSecretly(person.id);
                    setNote(result.ok ? `${person.name} signed. Nobody knows.` : result.reason);
                  }}
                  className="shrink-0 rounded-lg border border-neutral-700 px-2.5 py-2 text-[11px] text-neutral-200 hover:border-emerald-700"
                >
                  Approach
                </button>
              </Panel>
            );
          })}
          {targets.length === 0 && (
            <p className="text-xs text-neutral-500">Nobody worth approaching. Everybody is either yours or nobody&apos;s.</p>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-neutral-600">
          Approaching somebody who says no means they know you asked, and so, eventually, does everybody else.
        </p>
      )}
    </div>
  );
}
