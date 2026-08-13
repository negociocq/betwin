export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development',
    region: process.env.VERCEL_REGION || 'local'
  });
}
