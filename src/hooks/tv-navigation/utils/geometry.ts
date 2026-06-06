// UTILS - Geometry utilities

import { Direction } from '../core/types';

export function getCenter(rect: DOMRect): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function getDistance(
  rect1: DOMRect,
  rect2: DOMRect
): { dx: number; dy: number; distance: number } {
  const dx = rect2.left - rect1.left;
  const dy = rect2.top - rect1.top;
  const distance = Math.hypot(dx, dy);
  return { dx, dy, distance };
}

export function isSameRow(rect1: DOMRect, rect2: DOMRect): boolean {
  const dy = rect2.top - rect1.top;
  return Math.abs(dy) < rect1.height * 0.5;
}

export function isSameColumn(rect1: DOMRect, rect2: DOMRect): boolean {
  const dx = rect2.left - rect1.left;
  return Math.abs(dx) < rect1.width * 0.5;
}

export function overlapsVertically(rect1: DOMRect, rect2: DOMRect): boolean {
  return rect2.top < rect1.bottom && rect2.bottom > rect1.top;
}

export function overlapsHorizontally(rect1: DOMRect, rect2: DOMRect): boolean {
  return rect2.left < rect1.right && rect2.right > rect1.left;
}

export function isInDirection(
  from: DOMRect,
  to: DOMRect,
  direction: Direction
): boolean {
  if (direction === 'back') return false;
  const { dx, dy } = getDistance(from, to);
  const tolerance = 5; // Small tolerance for elements at almost same level

  let result = false;
  switch (direction) {
    case 'right':
      result = dx > -tolerance; // Allow slightly left or right
      break;
    case 'left':
      result = dx < tolerance; // Allow slightly right or left
      break;
    case 'down':
      result = dy > -tolerance; // Allow slightly above or below
      break;
    case 'up':
      result = dy < tolerance; // Allow slightly below or above
      break;
  }

  return result;
}

export function getRowKey(rect: DOMRect, bucketSize: number = 50): number {
  return Math.round(rect.top / bucketSize);
}

export function getColumnKey(rect: DOMRect, bucketSize: number = 50): number {
  return Math.round(rect.left / bucketSize);
}
