import { V3WebsocketClient } from '@okfe/okex-node';
import * as moment from 'moment';
import config from './config/index';
const wss = new V3WebsocketClient(config.websocekHost);

export function run() {
  wss.connect();
}

wss.on('open', () => {
    console.log('websocket open!!!');
    wss.login(config.httpkey, config.httpsecret, config.passphrase);
});

const symbol = 'LTC-USDT';
const future = '210205';

async function afterLogin() {
    // 订阅
    wss.subscribe(`futures/ticker:${symbol}-${future}`, `swap/ticker:${symbol}-SWAP`, `swap/funding_rate:${symbol}-SWAP`);
    // wss.subscribe('swap/candle300s:BTC-USD-SWAP');
}

// websocket 返回消息
wss.on('message', wsMessage);
function wsMessage(data){
    const obj = JSON.parse(data);
    const eventType = obj.event;
    if (eventType === 'login') {
        // 登录消息
        if (obj.success === true) {
            console.log('登录成功');
            afterLogin().catch(err => {
                console.error(err);
            });
        }
    }else if (eventType === undefined) {
        // 行情消息相关
        tableMsg(obj);
    }
}

const futureInfo = {
  best_ask: 0,
  best_bid: 0,
  last: 0,
};
const swapInfo = {
  best_ask: 0,
  best_bid: 0,
  last: 0,
};

const fundingInfo = {
  estimated_rate: 0,
  funding_rate: 0,
  funding_time: null,
  settlement_time: null,
};

function tableMsg(marketData){
    const tableType = marketData.table;
    if (tableType === 'futures/ticker') {
        // 行情数据
        futureInfo.best_ask = marketData.data[0].best_ask; // 卖一价
        futureInfo.best_bid = marketData.data[0].best_bid; // 买一价
        futureInfo.last = marketData.data[0].last; // 最新成交价
    } else if (tableType === 'swap/ticker') {
      // 行情数据
      swapInfo.best_ask = marketData.data[0].best_ask; // 卖一价
      swapInfo.best_bid = marketData.data[0].best_bid; // 买一价
      swapInfo.last = marketData.data[0].last; // 最新成交价
    } else if (tableType === 'swap/funding_rate') {
      fundingInfo.estimated_rate = marketData.data[0].estimated_rate;
      fundingInfo.funding_rate = marketData.data[0].funding_rate;
      fundingInfo.funding_time = moment(marketData.data[0].funding_time).format('YYYY-MM-DD HH:mm:ss');
      fundingInfo.settlement_time = moment(marketData.data[0].settlement_time).format('YYYY-MM-DD HH:mm:ss');
    } else {
      console.log(marketData.data);
    }
}

setInterval(async () => {
  const priceDiff = futureInfo.last - swapInfo.last;
  const priceDiffPercent = swapInfo.last && 100 * priceDiff / swapInfo.last;
  let text = `
${symbol}-${future}: ${futureInfo.last}
${symbol}-永续: ${swapInfo.last}
差价：${priceDiff.toFixed(2)}
差价百分比：${priceDiffPercent.toFixed(2)}
资金费率：${fundingInfo.funding_rate}
下一期预期资金费率：${fundingInfo.estimated_rate}
  `;
  console.log(text);
}, 10000);