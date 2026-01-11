// PC集計画面のJavaScript
let currentSessionId = null;
let hasPlayedIppon = false;
let lastPlayedYoId = null;
let previousTotalVotes = 0;
let lastVoteCheckTime = 0; // 投票音の重複防止

// 音声要素
const ipponAudio = document.getElementById('ipponAudio');
const yoAudio = document.getElementById('yoAudio');
const voteAudio = document.getElementById('voteAudio');

// 状態を更新
async function updateStatus() {
  try {
    const response = await axios.get('/api/status');
    const data = response.data;
    
    // セッションが変わったらIPPON再生フラグと投票数をリセット
    if (currentSessionId !== data.sessionId) {
      currentSessionId = data.sessionId;
      hasPlayedIppon = true; // 新セッションではIPPON音声を再生しない
      previousTotalVotes = data.voteCount; // 現在の投票数を初期値に設定
    }
    
    // 投票数が増えた場合、投票音を再生（500ms以内の重複を防止）
    const now = Date.now();
    if (data.voteCount > previousTotalVotes && now - lastVoteCheckTime > 500) {
      voteAudio.currentTime = 0;
      voteAudio.play().catch(e => console.log('投票音再生エラー:', e));
      lastVoteCheckTime = now;
    }
    previousTotalVotes = data.voteCount;
    
    // 投票カウントを更新
    const voteCountElement = document.getElementById('voteCount');
    if (voteCountElement) {
      voteCountElement.textContent = data.voteCount;
    }
    
    // 各審査員の状態を更新
    for (let i = 1; i <= 5; i++) {
      const judgeCard = document.getElementById(`judge-${i}`);
      const judgeName = document.getElementById(`judge-name-${i}`);
      const statusIcon = document.getElementById(`status-${i}`);
      const votedText = document.getElementById(`voted-text-${i}`);
      
      const voteCount = data.votes[i] || 0;
      
      if (voteCount > 0) {
        // 投票済み
        if (voteCount === 1) {
          statusIcon.textContent = '🟡';
        } else if (voteCount === 2) {
          statusIcon.textContent = '🟠';
        } else {
          statusIcon.textContent = '🔴';
        }
        
        votedText.textContent = `${voteCount}票 / 3票`;
        votedText.className = 'text-lg font-bold mt-2 text-white';
        judgeName.className = 'text-2xl font-bold mb-3 text-white';
        judgeCard.classList.add('voted-card');
        judgeCard.classList.remove('bg-white/90', 'border-black');
      } else {
        // 未投票
        statusIcon.textContent = '⚪️';
        votedText.textContent = '0票 / 3票';
        votedText.className = 'text-lg font-semibold mt-2 text-gray-600';
        judgeName.className = 'text-2xl font-bold mb-3 text-gray-900';
        judgeCard.classList.remove('voted-card');
        judgeCard.classList.add('bg-white/90', 'border-black');
      }
    }
    
    // IPPONバナー表示
    const ipponBanner = document.getElementById('ipponBanner');
    
    // 投票数が8以上で初めてIPPONを達成した時のみ音声再生
    if (data.isIppon && !hasPlayedIppon && data.voteCount >= 8) {
      // IPPON達成時のみ表示と音声再生
      ipponBanner.classList.remove('hidden');
      hasPlayedIppon = true;
      
      // 音声再生のみ（アニメーションなし）
      ipponAudio.currentTime = 0;
      ipponAudio.play().catch(e => console.log('音声再生エラー:', e));
    } else if (data.isIppon) {
      // IPPON状態が続く場合はバナーのみ表示（音声なし）
      ipponBanner.classList.remove('hidden');
    } else {
      // IPPON未達成の場合はバナーを非表示
      ipponBanner.classList.add('hidden');
    }
    
  } catch (error) {
    console.error('ステータス取得エラー:', error);
  }
}

// YO〜イベントをチェック
async function checkYoEvent() {
  try {
    const response = await axios.get('/api/yo/latest');
    const data = response.data;
    
    if (data.hasYo && data.yoId !== lastPlayedYoId) {
      yoAudio.currentTime = 0;
      yoAudio.play().catch(e => console.log('YO音声再生エラー:', e));
      lastPlayedYoId = data.yoId;
    }
  } catch (error) {
    console.error('YO〜イベント取得エラー:', error);
  }
}

// リセットボタン
document.getElementById('resetBtn').addEventListener('click', async () => {
  try {
    await axios.post('/api/reset');
    // リセット後は自動的にupdateStatus()がセッション変更を検知する
    // セッション変更時にhasPlayedIppon=trueに設定されるので音は鳴らない
  } catch (error) {
    console.error('リセットエラー:', error);
    alert('リセットに失敗しました');
  }
});

// 初回読み込み
updateStatus();

// 定期的に状態を更新（100ms間隔で超高速化）
setInterval(updateStatus, 100);

// YO〜イベントをチェック（1秒間隔）
setInterval(checkYoEvent, 1000);

// ページロード時に音声を準備（ブラウザの自動再生ポリシー対応）
document.addEventListener('click', () => {
  ipponAudio.load();
  yoAudio.load();
  voteAudio.load();
}, { once: true });
