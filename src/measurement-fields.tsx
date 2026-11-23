import { useLayoutEffect, useRef, useState } from 'react';
import { metrics, type Measurement, type Metric } from './model';

const general: Metric[] = ['heightCm', 'weightKg', 'bodyFatPct'];
const legacy: Metric[] = ['bicepsCm', 'thighCm', 'calfCm'];

// Front view. Points are fractions of the original image, rows follow the visual order of inputs.
const locations: { key: Metric; side: 'left' | 'right'; row: number; x: number; y: number }[] = [
  { key: 'chestCm', side: 'left', row: 1, x: .425, y: .23 },
  { key: 'rightBicepsCm', side: 'left', row: 2, x: .275, y: .30 },
  { key: 'leftBicepsCm', side: 'right', row: 2, x: .725, y: .30 },
  { key: 'rightForearmCm', side: 'left', row: 3, x: .17, y: .415 },
  { key: 'leftForearmCm', side: 'right', row: 3, x: .83, y: .415 },
  { key: 'waistCm', side: 'left', row: 4, x: .41, y: .39 },
  { key: 'hipsCm', side: 'right', row: 4, x: .62, y: .46 },
  { key: 'rightThighCm', side: 'left', row: 5, x: .40, y: .59 },
  { key: 'leftThighCm', side: 'right', row: 5, x: .60, y: .59 },
  { key: 'rightCalfCm', side: 'left', row: 6, x: .39, y: .77 },
  { key: 'leftCalfCm', side: 'right', row: 6, x: .61, y: .77 },
];

function BodyDiagram() {
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = frame.current!;
    const resize = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const { width, height } = size;
  const imageWidth = Math.min(width * 1.2, (height - 8) * 512 / 941);
  const imageHeight = imageWidth * 941 / 512;
  const left = (width - imageWidth) / 2;
  const top = (height - imageHeight) / 2;
  return <div className="body-diagram" ref={frame}>
    {width > 0 && <>
      <img src="/body-measurements.png" alt="Фигура человека спереди" width={512} height={941}
        style={{ left, top, width: imageWidth, height: imageHeight }} />
      <svg aria-hidden="true" focusable="false">
        {locations.map(({ key, side, row, x, y }) => {
          const startX = side === 'left' ? 0 : width;
          const startY = (row - .5) * height / 6 + 16;
          const targetX = left + x * imageWidth;
          const targetY = top + y * imageHeight;
          const bend = startX + (targetX - startX) * .25;
          return <g key={key}>
            <polyline points={`${startX},${startY} ${bend},${startY} ${targetX},${targetY}`} />
            <circle cx={targetX} cy={targetY} r={3.5} />
          </g>;
        })}
      </svg>
    </>}
  </div>;
}

function MetricField({ metric, value, describedBy }: { metric: Metric; value?: number | null; describedBy?: string }) {
  const [label, unit] = metrics[metric];
  return <label className="measurement-input">
    <span>{label}</span>
    <span className="measurement-number">
      <input name={metric} type="number" inputMode="decimal" aria-describedby={describedBy}
        min={metric === 'bodyFatPct' ? 0 : metric === 'weightKg' ? .01 : .1}
        max={metric === 'bodyFatPct' ? 100 : metric === 'weightKg' ? 999.99 : 9999.9}
        step={metric === 'weightKg' ? .01 : .1} defaultValue={value ?? ''} />
      <small>{unit}</small>
    </span>
  </label>;
}

export function MeasurementFields({ initial }: { initial?: Measurement }) {
  const original = legacy.filter((key) => initial?.[key] != null);
  return <>
    <div className="measurement-general">
      {general.map((k) => <MetricField key={k} metric={k} value={initial?.[k]} />)}
    </div>
    <fieldset className="circumferences">
      <legend>Обхваты тела</legend>
      <p className="muted">Стороны указаны со стороны подопечного. Заполните только измеренные показатели.</p>
      <div className="body-map">
        <BodyDiagram />
        {locations.map(({ key, side, row }) => (
          <div key={key} className="body-point" style={{ gridColumn: side === 'left' ? 1 : 3, gridRow: row }}>
            <MetricField metric={key} value={initial?.[key]} />
          </div>
        ))}
      </div>
    </fieldset>
    <div className="back-measurement">
      <MetricField metric="backWidthCm" value={initial?.backWidthCm} describedBy="back-width-help" />
      <p id="back-width-help" className="muted">Руки свободно опущены. Измерьте со спины по горизонтали между задними краями подмышек на уровне лопаток.</p>
    </div>
    {original.length > 0 && <div className="fields three">
      {original.map((k) => <MetricField key={k} metric={k} value={initial?.[k]} />)}
    </div>}
  </>;
}
