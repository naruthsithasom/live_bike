// Model: ผลแต่ละด่าน (ตาราง stage_results)
const { run, QueryTypes } = require('./index');

// บันทึกผลด่าน (ทุกคนในด่าน)
async function save({ stageNo, startedAt, streamer, results, rtype }) {
  if (!Array.isArray(results) || !results.length) return;
  const started = new Date(startedAt || Date.now());
  const rows = results.slice(0, 200).map(r => ({
    stage_no: stageNo | 0, started_at: started, rank_no: r.rank | 0, unique_id: String(r.uid || '').slice(0, 64), nickname: String(r.name || '').slice(0, 191),
    avatar_url: r.avatar || null, kind: String(r.kind || '').slice(0, 10), distance_m: Math.round(r.distanceM || 0), diamonds: Math.round(r.diamonds || 0), streamer: streamer || '',
    race_type: String(rtype || '').slice(0, 12), team: String(r.team || '').slice(0, 40), finished: r.finished ? 1 : 0, likes: Math.round(r.likes || 0),
  }));
  await run('บันทึกผลด่าน', ({ M }) => M.StageResult.bulkCreate(rows));
}

// สถิติรอบที่ผ่านมา: อันดับ 1-3 ของ N รอบล่าสุด
async function history(limit = 10) {
  const rows = await run('ดึงสถิติรอบ', ({ seq }) => seq.query(
    `SELECT stage_no, MAX(finished_at) AS finished_at, MAX(race_type) AS race_type, COUNT(*) AS riders,
            GROUP_CONCAT(CASE WHEN rank_no <= 3 THEN CONCAT(rank_no, '. ', nickname, IF(team <> '', CONCAT(' (', team, ')'), '')) END ORDER BY rank_no SEPARATOR '\\n') AS top3
     FROM stage_results GROUP BY stage_no ORDER BY stage_no DESC LIMIT ?`,
    { replacements: [Math.max(1, Math.min(limit | 0, 50))], type: QueryTypes.SELECT }));
  return (rows || []).map(r => ({ no: r.stage_no, at: r.finished_at, type: r.race_type, riders: Number(r.riders), top3: String(r.top3 || '').split('\n').filter(Boolean) }));
}

async function lastNo() {
  const n = await run('อ่านเลขด่าน', ({ M }) => M.StageResult.max('stage_no'));
  return Number(n) || 0;
}

module.exports = { save, history, lastNo };
