# 🧱 Complete Modular Architecture Implementation

## 📁 Structure Overview

The application is built with a feature-based modular architecture with comprehensive IPTV functionality.

```
src/
├── features/
│   ├── tv/                     # Live TV feature
│   │   ├── TVList.tsx          # TV channel list component with virtualization
│   │   ├── tv.api.ts           # TV API layer
│   │   ├── tv.hooks.ts         # TV-specific React hooks
│   │   ├── ChannelCategoriesList.tsx
│   │   ├── FavoriteCategoriesList.tsx
│   │   ├── FavoriteChannelsList.tsx
│   │   └── ChannelLogo.tsx
│   ├── movies/                 # Movies VOD feature
│   │   ├── MovieList.tsx       # Movies list with categories and pagination
│   │   ├── MovieDetails.tsx    # Movie details view
│   │   ├── movies.api.ts       # Movies API layer (VOD integration)
│   │   ├── movies.hooks.ts     # Movies-specific React hooks
│   │   ├── MovieCategoriesList.tsx
│   │   ├── FavoriteMovieCategoriesList.tsx
│   │   ├── FavoriteMoviesList.tsx
│   │   └── ContinueWatching.tsx
│   ├── series/                 # Series VOD feature
│   │   ├── SeriesList.tsx      # Series list with seasons/episodes
│   │   ├── SeriesDetails.tsx   # Series details with seasons/episodes
│   │   ├── series.api.ts       # Series API layer (VOD integration)
│   │   ├── series.hooks.ts     # Series-specific React hooks
│   │   ├── SeriesCategoriesList.tsx
│   │   ├── FavoriteSeriesCategoriesList.tsx
│   │   └── FavoriteSeriesList.tsx
│   ├── epg/                    # EPG feature
│   │   ├── EPGTimeline.tsx     # Electronic Program Guide timeline view
│   │   ├── epg.api.ts          # EPG API layer
│   │   └── epg.hooks.ts        # EPG-specific React hooks
│   ├── player/                 # Video player feature
│   │   ├── Player.tsx          # Video player component
│   │   ├── player.hooks.ts     # Player-specific React hooks
│   │   ├── mpv/                # MPV player integration
│   │   └── exo/                # ExoPlayer integration (Android)
│   ├── portals/                # Portal management feature
│   │   ├── PortalList.tsx      # Portal list and management
│   │   ├── PortalForm.tsx      # Portal add/edit form
│   │   ├── PortalTest.tsx      # Portal connection test
│   │   ├── PortalsPage.tsx     # Portals page
│   │   └── portals.types.ts    # Portal type definitions
│   ├── settings/               # Settings feature
│   │   └── Settings.tsx        # Application settings
│   └── personalized/           # Personalized content
│       └── ForYouSection.tsx   # Personalized recommendations
├── components/
│   ├── AppContent.tsx          # Main content router
│   ├── AppLayout.tsx           # App layout with sidebar
│   ├── ErrorBoundary.tsx       # Error boundary component
│   ├── theme-provider.tsx      # Theme provider
│   └── ui/                     # Shared UI components (shadcn/ui)
├── store/
│   ├── app.store.ts            # Global app state
│   ├── accountStore.ts         # Account management
│   ├── playback.store.ts       # Playback state
│   ├── portalCache.store.ts    # Portal data caching
│   ├── portals.store.ts        # Portal management
│   ├── resume.store.ts         # Resume playback state
│   └── stream.store.ts         # Stream URL management
├── hooks/
│   ├── useSecureStorage.ts     # 🔐 Stronghold - encrypted auth storage
│   ├── useDatabase.ts          # 🗄️ SQLite - channels/VOD/EPG data
│   ├── useImageCache.ts        # 📁 FS - image file cache
│   ├── useSettings.ts          # ⚙️ Store - app settings
│   ├── usePlaybackManager.ts   # Playback management
│   ├── useFavorites.ts         # Favorites management
│   ├── useTypedRouter.ts       # Typed routing
│   ├── useAppRouter.ts         # App routing
│   ├── useNavigationMenu.ts    # Navigation menu
│   ├── useCategories.ts        # Category management
│   ├── useRecentItems.ts       # Recent items tracking
│   ├── useCarousel.ts          # Carousel functionality
│   ├── useDebounce.ts          # Utility hooks
│   ├── useLongPress.ts         # Long press gesture
│   ├── useTVContainers.ts      # TV navigation containers
│   ├── useTVFocusGraph.ts      # TV focus management
│   ├── useTVKeyboard.ts        # TV keyboard handling
│   ├── useTranslation.ts       # Internationalization
│   ├── tv-navigation/          # TV navigation system
│   │   └── [25 navigation files]
│   └── index.ts                # Unified exports
├── lib/
│   ├── stalkerAPI_new.ts       # Stalker API client
│   ├── tauriHttp.ts            # Tauri HTTP utilities
│   ├── tauriStorage.ts         # Tauri storage utilities
│   ├── schema.ts               # Database schema
│   ├── services.ts             # Shared services
│   ├── logger.ts               # Logging utilities
│   ├── translations.ts         # Translation data
│   ├── db.ts                   # Database utilities
│   └── utils.ts                # General utilities
├── types/
│   └── index.ts                # TypeScript type definitions
└── App.tsx                    # Main application component
```

