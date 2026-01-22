// PC集計画面のJavaScript

// ============================================
// グローバル変数
// ============================================
let currentSessionId = null;
let hasPlayedIppon = false;
let lastPlayedYoId = null;
let previousTotalVotes = 0;
let audioInitialized = false; // 音声初期化フラグ

// ============================================
// DOM要素
// ============================================
const ipponAudio = document.getElementById('ipponAudio');
const yoAudio = document.getElementById('yoAudio');
const voteAudio = document.getElementById('voteAudio');
const ipponBanner = document.getElementById('ipponBanner');
const voteCountElement = document.getElementById('voteCount');
const resetBtn = document.getElementById('resetBtn');

// ============================================
// メイン処理: 状態更新
// ============================================
async function updateStatus() {
  try {
    const response = await axios.get('/api/status');
    const data = response.data;
    
    // セッション変更検知
    if (currentSessionId !== data.sessionId) {
      console.log('🔄 セッション変更:', { old: currentSessionId, new: data.sessionId });
      currentSessionId = data.sessionId;
      hasPlayedIppon = false;
      previousTotalVotes = data.voteCount; // ← 現在の投票数で初期化（音を防ぐ）
      console.log('✅ セッション変更完了: previousTotalVotes =', previousTotalVotes);
      return; // セッション変更時は音声チェックをスキップ
    }
    
    // 投票音再生
    // 投票数が増えたら1回だけ音声を再生
    console.log('🎯 投票チェック:', { 
      voteCount: data.voteCount, 
      previousTotalVotes,
      shouldPlay: data.voteCount > previousTotalVotes
    });
    
    if (data.voteCount > previousTotalVotes) {
      console.log('🔔 投票音を再生');
      playAudio(voteAudio);
    }
    previousTotalVotes = data.voteCount;
    
    // 投票数表示更新
    if (voteCountElement) {
      voteCountElement.textContent = data.voteCount;
    }
    
    // 審査員状態更新
    updateJudgesDisplay(data.votes);
    
    // IPPON表示と音声
    updateIpponDisplay(data.isIppon);
    
    // YO〜イベントチェック（同じレスポンスに含まれる）
    if (data.yo && data.yo.hasYo && data.yo.yoId !== lastPlayedYoId) {
      playAudio(yoAudio);
      lastPlayedYoId = data.yo.yoId;
    }
    
  } catch (error) {
    console.error('ステータス取得エラー:', error);
  }
}

// ============================================
// 審査員表示更新
// ============================================
function updateJudgesDisplay(votes) {
  for (let i = 1; i <= 5; i++) {
    const judgeCard = document.getElementById(`judge-${i}`);
    const judgeName = document.getElementById(`judge-name-${i}`);
    const statusIcon = document.getElementById(`status-${i}`);
    const votedText = document.getElementById(`voted-text-${i}`);
    
    const voteCount = votes[i] || 0;
    
    if (voteCount > 0) {
      // 投票済みスタイル
      updateVotedJudge(statusIcon, votedText, judgeName, judgeCard, voteCount);
    } else {
      // 未投票スタイル
      updateUnvotedJudge(statusIcon, votedText, judgeName, judgeCard);
    }
  }
}

// 投票済み審査員の表示
function updateVotedJudge(statusIcon, votedText, judgeName, judgeCard, voteCount) {
  // アイコン設定
  if (voteCount === 1) {
    statusIcon.textContent = '🟡';
  } else if (voteCount === 2) {
    statusIcon.textContent = '🟠';
  } else {
    statusIcon.textContent = '🔴';
  }
  
  // テキストとスタイル
  votedText.textContent = `${voteCount}票 / 3票`;
  votedText.className = 'text-lg font-bold mt-2 text-white';
  judgeName.className = 'text-2xl font-bold mb-3 text-white';
  judgeCard.classList.add('voted-card');
  judgeCard.classList.remove('bg-white/90', 'border-black');
}

// 未投票審査員の表示
function updateUnvotedJudge(statusIcon, votedText, judgeName, judgeCard) {
  statusIcon.textContent = '⚪️';
  votedText.textContent = '0票 / 3票';
  votedText.className = 'text-lg font-semibold mt-2 text-gray-600';
  judgeName.className = 'text-2xl font-bold mb-3 text-gray-900';
  judgeCard.classList.remove('voted-card');
  judgeCard.classList.add('bg-white/90', 'border-black');
}

// ============================================
// IPPON表示と音声
// ============================================
function updateIpponDisplay(isIppon) {
  if (isIppon && !hasPlayedIppon && !isResetting) {
    // IPPON達成：バナー表示 + 音声再生
    ipponBanner.classList.remove('hidden');
    hasPlayedIppon = true;
    playAudio(ipponAudio);
  } else if (isIppon) {
    // IPPON継続：バナーのみ表示
    ipponBanner.classList.remove('hidden');
  } else {
    // IPPON未達成：バナー非表示
    ipponBanner.classList.add('hidden');
  }
}

// YO〜イベントは updateStatus() 内で処理するため削除

// ============================================
// リセット処理
// ============================================
async function handleReset() {
  try {
    console.log('🔄 リセット開始');
    
    // ポーリングを一時停止
    stopPolling();
    
    // リセットAPIを呼ぶ
    await axios.post('/api/reset');
    
    // 100ms待機してリセットを確実に完了
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // ポーリングを再開（セッション変更は updateStatus() で自動検知される）
    startPolling();
    
    console.log('✅ リセット完了');
    
  } catch (error) {
    console.error('リセットエラー:', error);
    alert('リセットに失敗しました');
    // エラー時もポーリングを再開
    startPolling();
  }
}

// ============================================
// ユーティリティ: 音声再生
// ============================================
function playAudio(audioElement) {
  // 音声が初期化されていない場合はスキップ
  if (!audioInitialized) {
    return;
  }
  
  // 音声を最初から再生（再生中でも強制的にリセット）
  audioElement.currentTime = 0;
  audioElement.play().catch(e => {
    // エラーが出ても無視（AbortErrorは正常動作）
  });
}

// ============================================
// イベントリスナー設定
// ============================================
resetBtn.addEventListener('click', handleReset);

// 初回クリック時に音声を準備（自動再生ポリシー対応）
document.addEventListener('click', () => {
  // 音声を読み込み
  ipponAudio.load();
  yoAudio.load();
  voteAudio.load();
  
  // ミュート再生して自動再生許可を得る
  Promise.all([ipponAudio, yoAudio, voteAudio].map(audio => {
    audio.muted = true;
    return audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
    }).catch(e => console.log('音声初期化:', e));
  })).then(() => {
    // 全ての音声が初期化完了
    audioInitialized = true;
  });
}, { once: true });

// ============================================
// 初期化と定期更新
// ============================================
let statusIntervalId = null;

// ポーリング開始
function startPolling() {
  if (!statusIntervalId) {
    updateStatus();
    statusIntervalId = setInterval(updateStatus, 250); // 250ms間隔
  }
}

// ポーリング停止
function stopPolling() {
  if (statusIntervalId) {
    clearInterval(statusIntervalId);
    statusIntervalId = null;
  }
}

// 画面の表示/非表示でポーリングを制御
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopPolling(); // 画面が非表示になったら停止
  } else {
    startPolling(); // 画面が表示されたら再開
  }
});

// 初回起動
startPolling();
