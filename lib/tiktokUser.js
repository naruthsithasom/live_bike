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

module.exports = { avatarOf, viewerOf, isFollowerUser, cleanUsername };
