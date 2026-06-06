import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../theme-provider';

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render children', () => {
    render(
      <ThemeProvider>
        <div>Test Child</div>
      </ThemeProvider>
    );
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('should provide theme context', () => {
    const TestComponent = () => {
      const { theme } = useTheme();
      return <div>Current theme: {theme}</div>;
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByText('Current theme: dark')).toBeInTheDocument();
  });

  it('should allow changing theme', () => {
    const TestComponent = () => {
      const { theme, setTheme } = useTheme();
      return (
        <div>
          <div>Current theme: {theme}</div>
          <button onClick={() => setTheme('light')}>Change to light</button>
        </div>
      );
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByText('Current theme: dark')).toBeInTheDocument();

    act(() => {
      screen.getByText('Change to light').click();
    });

    expect(screen.getByText('Current theme: light')).toBeInTheDocument();
  });

  it('should use default theme when localStorage is empty', () => {
    const TestComponent = () => {
      const { theme } = useTheme();
      return <div>Current theme: {theme}</div>;
    };

    render(
      <ThemeProvider defaultTheme="light">
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByText('Current theme: light')).toBeInTheDocument();
  });

  it('should read theme from localStorage', () => {
    localStorage.setItem('iptv-thunder-ui-theme', 'light');

    const TestComponent = () => {
      const { theme } = useTheme();
      return <div>Current theme: {theme}</div>;
    };

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByText('Current theme: light')).toBeInTheDocument();
  });

  it('should support system theme', () => {
    const TestComponent = () => {
      const { theme, setTheme } = useTheme();
      return (
        <div>
          <div>Current theme: {theme}</div>
          <button onClick={() => setTheme('system')}>Use system</button>
        </div>
      );
    };

    // Mock matchMedia
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    act(() => {
      screen.getByText('Use system').click();
    });

    expect(screen.getByText('Current theme: system')).toBeInTheDocument();
  });
});
