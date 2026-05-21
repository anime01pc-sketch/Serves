const db = require('../db');

function initCronScheduler() {
  setInterval(async () => {
    try {
      const users = await db.filter('users', u => 
        u.status === 'active' && 
        u.expiry_date && 
        Date.now() > u.expiry_date
      );
      
      for (const user of users) {
        await db.update('users', u => u.id === user.id, { status: 'expired' });
        console.log(`[AUTO-EXPIRE] User ${user.username} expired`);
      }
      
      if (users.length > 0) {
        console.log(`[AUTO-EXPIRE] ${users.length} accounts expired`);
      }
    } catch(e) {
      console.error('[AUTO-EXPIRE] Error:', e);
    }
  }, 300000);

  setInterval(async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const pcs = await db.filter('pcs', p =>
        (p.session_end > 0 && p.session_end < now) ||
        (p.stopwatch_start > 0 && p.stopwatch_start < now - 86400)
      );
      for (const pc of pcs) {
        await db.update('pcs', p => p.id === pc.id, { session_end: 0, stopwatch_start: 0 });
        console.log(`[AUTO-END] Session ended for PC ${pc.id}`);
      }
    } catch(e) {
      console.error('[AUTO-END] Error:', e);
    }
  }, 60000);

  setInterval(async () => {
    try {
      const now = new Date();
      const singaporeTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
      const currentTime = `${String(singaporeTime.getHours()).padStart(2, '0')}:${String(singaporeTime.getMinutes()).padStart(2, '0')}`;
      
      const groups = await db.filter('groups', g => g.flush_time === currentTime);
      for (const group of groups) {
        const pcs = await db.filter('pcs', p => p.group_id === group.id);
        for (const pc of pcs) {
          if (pc.time_history && pc.time_history.length > 0) {
            await db.update('pcs', p => p.id === pc.id, { time_history: [] });
            console.log(`[FLUSH] History cleared for PC ${pc.name} in group ${group.name}`);
          }
        }
        if (pcs.length > 0) {
          console.log(`[FLUSH] ${pcs.length} PCs history cleared for group ${group.name}`);
        }
      }
    } catch(e) {
      console.error('[FLUSH] Error:', e);
    }
  }, 60000);
}

module.exports = {
  initCronScheduler
};
