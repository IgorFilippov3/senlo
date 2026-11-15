import React from "react";

const WORD = "M214 707Q158 707 116 691Q74 675 46 651.5Q18 628 0 608L94 526Q111 551 140.5 574Q170 597 215 597Q248 597 266.5 584Q285 571 285 554Q285 538 273 528.5Q261 519 241 512Q221 505 196 498Q168 491 138 480.5Q108 470 82 453Q56 436 40 409.5Q24 383 24 343Q24 276 76.5 235Q129 194 214 194Q274 194 323 217Q372 240 401 284L316 351Q298 325 270 310.5Q242 296 211 296Q185 296 168.5 305.5Q152 315 152 330Q152 341 160 348.5Q168 356 186 362Q204 368 235 376Q264 383 296 393Q328 403 356.5 420.5Q385 438 402.5 466.5Q420 495 420 538Q420 588 394.5 626.5Q369 665 322.5 686Q276 707 214 707Z M702 707Q636 707 588.5 686Q541 665 511.5 629Q482 593 468.5 547.5Q455 502 455 453Q455 406 468.5 360Q482 314 510 276.5Q538 239 584 216.5Q630 194 694 194Q751 194 794.5 213.5Q838 233 867 267.5Q896 302 910.5 349Q925 396 925 450Q925 459 924.5 471Q924 483 922 498H592Q598 544 631 566.5Q664 589 710 589Q747 589 784 576Q821 563 849 539L912 635Q875 661 843.5 677Q812 693 778.5 700Q745 707 702 707ZM795 396Q795 377 788 361Q780 345 767 333Q754 321 736 314.5Q718 308 696 308Q661 308 638.5 321.5Q616 335 604.5 355Q593 375 590 396Z M985 697V204H1122V270Q1130 256 1141 244Q1166 217 1199 205.5Q1232 194 1265 194Q1350 194 1397.5 241.5Q1445 289 1445 372V697H1307V423Q1307 366 1286.5 339.5Q1266 313 1222 313Q1189 313 1166.5 329Q1144 345 1133 378Q1122 411 1122 464V697Z M1639 707Q1587 707 1552 675.5Q1517 644 1517 575V0H1654V548Q1654 566 1663 573.5Q1672 581 1686 581Q1695 581 1703 579Q1711 577 1720 575V692Q1698 700 1677 703.5Q1656 707 1639 707Z M1995 707Q1923 707 1866 674Q1809 641 1776.5 582.5Q1744 524 1744 450Q1744 375 1776.5 317Q1809 259 1865.5 226.5Q1922 194 1995 194Q2067 194 2123.5 226.5Q2180 259 2212.5 317Q2245 375 2245 450Q2245 524 2212.5 582.5Q2180 641 2123.5 674Q2067 707 1995 707ZM1995 587Q2031 587 2056 571Q2081 555 2094 524Q2107 493 2107 450Q2107 406 2094 376Q2081 346 2056 330Q2031 314 1995 314Q1959 314 1933.5 330Q1908 346 1894.5 376Q1881 406 1881 450Q1881 493 1894.5 524Q1908 555 1933.5 571Q1959 587 1995 587Z";
const DOT = "M2293 697V560H2437V697Z";

export interface SenloLogoProps {
  className?: string;
  style?: React.CSSProperties;
  /** Colour of the full stop; the accent by default. On a dark ground pass a lighter one. */
  dotColor?: string;
  /** Accessible name; pass "" when the logo sits next to the same word in text. */
  title?: string;
}

/**
 * The Senlo wordmark: `senlo` and a full stop in the accent colour. The
 * letters are outlines of Hanken Grotesk ExtraBold (tracking -0.035em), so it
 * looks the same whether or not the font has loaded.
 *
 * It behaves like the text it replaces: the word takes the current text
 * colour and the height follows the font size (the letters' own height at
 * that size), so `className="text-[30px]"` sizes it. No hooks: it renders in
 * server components. The same drawing as a file: `senlo-logo.svg` in the
 * hosts' `public/core`.
 */
export function SenloLogo({ className, style, dotColor = "var(--sl-color-accent, #a9441f)", title = "Senlo" }: SenloLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 2437 707"
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{ height: "0.707em", width: "auto", display: "inline-block", flexShrink: 0, ...style }}
    >
      <path fill="currentColor" d={WORD} />
      <path fill={dotColor} d={DOT} />
    </svg>
  );
}

/** Width to height of the wordmark, for places that must state both (next/image, an OG image). */
export const SENLO_LOGO_RATIO = 2437 / 707;
