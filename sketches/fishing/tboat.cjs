// Draws the boat (and the bowl, the cooler) on a sea-blue page at 1.5x and screenshots it.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const br = await chromium.launch();
  const p = await br.newPage({ viewport: { width: 1300, height: 640 } });
  await p.setContent('<body style="margin:0;background:linear-gradient(#8fd0f6 0 360px,#2bb3d6 360px)"><canvas id=c width=1300 height=640></canvas></body>');
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/fa.js', 'utf8') });
  await p.evaluate(() => {
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    const FA = window.FA;
    ctx.save();
    ctx.translate(40, 360 - FA.BOAT.water * 1.4);
    ctx.scale(1.4, 1.4);
    FA.drawBoat(ctx);
    ctx.restore();
    // King Bob's bowl and the cooler, where they stand
    ctx.save();
    ctx.translate(40 + (FA.BOAT.king - FA.BOWL.w / 2) * 1.4, 360 + (FA.BOAT.deck - FA.BOAT.water + 4 - FA.BOWL.h) * 1.4);
    ctx.scale(1.4, 1.4);
    FA.drawBowlBack(ctx);
    FA.drawBowlFront(ctx);
    ctx.restore();
    ctx.save();
    ctx.translate(40 + (FA.BOAT.cooler - FA.COOLER.w / 2) * 1.4, 360 + (FA.BOAT.deck - FA.BOAT.water + 2 - FA.COOLER.h) * 1.4);
    ctx.scale(1.4, 1.4);
    FA.drawCooler(ctx, false);
    ctx.restore();
  });
  await p.screenshot({ path: process.argv[2] || 'boat.png' });
  await br.close();
})();
