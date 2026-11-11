const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const base = 'http://127.0.0.1:8065/api/v4';
let token;
async function api(method, route, body) {
    const response = await fetch(base + route, {
        method,
        headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${await response.text()}`);
    return {data: await response.json(), token: response.headers.get('Token')};
}
async function main() {
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt++) {
        try {const r = await fetch(base + '/system/ping'); if (r.ok) {ready = true; break;}} catch {}
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    if (!ready) throw new Error('Mattermost did not become ready');
    const adminPassword = crypto.randomBytes(18).toString('hex');
    await api('POST', '/users', {username: 'pswe-admin', email: 'admin@example.invalid', password: adminPassword});
    token = (await api('POST', '/users/login', {login_id: 'pswe-admin', password: adminPassword})).token;
    const password = crypto.randomBytes(18).toString('hex');
    const {data: user} = await api('POST', '/users', {username: 'pswe-visual', email: 'visual@example.invalid', password, locale: 'en'});
    const {data: team} = await api('POST', '/teams', {name: 'pswe07-visual', display_name: 'PSWE07 Visual', type: 'O'});
    await api('POST', `/teams/${team.id}/members`, {team_id: team.id, user_id: user.id});
    await api('PUT', `/users/${user.id}/preferences`, [
        {user_id: user.id, category: 'tutorial_step', name: user.id, value: '999'},
        {user_id: user.id, category: 'tutorial_step_auto_tour_status', name: user.id, value: 'true'},
    ]);
    const day = 86400000;
    const midnight = Math.floor(Date.now() / day) * day;
    const channels = [];
    for (const [name, yesterday, today] of [['dos-dias', 35, 55], ['dos-dias-corto', 35, 5], ['control-un-dia', 0, 35]]) {
        const {data: channel} = await api('POST', '/channels', {team_id: team.id, name, display_name: name, type: 'O'});
        await api('POST', `/channels/${channel.id}/members`, {user_id: user.id});
        let lastPost;
        for (const [offset, count] of [[-day, yesterday], [0, today]]) {
            for (let i = 0; i < count; i++) {
                const create_at = midnight + offset + 10 * 3600000 + i * 60000;
                const message = `[PSWE07 ${name}] ${offset < 0 ? 'Día anterior' : 'Día actual'} ${i + 1}. ` +
                    ('Mensaje de prueba con altura variable para la lista virtualizada. '.repeat(i % 4 + 1));
                const {data: post} = await api('POST', '/posts', {channel_id: channel.id, create_at, message});
                if (post.create_at !== create_at) throw new Error('Server did not preserve fixture post timestamp');
                lastPost = post.id;
            }
        }
        channels.push({id: channel.id, name, yesterday, today, lastPost});
    }
    const fixture = {username: 'pswe-visual', password, userId: user.id, team: team.name, channels};
    const filename = path.join(process.env.RUNNER_TEMP, 'pswe07-visual-fixture.json');
    fs.writeFileSync(filename, JSON.stringify(fixture), {mode: 0o600});
    const safe = {team: team.name, channels, timezone: 'UTC', method: 'Synthetic posts created by test administrator with real API timestamps'};
    fs.mkdirSync('visual-evidence', {recursive: true});
    fs.writeFileSync('visual-evidence/fixture-public.json', JSON.stringify(safe, null, 2));
    console.log('Prepared three synthetic channels; credentials remain outside evidence.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
