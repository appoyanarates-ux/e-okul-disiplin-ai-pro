// Electron entry forwarder supporting ES module package.json
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('./electron/main.cjs');
