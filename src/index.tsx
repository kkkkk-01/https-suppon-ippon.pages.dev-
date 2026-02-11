import { Hono } from 'hono'
import { cors } from 'hono/cors'

// メンテナンスモード（true: メンテナンス中, false: 通常運用）
const MAINTENANCE_MODE = false

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// メンテナンスモードチェック（APIとfaviconを除外）
app.use('*', async (c, next) => {
  const path = c.req.path
  // API、favicon、judge画面は除外
  if (!path.startsWith('/api/') && path !== '/favicon.ico' && !path.startsWith('/judge/')) {
    if (MAINTENANCE_MODE) {
      return c.html(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>メンテナンス中 - 素人一本</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="min-h-screen bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
                <div class="text-6xl mb-4">🔧</div>
                <h1 class="text-3xl font-bold text-gray-800 mb-4">メンテナンス中</h1>
                <p class="text-gray-600 mb-6">
                    現在、システムメンテナンスを実施しております。<br>
                    しばらくお待ちください。
                </p>
                <div class="text-sm text-gray-500">
                    素人一本システム
                </div>
            </div>
        </body>
        </html>
      `)
    }
  }
  await next()
})

// Enable CORS
app.use('/api/*', cors())

// API: Get current status
app.get('/api/status', async (c) => {
  const { DB } = c.env
  
  // Get current active session
  const session = await DB.prepare(`
    SELECT * FROM sessions 
    WHERE is_active = 1 
    ORDER BY id DESC LIMIT 1
  `).first<{ id: number; round_number: number }>()
  
  if (!session) {
    return c.json({
      sessionId: null,
      roundNumber: 0,
      voteCount: 0,
      votes: { 1: false, 2: false, 3: false, 4: false, 5: false },
      isIppon: false
    })
  }
  
  // Get votes for current session
  const votesResult = await DB.prepare(`
    SELECT judge_id, vote_count FROM votes
    WHERE session_id = ?
  `).bind(session.id).all()
  
  const votes: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let totalVoteCount = 0
  
  for (const vote of votesResult.results) {
    const judgeId = (vote as any).judge_id
    const voteCount = (vote as any).vote_count || 0
    votes[judgeId] = voteCount
    totalVoteCount += voteCount
  }
  
  // 8票以上（15票の8/15以上）でIPPON
  const isIppon = totalVoteCount >= 8
  
  // Get latest YO event for this session
  const yoEvent = await DB.prepare(`
    SELECT id, created_at FROM yo_events
    WHERE session_id = ?
    ORDER BY id DESC LIMIT 1
  `).bind(session.id).first<{ id: number, created_at: string }>()
  
  return c.json({
    sessionId: session.id,
    roundNumber: session.round_number,
    voteCount: totalVoteCount,
    maxVotes: 15,
    votes,
    isIppon,
    yo: yoEvent ? {
      hasYo: true,
      yoId: yoEvent.id,
      timestamp: yoEvent.created_at
    } : {
      hasYo: false
    }
  })
})

// API: Get latest YO event
app.get('/api/yo/latest', async (c) => {
  const { DB } = c.env
  
  // Get current active session
  const session = await DB.prepare(`
    SELECT * FROM sessions 
    WHERE is_active = 1 
    ORDER BY id DESC LIMIT 1
  `).first<{ id: number }>()
  
  if (!session) {
    return c.json({ hasYo: false })
  }
  
  // Get latest yo event
  const yoEvent = await DB.prepare(`
    SELECT ye.id, ye.judge_id, j.name as judge_name
    FROM yo_events ye
    JOIN judges j ON ye.judge_id = j.id
    WHERE ye.session_id = ?
    ORDER BY ye.id DESC LIMIT 1
  `).bind(session.id).first()
  
  if (!yoEvent) {
    return c.json({ hasYo: false })
  }
  
  return c.json({
    hasYo: true,
    yoId: (yoEvent as any).id,
    judgeId: (yoEvent as any).judge_id,
    judgeName: (yoEvent as any).judge_name
  })
})

// API: Reset (create new session)
app.post('/api/reset', async (c) => {
  const { DB } = c.env
  
  // Get last round number
  const lastSession = await DB.prepare(`
    SELECT MAX(round_number) as last_round FROM sessions
  `).first<{ last_round: number | null }>()
  
  const nextRound = (lastSession?.last_round || 0) + 1
  
  // Deactivate all sessions
  await DB.prepare(`UPDATE sessions SET is_active = 0`).run()
  
  // Create new session
  const result = await DB.prepare(`
    INSERT INTO sessions (round_number, is_active, created_at)
    VALUES (?, 1, CURRENT_TIMESTAMP)
  `).bind(nextRound).run()
  
  // Return new session ID
  return c.json({ 
    success: true, 
    round: nextRound,
    sessionId: result.meta.last_row_id
  })
})

// API: Vote (from smartphone)
app.post('/api/vote', async (c) => {
  const { DB } = c.env
  const { judgeNumber, voteCount = 1 } = await c.req.json()
  
  // Validate voteCount (1-3)
  const votesToAdd = Math.min(Math.max(1, voteCount), 3)
  
  // Get current active session
  const session = await DB.prepare(`
    SELECT * FROM sessions 
    WHERE is_active = 1 
    ORDER BY id DESC LIMIT 1
  `).first<{ id: number }>()
  
  if (!session) {
    return c.json({ error: 'No active session' }, 400)
  }
  
  // Get judge by number
  const judge = await DB.prepare(`
    SELECT * FROM judges WHERE judge_number = ?
  `).bind(judgeNumber).first<{ id: number }>()
  
  if (!judge) {
    return c.json({ error: 'Judge not found' }, 404)
  }
  
  // Get current vote count
  const currentVote = await DB.prepare(`
    SELECT vote_count FROM votes
    WHERE session_id = ? AND judge_id = ?
  `).bind(session.id, judge.id).first<{ vote_count: number }>()
  
  const currentCount = currentVote?.vote_count || 0
  
  // Calculate new count (max 3 votes total)
  const newCount = Math.min(currentCount + votesToAdd, 3)
  
  // Check if already at maximum
  if (currentCount >= 3) {
    return c.json({ error: 'Maximum 3 votes per judge', voteCount: 3 }, 400)
  }
  
  // Insert or update vote
  await DB.prepare(`
    INSERT INTO votes (session_id, judge_id, vote_count, voted, voted_at)
    VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(session_id, judge_id) 
    DO UPDATE SET vote_count = ?, voted = 1, voted_at = CURRENT_TIMESTAMP
  `).bind(session.id, judge.id, newCount, newCount).run()
  
  return c.json({ success: true, voteCount: newCount })
})

// API: YO event (from smartphone)
app.post('/api/yo', async (c) => {
  const { DB } = c.env
  const { judgeNumber } = await c.req.json()
  
  // Get current active session
  const session = await DB.prepare(`
    SELECT * FROM sessions 
    WHERE is_active = 1 
    ORDER BY id DESC LIMIT 1
  `).first<{ id: number }>()
  
  if (!session) {
    return c.json({ error: 'No active session' }, 400)
  }
  
  // Get judge by number
  const judge = await DB.prepare(`
    SELECT * FROM judges WHERE judge_number = ?
  `).bind(judgeNumber).first<{ id: number }>()
  
  if (!judge) {
    return c.json({ error: 'Judge not found' }, 404)
  }
  
  // Insert yo event
  await DB.prepare(`
    INSERT INTO yo_events (session_id, judge_id, created_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `).bind(session.id, judge.id).run()
  
  return c.json({ success: true })
})

// Favicon route - return 204 No Content to avoid errors
app.get('/favicon.ico', (c) => {
  return c.body(null, 204)
})

// Root route - serve PC page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>素人一本 - PC集計画面</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <style>
          .suppon-font {
            font-family: 'Arial Black', 'Arial Bold', sans-serif;
            font-weight: 900;
            letter-spacing: 0.15em;
            text-shadow: 4px 4px 0px rgba(0, 0, 0, 0.3);
          }
          .voted-card {
            background-color: rgba(239, 68, 68, 0.95);
            border-color: #dc2626 !important;
          }
          .zero-vote-card {
            background-color: rgba(59, 130, 246, 0.95);
            border-color: #2563eb !important;
          }
        </style>
    </head>
    <body class="min-h-screen" style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);">
        <div class="container mx-auto p-4 md:p-6">
            <div class="text-center mb-4">
                <img src="/suppon-logo.png" alt="素人一本" class="mx-auto mb-2" style="max-width: 200px;">
            </div>
            
            <div id="ipponBanner" class="hidden mb-4">
                <div class="bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white text-center py-6 rounded-xl shadow-2xl">
                    <div class="text-5xl md:text-6xl font-bold suppon-font flex items-center justify-center gap-3">
                        <span class="text-4xl">✨</span>
                        <span class="text-yellow-300">SUPPON!</span>
                        <span class="text-4xl">✨</span>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                <div id="judge-1" class="bg-white/90 border-3 border-black rounded-lg p-4 text-center transition-all duration-300 shadow-lg">
                    <div id="judge-name-1" class="text-xl font-bold mb-2 text-gray-900">審査員1</div>
                    <div id="status-1" class="text-5xl mb-2">⚪️</div>
                    <div id="voted-text-1" class="text-base font-semibold mt-1 text-gray-600">未投票</div>
                </div>
                <div id="judge-2" class="bg-white/90 border-3 border-black rounded-lg p-4 text-center transition-all duration-300 shadow-lg">
                    <div id="judge-name-2" class="text-xl font-bold mb-2 text-gray-900">審査員2</div>
                    <div id="status-2" class="text-5xl mb-2">⚪️</div>
                    <div id="voted-text-2" class="text-base font-semibold mt-1 text-gray-600">未投票</div>
                </div>
                <div id="judge-3" class="bg-white/90 border-3 border-black rounded-lg p-4 text-center transition-all duration-300 shadow-lg">
                    <div id="judge-name-3" class="text-xl font-bold mb-2 text-gray-900">審査員3</div>
                    <div id="status-3" class="text-5xl mb-2">⚪️</div>
                    <div id="voted-text-3" class="text-base font-semibold mt-1 text-gray-600">未投票</div>
                </div>
                <div id="judge-4" class="bg-white/90 border-3 border-black rounded-lg p-4 text-center transition-all duration-300 shadow-lg">
                    <div id="judge-name-4" class="text-xl font-bold mb-2 text-gray-900">審査員4</div>
                    <div id="status-4" class="text-5xl mb-2">⚪️</div>
                    <div id="voted-text-4" class="text-base font-semibold mt-1 text-gray-600">未投票</div>
                </div>
                <div id="judge-5" class="bg-white/90 border-3 border-black rounded-lg p-4 text-center transition-all duration-300 shadow-lg">
                    <div id="judge-name-5" class="text-xl font-bold mb-2 text-gray-900">審査員5</div>
                    <div id="status-5" class="text-5xl mb-2">⚪️</div>
                    <div id="voted-text-5" class="text-base font-semibold mt-1 text-gray-600">未投票</div>
                </div>
            </div>
            
            <div class="bg-white/90 border-3 border-black rounded-lg p-4 text-center mb-4">
                <div class="text-2xl font-bold mb-2">現在の投票数</div>
                <div id="voteCount" class="text-5xl font-bold text-red-600">0</div>
                <div class="text-lg text-gray-600 mt-1">/ 15票</div>
                <div class="text-sm text-gray-500 mt-1">（8票以上でSUPPON!）</div>
            </div>
            
            <div class="text-center">
                <button id="resetBtn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg shadow-lg transition-all duration-300 transform hover:scale-105">
                    次のお題へリセット
                </button>
            </div>
        </div>
        
        <audio id="ipponAudio" src="/ippon.m4a" preload="auto"></audio>
        <audio id="yoAudio" src="/yo-sound.m4a" preload="auto"></audio>
        <audio id="voteAudio" src="/vote-sound.mp3" preload="auto"></audio>
        
        <script src="/pc.js?v=46"></script>
    </body>
    </html>
  `)
})

// Judge page route - serve judge page
app.get('/judge/:number', async (c) => {
  const judgeNumber = c.req.param('number')
  
  // Validate judge number (1-5)
  const num = parseInt(judgeNumber)
  if (isNaN(num) || num < 1 || num > 5) {
    return c.text('Invalid judge number. Please use /judge/1 to /judge/5', 400)
  }
  
  // Serve judge.html - since it's a static file, redirect to it
  // The JavaScript in judge.html will parse the URL to get judge number
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>審査員${num} - すっぽん一本</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <style>
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-20px); }
      }
      .float {
        animation: float 3s ease-in-out infinite;
      }
      @keyframes pulse-scale {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      .pulse-scale {
        animation: pulse-scale 2s ease-in-out infinite;
      }
      @keyframes success-flash {
        0% { background-color: #facc15; }
        50% { background-color: #22c55e; }
        100% { background-color: #facc15; }
      }
      .success-flash {
        animation: success-flash 0.5s ease-in-out 1;
      }
      .suppon-font {
        font-family: 'Arial Black', 'Arial Bold', sans-serif;
        font-weight: 900;
        letter-spacing: 0.1em;
        text-shadow: 3px 3px 0px rgba(0, 0, 0, 0.3);
      }
    </style>
</head>
<body class="min-h-screen bg-yellow-400 transition-colors duration-300">
    <div class="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-screen">
        <div class="float mb-6">
            <img src="/suppon-logo.png" alt="すっぽん一本" class="mx-auto w-40 sm:w-52 md:w-64" style="max-width: 250px;">
        </div>
        
        <h1 class="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-8 suppon-font">
            審査員 ${num}
        </h1>
        
        <div class="bg-white/90 border-4 border-black rounded-lg p-4 mb-8 text-center">
            <div class="text-lg font-bold text-gray-700">あなたの投票数</div>
            <div id="currentVoteCount" class="text-5xl font-bold text-red-600">0</div>
            <div class="text-sm text-gray-600 mt-1">/ 3票</div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 w-full max-w-md mb-8">
            <button id="vote0Btn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-8 rounded-xl text-4xl shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-4 border-black suppon-font">
                0
            </button>
            <button id="vote1Btn" class="bg-green-500 hover:bg-green-600 text-white font-bold py-8 rounded-xl text-4xl shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-4 border-black suppon-font">
                1
            </button>
            <button id="vote2Btn" class="bg-orange-500 hover:bg-orange-600 text-white font-bold py-8 rounded-xl text-4xl shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-4 border-black suppon-font">
                2
            </button>
            <button id="vote3Btn" class="bg-red-600 hover:bg-red-700 text-white font-bold py-8 rounded-xl text-4xl shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-4 border-black suppon-font">
                3
            </button>
        </div>
        
        <button id="yoBtn" class="w-full max-w-md bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 rounded-lg text-3xl shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-4 border-black mb-6">
            YO〜！
        </button>
        
        <div id="feedback" class="hidden bg-white/90 border-4 border-black rounded-lg p-4 text-center max-w-sm">
            <div id="feedbackText" class="text-xl font-bold"></div>
        </div>
    </div>
    
    <script>
      const judgeNumber = ${num};
    </script>
    <script src="/judge.js"></script>
</body>
</html>`
  
  return c.html(html)
})

export default app
