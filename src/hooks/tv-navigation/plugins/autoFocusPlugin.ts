// PLUGIN - Auto Focus
// Automatically focuses initial element when new containers appear
// and restores focus when modals are closed

interface AutoFocusState {
  lastContainerIds: Set<string>;
  lastFocusedElement: HTMLElement | null;
  hadMovieDetails: boolean; // Track if we had MovieDetails previously
  isRestoringFocus: boolean; // Flag to prevent initial focus during restoration
  restoredElement: HTMLElement | null; // Track which element we restored focus to
}

const state: AutoFocusState = {
  lastContainerIds: new Set(),
  lastFocusedElement: null,
  hadMovieDetails: false,
  isRestoringFocus: false,
  restoredElement: null,
};

// Track if we're currently blocking focus events
let focusBlockActive = false;

// Function to block focus events during restoration
function blockFocusEvents() {
  if (focusBlockActive) return;
  focusBlockActive = true;
  
  const focusBlockHandler = (e: FocusEvent) => {
    if (!state.isRestoringFocus || !state.restoredElement) {
      focusBlockActive = false;
      document.removeEventListener('focusin', focusBlockHandler, true);
      return;
    }
    
    const target = e.target as HTMLElement;
    
    // If focus is trying to move somewhere other than our restored element, block it
    if (target !== state.restoredElement) {
        e.stopImmediatePropagation();
      e.preventDefault();
      state.restoredElement.focus();
      return false;
    }
  };
  
  document.addEventListener('focusin', focusBlockHandler, true);
  
  // Remove blocker after restoration period
  setTimeout(() => {
    focusBlockActive = false;
    document.removeEventListener('focusin', focusBlockHandler, true);
  }, 1100);
}

function getContainerId(container: HTMLElement): string {
  return container.id || container.dataset.tvContainer || '';
}

function findInitialElement(container: HTMLElement): HTMLElement | null {
  // When restoring focus, ignore data-tv-initial attribute
  if (state.isRestoringFocus) {
    return null;
  }
  const initialElement = container.querySelector('[data-tv-initial]') as HTMLElement;
  if (initialElement) {
    // Don't auto-focus for-you carousel elements - let containerPlugin handle it based on active nav
    const tvGroup = initialElement.closest('[data-tv-group]')?.getAttribute('data-tv-group');
    if (tvGroup?.startsWith('for-you-')) {
      return null;
    }
    return initialElement;
  }
  // Look for movie elements first (prioritize movies over search)
  const movieElement = container.querySelector('[data-tv-group="movies"][data-tv-focusable], [data-tv-group="favorite-movies"][data-tv-focusable]') as HTMLElement;
  if (movieElement) {
    return movieElement;
  }
  // Fallback to any focusable (but skip search input)
  const allFocusable = container.querySelectorAll('[data-tv-focusable]');
  for (const el of Array.from(allFocusable)) {
    const htmlEl = el as HTMLElement;
    if (!htmlEl.dataset.tvSearch) {
      return htmlEl;
    }
  }
  return null;
}

function focusInitialInContainer(container: HTMLElement, onFocused?: (el: HTMLElement) => void): void {
  // Skip initial focus if we're restoring focus (to prevent jumping to idx0)
  if (state.isRestoringFocus) {
    return;
  }
  const initialElement = findInitialElement(container);
  if (initialElement) {
    setTimeout(() => {
      initialElement.focus({ preventScroll: true });
      onFocused?.(initialElement);
    }, 50);
  }
}

function shouldApplyInitialFocus(activeElement: HTMLElement | null): boolean {
  // Don't apply initial focus if focus is already on a movie
  const focusedMovie = document.querySelector('[data-tv-group="movies"]:focus, [data-tv-group="series"]:focus');
  if (focusedMovie) {
    return false;
  }
  return !activeElement || activeElement === document.body;
}

