import 'dotenv/config';
import { triggerPoolSync } from '../src/workers/pool-sync.js';

triggerPoolSync().catch(console.error);
