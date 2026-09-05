// The conversation screen — reactive, personnel-and-managerial decisions
// play out here instead of as a flat card of buttons.
//
// A wrestler gets a real portrait and speaks in first person. The booker
// (the player) never gets a generated face — a themed monogram stands in,
// deliberately small, because the player isn't a talking head here, they're
// the one answering. A narrator speaker (weather, structural disasters —
// nobody with a face is doing the asking) gets neither, just a label.
//
// Full-screen, not an inline card: this replaces the screen behind it for as
// long as the conversation runs, the same way the source material it is
// modelled on does. Reuses the one modal idiom already in the codebase
// (TitleBuilder's scrim), darkened further since this isn't a small popover.

import { PaperDoll } from '../paperdoll/PaperDoll';
import type { Wrestler } from '../../engine/types';
import type { DialogueSpeaker, DialogueChoiceView } from '../../engine/dialogue/types';
import type { PromotionTheme } from '../components/chrome';

export type { DialogueSpeaker, DialogueChoiceView };

export interface DialogueCardProps {
  speaker: DialogueSpeaker;
  /** Resolved wrestler record, when speaker.kind === 'wrestler'. */
  wrestler?: Wrestler;
  /** Name shown above the body — the wrestler's, or a label like "Severe weather" for narrator. */
  speakerName: string;
  body: string;
  /** A second, quieter line under the body — a forecast confidence note, an aside. */
  subtext?: string;
  choices: DialogueChoiceView[];
  onChoose: (choiceId: string) => void;
  /** Every prior beat of this conversation, oldest first. Omit or empty on the opening node. */
  history?: { body: string; choiceLabel: string }[];
  theme: PromotionTheme;
  promotionName: string;
  /** Omit where the decision can't be walked away from unanswered (weather calls). */
  onClose?: () => void;
  /**
   * Rendered between the body and the choices — for a choice that needs a
   * sub-step before it can be taken (the champion call's interim-champion
   * picker). Most callers don't need this.
   */
  beforeChoices?: React.ReactNode;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}

export function DialogueCard({
  speaker,
  wrestler,
  speakerName,
  body,
  subtext,
  choices,
  onChoose,
  history = [],
  theme,
  promotionName,
  onClose,
  beforeChoices,
}: DialogueCardProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-black/80"
      onClick={onClose}
      data-testid="dialogue-card"
    >
      <div
        className="mx-auto flex w-full max-w-md flex-1 flex-col p-4 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mb-2 ml-auto rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
          >
            Close
          </button>
        )}

        {history.length > 0 && (
          <div className="mb-4 flex flex-col gap-1.5 border-b border-neutral-800 pb-4">
            {history.map((turn, i) => (
              <div key={i} className="text-[11px] leading-snug text-neutral-600">
                <span className="text-neutral-500">{turn.body}</span>
                <span className="ml-1.5 text-neutral-400">— You said: "{turn.choiceLabel}"</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col items-center gap-2 py-2 text-center">
          {speaker.kind === 'wrestler' && wrestler && (
            <>
              <PaperDoll photoDataUrl={wrestler.photoDataUrl} name={wrestler.name} size="large" />
              <div className="text-sm font-semibold text-neutral-100">{speakerName}</div>
            </>
          )}
          {speaker.kind === 'narrator' && (
            <div className={`text-xs font-semibold uppercase tracking-widest ${theme.ink}`}>{speakerName}</div>
          )}
        </div>

        <div
          className={`relative mt-2 rounded-xl border border-neutral-800 bg-gradient-to-b ${theme.wash} to-neutral-900 p-4`}
        >
          <p className="text-sm leading-relaxed text-neutral-100">
            {speaker.kind === 'wrestler' ? `"${body}"` : body}
          </p>
          {subtext && <p className="mt-2 text-xs italic leading-snug text-neutral-400">{subtext}</p>}
        </div>

        {speaker.kind !== 'narrator' && (
          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-neutral-500">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${theme.action} text-[11px] font-bold text-white`}
              aria-hidden
            >
              {initials(promotionName)}
            </span>
            <span>{promotionName} — your answer</span>
          </div>
        )}

        {beforeChoices && <div className="mt-4">{beforeChoices}</div>}

        <div className="mt-4 flex flex-col gap-2">
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              data-testid={`dialogue-choice-${choice.id}`}
              disabled={choice.disabled}
              onClick={() => onChoose(choice.id)}
              className={`rounded-lg border p-3 text-left text-sm transition ${
                choice.disabled
                  ? 'cursor-not-allowed border-neutral-800 bg-neutral-900/50 text-neutral-600'
                  : 'border-neutral-700 bg-neutral-900 text-neutral-100 hover:border-neutral-500'
              }`}
            >
              <div className="font-medium">{choice.label}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px]">
                <span className="text-emerald-400">↑ {choice.gains}</span>
                <span className="text-rose-400">↓ {choice.costs}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
