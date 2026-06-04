import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes';
import marketplaceRoutes from './routes/marketplaceRoutes';
import establishmentRoutes from './routes/establishmentRoutes';
import seedsRoutes from './routes/seedsRoutes';

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

app.use('/users', userRoutes);
app.use('/marketplace', marketplaceRoutes);
app.use('/establishment', establishmentRoutes);
app.use('/seeds', seedsRoutes);

export default app;
