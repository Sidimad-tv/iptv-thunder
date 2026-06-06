import { cn } from '../utils';

describe('cn (tailwind-merge utility)', () => {
  // Basic functionality
  it('should merge class names correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('should handle conditional classes', () => {
    expect(cn('class1', false, 'class3')).toBe('class1 class3');
  });

  it('should merge tailwind classes properly', () => {
    expect(cn('px-4 py-2', 'px-6')).toBe('py-2 px-6');
  });

  it('should handle undefined and null', () => {
    expect(cn('class1', undefined, null, 'class2')).toBe('class1 class2');
  });

  it('should handle empty strings', () => {
    expect(cn('', 'class1', '', 'class2')).toBe('class1 class2');
  });

  it('should return empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('should handle only falsy values', () => {
    expect(cn(false, undefined, null, 0, '')).toBe('');
  });

  // Tailwind class merging
  it('should merge conflicting margin classes', () => {
    expect(cn('m-4', 'm-8')).toBe('m-8');
  });

  it('should merge conflicting padding classes', () => {
    expect(cn('p-2', 'p-4', 'p-6')).toBe('p-6');
  });

  it('should merge text size classes', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });

  it('should merge color classes', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('should merge background color classes', () => {
    expect(cn('bg-red-500', 'bg-blue-600')).toBe('bg-blue-600');
  });

  it('should merge flexbox classes', () => {
    expect(cn('flex', 'block')).toBe('block');
  });

  it('should merge width classes', () => {
    expect(cn('w-full', 'w-64')).toBe('w-64');
  });

  it('should merge height classes', () => {
    expect(cn('h-full', 'h-32')).toBe('h-32');
  });

  // Complex scenarios
  it('should handle complex conditional classes', () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn(
      'base-class',
      isActive && 'active-class',
      isDisabled && 'disabled-class',
      'always-present'
    );
    expect(result).toBe('base-class active-class always-present');
  });

  it('should handle ternary operators', () => {
    const isDark = true;
    expect(cn(
      'base',
      isDark ? 'dark-mode' : 'light-mode'
    )).toBe('base dark-mode');
  });

  it('should handle array inputs', () => {
    expect(cn(['class1', 'class2'], 'class3')).toBe('class1 class2 class3');
  });

  it('should handle nested arrays', () => {
    expect(cn(['class1', ['class2', 'class3']], 'class4')).toBe('class1 class2 class3 class4');
  });

  it('should handle object syntax', () => {
    expect(cn({ 'active': true, 'disabled': false, 'loading': true })).toBe('active loading');
  });

  it('should merge arbitrary values', () => {
    expect(cn('w-[100px]', 'w-[200px]')).toBe('w-[200px]');
  });

  it('should handle responsive prefixes', () => {
    expect(cn('md:p-4', 'lg:p-8')).toBe('md:p-4 lg:p-8');
  });

  it('should merge same breakpoint classes', () => {
    expect(cn('md:p-4 md:m-2', 'md:p-8')).toBe('md:m-2 md:p-8');
  });

  it('should handle hover states', () => {
    expect(cn('hover:bg-red-500', 'hover:bg-blue-500')).toBe('hover:bg-blue-500');
  });

  it('should handle focus states', () => {
    expect(cn('focus:ring-2', 'focus:ring-4')).toBe('focus:ring-4');
  });

  // Real-world component scenarios
  it('should handle button classes', () => {
    const isPrimary = true;
    const isLarge = false;
    const isDisabled = false;

    const result = cn(
      'px-4 py-2 rounded font-medium transition-colors',
      isPrimary && 'bg-blue-500 text-white hover:bg-blue-600',
      !isPrimary && 'bg-gray-200 text-gray-800 hover:bg-gray-300',
      isLarge && 'text-lg px-6 py-3',
      isDisabled && 'opacity-50 cursor-not-allowed'
    );

    expect(result).toBe('px-4 py-2 rounded font-medium transition-colors bg-blue-500 text-white hover:bg-blue-600');
  });

  it('should handle card component classes', () => {
    const isHighlighted = true;
    const hasShadow = true;

    const result = cn(
      'bg-white rounded-lg p-6',
      isHighlighted && 'border-2 border-blue-500',
      hasShadow && 'shadow-lg',
      'hover:shadow-xl transition-shadow'
    );

    expect(result).toBe('bg-white rounded-lg p-6 border-2 border-blue-500 shadow-lg hover:shadow-xl transition-shadow');
  });

  it('should handle layout classes', () => {
    expect(cn(
      'flex flex-col',
      'md:flex-row',
      'gap-4',
      'items-start',
      'md:items-center'
    )).toBe('flex flex-col md:flex-row gap-4 items-start md:items-center');
  });

  // Edge cases
  it('should handle whitespace in class names', () => {
    expect(cn('  class1  ', '  class2  ')).toBe('class1 class2');
  });

  it('should handle duplicate class names (non-tailwind)', () => {
    // tailwind-merge doesn't deduplicate arbitrary class names
    expect(cn('class1', 'class1')).toBe('class1 class1');
  });

  it('should handle numbers as class values', () => {
    expect(cn(0, 1, 2)).toBe('1 2');
  });

  it('should handle important modifier with regular class', () => {
    // !p-4 (important) and p-8 are treated as different classes by tailwind-merge
    expect(cn('!p-4', 'p-8')).toBe('!p-4 p-8');
  });

  it('should handle arbitrary properties', () => {
    expect(cn('[color:red]', '[color:blue]')).toBe('[color:blue]');
  });
});
