import express from 'express';
import { syncToHeaven } from './heaven-bot.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// セキュリティ: トークン検証
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'change-this-secret-token';

// Webhook受信エンドポイント
app.post('/api/heaven-sync', async (req, res) => {
  try {
    // 認証チェック
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token !== AUTH_TOKEN) {
      console.error('❌ Unauthorized access attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const reservationData = req.body;
    console.log('📥 Received reservation:', {
      id: reservationData.reservation_id,
      customer: reservationData.customer_name,
      cast: reservationData.cast_name,
      time: reservationData.reservation_time
    });
    
    // バリデーション
    if (!reservationData.customer_name || !reservationData.cast_name || !reservationData.course) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // 即座にレスポンスを返す（非同期処理）
    res.status(202).json({ 
      message: 'Accepted. Processing in background.',
      reservation_id: reservationData.reservation_id,
      timestamp: new Date().toISOString()
    });
    
    // バックグラウンドで処理
    syncToHeaven(reservationData)
      .then(() => {
        console.log('✅ Heaven sync completed:', reservationData.reservation_id);
      })
      .catch((error) => {
        console.error('❌ Heaven sync failed:', reservationData.reservation_id, error.message);
        // TODO: 失敗時の通知やリトライ処理
      });
      
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ルートエンドポイント
app.get('/', (req, res) => {
  res.json({ 
    service: 'Heaven Automation Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      sync: 'POST /api/heaven-sync'
    }
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Heaven Automation Server running on port ${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/api/heaven-sync`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});
