const crypto = require('node:crypto');
const fs = require('node:fs');
const { pipeline } = require('node:stream/promises');
const { Root } = require('protobufjs');

const QueryCurrRegionHttpRsp = new Root()
  .loadSync('./Query.proto')
  .lookupType('QueryCurrRegionHttpRsp');

const log = (...args) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + (date.getDate() + 1)).slice(-2);
  const hour = ('0' + (date.getHours() + 1)).slice(-2);
  const minute = ('0' + (date.getMinutes() + 1)).slice(-2);
  const second = ('0' + (date.getSeconds() + 1)).slice(-2);
  console.log(`[${year}-${month}-${day} ${hour}:${minute}:${second}] ${args}`);
}

const data = {
  game: [
    '00/24230448.blk',
    '00/25539185.blk',
    '01/26692920.blk',
    '02/27251172.blk',
    '03/25181351.blk',
    '04/25776943.blk',
    '05/20618174.blk',
    '06/25555476.blk',
    '07/30460104.blk',
    '08/32244380.blk',
    '09/22299426.blk',
    '10/23331191.blk',
    '11/21030516.blk',
    '12/32056053.blk',
    '13/34382464.blk',
    '14/27270675.blk',
    '15/21419401.blk',
  ],
  design: [
    '00/31049740.blk',
  ],
};

(async () => {
  if (!fs.existsSync('./output')) fs.mkdirSync('./output');

  const queryCurRegionURL = '';
  log(`Configured url: ${queryCurRegionURL}`);
  const decryptKeyId = new URL(queryCurRegionURL).searchParams.get('key_id') === '5' ? 'dispatchGlobal' : 'dispatchCN';
  log(`Detected decrypt key id: ${decryptKeyId}\n`);
  const decryptKey = fs.readFileSync(`./certs/${decryptKeyId}.pem`, 'utf-8');

  log('Attempting to obtain encrypted query_cur_region data');
  const encrypted = Buffer.from(
    await fetch(queryCurRegionURL)
      .then((res) => res.json())
      .then((res) => res.content),
    'base64',
  );

  log('Attempting to decrypt the data and decode its structure\n');
  const decrypted = decryptRSA(encrypted, decryptKey);
  const { regionInfo: decoded } = QueryCurrRegionHttpRsp.decode(decrypted).toJSON();

  log(`Downloading ${data.game.length} game data file(s)`);
  for (const game of data.game) {
    await download(`${decoded.dataUrl}/output_${decoded.clientDataVersion}_${decoded.clientVersionSuffix}/client/General/AssetBundles/blocks/${game}`, `./output/${game.split('/').pop()}`);
  }

  log(`Downloading ${data.design.length} game design file(s)`);
  for (const game of data.design) {
    await download(`${decoded.resourceUrl}/output_${decoded.resVersionConfig.version}_${decoded.resVersionConfig.versionSuffix}/client/StandaloneWindows64/AssetBundles/blocks/${game}`, `./output/${game.split('/').pop()}`);
  }
  log('Done! check ./output folder');
})();

function decryptRSA(buffer, key, chunkSize = 256) {
  const chunks = [];
  for (let i = 0; i < buffer.length; i += chunkSize) {
    chunks.push(buffer.slice(i, i + chunkSize));
  }

  const decryptedChunks = chunks.map(chunk => crypto.privateDecrypt({
    key,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  }, chunk));

  return Buffer.concat(decryptedChunks);
}

async function download(url, path) {
  log(url);
  return pipeline(
    await fetch(url).then((res) => res.body),
    fs.createWriteStream(path),
  );
}
