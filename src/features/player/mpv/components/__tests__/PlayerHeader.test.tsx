import { render } from '@testing-library/react';
import { PlayerHeader } from '../PlayerHeader';

jest.mock('../../mpv.utils', () => ({
  formatEPGTime: jest.fn(() => '12:00'),
  getResolutionLabel: jest.fn(() => '1080p'),
}));

describe('PlayerHeader', () => {
  it('should render without crashing', () => {
    const { container } = render(
      <PlayerHeader
        name="Test Channel"
        streamState="playing"
        usingMpv={true}
        videoParams={{ width: 1920, height: 1080, fps: 30 }}
        totalRetries={0}
        currentUrlIdx={0}
        urlCount={1}
        currentProgram={null}
        isVod={false}
        isLoading={false}
        statusMsg=""
        isFullscreen={false}
        showUi={true}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('should render channel name', () => {
    const { getByText } = render(
      <PlayerHeader
        name="Test Channel"
        streamState="playing"
        usingMpv={true}
        videoParams={null}
        totalRetries={0}
        currentUrlIdx={0}
        urlCount={1}
        currentProgram={null}
        isVod={false}
        isLoading={false}
        statusMsg=""
        isFullscreen={false}
        showUi={true}
      />
    );

    expect(getByText('Test Channel')).toBeInTheDocument();
  });
});
