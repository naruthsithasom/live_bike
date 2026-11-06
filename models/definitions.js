// นิยามตารางด้วย Sequelize (สร้างตารางอัตโนมัติจากที่นี่ + เพิ่มคอลัมน์ใหม่ให้ตารางเดิม)
// ชื่อ attribute = ชื่อคอลัมน์จริง (snake_case) เพื่อให้คัดลอกแถวระหว่างฐานข้อมูล 2 ที่ได้ตรงๆ
const { DataTypes, literal } = require('sequelize');

const TABLE_OPTS = { timestamps: false, freezeTableName: true, charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', engine: 'InnoDB' };

function defineModels(seq) {
  // ผู้ชม: 1 แถวต่อ 1 บัญชี TikTok (ยอดเพชรรวม, ทีมที่เลือก, เวลากดติดตาม)
  const Viewer = seq.define('Viewer', {
    unique_id:      { type: DataTypes.STRING(64), primaryKey: true, allowNull: false },
    nickname:       { type: DataTypes.STRING(191), allowNull: false, defaultValue: '' },
    avatar_url:     { type: DataTypes.TEXT, allowNull: true },
    team:           { type: DataTypes.TINYINT, allowNull: true, comment: '0 = คุณ, 1-5 = คู่แข่ง' },
    total_diamonds: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    gift_count:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    first_seen:     { type: DataTypes.DATE, allowNull: false, defaultValue: literal('CURRENT_TIMESTAMP') },
    last_seen:      { type: DataTypes.DATE, allowNull: false, defaultValue: literal('CURRENT_TIMESTAMP') },
    followed_at:    { type: DataTypes.DATE, allowNull: true },
  }, { ...TABLE_OPTS, tableName: 'viewers' });

  // ของขวัญ: 1 แถวต่อการส่ง 1 ครั้ง (นับตอนส่งต่อเนื่องจบแล้ว)
  const Gift = seq.define('Gift', {
    id:             { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    unique_id:      { type: DataTypes.STRING(64), allowNull: false },
    nickname:       { type: DataTypes.STRING(191), allowNull: false, defaultValue: '' },
    avatar_url:     { type: DataTypes.TEXT, allowNull: true },
    gift_name:      { type: DataTypes.STRING(100), allowNull: false },
    gift_count:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    diamonds_each:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    total_diamonds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    action:         { type: DataTypes.STRING(20), allowNull: false, defaultValue: '' },
    target:         { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    streamer:       { type: DataTypes.STRING(64), allowNull: false, defaultValue: '' },
    is_test:        { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
    created_at:     { type: DataTypes.DATE(3), allowNull: false, defaultValue: literal('CURRENT_TIMESTAMP(3)') },
  }, { ...TABLE_OPTS, tableName: 'gifts', indexes: [{ name: 'idx_created', fields: ['created_at'] }, { name: 'idx_user', fields: ['unique_id'] }] });

  // ผลแต่ละด่าน (โหมดแข่งผู้ติดตาม): 1 แถวต่อนักปั่น 1 คนต่อ 1 ด่าน
  const StageResult = seq.define('StageResult', {
    id:          { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    stage_no:    { type: DataTypes.INTEGER, allowNull: false },
    started_at:  { type: DataTypes.DATE, allowNull: false },
    finished_at: { type: DataTypes.DATE, allowNull: false, defaultValue: literal('CURRENT_TIMESTAMP') },
    rank_no:     { type: DataTypes.INTEGER, allowNull: false },
    unique_id:   { type: DataTypes.STRING(64), allowNull: false, defaultValue: '' },
    nickname:    { type: DataTypes.STRING(191), allowNull: false, defaultValue: '' },
    avatar_url:  { type: DataTypes.TEXT, allowNull: true },
    kind:        { type: DataTypes.STRING(10), allowNull: false, defaultValue: '', comment: 'owner / bot / follower' },
    distance_m:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    diamonds:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    streamer:    { type: DataTypes.STRING(64), allowNull: false, defaultValue: '' },
    race_type:   { type: DataTypes.STRING(12), allowNull: false, defaultValue: '', comment: 'classic / survival / nation' },
    team:        { type: DataTypes.STRING(40), allowNull: false, defaultValue: '' },
    finished:    { type: DataTypes.TINYINT(1), allowNull: false, defaultValue: 0 },
    likes:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ...TABLE_OPTS, tableName: 'stage_results', indexes: [{ name: 'idx_stage', fields: ['stage_no', 'rank_no'] }] });

  return { Viewer, Gift, StageResult };
}

// สร้างตารางที่ยังไม่มี + เพิ่มคอลัมน์ที่ model มีแต่ตารางเดิมยังไม่มี (ไม่ลบ/ไม่แก้ของเดิม → ข้อมูลปลอดภัย)
async function syncSchema(seq, models) {
  const qi = seq.getQueryInterface();
  for (const M of Object.values(models)) {
    await M.sync();
    const have = await qi.describeTable(M.getTableName());
    for (const [name, attr] of Object.entries(M.rawAttributes)) {
      if (have[name]) continue;
      await qi.addColumn(M.getTableName(), name, { type: attr.type, allowNull: attr.allowNull !== false, defaultValue: attr.defaultValue, comment: attr.comment });
      console.log(`🗄️  เพิ่มคอลัมน์ ${M.getTableName()}.${name}`);
    }
  }
}

module.exports = { defineModels, syncSchema };
