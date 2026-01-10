import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

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
  
  return c.json({
    sessionId: session.id,
    roundNumber: session.round_number,
    voteCount: totalVoteCount,
    maxVotes: 15,
    votes,
    isIppon
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
  await DB.prepare(`
    INSERT INTO sessions (round_number, is_active, created_at)
    VALUES (?, 1, CURRENT_TIMESTAMP)
  `).bind(nextRound).run()
  
  return c.json({ success: true, round: nextRound })
})

// API: Vote (from smartphone)
app.post('/api/vote', async (c) => {
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
  
  // Get current vote count
  const currentVote = await DB.prepare(`
    SELECT vote_count FROM votes
    WHERE session_id = ? AND judge_id = ?
  `).bind(session.id, judge.id).first<{ vote_count: number }>()
  
  const currentCount = currentVote?.vote_count || 0
  
  // 最大3票まで
  if (currentCount >= 3) {
    return c.json({ error: 'Maximum 3 votes per judge', currentCount: 3 }, 400)
  }
  
  const newCount = currentCount + 1
  
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

// Root route - redirect to index.html
app.get('/', (c) => {
  return c.redirect('/index.html')
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
        
        <div class="grid grid-cols-3 gap-4 w-full max-w-md mb-8">
            <button id="vote1Btn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-8 rounded-xl text-4xl shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-4 border-black suppon-font">
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
