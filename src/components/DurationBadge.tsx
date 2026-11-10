import React from 'react';

interface DurationBadgeProps {
  duration: number | string;
  unit?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function DurationBadge({ duration, unit, className = '', size = 'md' }: DurationBadgeProps) {
  const isOne = duration === 1 || duration === '1';
  const numText = String(duration);
  const label = unit || (isOne ? 'HORA' : 'HORAS');

  // Size styling for the container
  const sizeClasses = {
    xs: 'w-7 h-7 sm:w-8 sm:h-8 p-0.5 rounded-lg',
    sm: 'w-8 h-8 sm:w-10 sm:h-10 p-0.5 sm:p-1 rounded-lg sm:rounded-xl',
    md: 'w-16 h-16 sm:w-20 sm:h-20 p-1.5 sm:p-2 rounded-2xl sm:rounded-[22px]',
    lg: 'w-20 h-20 sm:w-24 sm:h-24 p-2 rounded-[24px]',
  }[size];

  return (
    <div
      className={`bg-[#eef1f4] flex items-center justify-center shrink-0 shadow-xs ${sizeClasses} ${className}`}
      title={`Duración: ${numText} ${label.toLowerCase()}`}
    >
      <svg
        version="1.1"
        viewBox="0 0 121.8 114.5"
        className="w-full h-full select-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g>
          {/* Main clockwise circular arrow track */}
          <path
            fill="#707275"
            d="M114.3,52.2l4.5,0.2c2.5,0.1,3.7,2.3,2.4,4.4c-2.9,4.7-5.9,9.3-8.8,14c-1.4,2.2-3.9,2.1-5.1-0.2
            c-2.5-4.8-5.1-9.6-7.6-14.5c-1.3-2.4,0-4.4,2.7-4.4c1.4,0,2.8,0,4.3,0c-0.2-1.4-0.4-2.8-0.7-4.2C100.7,20.5,74.5,3,47.5,8.4
            C30,11.9,15.7,24.5,10,41.4c-9.8,29,9.1,60.2,39.3,65c5.5,0.9,11,0.8,16.5-0.1c1.3-0.2,1.6,0,1.8,1.3s0.5,2.6,0.8,3.9
            c0.3,1.6,0.1,1.9-1.4,2.2c-7.3,1.2-14.8,1.1-22-0.5C14.1,106.4-5.5,75.8,1.3,45S38.6-5.5,69.5,1.3c22.2,4.9,39.4,22.4,43.8,44.7
            C113.8,48,114,50.1,114.3,52.2z"
          />

          {/* Dash 1 */}
          <path
            fill="#707275"
            d="M73.4,105.1c0.3-0.3,0.6-0.8,1-1c2.5-1.2,4.9-2.3,7.4-3.5c0.5-0.4,1.3-0.2,1.6,0.3c0,0,0.1,0.1,0.1,0.1
            c0.8,1.4,1.7,2.8,2.5,4.2c0.4,0.5,0.3,1.2-0.2,1.6c-0.1,0.1-0.2,0.1-0.3,0.2c-2.9,1.4-5.8,2.8-8.8,4c-0.5,0.1-1,0-1.4-0.4
            C74.7,108.9,74.1,107.1,73.4,105.1z"
          />

          {/* Dash 2 */}
          <path
            fill="#707275"
            d="M92.2,102.3c-0.4-0.2-0.7-0.5-1-0.8c-1-1.2-1.9-2.5-2.9-3.7c-0.5-0.5-0.4-1.3,0.1-1.8c0.1,0,0.1-0.1,0.2-0.1
            c1.7-1.6,3.4-3.2,5.1-4.8c0.4-0.5,1.2-0.7,1.7-0.3c0.1,0.1,0.1,0.1,0.2,0.2c1.2,1,2.3,2.1,3.5,3.1c0.6,0.3,0.7,1.1,0.4,1.6
            c-0.1,0.1-0.2,0.2-0.3,0.3c-2,1.9-4,3.8-6.1,5.7C92.9,102,92.6,102.2,92.2,102.3z"
          />

          {/* Dash 3 */}
          <path
            fill="#707275"
            d="M103.2,77.8c0.4,0.2,0.7,0.2,0.9,0.3l4.1,1.8c0.6,0.2,1,0.8,0.9,1.4c0,0.2-0.1,0.3-0.2,0.4
            c-1.3,2.3-2.5,4.5-3.8,6.8c-0.2,0.6-0.9,0.9-1.6,0.7c-0.2-0.1-0.3-0.2-0.4-0.3l-3.8-2.7c-0.6-0.3-0.8-1.1-0.5-1.7
            c0-0.1,0.1-0.1,0.1-0.2c1.1-1.9,2.1-3.8,3.2-5.7C102.5,78.5,102.8,78.1,103.2,77.8z"
          />

          {/* Number (1, 2, 1-2, etc.) */}
          <text
            x="58.5"
            y={numText.length > 2 ? '61' : '63'}
            textAnchor="middle"
            fontWeight="800"
            fontSize={numText.length > 2 ? '26' : '36'}
            fill="#707275"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
          >
            {numText}
          </text>

          {/* Unit label (HORA / HORAS) */}
          <text
            x="58.5"
            y="85.5"
            textAnchor="middle"
            fontWeight="800"
            fontSize={label.length > 4 ? '18.5' : '19.5'}
            fill="#707275"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
          >
            {label}
          </text>
        </g>
      </svg>
    </div>
  );
}
