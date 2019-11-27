import { PublicClient } from '@okfe/okex-node';
import config from './config/index';
import * as bluebird from 'bluebird';
import * as moment from 'moment';
import dingding from './dingding';
const pClient = PublicClient(config.urlHost);

const lastDingTimeMap = {};

async function main(name: string, granularity: number) {
  lastDingTimeMap[name] = new Date(0);
  while (1){
    const result = await macd(name, granularity);
    await sendDing(result);
    await bluebird.delay(15000);
  }
}

async function sendDing(result){
  if (new Date().getTime() - lastDingTimeMap[result.name].getTime() < 180000) return;
  if (-result.value * 0.0004 < result.MACD && result.MACD < result.value * 0.0004) {
    let xintai = '';
    if (result.DEA > 0) {
      xintai = '零线以上，';
    }
    if (result.DEA < 0) {
      xintai = '零线以下，';
    }
    if (result.MACD_TEND === 'up' && result.MACD < 0) {
      xintai += 'DIF准备上穿DEA';
    }
    if (result.MACD_TEND === 'up' && result.MACD > 0) {
      xintai += 'DIF已经上穿DEA';
    }
    if (result.MACD_TEND === 'down' && result.MACD > 0) {
      xintai += 'DIF准备下穿DEA';
    }
    if (result.MACD_TEND === 'down' && result.MACD < 0) {
      xintai += 'DIF已经下穿DEA';
    }
    result.xintai = xintai;
    console.log(result);
    const text = `
### MACD(${result.name})
- 时间: ${result.time}
- 形态: ${result.xintai}
- DIF: ${result.DIF}
- DEA: ${result.DEA}
- MACD: ${result.MACD}
`;
    lastDingTimeMap[result.name] = new Date();
    await dingding(text, config.dingdingToken);
  }
}

async function macd(name: string, granularity: number) {
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
  data.reverse();
  const EMA12_ARR = calc_EMA(data.map(i => i[4]), 12);
  const EMA26_ARR = calc_EMA(data.map(i => i[4]), 26);
  const DIF_ARR = EMA12_ARR.map((EMA12, i) => {
    return EMA12 - EMA26_ARR[i];
  });
  const DEA_ARR = calc_EMA(DIF_ARR, 9);
  const MACD_ARR = DIF_ARR.map((DIF, i) => {
    return (DIF - DEA_ARR[i]) * 2;
  });
  const MACD = MACD_ARR[data.length - 1];

  let lastIntersect = MACD_ARR.length - 1;
  if (MACD > 0) {
    for (let i = MACD_ARR.length - 1; i >= 0; i--) {
      if (MACD_ARR[i] < 0) {
        lastIntersect = i + 1;
        break;
      }
    }
  } else {
    for (let i = MACD_ARR.length - 1; i >= 0; i--) {
      if (MACD_ARR[i] > 0) {
        lastIntersect = i + 1;
        break;
      }
    }
  }
  let MACD_SELECT = MACD_ARR.slice(lastIntersect);
  let MACD_SUM = 0;
  MACD_SELECT.forEach(_M => {
    MACD_SUM += _M;
  });
  const average = MACD_SUM / MACD_SELECT.length;
  let MACD_TEND = '';
  if (MACD > average) {
    MACD_TEND = 'up';
  } else if (MACD < average) {
    MACD_TEND = 'down';
  } else {
    MACD_TEND = MACD > 0 ? 'up' : 'down';
  }
  return {
    name,
    value: data[data.length - 1][4],
    time: moment(data[data.length - 1][0]).format('YYYY-MM-DD HH:mm:ss'),
    DIF: DIF_ARR[data.length - 1],
    DEA: DEA_ARR[data.length - 1],
    MACD,
    MACD_TEND,
  };
}

function calc_EMA(data: number[], N: number) {
  const result = [];
  // tslint:disable-next-line:prefer-for-of
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(data[i]);
    } else {
      const EMA = ((N - 1) * result[i - 1] + 2 * data[i]) / (N + 1);
      result.push(EMA);
    }
  }
  return result;
}

export function run() {
  main('BTC-USD-SWAP', 300).catch(err => console.error(err));
  main('BSV-USD-191227', 300).catch(err => console.error(err));
}
