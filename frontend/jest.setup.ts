import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
    };
  },
  usePathname() {
    return '/';
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  useParams() {
    return {};
  },
  redirect: jest.fn(),
}));

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'fr',
  useFormatter: () => ({
    dateTime: (date: Date, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr', options).format(date),
  }),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock fetch
global.fetch = jest.fn();

// jsdom does not provide matchMedia. Model the light system preference by default and retain
// listeners so components can subscribe/unsubscribe as they do in a browser.
const mediaQueryLists = new Map<string, MediaQueryList>();
window.matchMedia = jest.fn((media: string) => {
  const existing = mediaQueryLists.get(media);
  if (existing) return existing;

  const listeners = new Set<EventListenerOrEventListenerObject>();
  const addListener = jest.fn((listener: EventListenerOrEventListenerObject) => listeners.add(listener));
  const removeListener = jest.fn((listener: EventListenerOrEventListenerObject) => listeners.delete(listener));
  const list = {
    matches: false,
    media,
    onchange: null,
    addListener,
    removeListener,
    addEventListener: jest.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'change') addListener(listener);
    }),
    removeEventListener: jest.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'change') removeListener(listener);
    }),
    dispatchEvent: jest.fn((event: Event) => {
      for (const listener of listeners) {
        if (typeof listener === 'function') listener(event);
        else listener.handleEvent(event);
      }
      return true;
    }),
  } as unknown as MediaQueryList;
  mediaQueryLists.set(media, list);
  return list;
});

// Setup localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});
