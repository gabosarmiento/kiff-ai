import React from 'react';

interface KittScannerProps {
  color?: string;
  height?: string;
  ledSize?: string;
  duration?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function KittScanner({
  color = '#3895ff',
  height = '4px',
  ledSize = '6px',
  duration = '1s',
  className = '',
  style = {},
  ...props
}: KittScannerProps) {
  const leds = 8;
  
  // Use a stable animation name based on props (so React Fast Refresh doesn't break it)
  const animationName = React.useMemo(() => {
    // Only use valid CSS class chars
    const hash = btoa(`${ledSize}|${leds}|${duration}`)
      .replace(/[^a-z0-9]/gi, '').toLowerCase();
    return `kitt-scanner-${hash}`;
  }, [ledSize, leds, duration]);

  // Calculate the beam width
  const beamWidth = `calc(${ledSize} * ${leds})`;
  const translateDistance = `calc(100% - ${beamWidth})`;

  // Inject keyframes only once per animationName
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (document.getElementById(animationName)) return;
    const style = document.createElement('style');
    style.id = animationName;
    style.innerHTML = `@keyframes ${animationName} { from { transform: translateX(0); } to { transform: translateX(${translateDistance}); } }`;
    document.head.appendChild(style);
    return () => {
      // Optionally: cleanup if needed
      // document.head.removeChild(style);
    };
  }, [animationName, translateDistance]);

  return (
    <div
      className={`kitt-scanner ${className}`}
      style={{
        display: 'inline-block',
        width: '100%',
        height,
        position: 'relative',
        contain: 'content',
        ...style,
      }}
      {...props}
    >
      {/* Animation keyframes injected here for isolation */}
      <style>{`
        @keyframes ${animationName} {
          from { transform: translateX(0); }
          to { transform: translateX(${translateDistance}); }
        }
      `}</style>
      <div
        className="track"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          borderRadius: height,
        }}
      >
        <div
          className="beam"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: ledSize,
            height: '100%',
            width: beamWidth,
            willChange: 'transform',
            animation: `${animationName} ${duration} linear infinite alternate`,
          }}
        >
          {Array.from({ length: leds }).map((_, index) => (
            <div
              key={index}
              className="led"
              style={{
                height: '100%',
                background: color,
                borderRadius: height,
                opacity: getLedOpacity(index),
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Helper function to get LED opacity for comet tail effect
function getLedOpacity(index: number): number {
  const opacities = [1, 0.85, 0.65, 0.5, 0.35, 0.22, 0.12, 0.06];
  return opacities[index] || 0.05;
}
