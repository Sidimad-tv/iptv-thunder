import { render, screen, fireEvent } from '@testing-library/react';
import { DeadState } from '../DeadState';

describe('DeadState', () => {
  it('should render error message', () => {
    render(
      <DeadState
        errorMsg="Connection failed"
        onRetry={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Stream unavailable')).toBeInTheDocument();
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('should render without error message', () => {
    render(
      <DeadState
        errorMsg={null}
        onRetry={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Stream unavailable')).toBeInTheDocument();
  });

  it('should call onRetry when retry button is clicked', () => {
    const onRetry = jest.fn();
    render(
      <DeadState
        errorMsg={null}
        onRetry={onRetry}
        onClose={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <DeadState
        errorMsg={null}
        onRetry={jest.fn()}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