## 🏗️ Architecture Principles

### 1. **Feature-Based Organization**
- Each feature (TV, Movies, Series, EPG, Player, Portals, Settings, Personalized) has its own directory
- Related components, hooks, and API calls are co-located
- Clear separation of concerns

### 2. **Dependency Injection**
- Components receive dependencies via props
- Easy to test and mock
- Loose coupling between modules

### 3. **Global State Management**
- Zustand for simple, efficient state management with multiple stores
- **Stronghold** for secure auth persistence
- **SQLite** for content data
- Type-safe with TypeScript

### 4. **Data Fetching**
- TanStack Query for server state management
- Automatic caching, refetching, and error handling
- Prefetching for better UX

### 5. **TV Navigation System**
- Comprehensive TV navigation for Android TV
- D-pad support with focus management
- Keyboard handling for TV interfaces

## 💾 Modern Tauri 2 Storage Architecture

| Data Type | Technology | Purpose |
|-----------|-----------|---------|
| **Auth/Security** | 🔐 Stronghold | Encrypted storage for tokens, MAC, credentials |
| **Content Data** | 🗄️ SQLite | VOD, channels, EPG - searchable structured data |
| **Image Cache** | 📁 File System | Binary poster/icon files with native access |
| **Settings** | ⚙️ Store | App configuration, preferences |

### 🔐 Stronghold (Secure Storage)
```typescript
import { secureStorage } from '@/hooks';

// Save auth securely (encrypted)
await secureStorage.saveAuthData({
  macAddress: '00:1A:79:...',
  token: 'bearer_token',
  serverUrl: 'http://portal...'
});

// Retrieve auth
data = await secureStorage.getAuthData();
```
**Features:**
- Hardware-backed encryption
- Anti-tampering protection
- Secure vault isolated from app
- 32-byte password hashing

### 🗄️ SQLite (Structured Data)
```typescript
import { saveChannels, getChannels, searchVod } from '@/hooks';

// Save thousands of channels
await saveChannels(channelList);

// Fast queries with indexes
const channels = await getChannels(genreId);
const results = await searchVod('Action Movie');
```
**Schema:**
- `channels` - Live TV channels with genres
- `vod` - Movies with metadata
- `series` / `series_seasons` / `series_episodes` - TV series
- `epg` - Electronic program guide data

### 📁 File System (Image Cache)
```typescript
import { useImageCache } from '@/hooks';

const { fetchAndCacheImage, getImageBlobUrl } = useImageCache();

// Cache and retrieve images
const blobUrl = await getImageBlobUrl(posterUrl);
<img src={blobUrl} />
```
**Features:**
- Binary data storage
- Persistent cache across sessions
- Fast local file access

