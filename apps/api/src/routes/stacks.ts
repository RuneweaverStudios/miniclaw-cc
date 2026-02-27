import { Hono } from 'hono';

const stacksRoutes = new Hono();

// GET /api/stacks - Get available stacks
stacksRoutes.get('/', (c) => {
  const stacks = [
    {
      id: 'openclaw',
      name: 'OpenClaw',
      description: 'Node.js-based AI agent framework with built-in memory and tools',
      version: '1.0.0',
      services: ['OpenClaw CLI', 'Node.js 20', 'npm'],
      cpu: 1,
      memory: 2,
      price: 0.005,
      available: true,
    },
    {
      id: 'nanobot',
      name: 'Nanobot',
      description: 'Python-based AI agent framework with lightweight resource footprint',
      version: '0.1.0',
      services: ['Nanobot CLI', 'Python 3.11', 'pip'],
      cpu: 0.5,
      memory: 1,
      price: 0.003,
      available: true,
    },
  ];

  return c.json(stacks);
});

export { stacksRoutes };
