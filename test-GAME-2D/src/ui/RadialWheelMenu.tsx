import React, { useId } from "react";

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

function normalizeAngle(angleRad: number): number {
  const twoPi = Math.PI * 2;
  let a = angleRad % twoPi;
  if (a < 0) a += twoPi;
  return a;
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

function fullDonutPath(outerRadius: number, innerRadius: number): string {
  const outerTop = polarToCartesian(outerRadius, -Math.PI / 2);
  const outerBottom = polarToCartesian(outerRadius, Math.PI / 2);
  const innerTop = polarToCartesian(innerRadius, -Math.PI / 2);
  const innerBottom = polarToCartesian(innerRadius, Math.PI / 2);
  return [
    `M ${outerTop.x} ${outerTop.y}`,
    `A ${outerRadius} ${outerRadius} 0 1 1 ${outerBottom.x} ${outerBottom.y}`,
    `A ${outerRadius} ${outerRadius} 0 1 1 ${outerTop.x} ${outerTop.y}`,
    `M ${innerTop.x} ${innerTop.y}`,
    `A ${innerRadius} ${innerRadius} 0 1 0 ${innerBottom.x} ${innerBottom.y}`,
    `A ${innerRadius} ${innerRadius} 0 1 0 ${innerTop.x} ${innerTop.y}`
  ].join(" ");
}

export function RadialWheelMenu(props: {
  open: boolean;
  anchorX: number;
  anchorY: number;
  items: WheelMenuItem[];
  onClose: () => void;
  size?: number;
  centerLabel?: string;
  onCenterClick?: () => void;
  sliceOpacity?: number;
  centerOpacity?: number;
  zIndex?: number;
  arcLabel?: string;
}): React.ReactNode {
  if (!props.open) return null;

  const size = props.size ?? 240;
  const half = size / 2;
  const outerRadius = half;
  const innerRadius = Math.max(44, Math.floor(outerRadius * 0.42));
  const centerRadius = innerRadius - 6;
  const labelRadius = Math.max(innerRadius + 12, outerRadius - 18);

  const itemCount = Math.max(1, props.items.length);
  const isSingleItem = itemCount === 1;
  const useArcLabels = itemCount > 1;
  const angleStep = (Math.PI * 2) / itemCount;
  const startAngle = -Math.PI / 2;
  const centerLabel = props.centerLabel ?? "Annuler";
  const onCenterClick = props.onCenterClick ?? props.onClose;
  const sliceOpacity = typeof props.sliceOpacity === "number" ? props.sliceOpacity : 1;
  const centerOpacity = typeof props.centerOpacity === "number" ? props.centerOpacity : 1;

  const zIndex = typeof props.zIndex === "number" ? props.zIndex : 50;

  const arcId = useId();
  const arcRadius = outerRadius - 6;
  const arcStart = -Math.PI * 0.95;
  const arcEnd = -Math.PI * 0.05;
  const arcPathId = `wheel-arc-${arcId}`;
  const arcStartPos = polarToCartesian(arcRadius, arcStart);
  const arcEndPos = polarToCartesian(arcRadius, arcEnd);

  return (
    <div
      style={{
        position: "absolute",
        left: props.anchorX,
        top: props.anchorY,
        width: size,
        height: size,
        transform: "translate(-50%, -50%)",
        zIndex,
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
          {props.arcLabel ? (
            <path
              id={arcPathId}
              d={[
                `M ${arcStartPos.x} ${arcStartPos.y}`,
                `A ${arcRadius} ${arcRadius} 0 0 1 ${arcEndPos.x} ${arcEndPos.y}`
              ].join(" ")}
            />
          ) : null}
        </defs>

        <g filter="url(#wheelShadow)">
          {props.arcLabel ? (
            <text
              style={{
                fill: "rgba(255,255,255,0.85)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.3,
                pointerEvents: "none"
              }}
            >
              <textPath href={`#${arcPathId}`} startOffset="50%" textAnchor="middle">
                {props.arcLabel}
              </textPath>
            </text>
          ) : null}
          {props.items.map((item, index) => {
            const a0 = startAngle + index * angleStep;
            const a1 = startAngle + (index + 1) * angleStep;
            const mid = (a0 + a1) / 2;
            const midNorm = normalizeAngle(mid);
            const isBottom = midNorm > 0 && midNorm < Math.PI;
            const labelStart = isBottom ? a1 : a0;
            const labelEnd = isBottom ? a0 : a1;
            const labelPos = polarToCartesian((innerRadius + outerRadius) / 2, mid);

            const pathD = isSingleItem
              ? fullDonutPath(outerRadius, innerRadius)
              : donutSlicePath(innerRadius, outerRadius, a0, a1);
            const labelStartPos = polarToCartesian(labelRadius, labelStart);
            const labelEndPos = polarToCartesian(labelRadius, labelEnd);
            const delta = labelEnd - labelStart;
            const largeArcFlag: 0 | 1 = Math.abs(delta) > Math.PI ? 1 : 0;
            const sweepFlag: 0 | 1 = delta >= 0 ? 1 : 0;
            const labelPathId = `wheel-label-${index}-${item.id}`;
            const labelPath = [
              `M ${labelStartPos.x} ${labelStartPos.y}`,
              `A ${labelRadius} ${labelRadius} 0 ${largeArcFlag} ${sweepFlag} ${labelEndPos.x} ${labelEndPos.y}`
            ].join(" ");
            const isDisabled = Boolean(item.disabled);
            const title =
              isDisabled && item.disabledReason
                ? item.disabledReason
                : isDisabled
                  ? "Indisponible"
                  : undefined;

            return (
              <g key={item.id}>
                <defs>
                  <path id={labelPathId} d={labelPath} />
                </defs>
                <path
                  d={pathD}
                  fill={isDisabled ? "rgba(90, 90, 100, 0.75)" : item.color}
                  fillRule={isSingleItem ? "evenodd" : undefined}
                  stroke={isSingleItem ? "none" : "rgba(255,255,255,0.22)"}
                  strokeWidth={isSingleItem ? 0 : 1}
                  style={{
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    transition: "filter 120ms ease, opacity 120ms ease"
                  }}
                  opacity={(isDisabled ? 0.55 : 0.95) * Math.max(0, Math.min(1, sliceOpacity))}
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
                  x={useArcLabels ? undefined : labelPos.x}
                  y={useArcLabels ? undefined : labelPos.y}
                  textAnchor={useArcLabels ? undefined : "middle"}
                  dominantBaseline={useArcLabels ? undefined : "middle"}
                  style={{
                    fill: isDisabled ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.92)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.2,
                    pointerEvents: "none"
                  }}
                >
                  {useArcLabels ? (
                    <textPath
                      href={`#${labelPathId}`}
                      startOffset="50%"
                      textAnchor="middle"
                    >
                      {item.label}
                    </textPath>
                  ) : (
                    item.label
                  )}
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
            opacity={Math.max(0, Math.min(1, centerOpacity))}
            style={{ cursor: "pointer" }}
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              onCenterClick();
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
            {centerLabel}
          </text>
        </g>
      </svg>
    </div>
  );
}
