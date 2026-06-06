import { useAppStore, initialState } from '../app.store';

describe('app.store', () => {
  beforeEach(() => {
    useAppStore.setState(initialState);
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = useAppStore.getState();
      expect(state.isFullscreen).toBe(false);
      expect(state.isPip).toBe(false);
    });
  });

  describe('setFullscreen', () => {
    it('should set fullscreen to true', () => {
      useAppStore.getState().setFullscreen(true);
      expect(useAppStore.getState().isFullscreen).toBe(true);
    });

    it('should set fullscreen to false', () => {
      useAppStore.setState({ isFullscreen: true });
      useAppStore.getState().setFullscreen(false);
      expect(useAppStore.getState().isFullscreen).toBe(false);
    });

    it('should toggle fullscreen', () => {
      expect(useAppStore.getState().isFullscreen).toBe(false);
      useAppStore.getState().setFullscreen(true);
      expect(useAppStore.getState().isFullscreen).toBe(true);
      useAppStore.getState().setFullscreen(false);
      expect(useAppStore.getState().isFullscreen).toBe(false);
    });
  });

  describe('setPip', () => {
    it('should set pip to true', () => {
      useAppStore.getState().setPip(true);
      expect(useAppStore.getState().isPip).toBe(true);
    });

    it('should set pip to false', () => {
      useAppStore.setState({ isPip: true });
      useAppStore.getState().setPip(false);
      expect(useAppStore.getState().isPip).toBe(false);
    });

    it('should toggle pip', () => {
      expect(useAppStore.getState().isPip).toBe(false);
      useAppStore.getState().setPip(true);
      expect(useAppStore.getState().isPip).toBe(true);
      useAppStore.getState().setPip(false);
      expect(useAppStore.getState().isPip).toBe(false);
    });
  });

  describe('fullscreen and pip together', () => {
    it('should handle both fullscreen and pip', () => {
      useAppStore.getState().setFullscreen(true);
      useAppStore.getState().setPip(true);
      
      const state = useAppStore.getState();
      expect(state.isFullscreen).toBe(true);
      expect(state.isPip).toBe(true);
    });

    it('should handle independent state changes', () => {
      useAppStore.getState().setFullscreen(true);
      expect(useAppStore.getState().isPip).toBe(false);
      
      useAppStore.getState().setPip(true);
      expect(useAppStore.getState().isFullscreen).toBe(true);
    });
  });
});