function applyInitialFocus(containers: HTMLElement[]): HTMLElement | null {
  const navContainer = containers.find(c => getContainerId(c) === 'navigation');
  const mainContainer = containers.find(c => getContainerId(c) === 'main');
  const targetContainer = navContainer || mainContainer || containers[0];
  
  if (targetContainer) {
    let focusedElement: HTMLElement | null = null;
    focusInitialInContainer(targetContainer, (el) => {
      focusedElement = el;
    });
    return focusedElement;
  }
  return null;
}

interface MovieDetailsContext {
  movieDetailsElements: NodeListOf<HTMLElement>;
  activeElement: HTMLElement | null;
  hadMovieDetails: boolean;
  hasMovieDetailsNow: boolean;
  modalWasOpen: boolean;
}

function handleMovieDetailsOpening(ctx: MovieDetailsContext): boolean {
  const { movieDetailsElements, activeElement } = ctx;
  
  if (movieDetailsElements.length > 0 && activeElement?.matches('[data-tv-group="movies"], [data-tv-group="series"], [data-tv-group="favorite-movies"], [data-tv-group="favorite-series"]')) {
    state.lastFocusedElement = activeElement;
  }
  
  if (movieDetailsElements.length > 0) {
    // Focus the X button in MovieDetails
    const closeButton = document.querySelector('[data-tv-group="movie-details-close"]') as HTMLElement;
    if (closeButton) {
      setTimeout(() => closeButton.focus(), 100);
    }
    return true;
  }
  
  return false;
}

function createFocusVerificationInterval(removedInitials: { el: HTMLElement; hadInitial: boolean }[]): void {
  let checkCount = 0;
  const maxChecks = 5;
  const checkInterval = setInterval(() => {
    checkCount++;
    // Stop if we're no longer restoring focus (user navigated away)
    if (!state.isRestoringFocus) {
      clearInterval(checkInterval);
      return;
    }
    const currentActive = document.activeElement as HTMLElement;
    if (state.restoredElement && currentActive !== state.restoredElement) {
      state.restoredElement.focus();
    } else if (checkCount >= maxChecks) {
      clearInterval(checkInterval);
      state.isRestoringFocus = false;
      state.restoredElement = null;
      // Restore data-tv-initial attributes
      removedInitials.forEach(({ el }) => {
        el.dataset.tvInitial = 'true';
      });
    }
  }, 200);
}

function focusElementByTvId(tvId: string, removedInitials: { el: HTMLElement; hadInitial: boolean }[]): void {
  const newEl = document.querySelector(`[data-tv-id="${tvId}"]`) as HTMLElement;
  
  if (!newEl) return;
  
  const focusElement = () => {
    newEl.focus();
    state.restoredElement = newEl;
    (state as any).currentId = tvId;
    state.lastFocusedElement = null;
    (state as any).lastFocusedIndex = null;
    blockFocusEvents();
    createFocusVerificationInterval(removedInitials);
  };
  
  setTimeout(() => setTimeout(focusElement, 0), 50);
}

function focusElementByIndex(idx: string, removedInitials: { el: HTMLElement; hadInitial: boolean }[]): void {
  const groups = ['movies', 'series', 'favorite-movies', 'favorite-series'];
  const foundGroup = groups.find(group => {
    const el = document.querySelector(`[data-tv-group="${group}"][data-tv-index="${idx}"]`) as HTMLElement;
    return !!el;
  });

  if (!foundGroup) return;

  const newEl = document.querySelector(`[data-tv-group="${foundGroup}"][data-tv-index="${idx}"]`) as HTMLElement;
  const tvId = newEl.dataset.tvId;
  const indexNum = Number(idx);
  const baseDelay = indexNum > 50 ? 600 : 100;
  const secondDelay = indexNum > 50 ? 400 : 50;
  
  const focusAndVerifyByIndex = () => {
    newEl.focus();
    state.restoredElement = newEl;
    
    if (tvId) {
      (state as any).currentId = tvId;
    }
    state.lastFocusedElement = null;
    (state as any).lastFocusedIndex = null;
    blockFocusEvents();
    createFocusVerificationInterval(removedInitials);
  };
  
  const scrollThenFocusByIndex = () => {
    newEl.scrollIntoView({ behavior: 'auto', block: 'center' });
    setTimeout(focusAndVerifyByIndex, secondDelay);
  };
  
  setTimeout(scrollThenFocusByIndex, baseDelay);
}

