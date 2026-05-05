import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes';
import marketplaceRoutes from './routes/marketplaceRoutes';

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

app.use('/users', userRoutes);
app.use('/marketplace', marketplaceRoutes);

export default app;
