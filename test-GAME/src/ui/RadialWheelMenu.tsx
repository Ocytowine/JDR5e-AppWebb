import React from "react";

export type WheelMenuItem = {
  id: string;
  label: string;
  color: string;
  disabled?: boolean;
  disabledReason?: string;
  onSelect?: () => void;
};

function polarToCartesian(radius: number, angleRad: number): { x: number; y: number } {
  return { x: Math.cos(angleRad) * radius, y: Math.sin(angleRad) * radius };
}

function arcPath(
  radius: number,
  startAngleRad: number,
  endAngleRad: number,
  largeArcFlag: 0 | 1,
  sweepFlag: 0 | 1
): string {
  const start = polarToCartesian(radius, startAngleRad);
  const end = polarToCartesian(radius, endAngleRad);
  return `A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}

function donutSlicePath(
  innerRadius: number,
  outerRadius: number,
  startAngleRad: number,
  endAngleRad: number
): string {
  const fullCircle = Math.abs(endAngleRad - startAngleRad) >= Math.PI * 2 - 1e-6;
  const delta = endAngleRad - startAngleRad;
  const largeArcFlag: 0 | 1 = fullCircle || Math.abs(delta) > Math.PI ? 1 : 0;
  const sweepFlag: 0 | 1 = delta >= 0 ? 1 : 0;
  const sweepFlagReverse: 0 | 1 = sweepFlag === 1 ? 0 : 1;

  const outerStart = polarToCartesian(outerRadius, startAngleRad);
  const innerEnd = polarToCartesian(innerRadius, endAngleRad);
  const innerStart = polarToCartesian(innerRadius, startAngleRad);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    arcPath(outerRadius, startAngleRad, endAngleRad, largeArcFlag, sweepFlag),
    `L ${innerEnd.x} ${innerEnd.y}`,
    arcPath(innerRadius, endAngleRad, startAngleRad, largeArcFlag, sweepFlagReverse),
    `L ${innerStart.x} ${innerStart.y}`,
    "Z"
  ].join(" ");
}

export function RadialWheelMenu(props: {
  open: boolean;
  anchorX: number;
  anchorY: number;
  items: WheelMenuItem[];
  onClose: () => void;
  size?: number;
}): React.ReactNode {
  if (!props.open) return null;

  const size = props.size ?? 240;
  const half = size / 2;
  const outerRadius = half;
  const innerRadius = Math.max(44, Math.floor(outerRadius * 0.42));
  const centerRadius = innerRadius - 6;

  const itemCount = Math.max(1, props.items.length);
  const angleStep = (Math.PI * 2) / itemCount;
  const startAngle = -Math.PI / 2;

  return (
    <div
      style={{
        position: "absolute",
        left: props.anchorX,
        top: props.anchorY,
        width: size,
        height: size,
        transform: "translate(-50%, -50%)",
        zIndex: 50,
        pointerEvents: "auto",
        userSelect: "none"
      }}
      onMouseDown={event => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <svg width={size} height={size} viewBox={`${-half} ${-half} ${size} ${size}`}>
        <defs>
          <filter id="wheelShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="10" stdDeviation="14" floodOpacity="0.35" />
          </filter>
        </defs>

        <g filter="url(#wheelShadow)">
          {props.items.map((item, index) => {
            const a0 = startAngle + index * angleStep;
            const a1 = startAngle + (index + 1) * angleStep;
            const mid = (a0 + a1) / 2;
            const labelPos = polarToCartesian((innerRadius + outerRadius) / 2, mid);

            const pathD = donutSlicePath(innerRadius, outerRadius, a0, a1);
            const isDisabled = Boolean(item.disabled);
            const title =
              isDisabled && item.disabledReason
                ? item.disabledReason
                : isDisabled
                  ? "Indisponible"
                  : undefined;

            return (
              <g key={item.id}>
                <path
                  d={pathD}
                  fill={isDisabled ? "rgba(90, 90, 100, 0.75)" : item.color}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth={1}
                  style={{
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    transition: "filter 120ms ease, opacity 120ms ease"
                  }}
                  opacity={isDisabled ? 0.55 : 0.95}
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (isDisabled) return;
                    item.onSelect?.();
                  }}
                >
                  {title ? <title>{title}</title> : null}
                </path>
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    fill: isDisabled ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.92)",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.2,
                    pointerEvents: "none"
                  }}
                >
                  {item.label}
                </text>
              </g>
            );
          })}

          <circle
            cx={0}
            cy={0}
            r={centerRadius}
            fill="rgba(10,10,16,0.92)"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={1}
            style={{ cursor: "pointer" }}
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              props.onClose();
            }}
          />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fill: "rgba(255,255,255,0.9)",
              fontSize: 12,
              fontWeight: 800,
              pointerEvents: "none"
            }}
          >
            Annuler
          </text>
        </g>
      </svg>
    </div>
  );
}

