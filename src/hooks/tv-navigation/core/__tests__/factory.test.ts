import { createNavigation, CreateNavigationOptions } from '../factory';
import { NavigationConfig, NavigationPlugin } from '../types';

describe('factory', () => {
  describe('createNavigation', () => {
    it('should create navigation engine with rule engine plugin', () => {
      const config: NavigationConfig = { rules: [] };
      const options: CreateNavigationOptions = { config };

      const engine = createNavigation(options);

      expect(engine.plugins).toHaveLength(1);
      expect(engine.plugins[0].name).toBe('ruleEngine');
    });

    it('should create navigation engine with custom plugins', () => {
      const config: NavigationConfig = { rules: [] };
      const customPlugin: NavigationPlugin = {
        name: 'custom',
        findNext: jest.fn(),
      };
      const options: CreateNavigationOptions = { config, plugins: [customPlugin] };

      const engine = createNavigation(options);

      expect(engine.plugins).toHaveLength(2);
      expect(engine.plugins[0].name).toBe('ruleEngine');
      expect(engine.plugins[1].name).toBe('custom');
    });

    it('should allow adding plugins dynamically', () => {
      const config: NavigationConfig = { rules: [] };
      const options: CreateNavigationOptions = { config };

      const engine = createNavigation(options);
      const newPlugin: NavigationPlugin = {
        name: 'new',
        findNext: jest.fn(),
      };

      engine.addPlugin(newPlugin);

      expect(engine.plugins).toHaveLength(2);
      expect(engine.plugins[1].name).toBe('new');
    });

    it('should handle empty plugins array', () => {
      const config: NavigationConfig = { rules: [] };
      const options: CreateNavigationOptions = { config, plugins: [] };

      const engine = createNavigation(options);

      expect(engine.plugins).toHaveLength(1);
      expect(engine.plugins[0].name).toBe('ruleEngine');
    });

    it('should handle multiple custom plugins', () => {
      const config: NavigationConfig = { rules: [] };
      const plugin1: NavigationPlugin = {
        name: 'plugin1',
        findNext: jest.fn(),
      };
      const plugin2: NavigationPlugin = {
        name: 'plugin2',
        findNext: jest.fn(),
      };
      const plugin3: NavigationPlugin = {
        name: 'plugin3',
        findNext: jest.fn(),
      };
      const options: CreateNavigationOptions = { config, plugins: [plugin1, plugin2, plugin3] };

      const engine = createNavigation(options);

      expect(engine.plugins).toHaveLength(4);
      expect(engine.plugins[0].name).toBe('ruleEngine');
      expect(engine.plugins[1].name).toBe('plugin1');
      expect(engine.plugins[2].name).toBe('plugin2');
      expect(engine.plugins[3].name).toBe('plugin3');
    });
  });
});
