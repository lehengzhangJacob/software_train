-- OPTIONAL LEGACY DEMO FIXTURE ONLY.
-- Normal initialization uses prisma/seed.ts and does not create demo users or meals.
-- ============================================================
-- 初始化数据脚本
-- 包含：运动热量参考数据、示例用户数据
-- ============================================================

-- ============================================================
-- 1. 运动热量消耗参考数据（以60kg体重为基准，每30分钟）
-- 数据来源：Compendium of Physical Activities (2011)
-- ============================================================
INSERT OR IGNORE INTO exercise_calorie_reference (exercise_name, calories_per_30min, category, met_value, description) VALUES
-- 有氧运动
('步行（慢速，4km/h）',     80,  'aerobic', 2.8, '散步式步行，适合饭后消食'),
('步行（中速，5.6km/h）',  110,  'aerobic', 3.8, '正常步行速度'),
('步行（快速，7km/h）',    150,  'aerobic', 5.0, '快走，有明显出汗感'),
('跑步（慢跑，8km/h）',    240,  'aerobic', 8.0, '慢跑，可边跑边交谈'),
('跑步（中速，10km/h）',   300,  'aerobic', 10.0, '中等速度跑步'),
('跑步（快速，12km/h）',   360,  'aerobic', 12.0, '快速跑步'),
('骑行（休闲，<16km/h）',  140,  'aerobic', 4.0, '休闲骑行'),
('骑行（中速，16-22km/h）', 240,  'aerobic', 8.0, '中等速度骑行'),
('骑行（快速，>22km/h）',  330,  'aerobic', 10.0, '快速或竞赛骑行'),
('游泳（休闲）',           180,  'aerobic', 6.0, '休闲游泳，间歇性'),
('游泳（中速，自由泳）',    250,  'aerobic', 8.3, '持续中速游泳'),
('游泳（快速，竞技）',      350,  'aerobic', 11.0, '快速竞技游泳'),
('跳绳（中速）',           300,  'aerobic', 10.0, '中等速度跳绳'),
('跳绳（快速）',           360,  'aerobic', 12.0, '快速跳绳'),
('有氧操/健身操',          200,  'aerobic', 6.5, '团体有氧操课程'),
('爬楼梯',                 250,  'aerobic', 8.0, '匀速爬楼梯'),
('椭圆机',                 210,  'aerobic', 7.0, '椭圆机中等强度'),
('划船机',                 210,  'aerobic', 7.0, '划船机中等强度'),

-- 力量训练
('力量训练（中等强度）',    150,  'strength', 5.0, '举重、器械训练等'),
('力量训练（高强度）',      210,  'strength', 7.0, '大重量/高强度力量训练'),
('俯卧撑/仰卧起坐',        120,  'strength', 3.8, '自重训练'),
('深蹲/弓步蹲',            150,  'strength', 5.0, '自重或轻负重下肢训练'),

-- 柔韧/其他
('瑜伽',                    100,  'flexibility', 3.3, '哈他瑜伽/流瑜伽'),
('太极',                     90,  'flexibility', 3.0, '太极拳练习'),
('拉伸',                     60,  'flexibility', 2.0, '静态拉伸放松'),

-- 球类运动
('羽毛球',                  180,  'aerobic', 5.5, '休闲双打'),
('乒乓球',                  140,  'aerobic', 4.0, '休闲对打'),
('篮球（半场）',            240,  'aerobic', 8.0, '半场对抗'),
('足球（休闲）',            240,  'aerobic', 7.0, '休闲足球'),

-- 日常活动
('家务劳动（清洁/拖地）',   100,  'other', 3.3, '中度家务劳动'),
('园艺',                    120,  'other', 4.0, '种花、除草等'),
('遛狗',                     90,  'aerobic', 3.0, '散步遛狗');

-- ============================================================
-- 2. 示例用户数据（用于开发测试）
-- ============================================================
INSERT OR IGNORE INTO user_profile (username, gender, age, height_cm, weight_kg, daily_calorie_target, daily_protein_target, daily_fat_target, daily_carbs_target, activity_level)
VALUES
('测试用户_张三', 'male',   28, 175.0, 70.0, 2200, 80.0, 65.0, 280.0, 'moderately_active'),
('测试用户_李四', 'female', 25, 162.0, 55.0, 1800, 60.0, 50.0, 220.0, 'lightly_active');