### ⚙️ Store (Settings)
```typescript
import { useSettings } from '@/hooks';

const { setSetting, getSetting } = useSettings();

// Save preferences
await setSetting('theme', 'dark');
await setSetting('volume', 0.8);
```

### ❌ Why Not localStorage?
- No encryption (security risk for tokens)
- 5MB limit (too small for IPTV data)
- Synchronous (blocks UI)
- String-only (inefficient for binary)

## 🚀 Key Features

### TV Feature
- **TVList.tsx**: Virtualized channel list with responsive grid
- **tv.api.ts**: Clean API abstraction over StalkerClient
- **tv.hooks.ts**: Reusable data fetching hooks with caching
- **ChannelCategoriesList.tsx**: Channel category browser
- **FavoriteCategoriesList.tsx**: Favorite categories management
- **FavoriteChannelsList.tsx**: Favorite channels management
- **ChannelLogo.tsx**: Channel logo component

### Movies Feature
- **MovieList.tsx**: Movies grid with categories, search, and pagination
- **MovieDetails.tsx**: Movie details with metadata
- **movies.api.ts**: VOD integration for movies content
- **movies.hooks.ts**: Movie-specific data management with prefetching
- **MovieCategoriesList.tsx**: Movie category browser
- **FavoriteMovieCategoriesList.tsx**: Favorite movie categories
- **FavoriteMoviesList.tsx**: Favorite movies management
- **ContinueWatching.tsx**: Continue watching section

### Series Feature
- **SeriesList.tsx**: Series browser with seasons and episodes
- **SeriesDetails.tsx**: Series details with seasons and episodes
- **series.api.ts**: VOD integration for TV series content
- **series.hooks.ts**: Series data management with episode grouping
- **SeriesCategoriesList.tsx**: Series category browser
- **FavoriteSeriesCategoriesList.tsx**: Favorite series categories
- **FavoriteSeriesList.tsx**: Favorite series management

### EPG (Electronic Program Guide)
- **EPGTimeline.tsx**: Interactive timeline view with current program highlighting
- **epg.api.ts**: EPG data fetching and time utilities
- **epg.hooks.ts**: Real-time EPG updates and caching

