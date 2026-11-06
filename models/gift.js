// Model: ของขวัญ (ตาราง gifts)
const { run, QueryTypes } = require('./index');
const viewer = require('./viewer');

// บันทึกของขวัญ 1 ครั้ง (ไม่ throw — ถ้าพังแค่ข้าม)
async function log(g) {
  if (!g.uniqueId) return;
  const total = (g.count || 1) * (g.diamonds || 0);
  await run('บันทึกของขวัญ', async ({ seq, M }) => {
    await M.Gift.create({
      unique_id: g.uniqueId, nickname: g.nickname || '', avatar_url: g.avatar || null, gift_name: String(g.giftName || '').slice(0, 100),
      gift_count: g.count || 1, diamonds_each: g.diamonds || 0, total_diamonds: total, action: g.action || '', target: g.target || 0,
      streamer: g.streamer || '', is_test: g.isTest ? 1 : 0,
    });
    if (!g.isTest) await viewer.upsert(seq, { uniqueId: g.uniqueId, nickname: g.nickname, avatar: g.avatar, diamonds: total, gifts: g.count || 1 });
  });
}

// Top ผู้ส่งเพชรในช่วง N นาทีล่าสุด
async function topGifters({ minutes = 10, limit = 3, includeTest = false } = {}) {
  const rows = await run('ดึงอันดับ', ({ seq }) => seq.query(
    `SELECT unique_id AS uniqueId,
            IFNULL(SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(nickname, '') ORDER BY id DESC SEPARATOR '\\n'), '\\n', 1), '') AS nickname,
            IFNULL(SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(avatar_url, '') ORDER BY id DESC SEPARATOR '\\n'), '\\n', 1), '') AS avatar,
            SUM(total_diamonds) AS diamonds, SUM(gift_count) AS gifts
     FROM gifts
     WHERE created_at >= NOW(3) - INTERVAL ? MINUTE ${includeTest ? '' : 'AND is_test = 0'}
     GROUP BY unique_id
     ORDER BY diamonds DESC, MAX(id) ASC
     LIMIT ?`,
    { replacements: [Math.max(1, minutes | 0), Math.max(1, Math.min(limit | 0, 50))], type: QueryTypes.SELECT }));
  return (rows || []).map(r => ({ ...r, diamonds: Number(r.diamonds), gifts: Number(r.gifts) }));
}

// จำนวนของขวัญจริง (ไม่นับทดสอบ) + เพชรรวม
async function totals() {
  return run('สถิติของขวัญ', async ({ M }) => {
    const where = { is_test: 0 };
    const [gifts, diamonds] = await Promise.all([M.Gift.count({ where }), M.Gift.sum('total_diamonds', { where })]);
    return { gifts, diamonds: Number(diamonds) || 0 };
  });
}

module.exports = { log, topGifters, totals };
