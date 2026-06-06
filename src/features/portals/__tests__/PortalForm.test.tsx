import { render, screen, fireEvent } from '@testing-library/react';
import { PortalForm } from '../PortalForm';
import { PortalAccount } from '../portals.types';
import { usePortalsStore } from '@/store/portals.store';
import { useToast } from '@/components/ui/Toast';
import { useTranslation, useTVNavigation } from '@/hooks';

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
jest.mock('@/store/portals.store');
jest.mock('@/components/ui/Toast');
jest.mock('@/hooks');

const mockUsePortalsStore = usePortalsStore as jest.MockedFunction<typeof usePortalsStore>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;
const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;
const mockUseTVNavigation = useTVNavigation as jest.MockedFunction<typeof useTVNavigation>;

const mockT = jest.fn((key: string) => {
  const translations: Record<string, string> = {
    addPortal: 'Dodaj portal',
    editPortal: 'Edytuj portal',
    name: 'Nazwa',
    login: 'Login',
    password: 'Hasło',
    portalUrl: 'URL portalu',
    mac: 'Adres MAC',
    description: 'Opis',
    save: 'Zapisz',
    cancel: 'Anuluj',
    nameRequired: 'Nazwa jest wymagana',
    portalUrlRequired: 'URL portalu jest wymagany',
    macRequired: 'Adres MAC jest wymagany',
    invalidUrl: 'Nieprawidłowy URL',
  };
  return translations[key] || key;
});

describe('PortalForm', () => {
  const mockOnClose = jest.fn();
  const mockAddPortal = jest.fn();
  const mockUpdatePortal = jest.fn();
  const mockShowToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseTranslation.mockReturnValue({
      t: mockT,
      currentLang: 'pl',
      changeLanguage: jest.fn(),
      isLoading: false,
    } as any);

    mockUseToast.mockReturnValue({
      showToast: mockShowToast,
    } as any);

    mockUseTVNavigation.mockReturnValue({
      setActiveContainer: jest.fn(),
    } as any);

    mockUsePortalsStore.mockReturnValue({
      addPortal: mockAddPortal,
      updatePortal: mockUpdatePortal,
      portals: [],
    } as any);
  });

  it('should render add portal form', () => {
    render(<PortalForm onClose={mockOnClose} />);

    expect(screen.getByText('addNewPortal')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('np. Mój Portal IPTV')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('http://portal.example.com/')).toBeInTheDocument();
  });

  it('should render edit portal form when portal is provided', () => {
    const mockPortal: PortalAccount = {
      id: 'test-id',
      name: 'Test Portal',
      login: '',
      password: '',
      portalUrl: 'http://test.com',
      mac: '00:1A:79:AA:BB:CC',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      description: 'Test description',
    };

    render(<PortalForm portal={mockPortal} onClose={mockOnClose} />);

    expect(screen.getByText('Edytuj portal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Portal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('http://test.com')).toBeInTheDocument();
  });

  it('should update form state when input changes', () => {
    render(<PortalForm onClose={mockOnClose} />);

    const nameInput = screen.getByPlaceholderText('np. Mój Portal IPTV');
    fireEvent.change(nameInput, { target: { value: 'New Portal' } });

    expect(screen.getByDisplayValue('New Portal')).toBeInTheDocument();
  });

  it('should show validation error when name is empty', () => {
    render(<PortalForm onClose={mockOnClose} />);

    const urlInput = screen.getByPlaceholderText('http://portal.example.com/');
    fireEvent.change(urlInput, { target: { value: 'http://test.com' } });

    const saveButton = screen.getByText('add');
    fireEvent.click(saveButton);

    expect(mockAddPortal).not.toHaveBeenCalled();
  });

  it('should show validation error when portal URL is empty', () => {
    render(<PortalForm onClose={mockOnClose} />);

    const nameInput = screen.getByPlaceholderText('np. Mój Portal IPTV');
    fireEvent.change(nameInput, { target: { value: 'Test Portal' } });

    const urlInput = screen.getByPlaceholderText('http://portal.example.com/');
    fireEvent.change(urlInput, { target: { value: '' } });

    const saveButton = screen.getByText('add');
    fireEvent.click(saveButton);

    expect(mockAddPortal).not.toHaveBeenCalled();
  });

  it('should show validation error for invalid URL', () => {
    render(<PortalForm onClose={mockOnClose} />);

    const nameInput = screen.getByPlaceholderText('np. Mój Portal IPTV');
    fireEvent.change(nameInput, { target: { value: 'Test Portal' } });

    const urlInput = screen.getByPlaceholderText('http://portal.example.com/');
    fireEvent.change(urlInput, { target: { value: 'not a valid url' } });

    const saveButton = screen.getByText('add');
    fireEvent.click(saveButton);

    expect(mockAddPortal).not.toHaveBeenCalled();
  });

  it('should call addPortal with valid form data', () => {
    render(<PortalForm onClose={mockOnClose} />);

    const nameInput = screen.getByPlaceholderText('np. Mój Portal IPTV');
    fireEvent.change(nameInput, { target: { value: 'Test Portal' } });

    const urlInput = screen.getByPlaceholderText('http://portal.example.com/');
    fireEvent.change(urlInput, { target: { value: 'http://test.com' } });

    const macInput = screen.getByDisplayValue('00:1A:79:');
    fireEvent.change(macInput, { target: { value: '00:1A:79:AA:BB:CC' } });

    const saveButton = screen.getByText('add');
    fireEvent.click(saveButton);

    expect(mockAddPortal).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Portal',
        portalUrl: 'http://test.com',
        mac: '00:1A:79:AA:BB:CC',
      })
    );
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call updatePortal when editing existing portal', () => {
    const mockPortal: PortalAccount = {
      id: 'test-id',
      name: 'Test Portal',
      login: '',
      password: '',
      portalUrl: 'http://test.com',
      mac: '00:1A:79:AA:BB:CC',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(<PortalForm portal={mockPortal} onClose={mockOnClose} />);

    const nameInput = screen.getByDisplayValue('Test Portal');
    fireEvent.change(nameInput, { target: { value: 'Updated Portal' } });

    const saveButton = screen.getByText('Zapisz');
    fireEvent.click(saveButton);

    expect(mockUpdatePortal).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        name: 'Updated Portal',
      })
    );
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose when cancel button is clicked', () => {
    render(<PortalForm onClose={mockOnClose} />);

    const cancelButton = screen.getByText('Anuluj');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should show error toast when addPortal fails', async () => {
    mockAddPortal.mockRejectedValue(new Error('Failed to add portal'));

    render(<PortalForm onClose={mockOnClose} />);

    const nameInput = screen.getByPlaceholderText('np. Mój Portal IPTV');
    fireEvent.change(nameInput, { target: { value: 'Test Portal' } });

    const urlInput = screen.getByPlaceholderText('http://portal.example.com/');
    fireEvent.change(urlInput, { target: { value: 'http://test.com' } });

    const saveButton = screen.getByText('add');
    fireEvent.click(saveButton);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockShowToast).toHaveBeenCalled();
  });

  it('should pre-fill default MAC address', () => {
    render(<PortalForm onClose={mockOnClose} />);

    const macInput = screen.getByDisplayValue('00:1A:79:');
    expect(macInput).toBeInTheDocument();
  });

  it('should pre-fill default portal URL', () => {
    render(<PortalForm onClose={mockOnClose} />);

    const urlInput = screen.getByDisplayValue('http://');
    expect(urlInput).toBeInTheDocument();
  });
});
