// Model: ผู้ชม (ตาราง viewers)
const { run, QueryTypes } = require('./index');

// เพิ่ม/อัปเดตผู้ชม พร้อมบวกยอดเพชร (ต้องใช้ ON DUPLICATE KEY เพราะ Sequelize upsert บวกค่าเดิมไม่ได้)
function upsert(seq, { uniqueId, nickname, avatar, team, diamonds, gifts }) {
  return seq.query(
    `INSERT INTO viewers (unique_id, nickname, avatar_url, team, total_diamonds, gift_count)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       nickname = IF(VALUES(nickname) = '', nickname, VALUES(nickname)),
       avatar_url = IF(VALUES(avatar_url) IS NULL OR VALUES(avatar_url) = '', avatar_url, VALUES(avatar_url)),
       team = IFNULL(VALUES(team), team),
       total_diamonds = total_diamonds + VALUES(total_diamonds),
       gift_count = gift_count + VALUES(gift_count),
       last_seen = CURRENT_TIMESTAMP`,
    { replacements: [uniqueId, nickname || '', avatar || null, team === undefined ? null : team, diamonds || 0, gifts || 0] });
}

// ผู้ชมพิมพ์เลือกทีมในแชท
async function setTeam({ uniqueId, nickname, avatar, team }) {
  if (!uniqueId) return;
  await run('บันทึกทีม', ({ seq }) => upsert(seq, { uniqueId, nickname, avatar, team }));
}

// ผู้ชมกดติดตาม
async function markFollow({ uniqueId, nickname, avatar }) {
  if (!uniqueId) return;
  await run('บันทึกการกดติดตาม', async ({ seq, M }) => {
    await upsert(seq, { uniqueId, nickname, avatar });
    await M.Viewer.update({ followed_at: seq.literal('IFNULL(followed_at, CURRENT_TIMESTAMP)') }, { where: { unique_id: uniqueId } });
  });
}

// ทีมที่ผู้ชมเคยเลือกไว้ (โหลดตอนเปิดเซิร์ฟเวอร์ จะได้จำข้ามไลฟ์)
async function loadTeams() {
  const rows = await run('โหลดทีม', ({ M, seq }) => M.Viewer.findAll({ attributes: ['unique_id', 'team'], where: seq.literal('team IS NOT NULL'), raw: true }));
  return rows || [];
}

// ผู้ติดตามล่าสุด (เรียงตามเวลาที่กดติดตาม/เข้าร่วมครั้งแรก)
async function recentFollowers(limit = 50) {
  const out = await run('ดึงผู้ติดตาม', async ({ M, seq }) => {
    const where = seq.literal('followed_at IS NOT NULL');
    const rows = await M.Viewer.findAll({ where, order: [['followed_at', 'DESC']], limit: Math.max(1, Math.min(limit | 0, 500)), raw: true });
    const total = await M.Viewer.count({ where });
    return { total, rows: rows.map(r => ({ uniqueId: r.unique_id, nickname: r.nickname, avatar: r.avatar_url || '', diamonds: Number(r.total_diamonds), gifts: Number(r.gift_count), at: r.followed_at ? new Date(r.followed_at).getTime() : 0, lastSeen: r.last_seen })) };
  });
  return out || { total: 0, rows: [] };
}

async function count() {
  return run('นับผู้ชม', ({ M }) => M.Viewer.count());
}

module.exports = { upsert, setTeam, markFollow, loadTeams, recentFollowers, count, QueryTypes };
