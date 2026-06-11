import { render } from '@testing-library/react';
import { PortalList } from '../PortalList';
import { usePortalsStore } from '@/store/portals.store';
import { useTranslation } from '@/hooks/useTranslation';

jest.mock('@/store/portals.store', () => ({
  usePortalsStore: jest.fn(),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('../PortalForm', () => ({
  PortalForm: () => <div>PortalForm</div>,
}));

jest.mock('../PortalTest', () => ({
  PortalTest: () => <div>PortalTest</div>,
}));

jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

jest.mock('@/utils/portalImporter', () => ({
  fetchLatestBlogPortals: jest.fn(),
  fetchPortalsFromUrl: jest.fn(),
  getSavedImportUrls: jest.fn().mockReturnValue([]),
  addSavedImportUrl: jest.fn(),
  removeSavedImportUrl: jest.fn(),
  getBlogSources: jest.fn().mockReturnValue([]),
  addBlogSource: jest.fn(),
  removeBlogSource: jest.fn(),
  exportBlogSources: jest.fn(),
  importBlogSources: jest.fn(),
  DEFAULT_BLOG_POSTS: [],
}));

jest.mock('lucide-react', () => ({
  CheckCircle: 'svg',
  Circle: 'svg',
  Plus: 'svg',
  Target: 'svg',
  RefreshCw: 'svg',
  Edit: 'svg',
  Trash2: 'svg',
  X: 'svg',
  Globe: 'svg',
  User: 'svg',
  Monitor: 'svg',
  Download: 'svg',
  Upload: 'svg',
  History: 'svg',
  Trash: 'svg',
  Save: 'svg',
}));

const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;
const mockUsePortalsStore = usePortalsStore as jest.MockedFunction<typeof usePortalsStore>;

describe('PortalList', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseTranslation.mockReturnValue({
      t: (key: string) => key,
      language: 'en',
    } as any);

    mockUsePortalsStore.mockReturnValue({
      portals: [
        {
          id: '1',
          name: 'Test Portal',
          login: 'test',
          password: 'test',
          portalUrl: 'http://test.com',
          mac: '00:1A:79:00:00:01',
          isActive: true,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
      activePortalId: '1',
      deletePortal: jest.fn(),
      setActivePortal: jest.fn(),
    } as any);
  });

  it('should render without crashing', () => {
    const { container } = render(<PortalList />);
    expect(container).toBeInTheDocument();
  });

  it('should render portal items', () => {
    const { getByText } = render(<PortalList />);
    expect(getByText('Test Portal')).toBeInTheDocument();
  });

  it('should render add portal button', () => {
    const { getByText } = render(<PortalList />);
    expect(getByText('addPortal')).toBeInTheDocument();
  });
});
