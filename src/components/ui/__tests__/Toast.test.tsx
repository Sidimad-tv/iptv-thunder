import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '../Toast';

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('ToastProvider', () => {
    it('should render children', () => {
      render(
        <ToastProvider>
          <div>Test Child</div>
        </ToastProvider>
      );
      expect(screen.getByText('Test Child')).toBeInTheDocument();
    });

    it('should render toast notifications', () => {
      const TestComponent = () => {
        const { showToast } = useToast();
        return (
          <button onClick={() => showToast('Test message', 'info')}>
            Show Toast
          </button>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show Toast'));
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should remove toast after duration', () => {
      const TestComponent = () => {
        const { showToast } = useToast();
        return (
          <button onClick={() => showToast('Test message', 'info', 1000)}>
            Show Toast
          </button>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show Toast'));
      expect(screen.getByText('Test message')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(1000 + 300); // Duration + animation time
      });

      expect(screen.queryByText('Test message')).not.toBeInTheDocument();
    });

    it('should limit to max toasts', () => {
      const TestComponent = () => {
        const { showToast } = useToast();
        return (
          <button onClick={() => showToast('Test message', 'info')}>
            Show Toast
          </button>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      // Add 6 toasts (MAX_TOASTS is 5)
      for (let i = 0; i < 6; i++) {
        fireEvent.click(screen.getByText('Show Toast'));
      }

      // Should only have 5 toasts visible
      const toasts = screen.getAllByText('Test message');
      expect(toasts).toHaveLength(5);
    });
  });

  describe('useToast hook', () => {
    it('should throw error when used outside ToastProvider', () => {
      const TestComponent = () => {
        useToast();
        return <div>Test</div>;
      };

      expect(() => render(<TestComponent />)).toThrow('useToast must be used within a ToastProvider');
    });

    it('should provide showToast function', () => {
      const TestComponent = () => {
        const { showToast } = useToast();
        return <button onClick={() => showToast('Success!', 'success')}>Show</button>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show'));
      expect(screen.getByText('Success!')).toBeInTheDocument();
    });

    it('should provide removeToast function', () => {
      const TestComponent = () => {
        const { showToast, removeToast } = useToast();
        return (
          <>
            <button onClick={() => showToast('Test', 'info')}>Show</button>
            <button onClick={() => removeToast('toast-0')}>Remove</button>
          </>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show'));
      expect(screen.getByText('Test')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Remove'));

      act(() => {
        jest.advanceTimersByTime(300); // Wait for animation
      });

      expect(screen.queryByText('Test')).not.toBeInTheDocument();
    });

    it('should provide clearToasts function', () => {
      const TestComponent = () => {
        const { showToast, clearToasts } = useToast();
        return (
          <>
            <button onClick={() => showToast('Test', 'info')}>Show</button>
            <button onClick={clearToasts}>Clear</button>
          </>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show'));
      expect(screen.getByText('Test')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Clear'));
      expect(screen.queryByText('Test')).not.toBeInTheDocument();
    });

    it('should support different toast types', () => {
      const TestComponent = () => {
        const { showToast } = useToast();
        return (
          <>
            <button data-testid="success-btn" onClick={() => showToast('Success', 'success')}>Success</button>
            <button data-testid="error-btn" onClick={() => showToast('Error', 'error')}>Error</button>
            <button data-testid="info-btn" onClick={() => showToast('Info', 'info')}>Info</button>
          </>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('success-btn'));
      expect(screen.getByRole('alert')).toHaveTextContent('Success');

      fireEvent.click(screen.getByTestId('error-btn'));
      expect(screen.getAllByRole('alert')[1]).toHaveTextContent('Error');

      fireEvent.click(screen.getByTestId('info-btn'));
      expect(screen.getAllByRole('alert')[2]).toHaveTextContent('Info');
    });
  });

  describe('ToastItem', () => {
    it('should have close button', () => {
      const TestComponent = () => {
        const { showToast } = useToast();
        return <button onClick={() => showToast('Test', 'info')}>Show</button>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show'));

      const closeButton = screen.getByLabelText('Close notification');
      expect(closeButton).toBeInTheDocument();
    });

    it('should remove toast when close button is clicked', () => {
      const TestComponent = () => {
        const { showToast } = useToast();
        return <button onClick={() => showToast('Test', 'info')}>Show</button>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show'));
      expect(screen.getByText('Test')).toBeInTheDocument();

      const closeButton = screen.getByLabelText('Close notification');
      fireEvent.click(closeButton);

      act(() => {
        jest.advanceTimersByTime(300); // Wait for animation
      });

      expect(screen.queryByText('Test')).not.toBeInTheDocument();
    });
  });
});
