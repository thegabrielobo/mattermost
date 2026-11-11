const fs = require('node:fs');
const path = require('node:path');
const {spawn, execFileSync} = require('node:child_process');
const {chromium} = require(path.join(process.env.PSWE07_VISUAL_TOOLS, 'node_modules/playwright'));
const root = process.cwd();
const component = 'webapp/channels/src/components/post_view/post_list_virtualized/post_list_virtualized.tsx';
const fixed = fs.readFileSync(component);
const baseline = execFileSync('git', ['show', 'e8bd2b8a871cbeff6943bead62328478118188df:' + component]);
const fixture = JSON.parse(fs.readFileSync(path.join(process.env.RUNNER_TEMP, 'pswe07-visual-fixture.json')));
const out = path.join(root, 'visual-evidence');
const origin = 'http://127.0.0.1:9005';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForApp(child) {
    for (let i = 0; i < 150; i++) {
        if (child.exitCode !== null) throw new Error(`Webpack exited with ${child.exitCode}`);
        try {const r = await fetch(origin + '/static/root.html', {signal: AbortSignal.timeout(4000)}); if (r.ok) return;} catch {}
        await pause(2000);
    }
    throw new Error('Webapp did not become ready');
}

async function capture(browser, phase) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, timezoneId: 'UTC', locale: 'en-US',
        recordVideo: {dir: path.join(out, phase + '-video'), size: {width: 390, height: 844}}});
    const login = await context.request.post(origin + '/api/v4/users/login', {data: {login_id: fixture.username, password: fixture.password}});
    if (!login.ok()) throw new Error('Test user login failed: ' + login.status());
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
        window.__dateProbe = [];
        function sample() {
            const el = document.querySelector('[data-testid="floatingTimestamp"]');
            if (el) {
                const style = getComputedStyle(el);
                window.__dateProbe.push({ms: performance.now(), text: el.textContent.trim(),
                    scrolling: el.classList.contains('scrolling'), opacity: Number(style.opacity),
                    visible: style.visibility !== 'hidden' && Number(style.opacity) > 0.05,
                    path: location.pathname});
            }
            requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
    });
    const trials = [];
    for (let repeat = 0; repeat < 2; repeat++) {
        for (const channel of fixture.channels) {
            await context.request.post(origin + '/api/v4/channels/members/me/view', {data: {channel_id: channel.id}});
            await page.goto(`${origin}/${fixture.team}/channels/${channel.name}`, {waitUntil: 'domcontentloaded'});
            await page.locator('#postListScrollContainer').waitFor({state: 'visible'});
            await page.waitForTimeout(2500);
            const frames = await page.evaluate(() => window.__dateProbe);
            const finalLabel = frames.at(-1)?.text ?? '';
            const mismatches = frames.filter(frame => frame.scrolling && frame.visible && finalLabel.toLowerCase() === 'today' && frame.text.toLowerCase() === 'yesterday');
            const shot = `${phase}-${channel.name}-${repeat}.png`;
            await page.screenshot({path: path.join(out, shot), fullPage: false});
            trials.push({channel: channel.name, repeat, finalLabel, wrongVisibleFrames: mismatches.length,
                visibleInitialFrames: frames.filter(f => f.scrolling && f.visible).length, frames, screenshot: shot});
        }
    }
    // Exercise real scroll input and the rendered return-to-bottom control.
    const scroller = page.locator('#postListScrollContainer');
    await scroller.hover();
    const beforeScroll = await scroller.evaluate(el => el.scrollTop);
    await page.mouse.wheel(0, -700);
    await page.waitForTimeout(100);
    const afterScroll = await scroller.evaluate(el => el.scrollTop);
    const scrollingLabel = await page.locator('[data-testid="floatingTimestamp"]').evaluate(el => ({text: el.textContent, scrolling: el.classList.contains('scrolling')}));
    let returnToBottom = {attempted: false};
    const arrow = page.locator('.post-list__arrows.scrolling');
    if (await arrow.count()) {
        returnToBottom = {attempted: true};
        await arrow.click();
        await page.waitForTimeout(800);
        returnToBottom.metrics = await scroller.evaluate(el => ({top: el.scrollTop, height: el.scrollHeight, viewport: el.clientHeight}));
    }
    await page.screenshot({path: path.join(out, `${phase}-after-manual-scroll.png`)});
    await context.close();
    const desktop = await browser.newContext({viewport: {width: 1280, height: 900}, timezoneId: 'UTC'});
    await desktop.request.post(origin + '/api/v4/users/login', {data: {login_id: fixture.username, password: fixture.password}});
    const desktopPage = await desktop.newPage();
    await desktopPage.goto(`${origin}/${fixture.team}/channels/dos-dias`);
    await desktopPage.locator('#postListScrollContainer').waitFor({state: 'visible'});
    const desktopFloatingCount = await desktopPage.locator('[data-testid="floatingTimestamp"]').count();
    await desktopPage.screenshot({path: path.join(out, `${phase}-desktop.png`)});
    await desktop.close();
    const result = {phase, viewport: {width: 390, height: 844}, trials, errors, desktopFloatingCount,
        manualScroll: {beforeScroll, afterScroll, moved: beforeScroll !== afterScroll, scrollingLabel}, returnToBottom};
    fs.writeFileSync(path.join(out, `${phase}-results.json`), JSON.stringify(result, null, 2));
    return result;
}

async function main() {
    fs.mkdirSync(out, {recursive: true});
    const browser = await chromium.launch({headless: true});
    const results = [];
    try {
        for (const [phase, source] of [['baseline', baseline], ['fixed', fixed]]) {
            fs.writeFileSync(component, source);
            const log = fs.openSync(path.join(out, `${phase}-webpack.log`), 'w');
            const child = spawn(process.execPath, [path.join(root, 'webapp/node_modules/webpack-cli/bin/cli.js'), 'serve', '--mode', 'development', '--host', '127.0.0.1'], {
                cwd: path.join(root, 'webapp/channels'), detached: true,
                env: {...process.env, NODE_OPTIONS: '--max-old-space-size=6144'}, stdio: ['ignore', log, log],
            });
            try {await waitForApp(child); results.push(await capture(browser, phase));}
            finally {
                if (child.exitCode === null) process.kill(-child.pid, 'SIGTERM');
                await pause(2000);
                fs.closeSync(log);
            }
        }
        const reproduced = results[0].trials.some(t => t.wrongVisibleFrames > 0);
        const fixedWrongDate = results[1].trials.some(t => t.wrongVisibleFrames > 0);
        const summary = {baselineReproduced: reproduced, fixedWrongDateObserved: fixedWrongDate,
            conclusion: reproduced ? (fixedWrongDate ? 'defect remains' : 'baseline reproduced; no wrong-date flash observed with fix') : 'baseline symptom not reproduced under this fixture; visual repair remains inconclusive',
            method: 'Real webapp, API-seeded channels, browser RAF DOM observations, screenshots and video; no forced component state',
            phases: results.map(r => ({phase: r.phase, desktopFloatingCount: r.desktopFloatingCount, manualScroll: r.manualScroll, returnToBottom: r.returnToBottom,
                trials: r.trials.map(({frames, ...t}) => t)}))};
        fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
        console.log(JSON.stringify(summary));
        if (fixedWrongDate || !results[1].manualScroll.moved || !results[1].manualScroll.scrollingLabel.scrolling || results[1].desktopFloatingCount !== 0) process.exitCode = 1;
    } finally {fs.writeFileSync(component, fixed); await browser.close();}
}
main().catch(error => {fs.writeFileSync(component, fixed); console.error(error); process.exitCode = 1;});
