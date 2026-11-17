import React from 'react';

interface LogoMarkProps {
  size?: 'sm' | 'md';
  className?: string;
}

export const LogoMark: React.FC<LogoMarkProps> = ({size = 'md', className = ''}) => {
  const sizeClasses = size === 'sm' ? 'w-6 h-6 rounded-lg' : 'w-8 h-8 rounded-xl';

  return (
    <span
      className={`inline-flex items-center justify-center bg-[#A3E635] shrink-0 ${sizeClasses} ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full block"
      >
        <circle
          cx="16"
          cy="16"
          r="7.5"
          stroke="#121814"
          strokeWidth="2.1"
        />
        <circle
          cx="16"
          cy="16"
          r="4.2"
          fill="#121814"
        />
      </svg>
    </span>
  );
};
