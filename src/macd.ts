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
    console.log(result);
    let xintai = '';
    if (result.DEA > 0) {
      xintai = '零线以上，DIF与DEA趋近相交';
    }
    if (result.DEA < 0) {
      xintai = '零线以下，DIF与DEA趋近相交';
    }
    const text = `
### MACD(${result.name})
- 时间: ${result.time}
- 形态: ${xintai}
- DIF: ${result.DIF}
- DEA: ${result.DEA}
- MACD: ${result.MACD}
`;
    await dingding(text, 'a672bf9fc4d59176275e12bff0d068a4ac9923fcd7dd5c860e97a2562e9b6836');
    lastDingTimeMap[result.name] = new Date();
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

  return {
    name,
    value: data[data.length - 1][4],
    time: moment(data[data.length - 1][0]).format('YYYY-MM-DD HH:mm:ss'),
    DIF: DIF_ARR[data.length - 1],
    DEA: DEA_ARR[data.length - 1],
    MACD: (DIF_ARR[data.length - 1] - DEA_ARR[data.length - 1]) * 2,
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
