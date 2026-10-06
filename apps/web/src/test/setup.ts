import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Під навантаженням (паралельні jsdom-воркери) стандартної секунди на findBy* інколи мало
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
});
