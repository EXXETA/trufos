import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  Component: React.FC<React.SVGProps<SVGSVGElement>>;
  size?: number;
  color?: string;
}

const Icon: React.FC<IconProps> = ({ Component, size = 24, color = 'currentColor', ...props }) => {
  return (
      <Component
          width={size}
          height={size}
          fill={color}
          {...props}
      />
  );
};

export default Icon;
