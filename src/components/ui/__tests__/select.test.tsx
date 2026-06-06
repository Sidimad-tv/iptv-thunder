import { render, screen } from '@testing-library/react';
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from '../select';

describe('Select components', () => {
  describe('SelectTrigger', () => {
    it('should render trigger with children', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
        </Select>
      );
      expect(screen.getByText('Select an option')).toBeInTheDocument();
    });
  });

  describe('SelectItem', () => {
    it('should render item text', () => {
      render(
        <Select>
          <SelectContent>
            <SelectItem value="item1">Item 1</SelectItem>
          </SelectContent>
        </Select>
      );
      expect(screen.getByText('Item 1')).toBeInTheDocument();
    });
  });

  describe('SelectValue', () => {
    it('should render placeholder', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Choose an option" />
          </SelectTrigger>
        </Select>
      );
      expect(screen.getByText('Choose an option')).toBeInTheDocument();
    });
  });
});
