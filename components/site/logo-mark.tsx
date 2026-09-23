/**
 * Знак AnimeWatch (docs/04, «Знак»): лигатура AW — правая нога A становится первым штрихом W,
 * перекладина A — янтарный сигнал. Тот же рисунок, что public/brand/mark.svg, но в токенах:
 * буквы — цвет текста вокруг (currentColor), перекладина — signal.
 *
 * Декоративный: рядом всегда стоит слово «AnimeWatch», и называет ссылку оно.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <clipPath id="logo-mark-band">
          <rect x="0" y="16" width="100" height="68" />
        </clipPath>
      </defs>
      <rect x="10" y="59" width="34" height="11" className="fill-signal" />
      <polyline
        clipPath="url(#logo-mark-band)"
        points="7,90 27,10 47,90 59,48 71,90 93,6"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinejoin="miter"
        strokeMiterlimit="10"
      />
    </svg>
  );
}
