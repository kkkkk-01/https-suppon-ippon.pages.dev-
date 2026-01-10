// 審査員用JavaScriptロジック
let currentVoteCount = 0;
let hasVoted = false;
let isProcessing = false;
let currentSessionId = null;

// 状態を更新
async function updateStatus() {
  try {
    const response = await axios.get('/api/status');
    const data = response.data;
    
    // セッションIDが変わった場合、投票フラグをクリア
    if (currentSessionId !== null && data.sessionId !== currentSessionId) {
      hasVoted = false;
      currentVoteCount = 0;
      isProcessing = false;
    }
    
    currentSessionId = data.sessionId;
    currentVoteCount = data.votes[judgeNumber] || 0;
    document.getElementById('currentVoteCount').textContent = currentVoteCount;
    
    hasVoted = currentVoteCount > 0;
    updateButtonStates();
  } catch (error) {
    console.error('ステータス取得エラー:', error);
  }
}

// ボタンの状態を更新
function updateButtonStates() {
  const vote1Btn = document.getElementById('vote1Btn');
  const vote2Btn = document.getElementById('vote2Btn');
  const vote3Btn = document.getElementById('vote3Btn');
  
  if (!vote1Btn || !vote2Btn || !vote3Btn) {
    console.error('投票ボタン要素が見つかりません');
    return;
  }
  
  const shouldDisable = hasVoted || isProcessing;
  
  [vote1Btn, vote2Btn, vote3Btn].forEach(btn => {
    btn.disabled = shouldDisable;
    if (shouldDisable) {
      btn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  });
}

// 投票処理
async function voteMultiple(count) {
  if (hasVoted) {
    showFeedback('既に投票済みです', 'error');
    return;
  }
  
  if (isProcessing) {
    return;
  }
  
  try {
    isProcessing = true;
    showLoadingOverlay(true);
    updateButtonStates();
    
    const response = await axios.post('/api/vote', {
      judgeNumber: judgeNumber,
      voteCount: count
    });
    
    if (!response.data.success) {
      throw new Error(response.data.error || '投票に失敗しました');
    }
    
    hasVoted = true;
    showLoadingOverlay(false);
    showFeedback(`${count}票投票しました！\n投票完了です`, 'success');
    await updateStatus();
  } catch (error) {
    console.error('投票エラー:', error);
    showLoadingOverlay(false);
    showFeedback(error.response?.data?.error || '投票に失敗しました', 'error');
    isProcessing = false;
    updateButtonStates();
  } finally {
    isProcessing = false;
  }
}

// YO〜送信
async function sendYo() {
  if (isProcessing) return;
  
  try {
    isProcessing = true;
    await axios.post('/api/yo', { judgeNumber: judgeNumber });
  } catch (error) {
    console.error('YO送信エラー:', error);
  } finally {
    setTimeout(() => { isProcessing = false; }, 1000);
  }
}

// ローディングオーバーレイの表示/非表示
function showLoadingOverlay(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  
  if (show) {
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

// フィードバック表示
function showFeedback(message, type = 'info') {
  const feedback = document.getElementById('feedback');
  const feedbackText = document.getElementById('feedbackText');
  
  if (!feedback || !feedbackText) return;
  
  feedbackText.textContent = message;
  
  const colorMap = {
    success: 'text-xl font-bold text-green-600',
    error: 'text-xl font-bold text-red-600',
    info: 'text-xl font-bold text-gray-800'
  };
  feedbackText.className = colorMap[type] || colorMap.info;
  
  feedback.classList.remove('hidden');
  setTimeout(() => feedback.classList.add('hidden'), 3000);
}

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', function() {
  const vote1Btn = document.getElementById('vote1Btn');
  const vote2Btn = document.getElementById('vote2Btn');
  const vote3Btn = document.getElementById('vote3Btn');
  const yoBtn = document.getElementById('yoBtn');
  
  if (!vote1Btn || !vote2Btn || !vote3Btn || !yoBtn) {
    console.error('必要な要素が見つかりません');
    return;
  }
  
  vote1Btn.addEventListener('click', () => voteMultiple(1));
  vote2Btn.addEventListener('click', () => voteMultiple(2));
  vote3Btn.addEventListener('click', () => voteMultiple(3));
  yoBtn.addEventListener('click', sendYo);
  
  updateStatus();
  setInterval(updateStatus, 3000);
});
