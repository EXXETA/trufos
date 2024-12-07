import { FC, ReactNode, SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
  viewBox?: string;
  children?: ReactNode;
}

const Icon: FC<IconProps> = ({
  children,
  size = 24,
  color = 'currentColor',
  viewBox = `0 0 ${(size * 4) / 3} ${(size * 4) / 3}`,
  ...props
}) => {
  return (
    <svg width={size} height={size} fill={color} viewBox={viewBox} {...props}>
      {children}
    </svg>
  );
};

export default Icon;
