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
        if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Webpack exited: ${child.exitCode ?? child.signalCode}`);
        try {const r = await fetch(origin + '/static/root.html', {signal: AbortSignal.timeout(4000)}); if (r.ok) return;} catch {}
        await pause(2000);
    }
    throw new Error('Webapp did not become ready');
}

async function enterChannel(page, url) {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    const browserLink = page.getByRole('link', {name: 'View in Browser', exact: true});
    await Promise.race([
        page.locator('#postListScrollContainer').waitFor({state: 'visible'}),
        browserLink.waitFor({state: 'visible'}),
    ]);
    if (await browserLink.isVisible()) {
        await page.getByRole('checkbox').check();
        await browserLink.click();
    }
    await page.locator('#postListScrollContainer').waitFor({state: 'visible'});
}

async function capture(browser, phase) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, timezoneId: 'UTC', locale: 'en-US',
        recordVideo: {dir: path.join(out, phase + '-video'), size: {width: 390, height: 844}}});
    const login = await context.request.post(origin + '/api/v4/users/login', {headers: {'X-Requested-With': 'XMLHttpRequest'}, data: {login_id: fixture.username, password: fixture.password}});
    if (!login.ok()) throw new Error('Test user login failed: ' + login.status());
    const session = await context.request.get(origin + '/api/v4/users/me');
    if (!session.ok()) throw new Error('Browser session cookie not authenticated: ' + session.status());
    const csrf = (await context.cookies(origin)).find(cookie => cookie.name === 'MMCSRF')?.value;
    if (!csrf) throw new Error('Browser CSRF cookie absent');
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', error => {errors.push(error.message); fs.writeFileSync(path.join(out, phase + '-browser-errors.json'), JSON.stringify(errors, null, 2));});
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
            const viewed = await context.request.post(origin + '/api/v4/channels/members/me/view', {headers: {'X-CSRF-Token': csrf, 'X-Requested-With': 'XMLHttpRequest'}, data: {channel_id: channel.id}});
            if (!viewed.ok()) throw new Error('Could not mark fixture channel viewed: ' + viewed.status());
            await enterChannel(page, `${origin}/${fixture.team}/channels/${channel.name}`);
            await page.locator('#postListScrollContainer').waitFor({state: 'visible'});
            await page.waitForTimeout(2500);
            const frames = await page.evaluate(() => window.__dateProbe);
            const finalLabel = frames.at(-1)?.text ?? '';
            const mismatches = frames.filter(frame => frame.scrolling && frame.visible && finalLabel.toLowerCase() === 'today' && frame.text.toLowerCase() === 'yesterday');
            const shot = `${phase}-${channel.name}-${repeat}.png`;
            await page.screenshot({path: path.join(out, shot), fullPage: false});
            trials.push({channel: channel.name, repeat, navigation: 'cold', cpuThrottle: 1, finalLabel, wrongVisibleFrames: mismatches.length,
                visibleInitialFrames: frames.filter(f => f.scrolling && f.visible).length, frames, screenshot: shot});
        }
    }
    // Exercise in-app channel transitions through the rendered quick switcher.
    let spaNavigationError = null;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 2});
    try {
        for (const [index, channel] of [fixture.channels[0], fixture.channels[2], fixture.channels[1], fixture.channels[0]].entries()) {
            await page.evaluate(() => {window.__dateProbe = [];});
            await page.keyboard.press('Control+k');
            const input = page.locator('#quickSwitchInput');
            await input.waitFor({state: 'visible', timeout: 5000});
            await input.fill(channel.name);
            await page.waitForTimeout(600);
            await page.locator('#quickSwitchModal').getByTestId(channel.name).click();
            await page.waitForURL(url => url.pathname.endsWith('/channels/' + channel.name), {timeout: 10000, waitUntil: 'domcontentloaded'});
            await page.locator('#postListScrollContainer').waitFor({state: 'visible'});
            await page.waitForTimeout(2500);
            const frames = (await page.evaluate(() => window.__dateProbe)).filter(f => f.path.endsWith('/channels/' + channel.name));
            const finalLabel = frames.at(-1)?.text ?? '';
            const wrong = frames.filter(f => f.scrolling && f.visible && finalLabel.toLowerCase() === 'today' && f.text.toLowerCase() === 'yesterday');
            const shot = `${phase}-switch-${index}-${channel.name}.png`;
            await page.screenshot({path: path.join(out, shot)});
            trials.push({channel: channel.name, navigation: 'quick-switch', cpuThrottle: 2, repeat: index, finalLabel,
                wrongVisibleFrames: wrong.length, visibleInitialFrames: frames.filter(f => f.scrolling && f.visible).length, frames, screenshot: shot});
        }
    } catch (error) {
        spaNavigationError = error.message;
        await page.screenshot({path: path.join(out, `${phase}-switch-unavailable.png`)});
    }
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 1});
    await enterChannel(page, `${origin}/${fixture.team}/channels/control-un-dia`);
    await page.locator('#postListScrollContainer').waitFor({state: 'visible'});
    await page.waitForTimeout(1000);
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
    const desktopLogin = await desktop.request.post(origin + '/api/v4/users/login', {headers: {'X-Requested-With': 'XMLHttpRequest'}, data: {login_id: fixture.username, password: fixture.password}});
    if (!desktopLogin.ok()) throw new Error('Desktop login failed: ' + desktopLogin.status());
    const desktopSession = await desktop.request.get(origin + '/api/v4/users/me');
    if (!desktopSession.ok()) throw new Error('Desktop session cookie not authenticated: ' + desktopSession.status());
    const desktopPage = await desktop.newPage();
    await enterChannel(desktopPage, `${origin}/${fixture.team}/channels/dos-dias`);
    await desktopPage.locator('#postListScrollContainer').waitFor({state: 'visible'});
    await desktopPage.waitForTimeout(2500);
    const dismissOnboarding = desktopPage.getByText('No thanks, I’ll figure it out myself', {exact: true});
    if (await dismissOnboarding.isVisible()) {await dismissOnboarding.click(); await desktopPage.waitForTimeout(1000);}
    const desktopFloatingCount = await desktopPage.locator('[data-testid="floatingTimestamp"]').count();
    await desktopPage.screenshot({path: path.join(out, `${phase}-desktop.png`)});
    await desktop.close();
    const result = {phase, spaNavigationError, viewport: {width: 390, height: 844}, trials, errors, desktopFloatingCount,
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
            const child = spawn(process.execPath, [path.join(root, 'webapp/node_modules/webpack-cli/bin/cli.js'), 'serve', '--mode', 'development', '--host', '127.0.0.1', '--no-client-overlay'], {
                cwd: path.join(root, 'webapp/channels'), detached: true,
                env: {...process.env, npm_lifecycle_event: 'dev-server', NODE_OPTIONS: '--max-old-space-size=6144'}, stdio: ['ignore', log, log],
            });
            try {await waitForApp(child); results.push(await capture(browser, phase));}
            finally {
                if (child.exitCode === null && child.signalCode === null) {
                    try {process.kill(-child.pid, 'SIGTERM');} catch (error) {if (error.code !== 'ESRCH') throw error;}
                }
                await pause(2000);
                fs.closeSync(log);
            }
        }
        const reproduced = results[0].trials.some(t => t.wrongVisibleFrames > 0);
        const fixedWrongDate = results[1].trials.some(t => t.wrongVisibleFrames > 0);
        const summary = {baselineReproduced: reproduced, fixedWrongDateObserved: fixedWrongDate,
            conclusion: reproduced ? (fixedWrongDate ? 'defect remains' : 'baseline reproduced; no wrong-date flash observed with fix') : 'baseline symptom not reproduced under this fixture; visual repair remains inconclusive',
            method: 'Real webapp, API-seeded channels, browser RAF DOM observations, screenshots and video; no forced component state',
            phases: results.map(r => ({phase: r.phase, spaNavigationError: r.spaNavigationError, desktopFloatingCount: r.desktopFloatingCount, manualScroll: r.manualScroll, returnToBottom: r.returnToBottom,
                trials: r.trials.map(({frames, ...t}) => t)}))};
        fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
        console.log(JSON.stringify(summary));
        if (fixedWrongDate || !results[1].manualScroll.moved || !results[1].manualScroll.scrollingLabel.scrolling || results[1].desktopFloatingCount !== 0) process.exitCode = 1;
    } finally {
        fs.writeFileSync(component, fixed);
        for (const [index, ctx] of browser.contexts().entries()) {
            for (const [pageIndex, p] of ctx.pages().entries()) {
                await p.screenshot({path: path.join(out, `unfinished-${index}-${pageIndex}.png`)}).catch(() => {});
                const text = await p.locator('body').innerText().catch(() => 'Page not available');
                fs.writeFileSync(path.join(out, `unfinished-${index}-${pageIndex}.txt`), p.url() + '\n' + text);
            }
            await ctx.close().catch(() => {});
        }
        await browser.close();
    }
}
main().catch(error => {fs.writeFileSync(component, fixed); console.error(error); process.exitCode = 1;});
