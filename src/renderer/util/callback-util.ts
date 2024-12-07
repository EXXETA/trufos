import { MouseEvent } from 'react';

export function handleMouseEvent(callback: () => void) {
  return (e: MouseEvent) => {
    e.stopPropagation();
    callback();
  };
}
