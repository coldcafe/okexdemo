import { PublicClient } from '@okfe/okex-node';
import config from './config/index';
import * as bluebird from 'bluebird';
import * as moment from 'moment';
import dingding from './dingding';
const pClient = PublicClient(config.urlHost);

let lastDingTime = new Date(0);

async function main() {
  while (1){
    const result = await macd();
    await sendDing(result);
    await bluebird.delay(15000);
  }
}

async function sendDing(result){
  if (new Date().getTime() - lastDingTime.getTime() < 120000) return;
  if (-1 < result.DIF_DEA && result.DIF_DEA < 1) {
    console.log(result);
    const text = `
### btc(macd)
- 时间: ${result.time}
- DIF: ${result.DIF}
- DEA: ${result.DEA}
- DIF-DEA差: ${result.DIF_DEA}
`;
    await dingding(text, 'a672bf9fc4d59176275e12bff0d068a4ac9923fcd7dd5c860e97a2562e9b6836');
    lastDingTime = new Date();
  }
}

async function macd() {
  const data = await pClient.swap().getCandles('BTC-USD-SWAP', { granularity: 300});
  data.reverse();
  const EMA12_ARR = calc_EMA(data.map(i => i[4]), 12);
  const EMA26_ARR = calc_EMA(data.map(i => i[4]), 26);
  const DIF_ARR = EMA12_ARR.map((EMA12, i) => {
    return EMA12 - EMA26_ARR[i];
  });
  const DEA_ARR = calc_EMA(DIF_ARR, 9);

  return {
    time: moment(data[data.length - 1][0]).format('YYYY-MM-DD HH:mm:ss'),
    DIF: DIF_ARR[data.length - 1],
    DEA: DEA_ARR[data.length - 1],
    DIF_DEA: DIF_ARR[data.length - 1] - DEA_ARR[data.length - 1],
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
  main().catch(err => console.error(err));
}