### Player Feature
- **Player.tsx**: Modal video player with controls
- **player.hooks.ts**: Player state management for all content types
- **mpv/**: MPV player integration for desktop
- **exo/**: ExoPlayer integration for Android

### Portals Feature
- **PortalList.tsx**: Portal list and management interface
- **PortalForm.tsx**: Portal add/edit form
- **PortalTest.tsx**: Portal connection testing
- **PortalsPage.tsx**: Portals management page
- **portals.types.ts**: Portal type definitions

### Settings Feature
- **Settings.tsx**: Application settings interface

### Personalized Feature
- **ForYouSection.tsx**: Personalized content recommendations

### Shared Components
- **AppContent.tsx**: Main content router and view management
- **AppLayout.tsx**: App layout with sidebar navigation
- **ErrorBoundary.tsx**: Error boundary for error handling
- **theme-provider.tsx**: Theme provider for dark/light mode
- **ui/**: Shared UI components from shadcn/ui

### Global Stores
- **app.store.ts**: Global app state management
- **accountStore.ts**: Account management state
- **playback.store.ts**: Playback state management
- **portalCache.store.ts**: Portal data caching
- **portals.store.ts**: Portal management state
- **resume.store.ts**: Resume playback state
- **stream.store.ts**: Stream URL management

## 🔄 Data Flow

### TV Channels Flow
1. **App Component** → Creates StalkerClient and QueryClient
2. **Portals Store** → Manages active portal selection
3. **TVList Component** → Uses useChannels hook to fetch data
4. **Channel Selection** → Triggers usePlaybackManager to fetch stream URL
5. **Player Component** → Renders video with fetched URL

### Movies Flow
1. **MovieList Component** → Uses useMoviesWithPagination for paginated data
2. **Category Selection** → Filters movies by category
3. **Movie Selection** → Triggers usePlaybackManager with movie stream URL
4. **Player Component** → Renders movie content

### Series Flow
1. **SeriesList Component** → Fetches series and episodes
2. **Series Selection** → Shows seasons and episodes panel in SeriesDetails
3. **Episode Selection** → Triggers usePlaybackManager with episode stream URL
4. **Player Component** → Renders episode content with autoplay support

### EPG Flow
1. **EPGTimeline Component** → Fetches EPG data for multiple channels
2. **Time Navigation** → Updates date range and refetches data
3. **Program Selection** → Triggers TV channel selection
4. **Timeline View** → Shows current/next programs with real-time updates

### Portals Flow
1. **PortalList Component** → Displays all configured portals
2. **Portal Form** → Adds/edits portal configuration
3. **Portal Test** → Tests portal connection
4. **Portals Store** → Manages portal state and active selection

### Settings Flow
1. **Settings Component** → Displays application settings
2. **useSettings Hook** → Manages settings persistence
3. **Settings Store** → Stores user preferences

## 📋 Benefits

✅ **Complete IPTV Solution**: TV, Movies, Series, EPG, Portals, and Settings in one app
✅ **Multi-Platform**: Desktop (MPV) and Android (ExoPlayer) support
✅ **TV-Ready**: Comprehensive TV navigation system for Android TV
✅ **Scalable**: Easy to add new features following the same pattern
✅ **Maintainable**: Clear separation of concerns and modular structure
✅ **Performant**: Virtualization, caching, and lazy loading
✅ **User-Friendly**: Intuitive navigation and responsive design
✅ **Type-Safe**: Full TypeScript support throughout
✅ **Reusable**: Shared components and hooks
✅ **Real-time**: EPG updates and current program tracking
✅ **Multi-Account**: Support for multiple IPTV portal accounts
✅ **Personalized**: Content recommendations and continue watching  

## 🎯 Features Implemented

### 📡 Live TV
- Virtualized channel list with responsive grid
- Real-time channel switching
- Channel favorites management
- Search and filtering
- Channel categories
- Favorite channels and categories

### 🎬 Movies
- Categories and genre filtering
- Pagination for large catalogs
- Movie details and poster support
- Stream prefetching on hover
- Favorite movies and categories
- Continue watching section

### 📺 Series
- Series browser with seasons
- Episode grouping and organization
- Expandable season views
- Episode-level favorites
- Series details with full episode list
- Autoplay support for episode transitions
- Newest episode playback

### 📅 Electronic Program Guide
- Interactive timeline view
- Current program highlighting
- Date navigation
- Multiple time range views
- Real-time updates

### 🎮 Media Player
- Unified player for all content types
- MPV player integration for desktop
- ExoPlayer integration for Android
- Modal overlay with controls
- Buffering states
- Keyboard shortcuts
- Resume playback support

### 🔌 Portal Management
- Multi-account support (up to 15 portals)
- Portal configuration management
- Connection testing
- Quick account switching
- Import/Export functionality

### ⚙️ Settings
- Application settings interface
- Theme preferences
- Player configuration
- Language selection
- System settings

### 🎯 Personalization
- For You section with recommendations
- Continue watching tracking
- Recent items management
- Personalized content suggestions

### 📺 TV Navigation
- D-pad navigation support
- Focus management system
- TV keyboard handling
- Focus graph navigation
- Container-based navigation

## 🔧 Next Steps

1. **Recording**: DVR functionality
2. **Advanced Search**: Filters and sorting options
3. **Profile Management**: Multiple user profiles per portal
4. **Parental Controls**: Content filtering and PIN protection
5. **Social Features**: Sharing and recommendations
6. **Analytics**: Usage statistics and insights

## 📦 Dependencies

All required dependencies are already installed:
- `@tanstack/react-query` - Data fetching and caching
- `@tanstack/react-virtual` - List virtualization
- `zustand` - State management
- `react` & `react-dom` - UI framework
- `@tauri-apps/plugin-os` - Platform detection
- `@tauri-apps/api` - Tauri API integration
