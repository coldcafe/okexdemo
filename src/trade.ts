import { PublicClient } from '@okfe/okex-node';
import config from './config/index';
import * as bluebird from 'bluebird';
import * as moment from 'moment';
const pClient = PublicClient(config.urlHost);

async function main(name: string, granularity: number) {
  const data = await macd(name, granularity);
  let balance = 10000;
  let fee = 0;
  let btc = 0;
  data.forEach((item, i) => {
    if (item.MACD === 0) {
      return;
    }
    if (data[i - 1].MACD * item.MACD < 0) {
      if (item.DIF < item.DEA) {
        balance += item.close;
        fee += item.close * 0.0005;
        btc -= 1;
        console.log(item.time + ' ' + item.close + '卖出');
      }
      if (item.DIF > item.DEA) {
        balance -= parseFloat(item.close);
        fee += item.close * 0.0005;
        btc += 1;
        console.log(item.time + ' ' + item.close + '买入');
      }
    }
  });
  console.log('余额:' + balance);
  console.log('btc:' + btc);
  console.log('当前价格：' + data[data.length - 1].close);
  console.log('手续费:' + fee);
  console.log('总计:' + (parseFloat(data[data.length - 1].close) * btc + balance));
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
  return data.map((item, i) => {
    // const lastIntersect = getLastIntersect(MACD_ARR, i);
    // let MACD_SELECT = MACD_ARR.slice(lastIntersect, i);
    // let MAX = 0;
    // MACD_SELECT.forEach(_M => {
    //   if (_M > MAX) MAX = _M;
    // });
    // let MACD_TEND = '';
    // if (MACD_ARR[i] > MAX) {
    //   MACD_TEND = 'up';
    // } else if (MACD_ARR[i] < MAX) {
    //   MACD_TEND = 'down';
    // } else {
    //   MACD_TEND = MACD_ARR[i] > 0 ? 'up' : 'down';
    // }
    return {
      time: moment(item[0]).format('YYYY-MM-DD HH:mm:ss'),
      open: parseFloat(item[1]),
      close: parseFloat(item[4]),
      DIF: DIF_ARR[i],
      DEA: DEA_ARR[i],
      MACD: MACD_ARR[i],
      // MACD_TEND,
    };
  });
}

function getLastIntersect(MACD_ARR: any[], curIndex: number) {
  const MACD = MACD_ARR[curIndex];
  let lastIntersect = curIndex;
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
  return lastIntersect;
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
  main('BTC-USD-SWAP', 1500).catch(err => console.error(err));
}