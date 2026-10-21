import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';

let transfer;
axios.defaults.adapter = config => transfer(config);
const { uploadTutorial, tutorialUploadError } = await import('../src/lib/tutorialUpload.js');
const failure = status => Object.assign(new Error('request failed'), { response: { status } });

test('continues with received parts after retries fail; never sends the CRM token to storage', async () => {
  const file = new File(['12345678'], 'example.mp4', { type: 'video/mp4' });
  let firstReceived = false, failSecond = true, firstTransfers = 0, secondTransfers = 0, finalCalls = 0;
  transfer = async config => {
    assert.equal(config.headers.Authorization, undefined);
    assert.equal(config.withCredentials, false);
    if (config.url.endsWith('/1')) { firstTransfers++; firstReceived = true; }
    else { secondTransfers++; if (failSecond) throw failure(502); }
    return { data: '', status: 200, config };
  };
  const api = { post: async (url, data) => {
    if (url.endsWith('/complete')) {
      finalCalls++;
      // First confirmation was accepted but its response was lost.
      if (finalCalls === 1) throw failure(502);
      return { data: { id: 42 } };
    }
    assert.equal(data.id, 'stable-attempt');
    assert(!('file' in data));
    return { data: { parts: [
      { number: 1, start: 0, size: 4, received: firstReceived, url: 'https://s3.test.backblazeb2.com/1' },
      { number: 2, start: 4, size: 4, received: false, url: 'https://s3.test.backblazeb2.com/2' },
    ] } };
  } };
  const request = { id: 'stable-attempt', title: 'Test', description: '', file };
  await assert.rejects(uploadTutorial(api, request));
  assert.equal(firstTransfers, 1);
  assert.equal(secondTransfers, 3);
  assert.equal(finalCalls, 0);
  failSecond = false;
  const progress = [];
  assert.deepEqual(await uploadTutorial(api, request, event => progress.push(event)), { data: { id: 42 } });
  assert.equal(firstTransfers, 1);
  assert.equal(secondTransfers, 4);
  assert.equal(finalCalls, 2);
  assert.equal(progress.at(-1).percent, 100);
  assert(progress.slice(0, -1).every(event => event.percent < 100));
});

test('already published response skips transfer and finalization', async () => {
  transfer = () => { throw new Error('must not transfer again'); };
  const api = { post: async () => ({ data: { tutorial: { id: 42 }, parts: [] } }) };
  assert.deepEqual(await uploadTutorial(api, { id: 'existing', file: new File(['1'], 'x.mp4') }), { data: { id: 42 } });
});

test('server errors identify the server and preserve actionable storage errors', () => {
  assert.match(tutorialUploadError(failure(502)), /servidor.*502/);
  assert.doesNotMatch(tutorialUploadError(failure(502)), /Revisa tu conexión/);
  assert.match(tutorialUploadError(failure(401)), /sesión/);
  assert.match(tutorialUploadError({ response: { status: 503, data: { detail: 'Falta configurar Backblaze.' } } }), /Falta configurar/);
});
