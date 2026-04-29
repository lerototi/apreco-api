import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes';

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

app.use('/users', userRoutes);

export default app;