function handleMovieDetailsClosing(ctx: MovieDetailsContext): boolean {
  const { hadMovieDetails, hasMovieDetailsNow } = ctx;
  
  if (!hadMovieDetails || hasMovieDetailsNow) {
    return false;
  }
  
  // Check if there are too many movies - disable focus restoration for performance
  const movieCount = document.querySelectorAll('[data-tv-group="movies"]').length;
  
  if (movieCount > 500) {
    state.lastFocusedElement = null;
    (state as any).lastFocusedIndex = null;
    return true;
  }
  
  // Restore focus to the previously focused element
  let idx = state.lastFocusedElement?.dataset.tvIndex;
  let tvId = state.lastFocusedElement?.dataset.tvId;
  
  // Fallback to saved index if no element
  if (!idx && (state as any).lastFocusedIndex) {
    idx = (state as any).lastFocusedIndex;
  }
  
  if (!tvId && !idx) {
    // Nothing to restore, allow initial focus
    state.isRestoringFocus = false;
    return true;
  }
  
  // Set flag to prevent initial focus from overriding our restoration
  state.isRestoringFocus = true;
  
  // Temporarily remove data-tv-initial from idx0 to prevent it stealing focus
  const idx0Elements = document.querySelectorAll('[data-tv-initial="true"]');
  const removedInitials: { el: HTMLElement; hadInitial: boolean }[] = [];
  idx0Elements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    removedInitials.push({ el: htmlEl, hadInitial: true });
    delete htmlEl.dataset.tvInitial;
  });
  
  let focused = false;
  
  // Try to find by data-tv-id first (most reliable, unique)
  if (tvId) {
    focusElementByTvId(tvId, removedInitials);
    focused = true;
  }
  
  // Fallback to index if id not found - try all relevant groups
  setTimeout(() => {
    if (!focused && idx) {
      focusElementByIndex(idx, removedInitials);
    }
    
    if (!focused) {
      state.isRestoringFocus = false;
    }
  }, 100);

  return true;
}

interface ContentElements {
  movieElements: NodeListOf<HTMLElement>;
  seriesElements: NodeListOf<HTMLElement>;
  favoriteMovieElements: NodeListOf<HTMLElement>;
  favoriteSeriesElements: NodeListOf<HTMLElement>;
  categoryCardsElements: NodeListOf<HTMLElement>;
  tvChannelElements: NodeListOf<HTMLElement>;
}

function getContentElements(mainContainer: HTMLElement): ContentElements {
  return {
    movieElements: mainContainer.querySelectorAll('[data-tv-group="movies"][data-tv-initial="true"]'),
    seriesElements: mainContainer.querySelectorAll('[data-tv-group="series"][data-tv-initial="true"]'),
    favoriteMovieElements: mainContainer.querySelectorAll('[data-tv-group="favorite-movies"][data-tv-initial="true"]'),
    favoriteSeriesElements: mainContainer.querySelectorAll('[data-tv-group="favorite-series"][data-tv-initial="true"]'),
    categoryCardsElements: mainContainer.querySelectorAll('[data-tv-group="category-cards"][data-tv-initial="true"]'),
    tvChannelElements: mainContainer.querySelectorAll('[data-tv-group="tv-channels"][data-tv-initial="true"]'),
  };
}

function hasAnyContent(elements: ContentElements): boolean {
  return elements.movieElements.length > 0 ||
         elements.seriesElements.length > 0 ||
         elements.favoriteMovieElements.length > 0 ||
         elements.favoriteSeriesElements.length > 0 ||
         elements.categoryCardsElements.length > 0 ||
         elements.tvChannelElements.length > 0;
}

