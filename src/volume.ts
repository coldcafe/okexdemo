import { PublicClient } from '@okfe/okex-node';
import { V3WebsocketClient } from '@okfe/okex-node';
import * as moment from 'moment';
import config from './config/index';
import dingding from './dingding';
const wss = new V3WebsocketClient(config.websocekHost);
const pClient = PublicClient(config.urlHost);

const volumeMap = {};
let lastDingTimeMap = {};

async function main(name: string, granularity: number) {
  const nameArr = name.split('-');
  const type = nameArr[nameArr.length - 1];
  let request = null;
  if (type === 'SWAP') {
    request = pClient.swap();
  }
  if (/^\d{6}$/.test(type)) {
    request = pClient.futures();
  }
  const data = await request.getCandles(name, { granularity });
  volumeMap[name] = data.slice(0, 5).map(item => {
    return {
      time: moment(item[0]).format('YYYY-MM-DD HH:mm:ss'),
      close: item[4],
      volume: parseInt(item[5], 10),
      currency_volume: item[6],
    };
  });
  wss.on('open', () => {
    console.log('websocket open!!!');
    wss.subscribe('swap/candle' + granularity + 's:' + name);
  });
  wss.on('message', (message) => {
    const obj = JSON.parse(message);
    if (obj.table && obj.table.indexOf('swap/candle') === 0) {
      const tData = obj.data[0].candle;
      const newData = {
        time: moment(tData[0]).format('YYYY-MM-DD HH:mm:ss'),
        close: tData[4],
        volume: parseInt(tData[5], 10),
        currency_volume: tData[6],
      };
      if (volumeMap[name][0].time === newData.time) {
        volumeMap[name][0] = newData;
      } else {
        for (let i = volumeMap[name].length - 1; i > 0; i --) {
          volumeMap[name][i] = volumeMap[name][i - 1];
        }
        volumeMap[name][0] = newData;
      }
      let last4VolumeSum = 0;
      for (let i = 1; i < volumeMap[name].length; i++) {
        last4VolumeSum += volumeMap[name][i].volume;
      }
      let averageVolume = last4VolumeSum / (volumeMap[name].length - 1);
      if (newData.volume > averageVolume * 5) {
        newData['name'] = name;
        sendDing(newData).catch(err => console.error(err));
      }
    }
  });
}

async function sendDing(result){
  if (!lastDingTimeMap[result.name]) {
    lastDingTimeMap[result.name] = new Date(0);
  }
  if (new Date().getTime() - lastDingTimeMap[result.name].getTime() < 180000) return;
  const text = `
### 交易量异动(${result.name})
- 时间: ${result.time}
- 价格: ${result.close}
- 交易量： ${result.currency_volume}
`;
  lastDingTimeMap[result.name] = new Date();
  await dingding(text, config.dingdingToken);
}

export function run() {
  wss.connect();
  main('BTC-USD-SWAP', 60).catch(err => console.error(err));
}