import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock global supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      then: vi.fn(),
    })),
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
      user: null,
    },
  },
}));

// Mock import.meta.env
vi.mock('import.meta.env', () => ({
  env: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-key',
  },
}));

beforeAll(() => {
  // Setup globale
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  // Cleanup globale
});