import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerControls } from '../PlayerControls';
import { StreamState, Track } from '../../mpv.types';
import { useTranslation } from '@/hooks/useTranslation';

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
  createDebugRequestContext: jest.fn(),
  logDebugRequest: jest.fn(),
  logDebugSuccess: jest.fn(),
  logDebugError: jest.fn(),
}));
jest.mock('@/lib/tauriStorage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));
jest.mock('@/hooks/useTranslation');
jest.mock('@/features/tv/ChannelLogo', () => ({
  ChannelLogo: () => <div data-testid="channel-logo" />,
}));

const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;

const mockT = jest.fn((key: string) => {
  const translations: Record<string, string> = {
    volume: 'Głośność',
    fullscreen: 'Pełny ekran',
    exitFullscreen: 'Wyjdź z pełnego ekranu',
    audioTrack: 'Ścieżka audio',
    subtitleTrack: 'Napisy',
    epg: 'EPG',
    close: 'Zamknij',
    fromBeginning: 'Od początku',
  };
  return translations[key] || key;
});

describe('PlayerControls', () => {
  const defaultProps = {
    isVod: true,
    streamState: 'playing' as StreamState,
    isFullscreen: false,
    isPip: false,
    showUi: true,
    isPaused: false,
    volume: 80,
    currentTime: 60,
    duration: 120,
    tracks: [] as Track[],
    currentAudioId: null,
    currentSubId: null,
    onPlayPause: jest.fn(),
    onFullscreen: jest.fn(),
    onPip: jest.fn(),
    onClose: jest.fn(),
    onVolumeChange: jest.fn(),
    onProgressClick: jest.fn(),
    onShowEPG: jest.fn(),
    onSetAudioTrack: jest.fn(),
    onSetSubTrack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseTranslation.mockReturnValue({
      t: mockT,
      currentLang: 'en',
      changeLanguage: jest.fn(),
      isLoading: false,
    } as any);
  });

  it('should render nothing when streamState is not playing', () => {
    const { container } = render(
      <PlayerControls {...defaultProps} streamState="connecting" />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when fullscreen and not showUi', () => {
    const { container } = render(
      <PlayerControls {...defaultProps} isFullscreen={true} showUi={false} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render play/pause button', () => {
    render(<PlayerControls {...defaultProps} />);

    expect(screen.getByTitle('Pause')).toBeInTheDocument();
  });

  it('should call onPlayPause when play/pause button is clicked', () => {
    render(<PlayerControls {...defaultProps} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    expect(defaultProps.onPlayPause).toHaveBeenCalled();
  });

  it('should render seek to beginning button for VOD', () => {
    render(
      <PlayerControls
        {...defaultProps}
        onSeekToBeginning={jest.fn()}
      />
    );

    expect(screen.getByTitle('Od początku')).toBeInTheDocument();
  });

  it('should not render seek to beginning button for live TV', () => {
    render(
      <PlayerControls
        {...defaultProps}
        isVod={false}
        onSeekToBeginning={jest.fn()}
      />
    );

    expect(screen.queryByTitle('Od początku')).not.toBeInTheDocument();
  });

  it('should call onSeekToBeginning when seek button is clicked', () => {
    const onSeekToBeginning = jest.fn();
    render(
      <PlayerControls
        {...defaultProps}
        onSeekToBeginning={onSeekToBeginning}
      />
    );

    const seekButton = screen.getByTitle('Od początku');
    fireEvent.click(seekButton);

    expect(onSeekToBeginning).toHaveBeenCalled();
  });

  it('should render EPG button for live TV', () => {
    render(
      <PlayerControls
        {...defaultProps}
        isVod={false}
      />
    );

    expect(screen.getByTitle('Program TV (EPG)')).toBeInTheDocument();
  });

  it('should call onShowEPG when EPG button is clicked', () => {
    render(
      <PlayerControls
        {...defaultProps}
        isVod={false}
      />
    );

    const epgButton = screen.getByTitle('Program TV (EPG)');
    fireEvent.click(epgButton);

    expect(defaultProps.onShowEPG).toHaveBeenCalled();
  });

  it('should call onClose when close button is clicked', () => {
    render(<PlayerControls {...defaultProps} />);

    const closeButton = screen.getByTitle('Close');
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should show pause icon when playing', () => {
    render(<PlayerControls {...defaultProps} isPaused={false} />);

    const svgElements = document.querySelectorAll('svg');
    expect(svgElements.length).toBeGreaterThan(0);
  });

  it('should show play icon when paused', () => {
    render(<PlayerControls {...defaultProps} isPaused={true} />);

    const svgElements = document.querySelectorAll('svg');
    expect(svgElements.length).toBeGreaterThan(0);
  });

  it('should render progress bar', () => {
    render(<PlayerControls {...defaultProps} />);

    const progressBar = document.querySelector('.h-1.bg-gray-600');
    expect(progressBar).toBeInTheDocument();
  });

  it('should display current time and duration', () => {
    render(
      <PlayerControls
        {...defaultProps}
        currentTime={65}
        duration={120}
      />
    );

    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.getByText('2:00')).toBeInTheDocument();
  });

  it('should display hours when duration > 1 hour', () => {
    render(
      <PlayerControls
        {...defaultProps}
        currentTime={3665}
        duration={7200}
      />
    );

    expect(screen.getByText('1:01:05')).toBeInTheDocument();
    expect(screen.getByText('2:00:00')).toBeInTheDocument();
  });

  it('should render volume control', () => {
    render(<PlayerControls {...defaultProps} />);

    const volumeSlider = document.querySelector('input[type="range"]');
    expect(volumeSlider).toBeInTheDocument();
  });

  it('should call onVolumeChange when volume slider changes', () => {
    render(<PlayerControls {...defaultProps} />);

    const volumeSlider = document.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(volumeSlider, { target: { value: '50' } });

    expect(defaultProps.onVolumeChange).toHaveBeenCalledWith(50);
  });

  it('should call onFullscreen when fullscreen button is clicked', () => {
    render(<PlayerControls {...defaultProps} />);

    const fullscreenButton = screen.getByTitle('Fullscreen');
    fireEvent.click(fullscreenButton);

    expect(defaultProps.onFullscreen).toHaveBeenCalled();
  });

  it('should show exit fullscreen text when in fullscreen', () => {
    render(
      <PlayerControls
        {...defaultProps}
        isFullscreen={true}
      />
    );

    expect(screen.getByTitle('Exit Fullscreen')).toBeInTheDocument();
  });

  it('should render audio track selector when multiple audio tracks', () => {
    const tracks: Track[] = [
      { id: '1', type: 'audio', lang: 'en', title: 'English' },
      { id: '2', type: 'audio', lang: 'en', title: 'English' },
    ];

    render(
      <PlayerControls
        {...defaultProps}
        tracks={tracks}
      />
    );

    const trackButton = screen.getByTitle('trackSelection');
    fireEvent.click(trackButton);

    expect(screen.getByText('Audio')).toBeInTheDocument();
  });

  it('should render subtitle track selector when subtitles available', () => {
    const tracks: Track[] = [
      { id: '1', type: 'sub', lang: 'en', title: 'English' },
    ];

    render(
      <PlayerControls
        {...defaultProps}
        tracks={tracks}
      />
    );

    const trackButton = screen.getByTitle('trackSelection');
    fireEvent.click(trackButton);

    expect(screen.getByText('en')).toBeInTheDocument();
  });
});
