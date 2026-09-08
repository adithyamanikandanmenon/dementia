import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/i18n';
import { useVoice } from '@/hooks/useVoice';
import { useSettings } from '@/hooks/useSettings';
import { pairsConfig } from '@/services/gameService';
import { OBJECT_POOL, objectLabel } from '@/data/games';
import { shuffle, uid, type GameOutcome } from '@/utils/helpers';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Button';

interface Card {
  id: string;
  objIndex: number;
  emoji: string;
  matched: boolean;
  open: boolean;
  justMatched: boolean;
}

interface Props {
  level: number;
  onComplete: (o: GameOutcome) => void;
}

export function PicturePairs({ level, onComplete }: Props) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const { say, enabled } = useVoice();
  const cfg = useMemo(() => pairsConfig(level), [level]);

  const [cards, setCards] = useState<Card[]>(() => buildDeck(cfg.pairs));
  const [phase, setPhase] = useState<'preview' | 'play' | 'done'>('preview');
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [taps, setTaps] = useState(0);
  const [comparisons, setComparisons] = useState(0);
  const [paused, setPaused] = useState(false);
  const [announce, setAnnounce] = useState('');
  const startRef = useRef(Date.now());
  const lockRef = useRef(false);

  const matchedPairs = cards.filter((c) => c.matched).length / 2;

  // Preview: reveal all briefly, then flip down and begin play.
  useEffect(() => {
    setCards((cs) => cs.map((c) => ({ ...c, open: true })));
    const id = window.setTimeout(() => {
      setCards((cs) => cs.map((c) => ({ ...c, open: false })));
      setPhase('play');
      if (enabled) say(t('pairs.instruction'));
    }, cfg.previewMs);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(
    (comps: number) => {
      const score = Math.max(
        0,
        Math.min(100, Math.round((cfg.pairs / Math.max(comps, cfg.pairs)) * 100)),
      );
      const durationSec = Math.round((Date.now() - startRef.current) / 1000);
      setPhase('done');
      setAnnounce(t('pairs.title') + ' — ' + t('result.greatJob'));
      window.setTimeout(
        () =>
          onComplete({
            score,
            accuracy: score,
            attempts: comps,
            durationSec,
          }),
        900,
      );
    },
    [cfg.pairs, onComplete, t],
  );

  const handleTap = (card: Card) => {
    if (phase !== 'play' || paused || lockRef.current) return;
    if (card.matched || card.open) return;

    setTaps((n) => n + 1);
    const nextOpen = [...openIds, card.id];
    setCards((cs) =>
      cs.map((c) => (c.id === card.id ? { ...c, open: true } : c)),
    );
    setOpenIds(nextOpen);

    if (nextOpen.length === 2) {
      lockRef.current = true;
      const [a, b] = nextOpen.map((id) => cards.find((c) => c.id === id)!);
      const isMatch = a.objIndex === b.objIndex;
      const comps = comparisons + 1;
      setComparisons(comps);

      if (isMatch) {
        window.setTimeout(() => {
          setCards((cs) =>
            cs.map((c) =>
              nextOpen.includes(c.id)
                ? { ...c, matched: true, justMatched: true }
                : c,
            ),
          );
          setOpenIds([]);
          lockRef.current = false;
          setAnnounce(t('pairs.matched'));
          const done = cards.filter((c) => c.matched).length / 2 + 1;
          window.setTimeout(
            () =>
              setCards((cs) => cs.map((c) => ({ ...c, justMatched: false }))),
            400,
          );
          if (done >= cfg.pairs) finish(comps);
        }, 420);
      } else {
        window.setTimeout(() => {
          setCards((cs) =>
            cs.map((c) =>
              nextOpen.includes(c.id) ? { ...c, open: false } : c,
            ),
          );
          setOpenIds([]);
          lockRef.current = false;
        }, 900);
      }
    }
  };

  const wide = cfg.pairs >= 5;

  return (
    <div className="stack-lg">
      <p className="text-muted">{t('pairs.instruction')}</p>

      {/* Stats */}
      <div className="game-stats">
        <div className="game-stat">
          <div className="game-stat__value">
            {matchedPairs} / {cfg.pairs}
          </div>
          <div className="game-stat__label">{t('pairs.pairsFound')}</div>
        </div>
        <div className="game-stat">
          <div className="game-stat__value">{taps}</div>
          <div className="game-stat__label">{t('pairs.taps')}</div>
        </div>
        <button
          type="button"
          className="game-stat"
          onClick={() => setPaused(true)}
          aria-label={t('pairs.pause')}
          disabled={phase === 'done'}
        >
          <div className="game-stat__value" aria-hidden="true">
            <Icon name="pause" size={22} />
          </div>
          <div className="game-stat__label">{t('pairs.pause')}</div>
        </button>
      </div>

      {/* Hint banner */}
      <div className="banner banner--amber">
        <Icon name="sparkle" size={22} />
        <span>{phase === 'preview' ? t('pairs.preview') : t('pairs.hint')}</span>
      </div>

      {/* Board */}
      <div className={`pairs-board ${wide ? 'pairs-board--wide' : ''}`}>
        {cards.map((card) => {
          const obj = OBJECT_POOL[card.objIndex];
          const shown = card.open || card.matched;
          const label = objectLabel(obj, settings.language);
          return (
            <button
              key={card.id}
              type="button"
              className={[
                'pair-card',
                card.matched ? 'pair-card--matched' : '',
                card.open && !card.matched ? 'pair-card--open' : '',
                card.justMatched ? 'pop' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleTap(card)}
              disabled={phase !== 'play' || card.matched || paused}
              aria-label={
                shown
                  ? `${label}${card.matched ? ', ' + t('pairs.matched') : ''}`
                  : t('pairs.tapToTurn')
              }
            >
              {card.matched && (
                <span className="pair-tag pair-tag--matched">
                  <Icon name="check" size={14} strokeWidth={3} /> {t('pairs.matched')}
                </span>
              )}
              {card.open && !card.matched && (
                <span className="pair-tag pair-tag--open">{t('pairs.open')}</span>
              )}
              <span className="pair-card__face" aria-hidden="true">
                {shown ? obj.emoji : <span className="pair-card__q">❓</span>}
              </span>
              <span className="pair-card__label">
                {shown ? label : t('pairs.tapToTurn')}
              </span>
            </button>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {/* Pause overlay */}
      {paused && (
        <div className="pause-overlay">
          <div className="card card--pad-lg stack text-center" style={{ maxWidth: 360 }}>
            <span className="medallion medallion--amber medallion--lg" aria-hidden="true">
              ⏸️
            </span>
            <h2>{t('pairs.paused')}</h2>
            <Button variant="primary" size="lg" block icon="play" onClick={() => setPaused(false)}>
              {t('pairs.resume')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildDeck(pairs: number): Card[] {
  const chosen = shuffle(OBJECT_POOL.map((_, i) => i)).slice(0, pairs);
  const deck: Card[] = [];
  for (const objIndex of chosen) {
    for (let k = 0; k < 2; k++) {
      deck.push({
        id: uid('c_'),
        objIndex,
        emoji: OBJECT_POOL[objIndex].emoji,
        matched: false,
        open: false,
        justMatched: false,
      });
    }
  }
  return shuffle(deck);
}
