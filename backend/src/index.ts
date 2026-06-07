import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './db/prisma';

// API Routes
import profileRoutes from './api/routes/profile';
import jobsRoutes from './api/routes/jobs';
import jdAnalysisRoutes from './api/routes/jdAnalysis';
import applicationsRoutes from './api/routes/applications';
import browserExtensionRoutes from './api/routes/browserExtension';
import mcpRoutes from './api/routes/mcp';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Register routes
app.use('/api/profile', profileRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/jd', jdAnalysisRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/browser-extension', browserExtensionRoutes);
app.use('/api/mcp', mcpRoutes);

app.listen(port, () => {
  console.log(`Vega backend listening at http://localhost:${port}`);
});

// graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});
