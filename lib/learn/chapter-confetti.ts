import confetti from "canvas-confetti";

/** Duolingo-style palette: small bright rectangles (red, blue, green, yellow, purple, orange, pink, cyan). */
const COLORS = [
    "#E53935",
    "#1E88E5",
    "#43A047",
    "#FDD835",
    "#8E24AA",
    "#FB8C00",
    "#EC407A",
    "#00ACC1",
];

const Z = 100050;

/**
 * Light celebration: a few small square “cards” only — launch up from the bottom, then float down slowly.
 * No stars or circles; tuned to feel closer to Duolingo than a fireworks show.
 */
export function celebrateChapterComplete(): void {
    const base: confetti.Options = {
        zIndex: Z,
        colors: COLORS,
        disableForReducedMotion: true,
        /** Flat rectangles (paper-like), not stars */
        shapes: ["square"],
        /** Smaller pieces */
        scalar: 0.85,
        /** Slow, floaty fall */
        gravity: 0.52,
        drift: 0.02,
        ticks: 520,
        decay: 0.91,
        /** Launch upward from bottom centre */
        angle: 90,
        spread: 62,
        startVelocity: 36,
        origin: { x: 0.5, y: 0.96 },
        particleCount: 38,
        /** Less 3D wobble — reads more like flat confetti cards */
        flat: true,
    };

    confetti(base);

    window.setTimeout(() => {
        confetti({
            ...base,
            particleCount: 22,
            spread: 48,
            startVelocity: 28,
            scalar: 0.75,
            origin: { x: 0.5, y: 0.97 },
        });
    }, 320);
}
