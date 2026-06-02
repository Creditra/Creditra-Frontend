import React from 'react';
import './Skeleton.css';

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  width?: string | number;
  height?: string | number;
};

export const Skeleton: React.FC<SkeletonProps> = ({ width, height, style, className, ...rest }) => (
  <div
    className={`skeleton ${className ?? ''}`.trim()}
    style={{ width, height, ...style }}
    {...rest}
  />
);
