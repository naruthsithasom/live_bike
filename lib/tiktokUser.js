// อ่านข้อมูลผู้ใช้จากเหตุการณ์ TikTok (รูปแบบต่างกันตามเวอร์ชันไลบรารี)

// URL รูปโปรไฟล์
function avatarOf(u) {
  if (!u) return '';
  for (const img of [u.profilePicture, u.avatarThumb, u.avatarMedium, u.avatarLarge, u.avatar_thumb, u.avatar_medium, u.avatar_large]) {
    if (!img) continue;
    const list = img.url || img.urls || img.urlList || img.url_list || img.mUrls || [];
    const url = Array.isArray(list) ? list.find(x => typeof x === 'string' && x) : (typeof list === 'string' ? list : '');
    if (url) return url;
  }
  return '';
}
// TikTok รุ่นใหม่ (2026-11) ไม่ส่ง uniqueId แล้ว — ชื่อบัญชีอยู่ใน displayId (เช่น chonlathan_44) และ id เป็นตัวเลข
// เติม uniqueId ให้ทุกเหตุการณ์ตั้งแต่ต้นทาง ระบบเดิม (ติดตาม → นักปั่น, ไลก์, ของขวัญ, เข้าห้อง) จะได้ทำงาน
function fixUser(u) {
  if (!u || typeof u !== 'object') return u;
  if (!u.uniqueId) u.uniqueId = u.displayId || u.username || u.unique_id || u.display_id || (u.id && u.id !== '0' ? String(u.id) : '');
  if (!u.nickname && u.nickName) u.nickname = u.nickName;
  return u;
}
// เติมให้ทุกที่ที่มีข้อมูลผู้ใช้ในเหตุการณ์ (user / userInfo / common.user / details.user)
function fixEventUsers(data) {
  if (!data || typeof data !== 'object') return data;
  fixUser(data.user); fixUser(data.userInfo); fixUser(data.toUser);
  if (data.common) fixUser(data.common.user);
  if (data.details) fixUser(data.details.user);
  return data;
}
function viewerOf(u) { u = u || {}; return { uniqueId: u.uniqueId || '', nickname: u.nickname || u.uniqueId || 'ผู้ชม', avatar: avatarOf(u) }; }
// ผู้ชมคนนี้ติดตามเจ้าของไลฟ์อยู่แล้วหรือยัง (TikTok ส่งมากับข้อมูลผู้ใช้ทุกเหตุการณ์)
function isFollowerUser(u) {
  if (!u) return false;
  const st = (u.followInfo && (u.followInfo.followStatus ?? u.followInfo.follow_status)) ?? u.followRole ?? u.follow_role;
  return Number(st) >= 1 || !!(u.userIdentity && u.userIdentity.isFollowerOfAnchor);
}
// รับได้ทั้ง "ชื่อ", "@ชื่อ" หรือวางลิงก์โปรไฟล์/ไลฟ์ เช่น tiktok.com/@ชื่อ หรือ https://www.tiktok.com/@ชื่อ/live
function cleanUsername(s) {
  s = String(s || '').trim();
  const m = s.match(/@([\w.]{2,24})/);
  return m ? m[1] : s.replace(/^@/, '');
}

module.exports = { avatarOf, viewerOf, isFollowerUser, cleanUsername, fixUser, fixEventUsers };
