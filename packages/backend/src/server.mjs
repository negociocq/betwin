import express from 'express';

const app = express();
const PORT = 3000;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API endpoints
app.get('/api/markets', (req, res) => {
  res.json({ message: 'Markets endpoint - Betfair API integration coming soon' });
});

app.get('/api/signals', (req, res) => {
  res.json({ message: 'Signals endpoint - coming soon' });
});

app.get('/api/trades', (req, res) => {
  res.json({ message: 'Trades endpoint - Paper trading coming soon' });
});

app.get('/api/analytics', (req, res) => {
  res.json({ message: 'Analytics endpoint - coming soon' });
});

app.listen(PORT, () => {
  console.log(`✓ Backend server running on http://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
});
