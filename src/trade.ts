import { PublicClient } from '@okfe/okex-node';
import config from './config/index';
import * as bluebird from 'bluebird';
import * as moment from 'moment';
const pClient = PublicClient(config.urlHost);

async function main(name: string, granularity: number) {
  const data = await macd(name, granularity);
  let lastTradeTime;
  let lastTradePrice;
  let balance = 50000;
  let fee = 0;
  let btc = 0;
  function buy(time: string, price: number, num: number) {
    if (num <= 0) return;
    balance -= price * num;
    fee += price * num * 0.0005;
    btc += num;
    lastTradeTime = new Date(time);
    lastTradePrice = price;
    console.log(dateFormat(time) + ' ' + price + '买入 ' + num, price * btc + balance);
  }
  function sell(time: string, price: number, num: number) {
    if (num <= 0) return;
    balance += price * num;
    fee += price * num * 0.0005;
    btc -= num;
    lastTradeTime = new Date(time);
    lastTradePrice = price;
    console.log(dateFormat(time) + ' ' + price + '卖出 ' + num, price * btc + balance);
  }
  function v1(i: number) {
    if (data[i].MACD === 0) {
      return;
    }
    if (data[i - 1].DIF * data[i].DIF < 0) {
      if (data[i].DIF > 0) {
        if (btc < 1)
          buy(data[i].time, data[i].close, 1);
      }
      if (data[i].DIF < 0) {
        if (btc > 0)
          sell(data[i].time, data[i].close, btc);
      }
    }
    if (data[i - 1].MACD * data[i].MACD < 0) {
      if (data[i].DIF < data[i].DEA) {
        let num = 0;
        if (data[i].DIF < 0) {
          num = btc + 1;
        } else {
          num = btc - 1;
        }
        sell(data[i].time, data[i].close, num);
      }
      if (data[i].DIF > data[i].DEA) {
        let num = 0;
        if (data[i].DIF > 0) {
          num = 2 - btc;
        } else {
          num = 1 - btc;
        }
        buy(data[i].time, data[i].close, num);
      }
    }
  }
  function v2(i: number) {
    if (data[i - 1].DIF * data[i].DIF > 0) {
      if (btc > 0) {
        if (new Date().getTime() > lastTradeTime.getTime() + 120000 && data[i].close < lastTradePrice) {
          sell(data[i].time, data[i].close, btc);
        }
      }
      if (btc < 0) {
        if (new Date().getTime() > lastTradeTime.getTime() + 120000 && data[i].close > lastTradePrice) {
          buy(data[i].time, data[i].close, 0 - btc);
        }
      }
    }
  }
  data.forEach((item, i) => {
    if (new Date(item.time).getTime() < new Date('2019-11-29 20:00:00').getTime()) {
      return;
    }
    v1(i);
    v2(i);
  });
  console.log('余额:' + balance);
  console.log('btc:' + btc);
  console.log('当前价格：' + data[data.length - 1].close);
  console.log('手续费:' + fee);
  console.log('总计:' + (data[data.length - 1].close * btc + balance));
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
  let end = new Date().toISOString();
  let data = [];
  for (let i = 0; i < 10; i++) {
    const _data = await request.getCandles(name, { granularity, end });
    data = data.concat(_data);
    end = _data[_data.length - 1][0];
  }
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
      time: item[0],
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

function dateFormat(date: string) {
  return moment(date).format('YYYY-MM-DD HH:mm:ss');
}

export function run() {
  main('BTC-USD-SWAP', 60).catch(err => console.error(err));
}