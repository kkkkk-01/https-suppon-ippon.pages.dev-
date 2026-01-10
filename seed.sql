-- すっぽん一本 - Seed Data

-- 審査員データを挿入
INSERT OR IGNORE INTO judges (id, name, judge_number) VALUES 
  (1, '審査員1', 1),
  (2, '審査員2', 2),
  (3, '審査員3', 3),
  (4, '審査員4', 4),
  (5, '審査員5', 5);

-- 初期セッションを作成
INSERT OR IGNORE INTO sessions (id, round_number, is_active, created_at) VALUES 
  (1, 1, 1, CURRENT_TIMESTAMP);

-- 各審査員の初期投票レコードを作成
INSERT OR IGNORE INTO votes (session_id, judge_id, voted, vote_count, voted_at) VALUES 
  (1, 1, 0, 0, NULL),
  (1, 2, 0, 0, NULL),
  (1, 3, 0, 0, NULL),
  (1, 4, 0, 0, NULL),
  (1, 5, 0, 0, NULL);
