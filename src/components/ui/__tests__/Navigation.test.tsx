import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Navigation, NavigationItem } from '../Navigation';
import { useTranslation } from '@/hooks/useTranslation';

// Mock useTranslation
jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: jest.fn(),
}));

// Mock Tauri API
jest.mock('@tauri-apps/plugin-process', () => ({
  exit: jest.fn().mockResolvedValue(undefined),
}));

describe('Navigation', () => {
  const mockT = jest.fn((key: string) => {
    const translations: Record<string, string> = {
      player: 'Odtwarzacz',
      active: 'Aktywny',
      exit: 'Wyjdź',
    };
    return translations[key] || key;
  });

  const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTranslation.mockReturnValue({
      t: mockT,
      currentLang: 'pl',
      changeLanguage: jest.fn(),
      isLoading: false,
    } as any);
  });

  const defaultItems: NavigationItem[] = [
    { id: 'tv', label: 'TV', icon: '📺', active: false },
    { id: 'movies', label: 'Filmy', icon: '🎬', active: false },
    { id: 'series', label: 'Seriale', icon: '📺', active: false },
  ];

  it('should render navigation with title', () => {
    render(<Navigation items={defaultItems} />);

    expect(screen.getByAltText('IPTV Thunder')).toBeInTheDocument();
    expect(screen.getByText('Wyjdź')).toBeInTheDocument();
  });

  it('should render navigation items', () => {
    render(<Navigation items={defaultItems} />);

    expect(screen.getByText('TV')).toBeInTheDocument();
    expect(screen.getByText('Filmy')).toBeInTheDocument();
    expect(screen.getByText('Seriale')).toBeInTheDocument();
  });

  it('should render icons', () => {
    render(<Navigation items={defaultItems} />);

    // Header has 📺 and navigation items have icons too
    expect(screen.getAllByText('📺').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('🎬')).toBeInTheDocument();
  });

  it('should highlight active item', () => {
    const items: NavigationItem[] = [
      { id: 'tv', label: 'TV', icon: '📺', active: true },
      { id: 'movies', label: 'Filmy', icon: '🎬', active: false },
    ];

    const { container } = render(<Navigation items={items} />);

    const buttons = container.querySelectorAll('button');
    const activeButton = Array.from(buttons).find(btn =>
      btn.textContent?.includes('TV')
    );

    expect(activeButton).toHaveClass('bg-green-700/90');
  });

  it('should call onClick when item clicked', () => {
    const onClick = jest.fn();
    const items: NavigationItem[] = [
      { id: 'tv', label: 'TV', icon: '📺', onClick },
    ];

    render(<Navigation items={items} />);

    fireEvent.click(screen.getByText('TV'));
    expect(onClick).toHaveBeenCalled();
  });

  it('should render disabled items', () => {
    const items: NavigationItem[] = [
      { id: 'tv', label: 'TV', icon: '📺', disabled: true },
    ];

    const { container } = render(<Navigation items={items} />);

    const button = container.querySelector('button');
    expect(button).toBeDisabled();
  });

  it('should render subItems', () => {
    const items: NavigationItem[] = [
      {
        id: 'tv',
        label: 'TV',
        icon: '📺',
        subItems: [
          { id: 'live', label: 'Na żywo', onClick: jest.fn() },
          { id: 'epg', label: 'Program', onClick: jest.fn() },
        ],
      },
    ];

    render(<Navigation items={items} />);

    const mainButton = screen.getByText('TV');
    fireEvent.click(mainButton);

    expect(screen.getByText('Na żywo')).toBeInTheDocument();
    expect(screen.getByText('Program')).toBeInTheDocument();
  });


  it('should render close button', () => {
    render(<Navigation items={defaultItems} />);

    expect(screen.getByText('Wyjdź')).toBeInTheDocument();
  });

  it('should have close button with correct styling', () => {
    const { container } = render(<Navigation items={defaultItems} />);

    const closeButton = container.querySelector('[data-tv-focusable]');
    // Close button should have data-tv-focusable attribute
    expect(closeButton).toBeInTheDocument();
  });

  it('should apply TV navigation attributes', () => {
    const { container } = render(<Navigation items={defaultItems} />);

    const focusableElements = container.querySelectorAll('[data-tv-focusable]');
    expect(focusableElements.length).toBeGreaterThan(0);
  });

  describe('submenu interaction', () => {
    it('should expand/collapse submenu on click', async () => {
      const subItemClick = jest.fn();
      const items: NavigationItem[] = [
        {
          id: 'tv',
          label: 'TV',
          icon: '📺',
          subItems: [
            { id: 'live', label: 'Na żywo', onClick: subItemClick },
          ],
        },
      ];

      render(<Navigation items={items} />);

      // Initially submenu should not be visible
      expect(screen.queryByText('Na żywo')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByText('TV'));
      expect(screen.getByText('Na żywo')).toBeInTheDocument();

      // Click again to collapse
      fireEvent.click(screen.getByText('TV'));
      // AnimatePresence keeps elements in DOM during exit animation,
      // so we use waitFor to wait for the element to be removed
      await waitFor(() => {
        expect(screen.queryByText('Na żywo')).not.toBeInTheDocument();
      });
    });

    it('should call subItem onClick when clicked', () => {
      const subItemClick = jest.fn();
      const items: NavigationItem[] = [
        {
          id: 'tv',
          label: 'TV',
          icon: '📺',
          subItems: [
            { id: 'live', label: 'Na żywo', onClick: subItemClick },
          ],
        },
      ];

      render(<Navigation items={items} />);

      fireEvent.click(screen.getByText('TV'));
      fireEvent.click(screen.getByText('Na żywo'));

      expect(subItemClick).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper button roles', () => {
      render(<Navigation items={defaultItems} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should have tabIndex on focusable elements', () => {
      const { container } = render(<Navigation items={defaultItems} />);

      const focusableElements = container.querySelectorAll('[tabindex="0"]');
      expect(focusableElements.length).toBeGreaterThan(0);
    });
  });

  describe('footer', () => {
    it('should render version info', () => {
      render(<Navigation items={defaultItems} />);

      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    });

    it('should have decorative dots', () => {
      const { container } = render(<Navigation items={defaultItems} />);

      // Find the footer section
      const footer = container.querySelector('.border-t');
      expect(footer).toBeInTheDocument();
    });
  });
});