function shouldFocusOnContent(activeElement: HTMLElement | null, _initialFocusElement: HTMLElement | null, initialFocusApplied: boolean): boolean {
  const categoryGroups = '[data-tv-group="movie-categories"], [data-tv-group="series-categories"], [data-tv-group="favorite-movie-categories"], [data-tv-group="favorite-series-categories"], [data-tv-group="category-cards"]';
  const contentGroups = '[data-tv-group="movies"], [data-tv-group="series"], [data-tv-group="favorite-movies"], [data-tv-group="favorite-series"], [data-tv-group="tv-channels"]';

  const isInNavigation = activeElement?.closest('[data-tv-container="navigation"]') !== null;
  const isFocusLost = initialFocusApplied && (!activeElement || activeElement === document.body);

  // Don't auto-focus to content if user is actively navigating in navbar
  const shouldFocus = (activeElement?.matches(categoryGroups) ||
                       isFocusLost) &&
                       !isInNavigation &&
                       !activeElement?.matches('[data-tv-group="movie-details"]') &&
                       !(activeElement?.matches(contentGroups) && activeElement?.dataset.tvInitial === 'true');

  return shouldFocus;
}

function focusContentElement(elements: ContentElements): void {
  if (elements.categoryCardsElements.length > 0) {
    const firstCard = elements.categoryCardsElements[0];
    setTimeout(() => firstCard.focus({ preventScroll: true }), 100);
  } else if (elements.favoriteSeriesElements.length > 0) {
    const firstSeries = elements.favoriteSeriesElements[0];
    setTimeout(() => firstSeries.focus({ preventScroll: true }), 100);
  } else if (elements.favoriteMovieElements.length > 0) {
    const firstMovie = elements.favoriteMovieElements[0];
    setTimeout(() => firstMovie.focus({ preventScroll: true }), 100);
  } else if (elements.movieElements.length > 0) {
    const firstMovie = elements.movieElements[0];
    setTimeout(() => firstMovie.focus({ preventScroll: true }), 100);
  } else if (elements.seriesElements.length > 0) {
    const firstSeries = elements.seriesElements[0];
    setTimeout(() => firstSeries.focus({ preventScroll: true }), 100);
  } else if (elements.tvChannelElements.length > 0) {
    const firstChannel = elements.tvChannelElements[0];
    setTimeout(() => firstChannel.focus({ preventScroll: true }), 100);
  }
}

function getModalContainers(containers: HTMLElement[], isModalContainer: (id: string) => boolean): HTMLElement[] {
  return containers.filter(c => {
    const id = getContainerId(c);
    return id && isModalContainer(id);
  });
}

function getNewModalContainers(modalContainers: HTMLElement[], lastContainerIds: Set<string>): HTMLElement[] {
  return modalContainers.filter(c => {
    const id = getContainerId(c);
    return id && !lastContainerIds.has(id);
  });
}

function handleModalOpening(newModalContainers: HTMLElement[]): void {
  const activeElement = document.activeElement as HTMLElement;
  if (activeElement?.matches('[data-tv-focusable]')) {
    // First try to find portal card by data-portal-id
    const portalCard = activeElement.closest('[data-portal-id]') as HTMLElement;
    if (portalCard) {
      state.lastFocusedElement = portalCard;
    } else {
      // Fall back to data-tv-id
      let closestWithTvId: HTMLElement | null = null;
      let current: HTMLElement | null = activeElement;
      
      while (current && current !== document.body) {
        if (current.dataset.tvId && current.dataset.tvContainer !== 'main') {
          closestWithTvId = current;
          break;
        }
        current = current.parentElement;
      }
      
      if (closestWithTvId) {
        state.lastFocusedElement = closestWithTvId;
      } else {
        // Last resort: check if we're inside a portal card by data-portal-id
        const parentPortalCard = activeElement.closest('[data-portal-id]') as HTMLElement;
        if (parentPortalCard) {
          state.lastFocusedElement = parentPortalCard;
        } else {
          state.lastFocusedElement = activeElement;
        }
      }
    }
  }

  const sortedNew = newModalContainers.slice().sort((a, b) => {
    const zIndexA = Number.parseInt(globalThis.getComputedStyle(a).zIndex) || 0;
    const zIndexB = Number.parseInt(globalThis.getComputedStyle(b).zIndex) || 0;
    return zIndexB - zIndexA;
  });

  const topContainer = sortedNew[0];
  focusInitialInContainer(topContainer);
}

