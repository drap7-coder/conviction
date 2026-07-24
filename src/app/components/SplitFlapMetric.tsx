'use client';

import { useEffect, useRef, useState } from 'react';

interface SplitFlapMetricProps {
  value: string;
  label: string;
  change?: string;
  isPositive?: boolean;
}

const FLAP_DURATION_MS = 220;
const STAGGER_MS = 18;

export function SplitFlapMetric({
  value,
  label,
  change,
  isPositive,
}: SplitFlapMetricProps) {
  const [characters, setCharacters] = useState(() => value.split(''));
  const [flippingChars, setFlippingChars] = useState<Record<number, boolean>>({});
  const previousValueRef = useRef(value);

  useEffect(() => {
    const previousValue = previousValueRef.current;
    if (previousValue === value) return;

    const previousCharacters = previousValue.split('');
    const nextCharacters = value.split('');
    const characterCount = Math.max(
      previousCharacters.length,
      nextCharacters.length,
    );

    const changedPositions: Record<number, boolean> = {};
    for (let index = 0; index < characterCount; index += 1) {
      if (previousCharacters[index] !== nextCharacters[index]) {
        changedPositions[index] = true;
      }
    }

    setCharacters(
      Array.from(
        { length: characterCount },
        (_, index) => previousCharacters[index] ?? ' ',
      ),
    );
    setFlippingChars(changedPositions);

    const swapTimers = Object.keys(changedPositions).map((position) => {
      const index = Number(position);
      return window.setTimeout(() => {
        setCharacters((currentCharacters) => {
          const updatedCharacters = [...currentCharacters];
          updatedCharacters[index] = nextCharacters[index] ?? ' ';
          return updatedCharacters;
        });
      }, index * STAGGER_MS + FLAP_DURATION_MS / 2);
    });

    const completionTimer = window.setTimeout(() => {
      setCharacters(nextCharacters);
      setFlippingChars({});
      previousValueRef.current = value;
    }, characterCount * STAGGER_MS + FLAP_DURATION_MS);

    return () => {
      swapTimers.forEach(window.clearTimeout);
      window.clearTimeout(completionTimer);
    };
  }, [value]);

  const changeClass = isPositive === true
    ? 'sf-change-positive'
    : isPositive === false
      ? 'sf-change-negative'
      : 'sf-change-neutral';

  return (
    <div className="sf-card">
      <span className="sf-label">{label}</span>
      <div className="sf-body">
        <div className="sf-chars" aria-label={`${label}: ${value}`}>
          {characters.map((character, index) => {
            const isFlipping = flippingChars[index];
            return (
              <span
                key={`${index}-${character}`}
                aria-hidden="true"
                className={`sf-char${isFlipping ? ' animate-flap' : ''}`}
                style={{
                  animationDuration: `${FLAP_DURATION_MS}ms`,
                  animationDelay: `${index * STAGGER_MS}ms`,
                }}
              >
                {character === ' ' ? '\u00A0' : character}
              </span>
            );
          })}
        </div>
        {change && (
          <span className={`sf-change ${changeClass}`}>{change}</span>
        )}
      </div>
    </div>
  );
}