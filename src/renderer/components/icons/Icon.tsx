import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
}

const Icon: React.FC<IconProps> = ({ children, size = 24, color = 'currentColor', viewBox = '0 0 32 32', ...props }) => {
  return (
      <svg
          width={size}
          height={size}
          fill={color}
          viewBox={viewBox}
          {...props}
      >
        {children}
      </svg>
  );
};

export default Icon;