function handleModalClosing(modalWasOpen: boolean): boolean {
  if (!modalWasOpen) {
    return false;
  }

  // Check if lastFocusedElement was in navbar - if so, skip focus restoration
  const lastWasInNavbar = state.lastFocusedElement?.closest('[data-tv-group="navbar"]') !== null;
  if (lastWasInNavbar) {
    state.lastFocusedElement = null;
    return true;
  }

  let elementToFocus: HTMLElement | null = null;

  // Try direct reference first
  if (state.lastFocusedElement && document.contains(state.lastFocusedElement)) {
    elementToFocus = state.lastFocusedElement;
  } else if (state.lastFocusedElement) {
    // Try to find by data-tv-id first
    const lastTvId = state.lastFocusedElement.dataset.tvId;
    if (lastTvId) {
      elementToFocus = document.querySelector(`[data-tv-id="${lastTvId}"]`) as HTMLElement;
    }
    // If not found, try data-portal-id
    if (!elementToFocus) {
      const lastPortalId = state.lastFocusedElement.dataset.portalId;
      if (lastPortalId) {
        elementToFocus = document.querySelector(`[data-portal-id="${lastPortalId}"]`) as HTMLElement;
      }
    }
  }

  // Last resort: find any portal card with data-tv-focusable
  elementToFocus ??= document.querySelector('[data-portal-id][data-tv-focusable]');

  if (elementToFocus) {
    setTimeout(() => {
      if (elementToFocus.tabIndex === -1) {
        elementToFocus.tabIndex = 0;
      }
      elementToFocus.focus({ preventScroll: true });
    }, 150);
  } else {
    const addButton = document.querySelector('[data-tv-id="add-portal-btn"]') as HTMLElement;
    if (addButton) {
      setTimeout(() => {
        addButton.focus({ preventScroll: true });
      }, 150);
    }
  }

  state.lastFocusedElement = null;
  return true;
}

/**
 * Initialize auto-focus monitoring
 * Returns cleanup function to stop observing
 */