-- ============================================================
-- 3. 示例饮食记录数据（用于前端开发和测试）
-- 注意：以下数据record_date为演示，实际运行时请使用当前日期
-- ============================================================

-- 张三今日早餐
INSERT INTO meal_records (user_id, food_name, meal_type, calories, protein_g, fat_g, carbs_g, portion_desc, record_date, record_time, notes)
VALUES
(1, '鸡蛋（煮）x2',        'breakfast', 144, 12.6, 9.6,  1.2,  '2个中等大小',        date('now','localtime'), '08:00', '水煮蛋'),
(1, '全麦面包x2',          'breakfast', 180, 7.0,  2.5,  35.0, '2片',               date('now','localtime'), '08:00', NULL),
(1, '牛奶（全脂）',         'breakfast', 150, 8.0,  8.0,  12.0, '1杯约250ml',        date('now','localtime'), '08:00', NULL),
(1, '苹果',                'breakfast',  80, 0.5,  0.2,  21.0, '1个中等大小约200g', date('now','localtime'), '08:00', NULL);

-- 张三今日午餐
INSERT INTO meal_records (user_id, food_name, meal_type, calories, protein_g, fat_g, carbs_g, portion_desc, record_date, record_time, notes)
VALUES
(1, '米饭',                'lunch', 260, 5.2,  0.6,  57.0, '1碗约200g',    date('now','localtime'), '12:30', NULL),
(1, '宫保鸡丁',            'lunch', 350, 28.0, 18.0, 12.0, '1份约250g',    date('now','localtime'), '12:30', NULL),
(1, '清炒时蔬',            'lunch',  80, 3.0,  4.0,  8.0,  '1份约200g',    date('now','localtime'), '12:30', NULL);

-- 张三今日晚餐
INSERT INTO meal_records (user_id, food_name, meal_type, calories, protein_g, fat_g, carbs_g, portion_desc, record_date, record_time, notes)
VALUES
(1, '番茄蛋汤',            'dinner', 120, 6.0,  6.0,  8.0,  '1碗约300ml',   date('now','localtime'), '18:30', NULL),
(1, '清蒸鱼',              'dinner', 200, 32.0, 6.0,  2.0,  '1条约200g',    date('now','localtime'), '18:30', NULL),
(1, '杂粮饭',              'dinner', 220, 5.0,  1.5,  48.0, '1碗约180g',    date('now','localtime'), '18:30', NULL);

-- 李四今日记录
INSERT INTO meal_records (user_id, food_name, meal_type, calories, protein_g, fat_g, carbs_g, portion_desc, record_date, record_time, notes)
VALUES
(2, '酸奶+蓝莓',           'breakfast', 180, 10.0, 3.0,  28.0, '1杯酸奶+一把蓝莓',   date('now','localtime'), '07:45', NULL),
(2, '鸡胸肉沙拉',          'lunch',    320, 35.0, 12.0, 15.0, '1份约350g',          date('now','localtime'), '12:00', '低脂高蛋白'),
(2, '三文鱼+芦笋',         'dinner',   420, 38.0, 22.0, 10.0, '三文鱼150g+芦笋200g', date('now','localtime'), '18:00', '健康晚餐'),
(2, '坚果混合',            'snack',    160, 5.0,  14.0, 6.0,  '一小把约30g',         date('now','localtime'), '15:30', '下午加餐');

-- ============================================================
-- 4. 示例运动建议
-- ============================================================
INSERT INTO exercise_suggestions (user_id, suggestion_date, calorie_surplus, exercise_type, duration_minutes, calorie_burn_estimate, intensity, suggestion_detail)
VALUES
(1, date('now','localtime'), 180, '慢跑',    30, 240, 'moderate', '今日热量略超目标，建议进行30分钟慢跑（约8km/h），可消耗约240千卡。'),
(2, date('now','localtime'), -50, '步行',    30, 110, 'low',      '今日热量摄入在合理范围内，建议散步30分钟保持健康习惯。');