export function initAutoFocus(): () => void {
  let lastContainerIds = new Set<string>();
  let modalWasOpen = false;
  let initialFocusApplied = false;
  // Element that received the initial sidebar focus on app start.
  // While focus stays on this element we keep it on the sidebar (don't steal
  // to main content). Once the user moves focus, normal behaviour resumes.
  let initialFocusElement: HTMLElement | null = null;

  const isModalContainer = (id: string): boolean => {
    return id !== 'main' && id !== 'navigation' && id !== '';
  };

  const handleInitialFocus = (containers: HTMLElement[], activeElement: HTMLElement): void => {
    // Skip initial focus if we're restoring focus (to prevent jumping to idx0)
    if (state.isRestoringFocus) {
      return;
    }
    if (!initialFocusApplied && shouldApplyInitialFocus(activeElement)) {
      initialFocusElement = applyInitialFocus(containers);
      initialFocusApplied = true;
    }
  };

  const handleMainContainer = (containers: HTMLElement[], activeElement: HTMLElement): void => {
    const mainContainer = containers.find(c => getContainerId(c) === 'main');
    if (!mainContainer) {
      return;
    }

    const contentElements = getContentElements(mainContainer);
    const movieDetailsElements = mainContainer.querySelectorAll('[data-tv-group="movie-actions"][data-tv-initial="true"], [data-tv-group="series-actions"][data-tv-initial="true"]') as NodeListOf<HTMLElement>;

    const hadMovieDetails = state.hadMovieDetails;
    const hasMovieDetailsNow = movieDetailsElements.length > 0;

    // If MovieDetails is opening, save the currently focused movie (if any)
    // Use window.__lastFocusedMovieId which was saved when user clicked/pressed Enter on movie
    if (!hadMovieDetails && hasMovieDetailsNow) {
      const savedMovieId = (globalThis as any).__lastFocusedMovieId;
      
      // Try to find the element, with retry for virtualization
      const tryFindElement = (): HTMLElement | null => {
        if (savedMovieId) {
          const el = document.querySelector(`[data-tv-id="${savedMovieId}"]`) as HTMLElement;
          if (el) return el;
        }
        
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl?.matches('[data-tv-group="movies"], [data-tv-group="series"], [data-tv-group="favorite-movies"], [data-tv-group="favorite-series"]')) {
          return activeEl;
        }
        
        if ((state as any).currentId) {
          return document.querySelector(`[data-tv-id="${(state as any).currentId}"]`) as HTMLElement;
        }
        
        return null;
      };
      
      // First try immediately
      let focusedMovie = tryFindElement();
      
      // If not found, retry after delay (for virtualization)
      if (!focusedMovie && savedMovieId) {
        const savedIndex = (globalThis as any).__lastFocusedMovieIndex;
        setTimeout(() => {
          focusedMovie = tryFindElement();
          if (focusedMovie) {
            state.lastFocusedElement = focusedMovie;
          } else if (savedIndex) {
            // Even if element not found, try to use index for restoration
            (state as any).lastFocusedIndex = savedIndex;
          }
          (globalThis as any).__lastFocusedMovieId = null;
          (globalThis as any).__lastFocusedMovieIndex = null;
        }, 300);
      } else if (focusedMovie) {
        state.lastFocusedElement = focusedMovie;
        (globalThis as any).__lastFocusedMovieId = null;
        (globalThis as any).__lastFocusedMovieIndex = null;
      }
    }

    // Update state
    state.hadMovieDetails = hasMovieDetailsNow;

    const movieDetailsCtx: MovieDetailsContext = {
      movieDetailsElements,
      activeElement,
      hadMovieDetails,
      hasMovieDetailsNow,
      modalWasOpen,
    };

    if (handleMovieDetailsOpening(movieDetailsCtx)) {
      modalWasOpen = true;
    }

    if (handleMovieDetailsClosing(movieDetailsCtx)) {
      modalWasOpen = false;
    }

    if (hasAnyContent(contentElements) && shouldFocusOnContent(activeElement, initialFocusElement, initialFocusApplied)) {
      focusContentElement(contentElements);
    }
  };

  const handleModalContainers = (containers: HTMLElement[]): void => {
    const modalContainers = getModalContainers(containers, isModalContainer);
    const newModalContainers = getNewModalContainers(modalContainers, lastContainerIds);

    if (newModalContainers.length > 0) {
      handleModalOpening(newModalContainers);
      modalWasOpen = true;
    }

    const hadModalContainers = Array.from(lastContainerIds).some(id => isModalContainer(id));
    const hasModalContainersNow = modalContainers.length > 0;

    if (hadModalContainers && !hasModalContainersNow && modalWasOpen) {
      if (handleModalClosing(modalWasOpen)) {
        modalWasOpen = false;
      }
    }
  };

  const checkContainers = () => {
    const containers = Array.from(document.querySelectorAll('[data-tv-container]')) as HTMLElement[];
    const currentIds = new Set(containers.map(getContainerId).filter(Boolean));
    const activeElement = document.activeElement as HTMLElement;

    handleInitialFocus(containers, activeElement);
    handleMainContainer(containers, activeElement);
    handleModalContainers(containers);

    lastContainerIds = currentIds;
    state.lastContainerIds = currentIds;
  };

  checkContainers();

  const observer = new MutationObserver(() => {
    // Add delay to allow DOM to settle
    setTimeout(() => {
      requestAnimationFrame(checkContainers);
    }, 50);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
}
